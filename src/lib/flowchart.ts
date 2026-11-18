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
  if (!f.nodes.every(n => n && typeof n.id === "string" && typeof n.label === "string" && n.label.length <= 200 && ["step", "decision", "terminal"].includes(n.kind) && Number.isFinite(n.x) && Number.isFinite(n.y) && n.x >= 0 && n.x <= 1240 && n.y >= 0 && n.y <= 840)) return false;
  const ids = new Set(f.nodes.map(n => n.id));
  return ids.size === f.nodes.length && new Set(f.edges.map(e => e?.id)).size === f.edges.length && f.edges.every(e => e && typeof e.id === "string" && typeof e.label === "string" && e.label.length <= 100 && e.from !== e.to && ids.has(e.from) && ids.has(e.to));
}
