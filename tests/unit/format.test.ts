import { describe, expect, it } from "vitest";
import { formatBytes, formatDateTime, formatTime } from "@/lib/format";

describe("formatBytes", () => {
  it("미확인 용량과 0바이트를 구분한다", () => {
    expect(formatBytes(undefined)).toBe("크기 미확인");
    expect(formatBytes(null)).toBe("크기 미확인");
    expect(formatBytes(Number.NaN)).toBe("크기 미확인");
    expect(formatBytes(-1)).toBe("크기 미확인");
    expect(formatBytes(0)).toBe("0 B");
  });

  it("1KB 미만은 B, 소수 용량은 KB로 표시한다 (0.0MB 금지)", () => {
    expect(formatBytes(68)).toBe("68 B");
    expect(formatBytes(1023)).toBe("1023 B");
    expect(formatBytes(1024)).toBe("1.0 KB");
    expect(formatBytes(12_000)).toBe("11.7 KB");
    expect(formatBytes(40_000)).not.toContain("MB");
  });

  it("MB·GB 단위로 올린다", () => {
    expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
    expect(formatBytes(50 * 1024 * 1024 - 1)).toBe("50.0 MB");
    expect(formatBytes(3 * 1024 ** 3)).toBe("3.0 GB");
  });
});

describe("한국 시간 표시", () => {
  // 2026-10-23T05:30:00Z = 한국 시간 오후 2:30
  const utc = new Date(Date.UTC(2026, 9, 23, 5, 30));

  it("실행 환경의 시간대와 무관하게 Asia/Seoul로 표시한다", () => {
    expect(formatTime(utc)).toBe("오후 02:30");
    expect(formatDateTime(utc)).toBe("2026. 10. 23. 오후 02:30");
  });

  it("Timestamp 형태({toDate})도 받는다", () => {
    expect(formatTime({ toDate: () => utc })).toBe("오후 02:30");
    expect(formatTime(null)).toBe("");
  });
});
