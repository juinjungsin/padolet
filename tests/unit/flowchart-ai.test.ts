import { afterEach, describe, expect, it, vi } from "vitest";
import { POST } from "@/app/api/flowcharts/generate/route";
import { exampleProcedureDraft, exampleProcedureSteps, markExampleFlow, parseGeneratedFlow, parseResponseOutput, validateMarkdown } from "@/lib/flowchart-ai";
import { exampleTemplate } from "../support/flowchart-example";
import { readBoundedJson } from "@/lib/flowchart-ai-server";
import { understandingToFlow } from "@/lib/flowchart-understanding";

const node = (id: string) => ({ id, label: `업무 ${id}`, kind: "step", organization: "영업팀", owner: "담당자", input: "요청서", output: "견적", system: "ERP", issue: "", improvement: "", action: null, minutes: null, waitMinutes: null });
const generated = () => ({ title: "견적 업무", nodes: [node("a"), { ...node("b"), organization: "재무팀", minutes: 0 }], edges: [{ from: "a", to: "b", label: "확인", kind: "handoff", deliverable: "견적서", agreement: "금액 확인" }], warnings: ["처리 시간이 명시되지 않았습니다."] });
const response = (value = generated()) => ({ status: "completed", output: [{ type: "reasoning" }, { type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }] });
const understood = () => ({ title: "견적 업무", purpose: "요청 접수를 시작으로 견적서를 작성하여 재무팀에 전달하는 업무입니다.", documentKind: "actual",
  activities: [
    { id: "receive", action: "요청 접수", kind: "step", organization: "", owner: "", input: "요청", output: "접수된 요청", system: "", basis: "explicit", evidence: "요청 접수", minutes: null, waitMinutes: null },
    { id: "prepare", action: "견적 작성", kind: "step", organization: "", owner: "", input: "접수된 요청", output: "견적서", system: "", basis: "inferred", evidence: "견적서를 재무팀에 전달", minutes: null, waitMinutes: null },
  ], relationships: [{ from: "receive", to: "prepare", condition: "요청을 바탕으로 작성", kind: "sequence", deliverable: "요청", basis: "inferred", evidence: "요청 접수 후 견적서" }], warnings: [] });
