"use client";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { EMPTY_FLOW, Flowchart, FlowNode, FlowView, flowBounds, removeFlowNode, zoomFlow } from "@/lib/flowchart";
import { flowFilename, flowImage } from "@/lib/flowchart-image";
import { saveFlowchart, subscribeFlowcharts } from "@/lib/flowchart-store";
import { addMessage, addPost, containsBannedWord, getSession, isNameBlocked } from "@/lib/firestore";
import { uploadFile, UploadResult } from "@/lib/storage";
import type { PostCardContext } from "./PostCard";
import FlowCanvas from "./FlowCanvas";
import WorkflowDetails from "./WorkflowDetails";
import FlowchartAIImport from "./FlowchartAIImport";
import { arrangeWorkflow, diagnoseWorkflow, edgeCaption, RELATIONS, workflowReport, workflowTemplate, workflowText, Collaboration } from "@/lib/workflow";

const field = "border border-silver-mist rounded-lg p-2 bg-white text-sm max-w-full";
const button = "border border-silver-mist rounded-lg px-3 py-2 text-sm bg-white hover:bg-blue-50 disabled:opacity-40 whitespace-nowrap";
const initialView: FlowView = { x: 0, y: 0, width: 1000, height: 640 };
type Preview = { target: "post" | "chat"; file: File; url: string; title: string; text: string; uploaded?: UploadResult };

