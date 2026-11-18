import { validateMarkdown } from "@/lib/flowchart-ai";
import { FlowAIError, generateFlow, readBoundedJson, requireFlowAccess } from "@/lib/flowchart-ai-server";

export const runtime = "nodejs";
export const maxDuration = 120;
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request) {
  const timeout = AbortSignal.timeout(90000);
  const signal = AbortSignal.any([request.signal, timeout]);
  try {
    if (request.headers.get("origin") !== new URL(request.url).origin) return json({ error: "보드 화면에서 요청해 주세요." }, 403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return json({ error: "JSON 요청이 필요합니다." }, 415);
    const token = request.headers.get("authorization")?.match(/^Bearer ([^\s]+)$/)?.[1];
    if (!token || token.length > 16000) return json({ error: "보드에 다시 입장해 주세요." }, 401);
    const raw = await readBoundedJson(request, 256 * 1024);
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) return json({ error: "요청 형식이 올바르지 않습니다." }, 400);
    const { sessionId, apiKey, model, markdown, mode = "understand" } = raw as Record<string, unknown>;
    if (typeof sessionId !== "string" || !/^[a-zA-Z0-9_-]{1,128}$/.test(sessionId)
      || typeof apiKey !== "string" || !/^[\x21-\x7e]{10,4096}$/.test(apiKey)
      || typeof model !== "string" || !/^[a-zA-Z0-9_.:-]{1,120}$/.test(model)
      || typeof markdown !== "string" || !["understand", "actual", "example"].includes(mode as string)) return json({ error: "API 키·모델·문서 입력을 확인해 주세요." }, 400);
    try { validateMarkdown(markdown); } catch (error) { return json({ error: (error as Error).message }, 400); }
    await requireFlowAccess(sessionId, token, AbortSignal.any([signal, AbortSignal.timeout(15000)]));
    // Old clients may still send actual/example; all AI requests now understand the full document.
    return json(await generateFlow(markdown, model, apiKey, signal));
  } catch (error) {
    if (error instanceof FlowAIError) return json({ error: error.message }, error.status);
    if (signal.aborted || (error instanceof Error && ["AbortError", "TimeoutError"].includes(error.name))) return json({ error: "요청이 취소되었거나 제한 시간을 초과했습니다. 문서를 나눠 다시 시도해 주세요." }, 504);
    return json({ error: "AI 연결을 완료하지 못했습니다. 연결 상태를 확인하고 다시 시도해 주세요." }, 502);
  }
}
