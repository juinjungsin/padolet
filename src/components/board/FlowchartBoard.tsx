"use client";

import { useEffect, useRef, useState } from "react";
import { EMPTY_FLOW, Flowchart, FlowNode, removeFlowNode } from "@/lib/flowchart";
import { saveFlowchart, subscribeFlowcharts } from "@/lib/flowchart-store";
import type { PostCardContext } from "./PostCard";

const field = "border border-silver-mist rounded p-2 bg-white text-sm max-w-full";
const button = "border border-silver-mist rounded px-3 py-2 text-sm bg-white disabled:opacity-40";

export default function FlowchartBoard({ ctx }: { ctx: PostCardContext }) {
  const [flows, setFlows] = useState<(Flowchart & { id: string })[]>([]);
  const [selected, setSelected] = useState(ctx.currentUserId ?? "");
  const [draft, setDraft] = useState<Flowchart | null>(null);
  const [nodeId, setNodeId] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [edgeLabel, setEdgeLabel] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ id: string; x: number; y: number } | null>(null);
  const current = flows.find(f => f.id === selected) ?? EMPTY_FLOW;
  const flow = draft ?? current;
  const editable = loaded && !busy && !ctx.locked && (ctx.isAdmin || selected === ctx.currentUserId);
  const node = flow.nodes.find(n => n.id === nodeId);

  useEffect(() => subscribeFlowcharts(ctx.sessionId, values => { setFlows(values); setLoaded(true); }, () => setError("흐름도를 불러오지 못했습니다. 연결을 확인해 주세요.")), [ctx.sessionId]);
  useEffect(() => {
    if (!draft) return;
    const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [draft]);

  function change(next: Flowchart) { if (editable) { setDraft(next); setNotice(""); } }
  function patchNode(id: string, patch: Partial<FlowNode>) {
    change({ ...flow, nodes: flow.nodes.map(n => n.id === id ? { ...n, ...patch } : n) });
  }
  function point(e: React.PointerEvent<SVGElement>) {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left) * 1400 / rect.width, y: (e.clientY - rect.top) * 960 / rect.height };
  }
  function choose(id: string) {
    if (draft && !confirm("저장하지 않은 변경을 버리고 다른 흐름도를 열까요?")) return;
    setSelected(id); setDraft(null); setNodeId(null); setFrom(""); setTo(""); setError(""); setNotice("");
  }
  return <section className="p-4 space-y-3" aria-label="작업 흐름도">
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-sm">흐름도 선택 <select aria-label="흐름도 선택" className={field} value={selected} onChange={e => choose(e.target.value)}>
        <option value={ctx.currentUserId}>내 흐름도{flows.find(f => f.id === ctx.currentUserId) ? "" : " (새로 만들기)"}</option>
        {flows.filter(f => f.id !== ctx.currentUserId).map(f => <option key={f.id} value={f.id}>{f.title}</option>)}
      </select></label>
      <button disabled={!editable || !draft} className={button} onClick={async () => {
        if (!draft) return;
        setBusy(true); setError("");
        try {
          await saveFlowchart(ctx.sessionId, selected, draft);
          const saved = { ...draft, revision: draft.revision + 1, id: selected };
          setFlows(values => [...values.filter(f => f.id !== selected), saved]);
          setDraft(null); setNotice("흐름도를 저장했습니다.");
        } catch (err) { setError(err instanceof Error ? err.message : "저장하지 못했습니다."); }
        finally { setBusy(false); }
      }}>{busy ? "저장 중..." : "흐름도 저장"}</button>
      {draft && <button disabled={busy} className={button} onClick={() => { if (confirm("변경을 버리고 최신 저장본을 열까요?")) { setDraft(null); setError(""); } }}>최신본 다시 열기</button>}
      <span className="text-sm text-slate-text">{draft ? "저장하지 않은 변경 있음" : "저장된 내용"}</span>
    </div>
    <p className="text-sm text-slate-text">단계를 추가하고 끌어서 배치한 뒤 시작·도착 단계를 연결하세요. 단계 선택 후 방향키로도 이동할 수 있습니다. 내 흐름도는 참여자와 공유되며 작성자와 보드 관리자가 편집합니다.</p>
    {error && <p role="alert" className="text-red-700">{error}</p>}
    {notice && <p role="status">{notice}</p>}
    {!loaded && <p role="status">흐름도를 불러오는 중...</p>}
    <label className="block text-sm">흐름도 제목 <input className={field} maxLength={200} disabled={!editable} value={flow.title} onChange={e => change({ ...flow, title: e.target.value })} /></label>
    <div className="flex gap-2 flex-wrap">{([['step', '작업'], ['decision', '분기'], ['terminal', '시작/종료']] as const).map(([kind, label]) => <button key={kind} disabled={!editable || flow.nodes.length >= 100} className={button} onClick={() => {
      const id = crypto.randomUUID();
      change({ ...flow, nodes: [...flow.nodes, { id, kind, label, x: 40 + (flow.nodes.length % 5) * 240, y: 40 + (Math.floor(flow.nodes.length / 5) % 8) * 100 }] }); setNodeId(id);
    }}>{label} 추가</button>)}</div>
    {node && <div className="flex flex-wrap gap-2 items-center rounded border p-3">
      <label className="text-sm">단계 이름 <input className={field} disabled={!editable} maxLength={200} value={node.label} onChange={e => patchNode(node.id, { label: e.target.value })} /></label>
      <label className="text-sm">단계 종류 <select aria-label="단계 종류" className={field} disabled={!editable} value={node.kind} onChange={e => patchNode(node.id, { kind: e.target.value as FlowNode['kind'] })}><option value="step">작업</option><option value="decision">분기</option><option value="terminal">시작/종료</option></select></label>
      <button disabled={!editable} className={button} onClick={() => { change(removeFlowNode(flow, node.id)); setNodeId(null); }}>단계 삭제</button>
    </div>}
    <div className="flex flex-wrap items-end gap-2">
      <label className="text-sm">시작 단계<select aria-label="시작 단계" className={`block ${field}`} disabled={!editable} value={from} onChange={e => setFrom(e.target.value)}><option value="">선택</option>{flow.nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select></label>
      <label className="text-sm">도착 단계<select aria-label="도착 단계" className={`block ${field}`} disabled={!editable} value={to} onChange={e => setTo(e.target.value)}><option value="">선택</option>{flow.nodes.map(n => <option key={n.id} value={n.id}>{n.label}</option>)}</select></label>
      <label className="text-sm">연결선 설명<input className={`block ${field}`} disabled={!editable} maxLength={100} placeholder="예: 예 / 아니오" value={edgeLabel} onChange={e => setEdgeLabel(e.target.value)} /></label>
      <button disabled={!editable || !flow.nodes.some(n => n.id === from) || !flow.nodes.some(n => n.id === to) || from === to || flow.edges.length >= 200} className={button} onClick={() => {
        if (flow.edges.some(e => e.from === from && e.to === to)) { setError("이미 연결된 단계입니다."); return; }
        change({ ...flow, edges: [...flow.edges, { id: crypto.randomUUID(), from, to, label: edgeLabel }] }); setEdgeLabel(""); setError("");
      }}>연결선 추가</button>
    </div>
    <div className="overflow-auto border rounded-xl bg-white" style={{ maxHeight: 640 }}>
      <svg ref={svgRef} viewBox="0 0 1400 960" width="1400" height="960" role="group" aria-label="흐름도 캔버스" className="touch-none" onPointerMove={e => {
        if (!drag.current || !editable) return;
        const p = point(e); patchNode(drag.current.id, { x: Math.max(0, Math.min(1240, p.x - drag.current.x)), y: Math.max(0, Math.min(840, p.y - drag.current.y)) });
      }} onPointerUp={() => { drag.current = null; }} onPointerCancel={() => { drag.current = null; }}>
        <defs><marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#475569" /></marker><pattern id="flow-grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#dce1e5" /></pattern></defs>
        <rect width="1400" height="960" fill="url(#flow-grid)" />
        {flow.edges.map(edge => {
          const a = flow.nodes.find(n => n.id === edge.from), b = flow.nodes.find(n => n.id === edge.to);
          if (!a || !b) return null;
          const start = { x: a.x + 80, y: a.y + 64 }, end = { x: b.x + 80, y: b.y };
          return <g key={edge.id}><path d={`M${start.x},${start.y} C${start.x},${start.y + 50} ${end.x},${end.y - 50} ${end.x},${end.y}`} fill="none" stroke="#475569" strokeWidth="2" markerEnd="url(#flow-arrow)" /><text x={(start.x + end.x) / 2} y={(start.y + end.y) / 2 - 5} textAnchor="middle" fontSize="13" fill="#334155">{edge.label}</text></g>;
        })}
        {flow.nodes.map(n => <g key={n.id} role="button" tabIndex={0} aria-label={`단계 ${n.label}`} aria-pressed={nodeId === n.id} transform={`translate(${n.x},${n.y})`} className="cursor-move outline-none" onFocus={() => setNodeId(n.id)} onClick={() => setNodeId(n.id)} onPointerDown={e => {
          setNodeId(n.id); if (!editable) return;
          const p = point(e); drag.current = { id: n.id, x: p.x - n.x, y: p.y - n.y }; e.currentTarget.setPointerCapture(e.pointerId);
        }} onKeyDown={e => {
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setNodeId(n.id); }
          if (!editable || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
          e.preventDefault(); patchNode(n.id, { x: Math.max(0, Math.min(1240, n.x + (e.key === "ArrowRight" ? 10 : e.key === "ArrowLeft" ? -10 : 0))), y: Math.max(0, Math.min(840, n.y + (e.key === "ArrowDown" ? 10 : e.key === "ArrowUp" ? -10 : 0))) });
        }}>
          <title>{n.label}</title>
          {n.kind === "decision" ? <polygon points="80,0 160,32 80,64 0,32" fill="#FFFBE6" stroke={nodeId === n.id ? "#2563eb" : "#64748b"} strokeWidth="2" /> : <rect width="160" height="64" rx={n.kind === "terminal" ? 32 : 8} fill={n.kind === "terminal" ? "#EAF5EC" : "#EAF2FB"} stroke={nodeId === n.id ? "#2563eb" : "#64748b"} strokeWidth="2" />}
          <text x="80" y="37" textAnchor="middle" fontSize="14" fill="#1e293b" pointerEvents="none">{n.label.length > 12 ? n.label.slice(0, 12) + "…" : n.label}</text>
        </g>)}
      </svg>
    </div>
    {!flow.nodes.length && <p className="text-sm text-slate-text">작업·분기·시작/종료 단계를 추가해 흐름도를 그려 보세요.</p>}
    {flow.edges.length > 0 && <ul className="space-y-1 text-sm" aria-label="연결선 목록">{flow.edges.map(e => <li key={e.id} className="flex items-center gap-2"><span>{flow.nodes.find(n => n.id === e.from)?.label} → {flow.nodes.find(n => n.id === e.to)?.label}{e.label && ` (${e.label})`}</span><button disabled={!editable} className={button} onClick={() => change({ ...flow, edges: flow.edges.filter(edge => edge.id !== e.id) })}>연결선 삭제</button></li>)}</ul>}
  </section>;
}
