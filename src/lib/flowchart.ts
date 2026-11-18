export interface FlowNode { id: string; label: string; kind: "step" | "decision" | "terminal"; x: number; y: number }
export interface FlowEdge { id: string; from: string; to: string; label: string }
export interface Flowchart { title: string; nodes: FlowNode[]; edges: FlowEdge[]; revision: number }
export const EMPTY_FLOW: Flowchart = { title: "작업 흐름도", nodes: [], edges: [], revision: 0 };
export function removeFlowNode(flow: Flowchart, id: string): Flowchart {
  return { ...flow, nodes: flow.nodes.filter(n => n.id !== id), edges: flow.edges.filter(e => e.from !== id && e.to !== id) };
}
export function validFlowchart(value: unknown): value is Flowchart {
  if (!value || typeof value !== "object") return false;
  const f = value as Flowchart;
  if (typeof f.title !== "string" || f.title.length > 200 || !Number.isInteger(f.revision) || !Array.isArray(f.nodes) || !Array.isArray(f.edges) || f.nodes.length > 100 || f.edges.length > 200) return false;
  if (!f.nodes.every(n => n && typeof n.id === "string" && typeof n.label === "string" && n.label.length <= 200 && ["step", "decision", "terminal"].includes(n.kind) && Number.isFinite(n.x) && Number.isFinite(n.y))) return false;
  const ids = new Set(f.nodes.map(n => n.id));
  return ids.size === f.nodes.length && new Set(f.edges.map(e => e?.id)).size === f.edges.length && f.edges.every(e => e && typeof e.id === "string" && typeof e.label === "string" && e.label.length <= 100 && e.from !== e.to && ids.has(e.from) && ids.has(e.to));
}

export const NODE_WIDTH = 180;
export const NODE_HEIGHT = 80;
export interface FlowView { x: number; y: number; width: number; height: number }
export function flowBounds(flow: Flowchart): FlowView {
  if (!flow.nodes.length) return { x: 0, y: 0, width: 1000, height: 640 };
  const padding = Math.max(100, ...flow.edges.map(e => Array.from(e.label).length * 7 + 20));
  const x = Math.min(...flow.nodes.map(n => n.x)) - padding;
  const y = Math.min(...flow.nodes.map(n => n.y)) - padding;
  return { x, y, width: Math.max(380, Math.max(...flow.nodes.map(n => n.x + NODE_WIDTH)) - x + padding), height: Math.max(280, Math.max(...flow.nodes.map(n => n.y + NODE_HEIGHT)) - y + padding) };
}
export function zoomFlow(view: FlowView, factor: number, anchor = { x: view.x + view.width / 2, y: view.y + view.height / 2 }): FlowView {
  const width = view.width / factor, height = view.height / factor;
  const x = anchor.x - (anchor.x - view.x) / factor, y = anchor.y - (anchor.y - view.y) / factor;
  // Only floating-point representability limits the view; there is no fixed artboard or zoom range.
  if (![x, y, width, height].every(Number.isFinite) || width <= 0 || height <= 0 || x + width === x || y + height === y) return view;
  return { x, y, width, height };
}
export function flowEdgePath(a: FlowNode, b: FlowNode) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const horizontal = Math.abs(dx) >= Math.abs(dy);
  const start = horizontal ? { x: a.x + (dx >= 0 ? NODE_WIDTH : 0), y: a.y + NODE_HEIGHT / 2 } : { x: a.x + NODE_WIDTH / 2, y: a.y + (dy >= 0 ? NODE_HEIGHT : 0) };
  const end = horizontal ? { x: b.x + (dx >= 0 ? 0 : NODE_WIDTH), y: b.y + NODE_HEIGHT / 2 } : { x: b.x + NODE_WIDTH / 2, y: b.y + (dy >= 0 ? 0 : NODE_HEIGHT) };
  const mid = { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 };
  return { d: horizontal ? `M${start.x},${start.y} C${mid.x},${start.y} ${mid.x},${end.y} ${end.x},${end.y}` : `M${start.x},${start.y} C${start.x},${mid.y} ${end.x},${mid.y} ${end.x},${end.y}`, mid };
}
export function flowLabelLines(label: string): string[] {
  const chars = Array.from(label);
  const lines: string[] = [];
  for (let i = 0; i < chars.length; i += 12) lines.push(chars.slice(i, i + 12).join(""));
  return lines.length > 3 ? [...lines.slice(0, 2), lines[2].slice(0, 11) + "…"] : lines;
}
