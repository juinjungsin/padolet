import { describe, expect, it } from "vitest";
import { EMPTY_FLOW, validFlowchart, flowBounds } from "@/lib/flowchart";
import { arrangeWorkflow, diagnoseWorkflow, workflowLanes, workflowReport, workflowTemplate, workflowText } from "@/lib/workflow";
import { flowSvg } from "@/lib/flowchart-image";

describe("업무 리디자인", () => {
  it("keeps legacy diagrams readable and rejects malformed optional details", () => {
    expect(validFlowchart(EMPTY_FLOW)).toBe(true);
    const f = workflowTemplate("personal", 7);
    expect(validFlowchart(f)).toBe(true);
    for (const work of [{ minutes: -1 }, { waitMinutes: Infinity }, { owner: "a".repeat(81) }, { action: "constructor" }, { action: { toString: "bad" } }, { issue: 32 }, []]) {
      expect(validFlowchart({ ...f, nodes: [{ ...f.nodes[0], work }], edges: [] })).toBe(false);
    }
    expect(validFlowchart({ ...f, layout: "invalid" })).toBe(false);
    expect(validFlowchart({ ...f, edges: [{ ...f.edges[0], collaboration: { kind: "unknown" } }] })).toBe(false);
  });
  it("groups organizations, orders dependencies and handles feedback cycles without data loss", () => {
    const f = workflowTemplate("collaboration", 4);
    f.nodes.reverse();
    f.nodes[0].work = { ...f.nodes[0].work, improvement: "한 번만 입력" };
    f.edges.push({ id: "feedback", from: f.nodes[0].id, to: f.nodes[3].id, label: "보완", collaboration: { kind: "feedback" } });
    const result = arrangeWorkflow(f);
    expect(result.nodes[0].label).toBe("요청 접수");
    expect(result.nodes.at(-1)?.work?.improvement).toBe("한 번만 입력");
    expect(result.revision).toBe(4);
    expect(result.edges).toEqual(f.edges);
    expect(arrangeWorkflow(result)).toEqual(result);
    expect(workflowLanes(result)).toHaveLength(3);
    expect(result.nodes[0].y).toBe(result.nodes[3].y);
    f.edges.at(-1)!.collaboration = { kind: "sequence" };
    expect(validFlowchart(arrangeWorkflow(f))).toBe(true);
  });
  it("counts entered time, cross-organization handoffs and actionable missing information", () => {
    const f = workflowTemplate("personal", 0);
    f.nodes[0].work = { organization: "내 조직", owner: "접수 담당", minutes: 10, waitMinutes: 30, output: "요청서", action: "automate", improvement: "통합 입력" };
    f.nodes[1].work!.minutes = 0;
    const d = diagnoseWorkflow(f);
    expect(d).toMatchObject({ steps: 4, organizations: 2, handoffs: 1, minutes: 10, waitMinutes: 30, timedSteps: 2, improvements: 1 });
    expect(d.findings.some(x => x.text.includes("대기 시간"))).toBe(true);
    expect(d.findings.some(x => x.text.includes("조직 간 전달"))).toBe(true);
    f.edges[2].collaboration = { kind: "handoff", deliverable: "결과 보고서" };
    expect(diagnoseWorkflow(f).findings.some(x => x.text.includes("조직 간 전달"))).toBe(false);
  });
  it("exports organization lanes and complete work detail report with safe SVG text", () => {
    const f = workflowTemplate("collaboration", 0);
    f.nodes[0].work = { organization: "<조직&>", owner: "담당자", input: "요청", output: "산출물", issue: "중복", improvement: "통합", action: "simplify" };
    f.edges[0].collaboration = { kind: "handoff", deliverable: "합의서", agreement: "서명 완료" };
    const arranged = arrangeWorkflow(f), svg = flowSvg(arranged), b = flowBounds(arranged);
    expect(svg).toContain("&lt;조직&amp;&gt;"); expect(svg).not.toContain("<조직&>");
    expect(svg).toContain("단순화"); expect(svg).toContain("전달");
    for (const l of workflowLanes(arranged)) {
      expect(l.x).toBeGreaterThanOrEqual(b.x); expect(l.x + l.width).toBeLessThanOrEqual(b.x + b.width);
      expect(l.y + l.height).toBeLessThanOrEqual(b.y + b.height);
    }
    const report = workflowReport(arranged);
    for (const text of ["서명 완료", "합의서", "중복", "통합", "단순화", "전체 처리 시간은 아닙니다"]) expect(report).toContain(text);
    expect(workflowText(arranged)).toContain("서명 완료");
    expect(workflowText(arranged)).toContain("통합");
  });
});