const understandingResponse = (value: unknown = understood()) => ({ status: "completed", output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }] });
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
const request = (values: typeof body & { mode?: string } = body, headers: Record<string, string> = {}) => new Request("https://padolet.test/api/flowcharts/generate", { method: "POST", headers: { origin: "https://padolet.test", "content-type": "application/json", authorization: "Bearer test-firebase-token", ...headers }, body: JSON.stringify(values) });
function setup({ member = true, locked = false, providerStatus = 200, authStatus = 200, providerBody = understandingResponse() as unknown } = {}) {
  vi.stubEnv("NEXT_PUBLIC_FIREBASE_PROJECT_ID", "test-project"); vi.stubEnv("NEXT_PUBLIC_FIREBASE_API_KEY", "public-firebase-key"); vi.stubEnv("NEXT_PUBLIC_USE_EMULATOR", "0");
  const fetch = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.startsWith("https://identitytoolkit.googleapis.com/")) return Response.json({ users: [{ localId: "student" }] }, { status: authStatus });
    if (url.includes("/participants/")) return Response.json(member ? { fields: { name: { stringValue: "교육생" } } } : {}, { status: member ? 200 : 404 });
    if (url.startsWith("https://firestore.googleapis.com/")) return Response.json({ fields: { createdBy: { stringValue: "teacher" }, locked: { booleanValue: locked } } });
    if (url === "https://api.openai.com/v1/responses") {
      expect(init?.redirect).toBe("error");
      return Response.json(providerStatus === 200 ? providerBody : { error: { message: `echo ${body.apiKey}` } }, { status: providerStatus });
    }
    throw new Error("Unexpected URL");
  });
  vi.stubGlobal("fetch", fetch); return fetch;
}
describe("AI generation server boundary", () => {
  it.each([undefined, "actual", "example", "understand"])("understands the document for new and old clients (mode %s)", async mode => {
    const fetch = setup();
    const res = await POST(request({ ...body, mode }));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.understanding.purpose).toContain("견적서를 작성");
    expect(data.flow.nodes[1].label).toBe("[추정] 견적 작성");
    expect(data.flow.edges[0].label).toContain("[추정]");
    expect(data.flow.nodes[1].work.issue).toContain("근거: 견적서를 재무팀에 전달");
    const calls = fetch.mock.calls.filter(c => c[0].includes("api.openai.com"));
    expect(calls).toHaveLength(1);
    const payload = JSON.parse(calls[0][1]!.body as string);
    expect(payload.text.format.name).toBe("document_understanding");
    expect(payload.text.format.schema.properties.activities.minItems).toBe(1);
    expect(payload.instructions).toContain("문서 전체를 이해");
  });
  it("rejects invalid modes before spending API usage", async () => {
    const fetch = setup();
    expect((await POST(request({ ...body, mode: "invent" }))).status).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it.each([
    { ...understandingResponse(), status: "incomplete" },
    { status: "completed", output: [{ type: "message", content: [{ type: "refusal", refusal: "no" }] }] },
    understandingResponse({ ...understood(), activities: [] }),
  ])("never invents a successful graph from rejected or incomplete analysis", async providerBody => {
    setup({ providerBody });
    expect((await POST(request())).status).toBe(502);
  });
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

describe("document understanding to diagram", () => {
  it("renders source-backed activities without requiring numbered procedures or known owners", () => {
    const result = understandingToFlow(understood(), body.markdown);
    expect(result.flow.nodes).toHaveLength(2);
    expect(result.flow.nodes[0].work?.owner).toBe("");
    expect(result.flow.nodes[1].label).toBe("[추정] 견적 작성");
    expect(result.flow.edges).toHaveLength(1);
  });
  it("uses template examples as activities and preserves branch conditions", () => {
    const source = "목적: 자료 대조\n[예: 금액을 비교한다.]\n[예: 금액이 다르면 차이를 보고한다.]";
    const v = understood(); v.documentKind = "example";
    v.activities = v.activities.map((a, i) => ({ ...a, kind: i ? "step" : "decision", basis: "example", evidence: i ? "금액이 다르면 차이를 보고한다." : "금액을 비교한다.", action: i ? "차이 보고" : "금액 일치?" }));
    v.relationships[0] = { ...v.relationships[0], basis: "example", condition: "불일치", evidence: "금액이 다르면 차이를 보고한다." };
    const result = understandingToFlow(v, source);
    expect(result.flow.title).toMatch(/^\[예시 초안\]/);
    expect(result.flow.nodes[0].kind).toBe("decision");
    expect(result.flow.edges[0].label).toBe("[예시] 불일치");
    expect(result.flow.nodes.every(n => n.work?.minutes === undefined)).toBe(true);
  });
  it.each(["fabricated evidence", "bad endpoint", "duplicate activity"])("rejects %s", scenario => {
    const v = understood();
    if (scenario === "fabricated evidence") v.activities[0].evidence = "원문에 없는 내용";
    if (scenario === "bad endpoint") v.relationships[0].to = "missing";
    if (scenario === "duplicate activity") v.activities[1].id = v.activities[0].id;
    expect(() => understandingToFlow(v, body.markdown)).toThrow();
  });
});

describe("example template extraction", () => {
  it("copies five explicit steps without inventing roles or importing sample metrics", () => {
    const draft = exampleProcedureDraft(exampleTemplate)!;
    expect(draft.flow.nodes).toHaveLength(5); expect(draft.flow.edges).toHaveLength(4);
    expect(draft.flow.nodes.map(n => n.label)).toEqual(exampleProcedureSteps(exampleTemplate));
    expect(draft.flow.nodes.every(n => !n.work)).toBe(true);
    expect(JSON.stringify(draft.flow)).not.toMatch(/예시지점|100건|95건|30분/);
    draft.flow.edges.forEach((edge, i) => {
      expect(edge.from).toBe(draft.flow.nodes[i].id); expect(edge.to).toBe(draft.flow.nodes[i + 1].id);
    });
  });
  it.each([
    "# 업무\n## 절차\n1. 접수한다.\n2. 검토한다.",
    "# 업무\n## 절차\n1. [예: 접수한다.]\n2. 실제 검토한다.",
    "# 업무\n## 절차\n1. [예: 접수한다.]\n3. [예: 검토한다.]",
    "# 빈 양식\n## 절차\n1. [내용]\n2. [내용]",
    exampleTemplate + "\n## 다른 절차\n1. [예: 접수]\n2. [예: 완료]",
  ])("does not invent or merge ambiguous procedures", markdown => {
    expect(exampleProcedureDraft(markdown)).toBeNull();
  });
  it("does not mutate original results when removing example durations", () => {
    const original = parseGeneratedFlow(generated());
    const marked = markExampleFlow(original);
    expect(original.flow.nodes[1].work?.minutes).toBe(0);
    expect(marked.flow.nodes[1].work?.minutes).toBeUndefined();
    expect(markExampleFlow(marked).flow.title).toBe(marked.flow.title);
  });
});
