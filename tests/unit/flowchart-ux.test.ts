import { describe, expect, it } from "vitest";
import { EMPTY_FLOW, flowBounds, zoomFlow, validFlowchart, Flowchart } from "@/lib/flowchart";
import { flowSvg, imageSize, flowFilename } from "@/lib/flowchart-image";
const flow: Flowchart = { ...EMPTY_FLOW, nodes: [{ id: "a", label: '<시작 & "확인">', kind: "step", x: -3000, y: -2000 }, { id: "b", label: "끝", kind: "terminal", x: 4000, y: 5000 }], edges: [{ id: "ab", from: "a", to: "b", label: "예 & 아니오" }] };
describe("flowchart canvas and image", () => {
  it("accepts negative and large coordinates and bounds the whole graph", () => {
    expect(validFlowchart(flow)).toBe(true);
    const b = flowBounds(flow);
    expect(b.x).toBeLessThan(-3000); expect(b.y).toBeLessThan(-2000);
    expect(b.x + b.width).toBeGreaterThan(4180); expect(b.y + b.height).toBeGreaterThan(5080);
  });
  it("zoom preserves the anchor with no fixed min/max zoom", () => {
    const v = { x: -500, y: -400, width: 1000, height: 800 };
    expect(zoomFlow(v, 2, { x: 0, y: 0 })).toEqual({ x: -250, y: -200, width: 500, height: 400 });
    expect(zoomFlow(v, 100000).width).toBe(0.01);
    expect(zoomFlow(v, 0.000001).width).toBe(1e9);
    expect(zoomFlow(v, 0)).toEqual(v);
  });
  it("exports escaped labels, all shapes and connectors within raster memory limits", () => {
    const svg = flowSvg(flow);
    expect(svg).toContain("&lt;시작 &amp;"); expect(svg).not.toContain('<시작');
    expect(svg).toContain('marker-end="url(#arrow)"');
    expect(svg).toContain('translate(-3000,-2000)'); expect(svg).toContain('translate(4000,5000)');
    const size = imageSize(flow);
    expect(size.width * size.height).toBeLessThanOrEqual(16000000);
    expect(Math.max(size.width, size.height)).toBeLessThanOrEqual(8192);
    expect(flowFilename("업무/검토", "jpg")).toBe("업무_검토.jpg");
  });
});
