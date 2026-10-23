import { describe, expect, it } from "vitest";
import { countActivityByAuthor } from "@/lib/metrics";

describe("countActivityByAuthor", () => {
  it("동명이인을 참여 식별자로 구분한다", () => {
    const posts = [{ authorId: "u1" }, { authorId: "u2" }, { authorId: "u1" }];
    const messages = [{ authorId: "u2" }, { authorId: undefined }];
    const stats = countActivityByAuthor(posts, messages);
    expect(stats.get("u1")).toEqual({ postCount: 2, msgCount: 0 });
    expect(stats.get("u2")).toEqual({ postCount: 1, msgCount: 1 });
    expect(stats.size).toBe(2); // 식별자 없는 항목은 집계하지 않음
  });
});
