import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

// 디자인 토큰 대비 검증 (요구사항 5.3 — 일반 본문 4.5:1 이상, UI 경계 3:1 이상)
const css = readFileSync(path.resolve(__dirname, "../../src/app/globals.css"), "utf8");
const token = (name: string): string => {
  const m = css.match(new RegExp(`--color-${name}:\\s*(#[0-9a-fA-F]{6})`));
  if (!m) throw new Error(`토큰 없음: ${name}`);
  return m[1];
};

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
export function contrast(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}

const SURFACES = ["chalk-card", "parchment", "vellum"];
const TEXT = ["ink", "graphite", "slate-text", "ash-text", "blueprint", "terracotta", "sage", "warn"];

describe("텍스트 토큰 대비 ≥ 4.5:1", () => {
  for (const fg of TEXT) {
    for (const bg of SURFACES) {
      it(`${fg} on ${bg}`, () => {
        expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
      });
    }
  }

  it.each([
    ["chalk-card", "graphite"], // 주요 버튼 글자
    ["chalk-card", "blueprint"],
    ["ochre", "buttercup"], // 강조 바탕 위 텍스트
    ["warn", "warn-bg"], // 도움 필요 배지
    ["sage", "ok-bg"], // 완료 배지
    ["slate-text", "linen"], // 칩
  ])("%s on %s", (fg, bg) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("UI 경계 대비 ≥ 3:1", () => {
  it("입력창 테두리", () => {
    expect(contrast(token("field-border"), token("chalk-card"))).toBeGreaterThanOrEqual(3);
  });
});
