import type { Post, Message } from "./firestore";

export const KANBAN_COLUMNS = [
  { id: "todo", label: "할 일" },
  { id: "doing", label: "진행 중" },
  { id: "done", label: "완료" },
] as const;
export type KanbanStatus = typeof KANBAN_COLUMNS[number]["id"];

/** Move only the selected post; never rewrite another participant's document. */
export function rankBefore(posts: Post[], movingId: string, targetId: string): number {
  const ordered = posts.filter(p => p.id !== movingId).sort((a, b) => a.gridIndex - b.gridIndex);
  const index = ordered.findIndex(p => p.id === targetId);
  if (index < 0) throw new Error("이동할 위치를 찾을 수 없습니다.");
  const next = ordered[index].gridIndex;
  return index === 0 ? next - 1 : (ordered[index - 1].gridIndex + next) / 2;
}

export type MessageSort = "oldest" | "latest" | "author" | "content";
export function sortMessages(messages: Message[], mode: MessageSort): Message[] {
  const time = (m: Message) => m.createdAt?.toMillis?.() ?? 0;
  return [...messages].sort((a, b) => {
    if (mode === "author") return a.authorName.localeCompare(b.authorName, "ko") || time(a) - time(b);
    // Hidden content must not influence visible ordering.
    if (mode === "content") return (a.hidden ? "" : a.content).localeCompare(b.hidden ? "" : b.content, "ko") || time(a) - time(b);
    return mode === "latest" ? time(b) - time(a) : time(a) - time(b);
  });
}
