"use client";
import { useEffect, useRef } from "react";
import { Flowchart, FlowNode, FlowView, flowEdgePath, flowLabelLines, zoomFlow } from "@/lib/flowchart";
import { ACTIONS, edgeCaption, workBadge, workflowLanes } from "@/lib/workflow";

interface Props {
  flow: Flowchart; view: FlowView; onView: (v: FlowView) => void;
  selected: string | null; onSelect: (id: string | null) => void;
  editable: boolean; connecting: boolean;
  onConnect: (id: string) => void; onMove: (id: string, x: number, y: number) => void;
  onCreate: (x: number, y: number) => void;
}
export default function FlowCanvas(props: Props) {
  const { flow, view, onView, selected, onSelect, editable, connecting, onConnect, onMove, onCreate } = props;
  const svg = useRef<SVGSVGElement>(null);
  const latest = useRef(props);
  useEffect(() => { latest.current = props; });
  const gesture = useRef<{ kind: "node" | "pan"; id?: string; x: number; y: number; view: FlowView } | null>(null);
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const backgroundPress = useRef(false);
  const pinch = useRef<{ distance: number; view: FlowView; center: { x: number; y: number } } | null>(null);
  function world(clientX: number, clientY: number) {
    const matrix = svg.current?.getScreenCTM();
    if (!matrix) return { x: 0, y: 0 };
    const p = svg.current!.createSVGPoint(); p.x = clientX; p.y = clientY;
    return p.matrixTransform(matrix.inverse());
  }
  useEffect(() => {
    const el = svg.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const p = world(e.clientX, e.clientY);
      latest.current.onView(zoomFlow(latest.current.view, Math.exp(-Math.max(-150, Math.min(150, e.deltaY)) * 0.005), p));
    };
    el.addEventListener("wheel", wheel, { passive: false });
    return () => el.removeEventListener("wheel", wheel);
  }, []);
  function begin(e: React.PointerEvent<SVGElement>, n?: FlowNode) {
    if (e.button !== 0 && e.button !== 1) return; // Right-click must keep the source selected.
    e.stopPropagation();
    backgroundPress.current = !n;
    const p = world(e.clientX, e.clientY);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    svg.current!.setPointerCapture(e.pointerId);
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()];
      pinch.current = { distance: Math.hypot(a.x - b.x, a.y - b.y), view, center: world((a.x + b.x) / 2, (a.y + b.y) / 2) };
      gesture.current = null; return;
    }
    if (n && e.button === 0) {
      if (connecting) { onConnect(n.id); return; }
      onSelect(n.id);
      if (editable && flow.layout !== "organization") gesture.current = { kind: "node", id: n.id, x: p.x - n.x, y: p.y - n.y, view };
    } else {
      gesture.current = { kind: "pan", x: e.clientX, y: e.clientY, view };
    }
  }
  function end(e: React.PointerEvent) { pointers.current.delete(e.pointerId); gesture.current = null; pinch.current = null; }
  return <svg ref={svg} viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`} preserveAspectRatio="xMidYMid meet" role="group" aria-label="흐름도 캔버스" data-testid="flow-canvas" className="w-full h-full min-h-80 touch-none select-none bg-white rounded-xl border border-silver-mist"
    onPointerDown={e => begin(e)} onPointerUp={end} onPointerCancel={end}
    onDoubleClick={e => { if (backgroundPress.current && (e.target === e.currentTarget || (e.target as Element).hasAttribute("data-background"))) { const p = world(e.clientX, e.clientY); if (editable) onCreate(p.x - 90, p.y - 40); } }}
    onPointerMove={e => {
      if (pointers.current.has(e.pointerId)) pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pinch.current && pointers.current.size === 2) {
        const [a, b] = [...pointers.current.values()];
        if (pinch.current.distance > 0) onView(zoomFlow(pinch.current.view, Math.hypot(a.x - b.x, a.y - b.y) / pinch.current.distance, pinch.current.center));
        return;
      }
      const g = gesture.current;
      if (!g) return;
      if (g.kind === "node" && editable) { const p = world(e.clientX, e.clientY); onMove(g.id!, p.x - g.x, p.y - g.y); }
      if (g.kind === "pan") {
        const rect = svg.current!.getBoundingClientRect();
        const ratio = Math.max(g.view.width / rect.width, g.view.height / rect.height);
        onView({ ...g.view, x: g.view.x - (e.clientX - g.x) * ratio, y: g.view.y - (e.clientY - g.y) * ratio });
      }
    }}>
    <defs><marker id="flow-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#475569" /></marker><pattern id="flow-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="1" fill="#dce1e5" /></pattern></defs>
    <rect data-background="true" x={view.x - view.width} y={view.y - view.height} width={view.width * 3} height={view.height * 3} fill="url(#flow-grid)" />
    {workflowLanes(flow).map((lane, i) => <g key={lane.name} pointerEvents="none"><rect x={lane.x} y={lane.y} width={lane.width} height={lane.height} rx="12" fill={i % 2 ? "#eef2ff" : "#f0fdf4"} stroke="#cbd5e1" /><text x={lane.x + 12} y={lane.y + 22} fontSize="14" fontWeight="600" fill="#334155">{lane.name}</text></g>)}
    {flow.edges.map(edge => {
      const a = flow.nodes.find(n => n.id === edge.from), b = flow.nodes.find(n => n.id === edge.to);
      if (!a || !b) return null;
      const { d, mid } = flowEdgePath(a, b);
      return <g key={edge.id} pointerEvents="none"><path d={d} fill="none" stroke="#475569" strokeWidth="2" strokeDasharray={edge.collaboration?.kind === "feedback" ? "6 4" : undefined} markerEnd="url(#flow-arrow)" /><text x={mid.x} y={mid.y - 8} textAnchor="middle" fontSize="13" fill="#334155" stroke="white" strokeWidth="4" paintOrder="stroke">{edgeCaption(edge)}</text></g>;
    })}
    {flow.nodes.map(n => {
      const lines = flowLabelLines(n.label);
      return <g key={n.id} role="button" tabIndex={0} aria-label={`단계 ${n.label}`} aria-pressed={selected === n.id} transform={`translate(${n.x},${n.y})`} className="cursor-pointer focus:outline-none" onPointerDown={e => begin(e, n)}
        onContextMenu={e => { e.preventDefault(); e.stopPropagation(); if (editable) onConnect(n.id); }}
        onKeyDown={e => {
          if (e.key === "Escape") { onSelect(null); return; }
          if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (connecting) onConnect(n.id); else onSelect(n.id); }
          if (e.key === "F10" && e.shiftKey) { e.preventDefault(); if (editable) onConnect(n.id); }
          if (!editable || flow.layout === "organization" || !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key)) return;
          e.preventDefault(); onMove(n.id, n.x + (e.key === "ArrowRight" ? 10 : e.key === "ArrowLeft" ? -10 : 0), n.y + (e.key === "ArrowDown" ? 10 : e.key === "ArrowUp" ? -10 : 0));
        }}>
        <title>{[n.label, workBadge(n), n.work?.output && `산출물: ${n.work.output}`, n.work?.issue && `문제: ${n.work.issue}`, n.work?.improvement && `개선: ${n.work.improvement}`].filter(Boolean).join("\n")}</title>
        {selected === n.id && <rect x="-6" y="-6" width="192" height="92" rx="16" fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="5 3" />}
        {n.kind === "decision" ? <polygon points="90,0 180,40 90,80 0,40" fill="#fff4cc" stroke="#64748b" strokeWidth="2" /> : <rect width="180" height="80" rx={n.kind === "terminal" ? 40 : 12} fill={n.kind === "terminal" ? "#e1f3e8" : "#e6efff"} stroke="#64748b" strokeWidth="2" />}
        <text textAnchor="middle" fontSize="14" fill="#172b4d" pointerEvents="none">{lines.map((line, i) => <tspan key={i} x="90" y={44 - (lines.length - 1) * 9 + i * 18}>{line}</tspan>)}</text>
        {n.work && <text x="90" y="99" textAnchor="middle" fontSize="11" fill="#334155" stroke="white" strokeWidth="3" paintOrder="stroke">{Array.from(workBadge(n)).slice(0, 24).join("")}</text>}
        {n.work?.action && <text x="90" y="116" textAnchor="middle" fontSize="11" fontWeight="600" fill="#1d4ed8" stroke="white" strokeWidth="3" paintOrder="stroke">{ACTIONS[n.work.action]}</text>}
      </g>;
    })}
  </svg>;
}
