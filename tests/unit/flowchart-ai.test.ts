import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/flowcharts/generate/route";
import { parseGeneratedFlow, parseResponseOutput, validateMarkdown } from "@/lib/flowchart-ai";
import { readBoundedJson } from "@/lib/flowchart-ai-server";

const node = (id: string) => ({ id, label: `업무 ${id}`, kind: "step", organization: "영업팀", owner: "담당자", input: "요청서", output: "견적", system: "ERP", issue: "", improvement: "", action: null, minutes: null, waitMinutes: null });
const generated = () => ({ title: "견적 업무", nodes: [node("a"), { ...node("b"), organization: "재무팀", minutes: 0 }], edges: [{ from: "a", to: "b", label: "확인", kind: "handoff", deliverable: "견적서", agreement: "금액 확인" }], warnings: ["처리 시간이 명시되지 않았습니다."] });
const response = (value = generated()) => ({ status: "completed", output: [{ type: "reasoning" }, { type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }] });
afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("Markdown to workflow", () => {
  it("normalizes IDs and preserves unknown time separately from explicit zero", () => {
    const { flow } = parseResponseOutput(response());
    expect(flow.layout).toBe("organization");
    expect(flow.nodes.map(n => n.id)).toEqual(["ai-node-1", "ai-node-2"]);
    expect(flow.edges[0].from).toBe(flow.nodes[0].id);
    expect(flow.nodes[0].work?.minutes).toBeUndefined();
    expect(flow.nodes[1].work?.minutes).toBe(0);
    expect(flow.edges[0].collaboration?.deliverable).toBe("견적서");
  });
  it("rejects missing steps, duplicate IDs, unknown endpoints and unsafe values", () => {
    const invalid = [
      { ...generated(), nodes: [] },
      { ...generated(), nodes: [node("a"), node("a")] },
      { ...generated(), edges: [{ ...generated().edges[0], to: "missing" }] },
      { ...generated(), edges: [generated().edges[0], generated().edges[0]] },
      { ...generated(), nodes: [{ ...node("a"), action: "unknown" }, node("b")] },
      { ...generated(), nodes: [{ ...node("a"), minutes: -1 }, node("b")] },
    ];
    invalid.forEach(value => expect(() => parseGeneratedFlow(value)).toThrow());
  });
  it("does not accept refusal, truncated or malformed output", () => {
    expect(() => parseResponseOutput({ ...response(), status: "incomplete" })).toThrow("중단");
    expect(() => parseResponseOutput({ status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }] })).toThrow("거절");
    expect(() => parseResponseOutput({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: "not JSON" }] }] })).toThrow("읽지");
    expect(() => validateMarkdown(" ")).toThrow();
    expect(() => validateMarkdown("한".repeat(50000))).toThrow();
    expect(() => validateMarkdown("a".repeat(60001))).toThrow();
  });
  it("limits streamed bodies even when content-length is missing", async () => {
    await expect(readBoundedJson(new Response("a".repeat(101)), 100)).rejects.toMatchObject({ status: 413 });
  });
});

const body = { sessionId: "board-test", apiKey: "sk-test-placeholder-only", model: "gpt-4o-mini", markdown: "# 업무\n요청 접수 후 견적서를 재무팀에 전달합니다." };
const request = (values = body, headers: Record<string, string> = {}) => new Request("https://padolet.test/api/flowcharts/generate", { method: "POST", headers: { origin: "https://padolet.test", "content-type": "application/json", authorization: "Bearer test-firebase-token", ...headers }, body: JSON.stringify(values) });
function setup({ member = true, locked = false, providerStatus = 200, authStatus = 200 } = {}) {
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "test-project"); vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "public-firebase-key"); vi.stubEnv("NEXT_PUBLIC_USE_EMULATOR", "0");
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith("https://identitytoolkit.googleapis.com/")) return Response.json({ users: [{ localId: "student" }] }, { status: authStatus });
    if (url.includes("/participants/")) return Response.json(member ? { fields: { name: { stringValue: "교육생" } } } : {}, { status: member ? 200 : 404 });
    if (url.startsWith("https://firestore.googleapis.com/")) return Response.json({ fields: { createdBy: { stringValue: "teacher" }, locked: { booleanValue: locked } } });
    if (url === "https://api.openai.com/v1/responses") {
      expect(init?.redirect).toBe("error");
      return Response.json(providerStatus === 200 ? response() : { error: { message: `echo ${body.apiKey}` } }, { status: providerStatus });
    }
    throw new Error("Unexpected URL");
  });
  vi.stubGlobal("fetch", fetch); return fetch;
}
describe("AI generation server boundary", () => {
  it("verifies membership, sends a constrained response request and never returns the API key", async () => {
    const fetch = setup();
    const res = await POST(request()); expect(res.status).toBe(200);
    const data = await res.json(); expect(data.flow.nodes).toHaveLength(2);
    expect(JSON.stringify(data)).not.toContain(body.apiKey);
    expect(res.headers.get("cache-control")).toBe("no-store");
    const call = fetch.mock.calls.find(c => c[0] === "https://api.openai.com/v1/responses")!;
    const payload = JSON.parse(call[1]!.body as string);
    expect(payload.store).toBe(false); expect(payload.text.format.strict).toBe(true);
    expect(payload.input[0].content[0].text).toBe(body.markdown);
    expect(payload).not.toHaveProperty("tools");
    expect(JSON.stringify(payload)).not.toContain(body.apiKey);
  });
  it.each([{ member: false }, { locked: true }, { authStatus: 401 }])("rejects unauthorized generation before contacting OpenAI: %j", async options => {
    const fetch = setup(options);
    expect((await POST(request())).status).toBe(options.authStatus ? 401 : 403);
    expect(fetch.mock.calls.some(c => c[0].includes("api.openai.com"))).toBe(false);
  });
  it("rejects cross-origin, missing auth and invalid text without upstream requests", async () => {
    const fetch = setup();
    expect((await POST(request(body, { origin: "https://other.test" }))).status).toBe(403);
    expect((await POST(request(body, { authorization: "" }))).status).toBe(401);
    expect((await POST(request({ ...body, markdown: " " }))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([401, 429, 500])("returns a safe message for provider %i errors", async providerStatus => {
    setup({ providerStatus }); const res = await POST(request());
    expect(res.ok).toBe(false); expect(await res.text()).not.toContain(body.apiKey);
  });
});
