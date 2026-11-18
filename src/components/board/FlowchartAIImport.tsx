"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { auth } from "@/lib/firebase";
import { Flowchart, FlowView, flowBounds, validFlowchart } from "@/lib/flowchart";
import { DEFAULT_FLOW_MODEL, FLOW_MODEL_OPTIONS, FlowExtractionMode, GeneratedFlow, MAX_MARKDOWN_BYTES, exampleProcedureDraft, validateMarkdown } from "@/lib/flowchart-ai";
import { diagnoseWorkflow } from "@/lib/workflow";
import FlowCanvas from "./FlowCanvas";
import WorkflowDetails from "./WorkflowDetails";

const field = "w-full min-w-0 border border-silver-mist rounded-lg p-2 bg-white text-sm";
const button = "border border-silver-mist rounded-lg px-3 py-2 text-sm bg-white hover:bg-blue-50 disabled:opacity-40";
export default function FlowchartAIImport({ sessionId, editable, onApply }: { sessionId: string; editable: boolean; onApply: (flow: Flowchart) => boolean }) {
  const [apiKey, setApiKey] = useState("");
  const [modelChoice, setModelChoice] = useState(DEFAULT_FLOW_MODEL);
  const [customModel, setCustomModel] = useState("");
  const model = modelChoice === "custom" ? customModel : modelChoice;
  const [markdown, setMarkdown] = useState("");
  const [mode, setMode] = useState<FlowExtractionMode>("actual");
  const exampleDraft = useMemo(() => exampleProcedureDraft(markdown), [markdown]);
  const [fileName, setFileName] = useState("");
  const [reading, setReading] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState<GeneratedFlow | null>(null);
  const [view, setView] = useState<FlowView>({ x: 0, y: 0, width: 1000, height: 640 });
  const [selected, setSelected] = useState<string | null>(null);
  const active = useRef<AbortController | null>(null);
  const fileRead = useRef(0);
  useEffect(() => () => { active.current?.abort(); fileRead.current++; }, []);
  useEffect(() => { if (!editable) active.current?.abort(); }, [editable]);

  async function chooseFile(file?: File) {
    const read = ++fileRead.current;
    setResult(null); setError(""); setNotice(""); setMarkdown(""); setFileName(""); setMode("actual");
    if (!file) return;
    if (!/\.(md|markdown)$/i.test(file.name)) { setError(".md 또는 .markdown 파일을 선택해 주세요."); return; }
    if (file.size > MAX_MARKDOWN_BYTES) { setError("문서는 UTF-8 128KB, 60,000자 이하로 나눠 올려 주세요."); return; }
    setReading(true);
    try {
      const bytes = await file.arrayBuffer();
      if (read !== fileRead.current) return;
      let text: string;
      try { text = new TextDecoder("utf-8", { fatal: true }).decode(bytes); }
      catch { throw new Error("파일을 UTF-8 형식으로 저장한 뒤 다시 올려 주세요."); }
      validateMarkdown(text); setMarkdown(text); setFileName(file.name);
      setMode(exampleProcedureDraft(text) ? "example" : "actual");
    } catch (err) { if (read === fileRead.current) setError(err instanceof Error ? err.message : "파일을 읽지 못했습니다."); }
    finally { if (read === fileRead.current) setReading(false); }
  }
  async function generate() {
    if (!editable || active.current || !markdown || !apiKey.trim()) return;
    const controller = new AbortController(); active.current = controller;
    setPending(true); setError(""); setNotice(""); setResult(null);
    try {
      const user = auth().currentUser;
      if (!user) throw new Error("보드에 다시 입장해 주세요.");
      const token = await user.getIdToken();
      if (controller.signal.aborted) return;
      const response = await fetch("/api/flowcharts/generate", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ sessionId, apiKey: apiKey.trim(), model: model.trim(), markdown, mode }),
        cache: "no-store", signal: AbortSignal.any([controller.signal, AbortSignal.timeout(100000)]),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(typeof data.error === "string" ? data.error : "AI 생성을 완료하지 못했습니다.");
      if (!validFlowchart(data.flow) || !data.flow.nodes.length || !Array.isArray(data.warnings) || !data.warnings.every((w: unknown) => typeof w === "string")) throw new Error("생성 결과 형식이 올바르지 않습니다.");
      if (controller.signal.aborted) return;
      setResult(data); setView(flowBounds(data.flow)); setSelected(null);
    } catch (err) {
      if (controller.signal.aborted) setNotice("생성을 취소했습니다. 기존 흐름도는 유지됩니다.");
      else if (err instanceof Error && ["TimeoutError", "AbortError"].includes(err.name)) setError("생성 시간이 초과되었습니다. 문서를 나눠 다시 시도해 주세요.");
      else setError(err instanceof Error ? err.message : "AI 연결을 완료하지 못했습니다.");
    } finally { if (active.current === controller) { active.current = null; setPending(false); } }
  }
  const stats = result ? diagnoseWorkflow(result.flow) : null;
  const selectedNode = result?.flow.nodes.find(n => n.id === selected);
  return <details className="rounded-xl border border-blue-200 bg-blue-50/50 p-3" data-testid="flow-ai-import">
    <summary className="cursor-pointer font-semibold">MD 파일에서 AI로 흐름도 만들기</summary>
    <div className="mt-3 space-y-3 min-w-0">
      <p className="text-sm">업무 설명 파일을 올리면 단계·담당 조직·입출력·협업 연결을 추출합니다. 생성 결과를 검토한 뒤 편집 가능한 초안으로 적용하세요.</p>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="text-xs space-y-1"><span>OpenAI API 키</span><input aria-label="OpenAI API 키" className={field} type="password" autoComplete="off" spellCheck={false} maxLength={4096} disabled={!editable || pending} value={apiKey} placeholder="API 키 입력" onChange={e => setApiKey(e.target.value)} /></label>
        <div className="min-w-0 space-y-2">
          <label className="block text-xs space-y-1"><span>OpenAI 모델 ID</span><select aria-label="OpenAI 모델 ID" className={field} disabled={!editable || pending} value={modelChoice} onChange={e => setModelChoice(e.target.value)}>{FLOW_MODEL_OPTIONS.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}<option value="custom">직접 입력</option></select></label>
          {modelChoice === "custom" ? <label className="block text-xs space-y-1"><span>직접 입력할 모델 ID</span><input aria-label="직접 입력할 모델 ID" className={field} maxLength={120} disabled={!editable || pending} value={customModel} placeholder="사용할 모델 ID 입력" onChange={e => setCustomModel(e.target.value)} /></label> : <p className="text-xs text-slate-text">{model}</p>}
          <p className="text-xs text-slate-text">사용 가능 여부는 입력한 API 키의 모델 접근 권한에 따라 달라집니다.</p>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 text-xs items-center"><button type="button" className={button} disabled={pending || !apiKey} onClick={() => setApiKey("")}>입력한 키 지우기</button><span>키는 이 화면의 메모리에서만 유지하며 보드나 브라우저 저장소에 저장하지 않습니다.</span></div>
      <label className="block text-sm space-y-1"><span>업무 설명 Markdown 파일</span><input aria-label="업무 설명 Markdown 파일" className={field} type="file" accept=".md,.markdown,text/markdown,text/plain" disabled={!editable || pending || reading} onChange={e => { void chooseFile(e.target.files?.[0]); e.target.value = ""; }} /></label>
      <p className="text-xs text-slate-text">UTF-8 · 최대 128KB / 60,000자. 담당 조직, 업무 순서, 입력·산출물, 승인·전달 조건을 적으면 더 정확하게 구성할 수 있습니다.</p>
      {fileName && <div><p className="text-sm break-all">{fileName} · {markdown.length.toLocaleString()}자</p><details className="mt-1 text-xs"><summary className="cursor-pointer">전송할 문서 미리보기</summary><pre className="max-h-48 overflow-auto whitespace-pre-wrap break-all bg-white rounded-lg p-3">{markdown}</pre></details></div>}
      {fileName && <div className="rounded-lg border border-silver-mist bg-white p-3 space-y-2">
        {exampleDraft && <p className="text-sm text-amber-900">작성 양식의 예시 절차 {exampleDraft.flow.nodes.length}개를 찾았습니다. ‘예시 기반 초안’으로 구성할 수 있습니다. 아래에서 분석 기준을 선택하세요.</p>}
        <label className="block text-xs space-y-1"><span>문서 분석 기준</span><select aria-label="문서 분석 기준" className={field} value={mode} disabled={!editable || pending} onChange={e => { setMode(e.target.value as FlowExtractionMode); setResult(null); setError(""); setNotice(""); }}><option value="actual">실제 업무 내용만 추출</option><option value="example">예시 기반 초안</option></select></label>
        <p className="text-xs text-slate-text">{mode === "example" ? "양식의 예시 절차도 구성도로 만듭니다. 결과에는 [예시 초안] 표시가 붙으며 예시 수치·목표 시간은 실제 업무 시간으로 기록하지 않습니다." : "서술형·인터뷰·업무 목록도 분석합니다. 담당자나 순서가 불명확하면 빈 값으로 두고, 연결 순서를 임의로 만들지 않습니다."}</p>
        {mode === "example" && exampleDraft && <button className={button} disabled={!editable || pending} onClick={() => { setResult(exampleDraft); setView(flowBounds(exampleDraft.flow)); setSelected(null); setError(""); setNotice("AI 호출 없이 문서에 적힌 예시 절차를 연결했습니다. 실제 업무에 맞게 검토해 주세요."); }}>예시 절차로 바로 초안 만들기 (AI 호출 없음)</button>}
      </div>}
      <p className="text-xs text-slate-text">‘AI로 생성’을 누르면 파일 내용이 padolet 서버를 거쳐 OpenAI로 전송되며, 입력한 키의 API 사용 요금이 적용됩니다. 키와 원본 파일은 padolet에 저장하지 않습니다.</p>
      <div className="flex gap-2"><button className={button} disabled={!editable || pending || reading || !markdown || !apiKey.trim() || !model.trim()} onClick={generate}>{reading ? "파일 읽는 중..." : pending ? "업무를 분석하는 중..." : "AI로 생성"}</button>{pending && <button className={button} onClick={() => active.current?.abort()}>생성 취소</button>}</div>
      {error && <p role="alert" className="text-sm text-red-700">{error}</p>}{notice && <p role="status" className="text-sm">{notice}</p>}
      {pending && <p role="status" className="text-sm">업무 구성도를 생성하고 있습니다. 최대 90초 정도 걸릴 수 있습니다. 취소하더라도 이미 처리된 API 사용량은 청구될 수 있습니다.</p>}
      {result && stats && <section aria-label="AI 생성 결과 미리보기" className="space-y-3 rounded-xl bg-white p-3 border border-silver-mist">
        <h3 className="font-semibold">{result.flow.title}</h3><p className="text-sm">단계 {result.flow.nodes.length}개 · 연결 {result.flow.edges.length}개 · 조직 {stats.organizations}개</p>
        <p className="text-xs text-slate-text">생성 결과는 초안입니다. 원문과 비교해 단계·담당자·조건을 확인하세요. 객체를 선택하면 추출된 업무 상세를 볼 수 있습니다.</p>
        {result.warnings.length > 0 && <ul className="list-disc pl-5 text-sm text-amber-900" aria-label="AI 확인 사항">{result.warnings.map((w, i) => <li key={i}>{w}</li>)}</ul>}
        <div className="h-80"><FlowCanvas flow={result.flow} view={view} onView={setView} selected={selected} onSelect={setSelected} editable={false} connecting={false} onConnect={() => {}} onMove={() => {}} onCreate={() => {}} /></div>
        {selectedNode && <WorkflowDetails node={selectedNode} editable={false} onChange={() => {}} />}
        <div className="flex flex-wrap gap-2"><button className={button} disabled={!editable || pending} onClick={() => { if (onApply(result.flow)) { setResult(null); setNotice("생성 결과를 초안에 적용했습니다. 편집 후 ‘흐름도 저장’을 눌러 주세요."); } }}>현재 흐름도에 적용</button><button className={button} onClick={() => { setResult(null); setNotice("생성 결과를 버렸습니다. 기존 흐름도는 유지됩니다."); }}>결과 버리기</button></div>
      </section>}
    </div>
  </details>;
}