export default function FlowchartBoard({ ctx }: { ctx: PostCardContext }) {
  const [flows, setFlows] = useState<(Flowchart & { id: string })[]>([]);
  const [selected, setSelected] = useState(ctx.currentUserId ?? "");
  const [draft, setDraft] = useState<Flowchart | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [edgeLabel, setEdgeLabel] = useState("");
  const [relation, setRelation] = useState<NonNullable<Collaboration["kind"]>>("sequence");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [view, setView] = useState(initialView);
  const [popupRoot, setPopupRoot] = useState<HTMLElement | null>(null);
  const popup = useRef<Window | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const actionBusy = useRef(false);
  const nameInput = useRef<HTMLInputElement>(null);
  const initialFit = useRef(false);
  const flow = draft ?? flows.find(f => f.id === selected) ?? EMPTY_FLOW;
  const editable = loaded && !busy && !ctx.locked && (ctx.isAdmin || selected === ctx.currentUserId);
  const node = flow.nodes.find(n => n.id === nodeId);
  const diagnosis = diagnoseWorkflow(flow);
  useEffect(() => subscribeFlowcharts(ctx.sessionId, values => {
    setFlows(values); setLoaded(true);
    const mine = values.find(f => f.id === ctx.currentUserId);
    if (!initialFit.current && mine) { initialFit.current = true; setView(flowBounds(mine)); }
  }, () => setError("흐름도를 불러오지 못했습니다. 연결을 확인해 주세요.")), [ctx.sessionId, ctx.currentUserId]);
  useEffect(() => {
    if (!draft) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draft]);
  useEffect(() => () => { popup.current?.close(); }, []);
  const previewUrl = preview?.url;
  useEffect(() => () => { if (previewUrl) URL.revokeObjectURL(previewUrl); }, [previewUrl]);
  function change(next: Flowchart) { if (editable) { setDraft(next.layout === "organization" ? arrangeWorkflow(next) : next); setNotice(""); } }
  function patchNode(id: string, patch: Partial<FlowNode>) {
    const next = { ...flow, nodes: flow.nodes.map(n => n.id === id ? { ...n, ...patch } : n) };
    change(next);
    if (flow.layout === "organization" && patch.work?.organization !== undefined && patch.work.organization !== node?.work?.organization) setView(flowBounds(arrangeWorkflow(next)));
  }
  function applyTemplate(kind: "personal" | "collaboration") {
    if (flow.nodes.length && !(popup.current ?? window).confirm("현재 초안을 템플릿으로 교체할까요? 저장 전에는 ‘최신본 다시 열기’로 되돌릴 수 있습니다.")) return;
    const next = workflowTemplate(kind, flow.revision); change(next); setNodeId(next.nodes[0].id); setView(flowBounds(next)); setConnecting(false);
  }
  function downloadReport() {
    const url = URL.createObjectURL(new Blob([workflowReport(flow)], { type: "text/markdown;charset=utf-8" }));
    const doc = popup.current?.document ?? document, a = doc.createElement("a");
    a.href = url; a.download = flowFilename(flow.title, "png").replace(/\.png$/, "-업무진단.md"); doc.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }
  function selectNode(id: string | null) { setNodeId(id); if (!id) setConnecting(false); }
  function connect(target: string, source = nodeId) {
    if (!editable) return;
    if (!source) { setNodeId(target); setNotice("출발 객체를 선택했습니다. 다른 객체를 우클릭하세요."); return; }
    if (source === target) { setError("다른 객체를 도착점으로 선택해 주세요."); return; }
    if (!flow.nodes.some(n => n.id === source) || !flow.nodes.some(n => n.id === target)) return;
    if (flow.edges.some(e => e.from === source && e.to === target)) { setError("이미 연결된 객체입니다."); return; }
    if (flow.edges.length >= 200) { setError("연결선은 최대 200개까지 저장할 수 있습니다."); return; }
    change({ ...flow, edges: [...flow.edges, { id: crypto.randomUUID(), from: source, to: target, label: edgeLabel, collaboration: { kind: relation } }] });
    setError(""); setEdgeLabel(""); setConnecting(false); setNotice("연결했습니다. 이어서 다른 객체를 우클릭할 수 있습니다.");
  }
  function create(kind: FlowNode["kind"], x?: number, y?: number) {
    if (!editable || flow.nodes.length >= 100) return;
    const id = crypto.randomUUID();
    let px = x ?? view.x + view.width / 2 - 90, py = y ?? view.y + view.height / 2 - 40;
    for (let i = 0; i < 100 && flow.nodes.some(n => Math.abs(n.x - px) < 170 && Math.abs(n.y - py) < 80); i++) { px += 40; py += 100; }
    if (!Number.isFinite(px) || !Number.isFinite(py)) return;
    const next: Flowchart = { ...flow, nodes: [...flow.nodes, { id, kind, label: kind === "step" ? "새 작업" : kind === "decision" ? "조건 확인" : "시작/종료", x: px, y: py }] };
    change(next);
    setNodeId(id); setConnecting(false); setView(flow.layout === "organization" ? flowBounds(arrangeWorkflow(next)) : { ...view, x: px + 90 - view.width / 2, y: py + 40 - view.height / 2 });
    setTimeout(() => { nameInput.current?.focus(); nameInput.current?.select(); }, 0);
  }
  function choose(id: string) {
    if (draft && !window.confirm("저장하지 않은 변경을 버리고 다른 흐름도를 열까요?")) return;
    setSelected(id); setDraft(null); setNodeId(null); setConnecting(false); setFrom(""); setTo(""); setError(""); setNotice(""); setView(flowBounds(flows.find(f => f.id === id) ?? EMPTY_FLOW));
  }
  function openWindow() {
    if (popup.current && !popup.current.closed) { popup.current.focus(); return; }
    const win = window.open("", "", "popup=yes,width=1500,height=960");
    if (!win) { setError("새 창이 차단되었습니다. 브라우저에서 팝업을 허용해 주세요."); return; }
    win.document.title = "padolet · 흐름도 편집"; win.document.documentElement.lang = "ko"; win.document.documentElement.className = document.documentElement.className;
    document.querySelectorAll('link[rel="stylesheet"], style').forEach(el => win.document.head.appendChild(el.cloneNode(true)));
    win.document.body.className = "bg-parchment text-ink font-sans";
    const root = win.document.createElement("div"); win.document.body.appendChild(root);
    popup.current = win; setPopupRoot(root);
    win.addEventListener("pagehide", () => { popup.current = null; setPopupRoot(null); }, { once: true });
  }
  async function run(action: () => Promise<void>) {
    if (actionBusy.current) return;
    actionBusy.current = true; setBusy(true); setError(""); setNotice("");
    try { await action(); } catch (err) { setError(err instanceof Error ? err.message : "작업을 완료하지 못했습니다. 다시 시도해 주세요."); }
    finally { actionBusy.current = false; setBusy(false); }
  }
  async function exportImage(format: "png" | "jpg", target?: "post" | "chat") {
    await run(async () => {
      const blob = await flowImage(flow, format), url = URL.createObjectURL(blob);
      if (target) { setPreview({ target, file: new File([blob], flowFilename(flow.title, format), { type: blob.type }), url, title: flow.title, text: workflowText(flow) }); return; }
      const doc = popup.current?.document ?? document;
      const a = doc.createElement("a"); a.href = url; a.download = flowFilename(flow.title, format); doc.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 30000); setNotice(`${format.toUpperCase()} 파일을 저장했습니다.`);
    });
  }
  async function share() {
    if (!preview || ctx.locked || !ctx.currentUserId) return;
    await run(async () => {
      const session = await getSession(ctx.sessionId);
      if (!session || (session.locked && !ctx.isAdmin)) throw new Error("보드가 잠겨 있어 공유할 수 없습니다.");
      if (isNameBlocked(ctx.currentUserName ?? "", session.blockedNames ?? [])) throw new Error("관리자에 의해 공유가 제한된 사용자입니다.");
      if (containsBannedWord(preview.text, session.bannedWords ?? [])) throw new Error("흐름도에 금칙어가 포함되어 있습니다.");
      const uploaded = preview.uploaded ?? await uploadFile(ctx.sessionId, preview.file).promise;
      setPreview(p => p ? { ...p, uploaded } : p);
      const attachment = { authorId: ctx.currentUserId!, authorName: ctx.currentUserName || "참여자", content: `흐름도: ${preview.title}`, type: "image" as const, fileUrl: uploaded.url, fileMeta: { name: uploaded.name, size: uploaded.size, mimeType: uploaded.mimeType } };
      if (preview.target === "post") {
        const last = await getDocs(query(collection(db(), "sessions", ctx.sessionId, "posts"), orderBy("gridIndex", "desc"), limit(1)));
        await addPost(ctx.sessionId, { ...attachment, title: preview.title, kind: "general", color: "blue", authorRole: ctx.isAdmin ? "admin" : "participant", gridIndex: (last.docs[0]?.data().gridIndex ?? -1) + 1 });
      } else await addMessage(ctx.sessionId, attachment);
      setPreview(null); setNotice(`${preview.target === "post" ? "보드 포스트잇" : "대화"}에 흐름도 이미지를 공유했습니다.`);
    });
  }

  const editor = <section className={`p-4 flex flex-col gap-3 ${popupRoot ? "h-dvh overflow-auto" : ""}`} aria-label="작업 흐름도">
    <div className="rounded-xl bg-white border border-silver-mist p-3 space-y-2">
      <h2 className="font-semibold">업무 리디자인 구성도</h2>
      <p className="text-xs text-slate-text">① 내 업무와 산출물 파악 → ② 조직 간 전달·승인 연결 → ③ 문제점과 개선안 정리</p>
      <div className="flex flex-wrap gap-2"><button className={button} disabled={!editable} onClick={() => applyTemplate("personal")}>내 업무 템플릿</button><button className={button} disabled={!editable} onClick={() => applyTemplate("collaboration")}>조직 협업 템플릿</button><button className={button} disabled={!editable || !flow.nodes.length} onClick={() => { const next = arrangeWorkflow(flow); change(next); setView(flowBounds(next)); }}>조직별 자동 배치</button><button className={button} disabled={!editable || flow.layout !== "organization"} onClick={() => change({ ...flow, layout: "free" })}>자유 배치로 전환</button></div>
      {flow.layout === "organization" && <p className="text-xs text-slate-text">조직별 구획은 담당 조직과 연결 순서에 맞춰 자동 배치됩니다. 직접 이동하려면 자유 배치로 전환하세요.</p>}
    </div>
    <div className="flex flex-wrap items-center gap-2">
      <select aria-label="흐름도 선택" className={field} disabled={busy} value={selected} onChange={e => choose(e.target.value)}><option value={ctx.currentUserId}>내 흐름도</option>{flows.filter(f => f.id !== ctx.currentUserId).map(f => <option key={f.id} value={f.id}>{f.title}</option>)}</select>
      <input aria-label="흐름도 제목" className={`${field} min-w-0 flex-1`} maxLength={200} disabled={!editable} value={flow.title} onChange={e => change({ ...flow, title: e.target.value })} />
      <button disabled={!editable || !draft} className={button} onClick={() => run(async () => {
        if (!draft) return; await saveFlowchart(ctx.sessionId, selected, draft);
        setFlows(values => [...values.filter(f => f.id !== selected), { ...draft, revision: draft.revision + 1, id: selected }]); setDraft(null); setNotice("흐름도를 저장했습니다.");
      })}>흐름도 저장</button>
      {popupRoot ? <button className={button} onClick={() => { popup.current?.close(); setPopupRoot(null); }}>보드로 돌아가기</button> : <button className={button} onClick={openWindow}>새 창에서 크게 편집</button>}
      {draft && <button disabled={busy} className={button} onClick={() => { if (window.confirm("변경을 버리고 최신 저장본을 열까요?")) { setDraft(null); setError(""); } }}>최신본 다시 열기</button>}
    </div>
    <FlowchartAIImport key={selected} sessionId={ctx.sessionId} editable={editable} onApply={generated => {
      if (!editable) return false;
      if (flow.nodes.length && !(popup.current ?? window).confirm("현재 흐름도 초안을 AI 생성 결과로 교체할까요? 저장 전에는 ‘최신본 다시 열기’로 저장본을 복구할 수 있습니다.")) return false;
      const next = { ...generated, revision: flow.revision };
      change(next); setNodeId(null); setConnecting(false); setFrom(""); setTo(""); setError(""); setView(flowBounds(next)); return true;
    }} />
    <div className="flex flex-wrap gap-2 items-center">
      {([['step', '작업'], ['decision', '분기'], ['terminal', '시작/종료']] as const).map(([kind, label]) => <button key={kind} className={button} disabled={!editable || flow.nodes.length >= 100} onClick={() => create(kind)}>{label} 추가</button>)}
      <span className="text-xs text-slate-text">{draft ? "저장하지 않은 변경 있음" : "저장된 내용"}</span>
      <div className="flex gap-1 ml-auto"><button className={button} onClick={() => setView(zoomFlow(view, 1 / 1.25))} aria-label="흐름도 축소">−</button><output className="text-sm self-center min-w-14 text-center" aria-label="확대 비율">{Number((100000 / view.width).toPrecision(4))}%</output><button className={button} onClick={() => setView(zoomFlow(view, 1.25))} aria-label="흐름도 확대">+</button><button className={button} onClick={() => setView(flowBounds(flow))}>전체 보기</button><button className={button} onClick={() => setView({ ...initialView, x: view.x, y: view.y })}>100%</button></div>
    </div>
    <p className="text-sm rounded-lg bg-blue-50 p-2 text-blue-900">{connecting ? "연결할 도착 객체를 클릭·탭하세요." : node ? `출발: ${node.label} → 연결할 다른 객체를 우클릭하세요.` : "객체를 선택한 뒤 연결할 다른 객체를 우클릭하세요."} <span className="text-xs">빈 곳 두 번 클릭: 작업 추가 · 빈 곳 끌기: 화면 이동 · 휠/두 손가락: 확대·축소</span></p>
    {error && <p role="alert" className="text-red-700">{error}</p>}{notice && <p role="status">{notice}</p>}{!loaded && <p role="status">흐름도를 불러오는 중...</p>}
    <div className="min-h-11">{node && <div className="flex flex-wrap gap-2 items-center">
      <input ref={nameInput} aria-label="단계 이름" className={`${field} flex-1 min-w-0`} disabled={!editable} maxLength={200} value={node.label} onChange={e => patchNode(node.id, { label: e.target.value })} />
      <select aria-label="단계 종류" className={field} disabled={!editable} value={node.kind} onChange={e => patchNode(node.id, { kind: e.target.value as FlowNode['kind'] })}><option value="step">작업</option><option value="decision">분기</option><option value="terminal">시작/종료</option></select>
      <input aria-label="연결선 설명" className={field} maxLength={100} disabled={!editable} placeholder="연결 설명 (선택)" value={edgeLabel} onChange={e => setEdgeLabel(e.target.value)} />
      <select aria-label="새 연결 유형" className={field} disabled={!editable} value={relation} onChange={e => setRelation(e.target.value as typeof relation)}>{Object.entries(RELATIONS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select>
      <button disabled={!editable} className={button} onClick={() => setConnecting(v => !v)}>{connecting ? "연결 취소" : "선택 객체에서 연결"}</button>
      <button disabled={!editable} className={button} onClick={() => { change(removeFlowNode(flow, node.id)); selectNode(null); }}>단계 삭제</button>
    </div>}</div>
    <div className={`grid gap-3 min-w-0 ${node ? "xl:grid-cols-[minmax(0,1fr)_300px]" : ""} ${popupRoot ? "flex-1" : ""}`}>
      <div className="h-[520px] min-h-80 min-w-0"><FlowCanvas key={popupRoot ? "window" : "board"} flow={flow} view={view} onView={setView} selected={nodeId} onSelect={selectNode} editable={editable} connecting={connecting} onConnect={connect} onMove={(id, x, y) => { if (Number.isFinite(x) && Number.isFinite(y)) patchNode(id, { x, y }); }} onCreate={(x, y) => create("step", x, y)} /></div>
      {node && <WorkflowDetails node={node} editable={editable} onChange={work => patchNode(node.id, { work })} />}
    </div>
    <details className="rounded-xl border border-silver-mist bg-white p-3"><summary className="cursor-pointer font-semibold">업무 진단 · 작업 {diagnosis.steps}개 / 조직 {diagnosis.organizations}개 / 협업 연결 {diagnosis.handoffs}개 / 개선안 {diagnosis.improvements}개</summary><div className="space-y-2 pt-3 text-sm" aria-label="업무 진단 결과"><p>입력된 작업 시간 합계 {diagnosis.minutes}분 · 대기 시간 합계 {diagnosis.waitMinutes}분 (작업 시간 입력 {diagnosis.timedSteps}/{diagnosis.steps})</p><p className="text-xs text-slate-text">단계별 입력값의 단순 합계입니다. 병렬·반복 작업을 반영한 전체 처리 시간은 아닙니다. 아래 항목은 입력 누락·대기·조직 간 전달을 점검하는 참고 목록입니다.</p><ul className="space-y-1">{diagnosis.findings.map((finding, i) => <li key={i}><button className="text-left underline text-blue-800" onClick={() => { setNodeId(finding.nodeId); const n = flow.nodes.find(n => n.id === finding.nodeId)!; setView({ ...view, x: n.x + 90 - view.width / 2, y: n.y + 40 - view.height / 2 }); }}>{finding.text}</button></li>)}</ul>{!diagnosis.findings.length && <p>현재 입력에서 확인 항목이 없습니다. 실제 담당자와 업무·완료 조건을 함께 검토하세요.</p>}<button className={button} disabled={!flow.nodes.length || busy} onClick={downloadReport}>업무 진단서 저장</button></div></details>
    <div className="flex flex-wrap gap-2"><button disabled={busy || !flow.nodes.length} className={button} onClick={() => exportImage("png")}>PNG 저장</button><button disabled={busy || !flow.nodes.length} className={button} onClick={() => exportImage("jpg")}>JPG 저장</button><button disabled={busy || ctx.locked || !flow.nodes.length} className={button} onClick={() => exportImage("png", "post")}>포스트잇으로 공유</button><button disabled={busy || ctx.locked || !flow.nodes.length} className={button} onClick={() => exportImage("png", "chat")}>대화로 공유</button><span className="text-xs self-center text-slate-text">전체 흐름도를 이미지로 저장·공유합니다. 큰 그림은 이미지 최대 8192px 내에서 축소됩니다.</span></div>
    <details><summary className="text-sm cursor-pointer">연결선 목록·목록으로 연결</summary><div className="flex flex-wrap gap-2 py-2"><select aria-label="시작 단계" className={field} value={from} onChange={e => setFrom(e.target.value)}><option value="">출발 객체</option>{flow.nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select><select aria-label="도착 단계" className={field} value={to} onChange={e => setTo(e.target.value)}><option value="">도착 객체</option>{flow.nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select><button disabled={!editable || !from || !to} className={button} onClick={() => connect(to, from)}>연결선 추가</button></div>
      {flow.edges.length > 0 && <ul className="space-y-2 text-sm" aria-label="연결선 목록">{flow.edges.map(e => <li key={e.id} className="rounded-lg border border-silver-mist p-3 space-y-2"><div className="flex flex-wrap items-center gap-2"><span>{flow.nodes.find(n => n.id === e.from)?.label} → {flow.nodes.find(n => n.id === e.to)?.label}{edgeCaption(e) && ` (${edgeCaption(e)})`}</span><button disabled={!editable} className={button} onClick={() => change({ ...flow, edges: flow.edges.filter(edge => edge.id !== e.id) })}>연결선 삭제</button></div><fieldset disabled={!editable} className="grid sm:grid-cols-2 gap-2 min-w-0"><label className="text-xs">협업 유형<select aria-label="협업 유형" className={`${field} block w-full`} value={e.collaboration?.kind ?? "sequence"} onChange={ev => change({ ...flow, edges: flow.edges.map(edge => edge.id === e.id ? { ...edge, collaboration: { ...edge.collaboration, kind: ev.target.value as Collaboration["kind"] } } : edge) })}>{Object.entries(RELATIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="text-xs">연결 설명<input className={`${field} block w-full`} maxLength={100} value={e.label} onChange={ev => change({ ...flow, edges: flow.edges.map(edge => edge.id === e.id ? { ...edge, label: ev.target.value } : edge) })} /></label>{([["deliverable", "전달 산출물"], ["agreement", "인수·완료 조건"]] as const).map(([key, label]) => <label key={key} className="text-xs">{label}<textarea aria-label={label} rows={2} className={`${field} block w-full`} maxLength={1000} value={e.collaboration?.[key] ?? ""} onChange={ev => change({ ...flow, edges: flow.edges.map(edge => edge.id === e.id ? { ...edge, collaboration: { ...edge.collaboration, [key]: ev.target.value } } : edge) })} /></label>)}</fieldset></li>)}</ul>}
    </details>
    {preview && <div role="dialog" aria-modal="true" aria-label="흐름도 공유 확인" className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onKeyDown={e => {
      if (e.key === "Escape" && !busy) setPreview(null);
      if (e.key === "Tab") { const controls = e.currentTarget.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"); if (controls.length) { e.preventDefault(); const index = Array.from(controls).indexOf(e.currentTarget.ownerDocument.activeElement as HTMLButtonElement); controls[(index + (e.shiftKey ? -1 : 1) + controls.length) % controls.length].focus(); } }
    }}><div className="bg-white rounded-xl p-5 max-w-2xl w-full space-y-3"><h3 className="font-bold">{preview.target === "post" ? "보드 포스트잇" : "대화"}에 공유</h3><p className="text-sm">현재 흐름도의 이미지 사본을 게시합니다. 이후 편집 내용은 공유 이미지에 자동 반영되지 않습니다.</p>{/* eslint-disable-next-line @next/next/no-img-element */}
<img src={preview.url} alt={`${preview.title} 공유 미리보기`} className="max-h-[55vh] w-full object-contain" /><div className="flex gap-2 justify-end"><button autoFocus disabled={busy} className={button} onClick={() => setPreview(null)}>취소</button><button disabled={busy || ctx.locked} className={button} onClick={share}>{busy ? "공유 중..." : "공유하기"}</button></div></div></div>}
  </section>;
  return popupRoot ? <><div className="p-6 text-sm">새 창에서 편집 중입니다. 창을 닫으면 초안이 보드로 돌아옵니다. <button className={button} onClick={() => popup.current?.focus()}>편집 창으로 이동</button><button className={button} onClick={() => { popup.current?.close(); setPopupRoot(null); }}>보드로 가져오기</button></div>{createPortal(editor, popupRoot)}</> : editor;
}
