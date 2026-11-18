// Server route helpers. Keys and document contents are never logged or persisted.
import { FLOW_AI_INSTRUCTIONS, FLOW_AI_SCHEMA, parseResponseOutput, validateMarkdown } from "./flowchart-ai";

export class FlowAIError extends Error {
  constructor(message: string, public status: number) { super(message); }
}
export async function readBoundedJson(source: Request | Response, maxBytes: number): Promise<unknown> {
  if (Number(source.headers.get("content-length") ?? 0) > maxBytes) throw new FlowAIError("요청 또는 응답이 너무 큽니다. 문서를 나눠 주세요.", 413);
  const reader = source.body?.getReader();
  if (!reader) throw new FlowAIError("요청 내용을 읽을 수 없습니다.", 400);
  const chunks: Uint8Array[] = []; let size = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read(); if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new FlowAIError("요청 또는 응답이 너무 큽니다. 문서를 나눠 주세요.", 413); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new FlowAIError("JSON 텍스트를 읽을 수 없습니다.", 400); }
}
interface FirestoreDocument { fields?: Record<string, { stringValue?: string; booleanValue?: boolean; arrayValue?: { values?: { stringValue?: string }[] } }> }
export async function requireFlowAccess(sessionId: string, token: string, signal: AbortSignal) {
  const project = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const firebaseKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  if (!project || !firebaseKey) throw new FlowAIError("인증 설정을 확인할 수 없습니다. 관리자에게 문의해 주세요.", 503);
  const emulator = process.env.NODE_ENV !== "production" && process.env.NEXT_PUBLIC_USE_EMULATOR === "1" && project.startsWith("demo-");
  const authOrigin = emulator ? `http://127.0.0.1:${Number(process.env.NEXT_PUBLIC_EMULATOR_AUTH_PORT || 9099)}/identitytoolkit.googleapis.com` : "https://identitytoolkit.googleapis.com";
  const firestoreOrigin = emulator ? `http://127.0.0.1:${Number(process.env.NEXT_PUBLIC_EMULATOR_FIRESTORE_PORT || 8080)}` : "https://firestore.googleapis.com";
  const authResult = await fetch(`${authOrigin}/v1/accounts:lookup?key=${encodeURIComponent(firebaseKey)}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ idToken: token }), cache: "no-store", redirect: "error", signal,
  });
  if (!authResult.ok) throw new FlowAIError("로그인을 확인할 수 없습니다. 보드에 다시 입장해 주세요.", 401);
  const account = await authResult.json() as { users?: { localId?: string; email?: string; disabled?: boolean }[] };
  const user = account.users?.[0];
  if (!user?.localId || user.disabled) throw new FlowAIError("보드에 다시 입장해 주세요.", 401);
  async function document(path: string): Promise<FirestoreDocument | null> {
    const response = await fetch(`${firestoreOrigin}/v1/projects/${encodeURIComponent(project!)}/databases/(default)/documents/${path}`, {
      headers: { Authorization: `Bearer ${token}` }, cache: "no-store", redirect: "error", signal,
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new FlowAIError("보드 접근 권한을 확인하지 못했습니다.", 403);
    return response.json();
  }
  const base = `sessions/${encodeURIComponent(sessionId)}`;
  const [session, participant] = await Promise.all([document(base), document(`${base}/participants/${encodeURIComponent(user.localId)}`)]);
  if (!session) throw new FlowAIError("보드를 찾을 수 없습니다.", 404);
  // Same owner/super-admin policy as Firestore flowchart writes.
  const admin = session.fields?.createdBy?.stringValue === user.localId || user.email?.toLowerCase() === "jongbin@gmail.com";
  if (!admin && (!participant || session.fields?.locked?.booleanValue)) throw new FlowAIError("보드 참여 권한 또는 잠금 상태를 확인해 주세요.", 403);
  const name = participant?.fields?.name?.stringValue?.trim().toLowerCase();
  if (name && session.fields?.blockedNames?.arrayValue?.values?.some(v => v.stringValue?.trim().toLowerCase() === name)) throw new FlowAIError("관리자에 의해 사용이 제한되었습니다.", 403);
}

export async function generateFlow(markdown: string, model: string, apiKey: string, signal: AbortSignal) {
  validateMarkdown(markdown);
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
    cache: "no-store", redirect: "error", signal,
    body: JSON.stringify({ model, store: false, instructions: FLOW_AI_INSTRUCTIONS,
      input: [{ role: "user", content: [{ type: "input_text", text: markdown }] }],
      text: { format: { type: "json_schema", name: "business_workflow", strict: true, schema: FLOW_AI_SCHEMA } }, max_output_tokens: 16000 }),
  });
  if (!response.ok) {
    // Do not forward provider error bodies: they may contain submitted secrets or source text.
    if (response.status === 401 || response.status === 403) throw new FlowAIError("OpenAI API 키 또는 해당 모델 사용 권한을 확인해 주세요.", 400);
    if (response.status === 429) throw new FlowAIError("OpenAI 사용 한도·잔액 또는 요청 빈도를 확인하고 다시 시도해 주세요.", 429);
    if (response.status === 400 || response.status === 404) throw new FlowAIError("이 모델에서 구조화된 흐름도 생성을 사용할 수 없습니다. 모델 ID를 확인해 주세요.", 400);
    throw new FlowAIError("OpenAI 서비스가 응답하지 못했습니다. 잠시 후 다시 시도해 주세요.", 502);
  }
  try { return parseResponseOutput(await readBoundedJson(response, 1024 * 1024)); }
  catch (error) { throw new FlowAIError(error instanceof Error ? error.message : "AI 결과를 읽지 못했습니다.", 502); }
}
