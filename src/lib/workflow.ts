import type { Flowchart, FlowEdge, FlowNode } from "./flowchart";

export const ACTIONS = { keep: "유지", simplify: "단순화", automate: "자동화", delegate: "이관·협업", eliminate: "제거" } as const;
export const RELATIONS = { sequence: "순서", request: "요청", handoff: "전달", approval: "승인", feedback: "피드백" } as const;
export interface WorkDetails {
  organization?: string; owner?: string; input?: string; output?: string; system?: string;
  issue?: string; improvement?: string; action?: keyof typeof ACTIONS;
  minutes?: number; waitMinutes?: number;
}
export interface Collaboration { kind?: keyof typeof RELATIONS; deliverable?: string; agreement?: string }
const textKeys = ["organization", "owner", "input", "output", "system", "issue", "improvement"] as const;
export function validWork(value: unknown): value is WorkDetails | undefined {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const w = value as WorkDetails;
  return textKeys.every(k => w[k] === undefined || (typeof w[k] === "string" && w[k]!.length <= (k === "organization" || k === "owner" ? 80 : 1000)))
    && [w.minutes, w.waitMinutes].every(n => n === undefined || (typeof n === "number" && Number.isFinite(n) && n >= 0 && n <= 1000000))
    && (w.action === undefined || (typeof w.action === "string" && Object.hasOwn(ACTIONS, w.action)));
}
export function validCollaboration(value: unknown): value is Collaboration | undefined {
  if (value === undefined) return true;
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const c = value as Collaboration;
  return (c.kind === undefined || (typeof c.kind === "string" && Object.hasOwn(RELATIONS, c.kind)))
    && [c.deliverable, c.agreement].every(t => t === undefined || (typeof t === "string" && t.length <= 1000));
}
export const organization = (n: FlowNode) => n.work?.organization?.trim() || "담당 조직 미지정";
export function edgeCaption(e: FlowEdge) {
  const kind = e.collaboration?.kind;
  return [kind && kind !== "sequence" ? RELATIONS[kind] : "", e.label].filter(Boolean).join(" · ");
}
export function workBadge(n: FlowNode) {
  return [n.work?.organization?.trim(), n.work?.owner?.trim()].filter(Boolean).join(" · ");
}
// Preserve node/edge IDs and metadata. A stable topological ordering follows dependencies;
// feedback cycles use original order after the acyclic portion.
export function arrangeWorkflow(flow: Flowchart): Flowchart {
  const remaining = new Set(flow.nodes.map(n => n.id)), ordered: FlowNode[] = [];
  while (remaining.size) {
    const next = flow.nodes.find(n => remaining.has(n.id) && !flow.edges.some(e => e.to === n.id && remaining.has(e.from) && e.collaboration?.kind !== "feedback"))
      ?? flow.nodes.find(n => remaining.has(n.id))!;
    remaining.delete(next.id); ordered.push(next);
  }
  const groups = [...new Set(ordered.map(organization))];
  return { ...flow, layout: "organization", nodes: ordered.map((n, i) => ({ ...n, x: 180 + i * 260, y: 100 + groups.indexOf(organization(n)) * 200 })) };
}
export function workflowLanes(flow: Flowchart) {
  if (flow.layout !== "organization" || !flow.nodes.length) return [];
  const left = Math.min(...flow.nodes.map(n => n.x)) - 160, right = Math.max(...flow.nodes.map(n => n.x)) + 220;
  return [...new Set(flow.nodes.map(organization))].map(name => {
    const nodes = flow.nodes.filter(n => organization(n) === name);
    const y = Math.min(...nodes.map(n => n.y)) - 50;
    return { name, x: left, y, width: right - left, height: Math.max(...nodes.map(n => n.y)) - y + 140 };
  });
}
export function diagnoseWorkflow(flow: Flowchart) {
  const steps = flow.nodes.filter(n => n.kind !== "terminal");
  const handoffs = flow.edges.filter(e => {
    const a = flow.nodes.find(n => n.id === e.from), b = flow.nodes.find(n => n.id === e.to);
    return a?.work?.organization?.trim() && b?.work?.organization?.trim() && organization(a) !== organization(b);
  });
  const findings: { nodeId: string; text: string }[] = [];
  for (const n of steps) {
    if (!n.work?.owner?.trim()) findings.push({ nodeId: n.id, text: `${n.label}: 담당 역할을 지정해 주세요.` });
    if (!n.work?.output?.trim()) findings.push({ nodeId: n.id, text: `${n.label}: 완료 시 산출물을 정의해 주세요.` });
    if ((n.work?.waitMinutes ?? 0) > (n.work?.minutes ?? Infinity)) findings.push({ nodeId: n.id, text: `${n.label}: 입력한 대기 시간이 작업 시간보다 깁니다.` });
  }
  for (const e of handoffs) if (!e.collaboration?.deliverable?.trim()) findings.push({ nodeId: e.from, text: `${flow.nodes.find(n => n.id === e.from)!.label} → ${flow.nodes.find(n => n.id === e.to)!.label}: 조직 간 전달 산출물을 합의해 주세요.` });
  return { steps: steps.length, organizations: new Set(flow.nodes.map(n => n.work?.organization?.trim()).filter(Boolean)).size,
    handoffs: handoffs.length, minutes: steps.reduce((s, n) => s + (n.work?.minutes ?? 0), 0),
    waitMinutes: steps.reduce((s, n) => s + (n.work?.waitMinutes ?? 0), 0),
    timedSteps: steps.filter(n => n.work?.minutes !== undefined).length,
    improvements: steps.filter(n => n.work?.improvement?.trim() || (n.work?.action && n.work.action !== "keep")).length, findings };
}
export function workflowText(flow: Flowchart) {
  return [flow.title, ...flow.nodes.flatMap(n => [n.label, ...textKeys.map(k => n.work?.[k] ?? "")]), ...flow.edges.flatMap(e => [edgeCaption(e), e.collaboration?.deliverable ?? "", e.collaboration?.agreement ?? ""])].join(" ");
}
export function workflowReport(flow: Flowchart) {
  const d = diagnoseWorkflow(flow);
  const clean = (s = "") => s.replace(/\r/g, "").replace(/\n/g, " / ");
  return [`# ${clean(flow.title)}`, "", "## 업무 진단", `작업 ${d.steps}개 · 조직 ${d.organizations}개 · 조직 간 연결 ${d.handoffs}개 · 개선안 ${d.improvements}개`,
    `입력된 작업 시간 합계 ${d.minutes}분 / 대기 시간 합계 ${d.waitMinutes}분 (작업 시간 입력 ${d.timedSteps}/${d.steps})`,
    "단계별 입력값의 단순 합계입니다. 병렬·반복 작업을 반영한 전체 처리 시간은 아닙니다.", "", "## 업무별 현재 상태와 개선안",
    ...flow.nodes.flatMap(n => [`### ${clean(n.label)}`, `- 조직 / 담당 역할: ${clean(n.work?.organization)} / ${clean(n.work?.owner)}`,
      `- 입력: ${clean(n.work?.input)}`, `- 산출물: ${clean(n.work?.output)}`, `- 사용 시스템: ${clean(n.work?.system)}`,
      `- 작업 / 대기(분): ${n.work?.minutes ?? "미입력"} / ${n.work?.waitMinutes ?? "미입력"}`,
      `- 문제점: ${clean(n.work?.issue)}`, `- 개선 방향: ${n.work?.action ? ACTIONS[n.work.action] : "미정"}`, `- 개선안: ${clean(n.work?.improvement)}`, ""]),
    "## 조직 간 협업 및 연결", ...flow.edges.map(e => `- ${clean(flow.nodes.find(n => n.id === e.from)?.label)} → ${clean(flow.nodes.find(n => n.id === e.to)?.label)} [${clean(edgeCaption(e))}] · 전달: ${clean(e.collaboration?.deliverable)} · 완료 조건: ${clean(e.collaboration?.agreement)}`),
    "", "## 확인할 항목", ...d.findings.map(f => `- ${clean(f.text)}`)].join("\n");
}
export function workflowTemplate(kind: "personal" | "collaboration", revision: number): Flowchart {
  const labels = kind === "personal" ? ["업무 요청 확인", "자료 수집·입력", "검토·판단", "결과 전달"] : ["요청 접수", "실무 검토", "승인 결정", "결과 회신"];
  const orgs = kind === "personal" ? ["내 조직", "내 조직", "내 조직", "협업 조직"] : ["요청 조직", "수행 조직", "승인 조직", "요청 조직"];
  const ids = labels.map(() => crypto.randomUUID());
  return arrangeWorkflow({ title: kind === "personal" ? "내 업무 파악과 개선" : "조직 간 협업과 인수인계", revision,
    nodes: labels.map((label, i) => ({ id: ids[i], label, kind: i === 2 ? "decision" : "step", x: 0, y: 0, work: { organization: orgs[i] } })),
    edges: ids.slice(1).map((id, i) => ({ id: crypto.randomUUID(), from: ids[i], to: id, label: "", collaboration: { kind: i === 1 ? "approval" : "handoff" } })) });
}
