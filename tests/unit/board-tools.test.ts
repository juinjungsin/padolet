import { describe, expect, it } from "vitest";
import { Timestamp } from "firebase/firestore";
import { rankBefore, sortMessages } from "@/lib/board-layout";
import { sortPosts } from "@/lib/post-kind";
import { EMPTY_FLOW, removeFlowNode, validFlowchart, Flowchart } from "@/lib/flowchart";
import type { Post, Message } from "@/lib/firestore";
const post = (id: string, rank: number): Post => ({ id, gridIndex: rank, content: id, title: id, authorId: id, authorName: id, type: "text", createdAt: Timestamp.fromMillis(rank * 1000) });
describe("board tools", () => {
  it("moves one card before a neighbour without mutating other cards", () => {
    const posts = [post("a", 0), post("b", 1), post("c", 2)];
    expect(rankBefore(posts, "c", "b")).toBe(0.5);
    expect(rankBefore(posts, "c", "a")).toBe(-1);
    expect(posts.map(p => p.gridIndex)).toEqual([0, 1, 2]);
    expect(() => rankBefore(posts, "c", "missing")).toThrow();
  });
  it("sorts dates, titles and authors with pinned cards first", () => {
    const posts = [post("b", 1), post("a", 2), { ...post("z", 3), pinned: true }];
    expect(sortPosts(posts, "oldest").map(p => p.id)).toEqual(["z", "b", "a"]);
    expect(sortPosts(posts, "title").map(p => p.id)).toEqual(["z", "a", "b"]);
    expect(sortPosts(posts, "author").map(p => p.id)).toEqual(["z", "a", "b"]);
  });
  it("sorts messages without mutating the subscription array", () => {
    const messages: Message[] = [{ ...post("b", 1), type: "text" }, { ...post("a", 2), type: "text" }];
    expect(sortMessages(messages, "latest").map(m => m.id)).toEqual(["a", "b"]);
    expect(sortMessages(messages, "author").map(m => m.id)).toEqual(["a", "b"]);
    expect(sortMessages(messages, "content").map(m => m.id)).toEqual(["a", "b"]);
    expect(messages[0].id).toBe("b");
  });
  it("removes a step and its incident edges while preserving other steps", () => {
    const flow: Flowchart = { ...EMPTY_FLOW, nodes: ["a", "b", "c"].map(id => ({ id, label: id, kind: "step", x: 0, y: 0 })), edges: [{ id: "e", from: "a", to: "b", label: "" }] };
    expect(validFlowchart(flow)).toBe(true);
    const next = removeFlowNode(flow, "a");
    expect(next.nodes).toHaveLength(2); expect(next.edges).toHaveLength(0);
    expect(flow.edges).toHaveLength(1);
    expect(validFlowchart({ ...flow, nodes: [] })).toBe(false);
    expect(validFlowchart({ ...flow, nodes: [flow.nodes[0], flow.nodes[0]] })).toBe(false);
    expect(validFlowchart({ ...flow, nodes: [{ ...flow.nodes[0], x: Infinity }] })).toBe(false);
  });
});
