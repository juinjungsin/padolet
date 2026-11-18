import { Flowchart, flowBounds, flowEdgePath, flowLabelLines } from "./flowchart";
import { ACTIONS, edgeCaption, workBadge, workflowLanes } from "./workflow";

const xml = (s: string) => s.replace(/[<>&"']/g, c => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", '"': "&quot;", "'": "&apos;" }[c]!));
export function flowSvg(flow: Flowchart) {
  const b = flowBounds(flow);
  const nodes = flow.nodes.map(n => {
    const shape = n.kind === "decision" ? '<polygon points="90,0 180,40 90,80 0,40" fill="#fff4cc"/>' : `<rect width="180" height="80" rx="${n.kind === "terminal" ? 40 : 12}" fill="${n.kind === "terminal" ? "#e1f3e8" : "#e6efff"}"/>`;
    const lines = flowLabelLines(n.label);
    const badge = workBadge(n);
    return `<g transform="translate(${n.x},${n.y})"><g stroke="#475569" stroke-width="2">${shape}</g><text text-anchor="middle" fill="#172b4d" font-size="14">${lines.map((line, i) => `<tspan x="90" y="${44 - (lines.length - 1) * 9 + i * 18}">${xml(line)}</tspan>`).join("")}</text>${badge ? `<text x="90" y="99" text-anchor="middle" font-size="11" fill="#334155" stroke="white" stroke-width="3" paint-order="stroke">${xml(Array.from(badge).slice(0, 24).join(""))}</text>` : ""}${n.work?.action ? `<text x="90" y="116" text-anchor="middle" font-size="11" fill="#1d4ed8" stroke="white" stroke-width="3" paint-order="stroke">${ACTIONS[n.work.action]}</text>` : ""}</g>`;
  }).join("");
  const edges = flow.edges.map(e => {
    const a = flow.nodes.find(n => n.id === e.from), z = flow.nodes.find(n => n.id === e.to);
    if (!a || !z) return "";
    const { d, mid } = flowEdgePath(a, z);
    return `<path d="${d}" fill="none" stroke="#475569" stroke-width="2" ${e.collaboration?.kind === "feedback" ? 'stroke-dasharray="6 4"' : ""} marker-end="url(#arrow)"/><text x="${mid.x}" y="${mid.y - 8}" text-anchor="middle" font-size="13" fill="#334155" stroke="white" stroke-width="4" paint-order="stroke">${xml(edgeCaption(e))}</text>`;
  }).join("");
  const lanes = workflowLanes(flow).map((l, i) => `<rect x="${l.x}" y="${l.y}" width="${l.width}" height="${l.height}" rx="12" fill="${i % 2 ? "#eef2ff" : "#f0fdf4"}" stroke="#cbd5e1"/><text x="${l.x + 12}" y="${l.y + 22}" font-size="14" fill="#334155">${xml(l.name)}</text>`).join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${b.width}" height="${b.height}" viewBox="${b.x} ${b.y} ${b.width} ${b.height}" font-family="Arial, sans-serif"><rect x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" fill="white"/><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto"><path d="M0 0L10 5L0 10Z" fill="#475569"/></marker></defs>${lanes}${edges}${nodes}</svg>`;
}
export function imageSize(flow: Flowchart) {
  const b = flowBounds(flow);
  // Full diagram, constrained raster memory. Zoom never affects exported bounds.
  const scale = Math.min(2, 8192 / b.width, 8192 / b.height, Math.sqrt(16000000 / (b.width * b.height)));
  return { width: Math.max(1, Math.floor(b.width * scale)), height: Math.max(1, Math.floor(b.height * scale)) };
}
export async function flowImage(flow: Flowchart, format: "png" | "jpg"): Promise<Blob> {
  if (!flow.nodes.length) throw new Error("먼저 객체를 추가해 주세요.");
  const url = URL.createObjectURL(new Blob([flowSvg(flow)], { type: "image/svg+xml;charset=utf-8" }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => { img.onload = () => resolve(); img.onerror = () => reject(new Error("이미지를 생성하지 못했습니다.")); img.src = url; });
    const canvas = document.createElement("canvas");
    const size = imageSize(flow); canvas.width = size.width; canvas.height = size.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("이 브라우저에서는 이미지 저장을 지원하지 않습니다.");
    context.fillStyle = "white"; context.fillRect(0, 0, canvas.width, canvas.height); context.drawImage(img, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error("이미지 생성에 실패했습니다.")), format === "jpg" ? "image/jpeg" : "image/png", 0.94));
  } finally { URL.revokeObjectURL(url); }
}
export function flowFilename(title: string, format: "png" | "jpg") { return `${(title.trim() || "흐름도").replace(/[\\/:*?"<>|\r\n]/g, "_").slice(0, 80)}.${format}`; }
