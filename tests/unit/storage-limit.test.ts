import { describe, expect, it } from "vitest";
import { MAX_FILE_SIZE, MAX_FILE_SIZE_MB, validateFiles } from "@/lib/storage";

// 파일 1개 크기 상한 (2026-10 50MB → 100MB) — storage.rules와 같은 경계
const MB = 1024 * 1024;
// 실제 바이트 없이 크기만 가진 파일 (validateFiles는 이름·형식·크기만 본다)
const fakeFile = (name: string, size: number, type = "video/mp4") => ({ name, size, type }) as File;

describe("첨부 파일 크기 상한", () => {
  it("상한은 100MB", () => {
    expect(MAX_FILE_SIZE_MB).toBe(100);
    expect(MAX_FILE_SIZE).toBe(100 * MB);
  });

  it("예전 상한(50MB)을 넘는 파일과 정확히 100MB인 파일은 통과", () => {
    const { valid, errors } = validateFiles([fakeFile("강의영상.mp4", 60 * MB), fakeFile("꽉찬.mp4", 100 * MB)]);
    expect(valid.map((f) => f.name)).toEqual(["강의영상.mp4", "꽉찬.mp4"]);
    expect(errors).toEqual([]);
  });

  it("100MB를 1바이트라도 넘으면 거절하고 안내", () => {
    const { valid, errors } = validateFiles([fakeFile("큰파일.mp4", 100 * MB + 1)]);
    expect(valid).toEqual([]);
    expect(errors[0]).toMatch(/^큰파일\.mp4 — 100MB 초과/);
  });
});
