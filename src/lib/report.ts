// 세션 보고서 직렬화 (MD) — 화면·PDF와 같은 항목 규칙을 쓴다 (P0-02)
// 첨부만 있는 게시물도 빈 항목이 되지 않도록 첨부 줄을 항상 출력한다.
import type { Comment, Message, Participant, Post, Session } from "./firestore";
import { formatBytes, formatDate, formatDateTime, formatTime } from "./format";
import { METRICS } from "./metrics";
import { getPostKind, POST_KIND_LABEL } from "./post-kind";
import { meTooCount, QUESTION_STATUS_LABEL, questionStatus } from "./question";

export interface ReportOptions {
  /** 참여자 명단 포함 (외부 공유 시 끌 수 있음) */
  includeParticipants: boolean;
  /** 첨부 다운로드 링크 포함 — 링크를 아는 사람은 누구나 파일을 열 수 있다 */
  includeLinks: boolean;
}

export const DEFAULT_REPORT_OPTIONS: ReportOptions = {
  includeParticipants: true,
  includeLinks: true,
};

export interface ReportData {
  session: Session;
  participants: Participant[];
  posts: Post[];
  /** postId → 댓글 */
  comments: Record<string, Comment[]>;
  messages: Message[];
  generatedAt?: Date;
}

export interface AttachmentInfo {
  kind: "이미지" | "파일";
  name: string;
  size: string;
  url: string | null;
}

export function getAttachment(item: Pick<Post, "type" | "fileUrl" | "fileMeta">): AttachmentInfo | null {
  if (item.type !== "image" && item.type !== "file") return null;
  if (!item.fileUrl && !item.fileMeta) return null;
  return {
    kind: item.type === "image" ? "이미지" : "파일",
    name: item.fileMeta?.name || (item.type === "image" ? "이미지" : "파일"),
    size: formatBytes(item.fileMeta?.size),
    url: item.fileUrl || null,
  };
}

/** 대화 답장 형식("┃ 이름: 인용\n본문")을 인용과 본문으로 분리 */
export function splitReply(content: string): { quote: string | null; body: string } {
  const lines = content.split("\n");
  if (lines[0]?.startsWith("┃ ") && lines.length >= 2) {
    return { quote: lines[0].slice(2), body: lines.slice(1).join("\n") };
  }
  return { quote: null, body: content };
}

const escapeLinkText = (s: string) => s.replace(/([\[\]\\])/g, "\\$1");
const escapeUrl = (s: string) => s.replace(/ /g, "%20").replace(/\(/g, "%28").replace(/\)/g, "%29");

function attachmentMd(a: AttachmentInfo, includeLinks: boolean): string {
  const name = includeLinks && a.url ? `[${escapeLinkText(a.name)}](${escapeUrl(a.url)})` : a.name;
  return `첨부(${a.kind}): ${name} · ${a.size}`;
}

/** 보고서 항목 표시: 유형(일반 제외)·고정·수정 */
export function postTags(p: Post): string[] {
  const kind = getPostKind(p);
  const question = kind === "question";
  return [
    kind !== "general" && POST_KIND_LABEL[kind],
    question && `상태 ${QUESTION_STATUS_LABEL[questionStatus(p)]}`,
    question && meTooCount(p) > 0 && `저도 궁금해요 ${meTooCount(p)}`,
    p.sourceMessageId && "대화에서 옮김",
    p.pinned && "고정됨",
    p.editedAt && "수정됨",
  ].filter((t): t is string => !!t);
}

/** 여러 줄 본문을 목록 항목 아래에 들여써서 붙인다 */
const indent = (text: string, pad = "  ") => text.split("\n").map((l) => (l ? pad + l : l)).join("\n");

export function buildReportMarkdown(data: ReportData, options: ReportOptions = DEFAULT_REPORT_OPTIONS): string {
  const { session, participants, posts, comments, messages } = data;
  const out: string[] = [];

  out.push(`# ${session.title} — 세션 보고서`, "");
  out.push(`- 생성일: ${formatDate(session.createdAt) || "-"}`);
  out.push(`- 입장 코드: ${session.code}`);
  out.push(`- ${METRICS.cumulative.label}: ${participants.length}명`);
  out.push(`- 포스트잇: ${posts.length}개 · 대화: ${messages.length}건`);
  out.push(`- 출력 시각: ${formatDateTime(data.generatedAt ?? new Date())}`);
  out.push("", `> ${METRICS.cumulative.label}: ${METRICS.cumulative.help}`, "");

  if (options.includeParticipants) {
    out.push(`## 참여자 (${participants.length}명)`, "");
    participants.forEach((p, i) => out.push(`${i + 1}. ${p.name}${p.isAnonymous ? " (익명)" : ""}`));
    out.push("");
  }

  out.push(`## 포스트잇 (${posts.length}개)`, "");
  posts.forEach((p, i) => {
    out.push(`### ${i + 1}. ${p.authorName} · ${formatDateTime(p.createdAt) || "시각 미확인"}`);
    const tags = postTags(p);
    if (tags.length) out.push(`(${tags.join(" · ")})`);
    out.push("");
    if (p.title?.trim()) out.push(`**${p.title.trim()}**`, "");
    if (p.purpose?.trim()) out.push(`사용 목적: ${p.purpose.trim()}`, "");
    if (p.content?.trim()) out.push(p.content.trim(), "");
    const a = getAttachment(p);
    if (a) out.push(`- ${attachmentMd(a, options.includeLinks)}`, "");
    if (!p.content?.trim() && !a) out.push("(내용 없음)", "");
    const list = (p.id && comments[p.id]) || [];
    if (list.length) {
      out.push(`- 댓글 ${list.length}건`);
      list.forEach((c) => out.push(`  - ${c.authorName} (${formatTime(c.createdAt)}): ${c.content.replace(/\n/g, " ")}`));
      out.push("");
    }
  });

  out.push(`## 대화 (${messages.length}건)`, "");
  messages.forEach((m) => {
    const head = `- [${formatTime(m.createdAt) || "--:--"}] ${m.authorName}: `;
    if (m.hidden) {
      out.push(`${head}(관리자가 숨긴 메시지)`);
      return;
    }
    const a = getAttachment(m);
    if (a) {
      // 파일 메시지의 content는 파일명과 같아 중복 출력하지 않음
      const caption = m.content?.trim() && m.content.trim() !== a.name ? ` — ${m.content.trim()}` : "";
      out.push(`${head}${attachmentMd(a, options.includeLinks)}${caption}`);
      return;
    }
    const { quote, body } = splitReply(m.content || "");
    const text = quote ? `${body} (답글 대상 — ${quote})` : body;
    const [first, ...rest] = (text.trim() || "(내용 없음)").split("\n");
    out.push(head + first + (rest.length ? "\n" + indent(rest.join("\n")) : ""));
  });
  out.push("");

  return out.join("\n");
}
