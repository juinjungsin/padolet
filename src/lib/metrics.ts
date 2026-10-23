// 참여 지표 정의 — 관리자 목록·보드·참여자 패널·보고서가 모두 같은 이름과 기준을 쓴다 (P0-01)

export const METRICS = {
  cumulative: {
    label: "누적 입장",
    help: "이 세션에 입장한 브라우저 수입니다(보드에 들어온 강사·관리자 포함). 같은 브라우저로 다시 들어오면 1명으로, 다른 기기·시크릿 창은 따로 집계됩니다. 이름이 같아도 합치지 않습니다.",
  },
  recent: {
    label: "최근 활동",
    help: "최근 약 3분 안에 보드를 화면에 띄워 둔 인원입니다. 창을 닫거나 다른 탭으로 옮기면 빠지므로 실제 접속 인원과 다를 수 있습니다.",
  },
} as const;

export interface AuthoredItem {
  authorId?: string;
}

/**
 * 작성자별 활동량 집계 — 참여 식별자(authorId) 기준.
 * 이름 기준으로 세면 동명이인이 한 사람으로 합쳐지므로 사용하지 않는다.
 */
export function countActivityByAuthor(
  posts: AuthoredItem[],
  messages: AuthoredItem[]
): Map<string, { postCount: number; msgCount: number }> {
  const map = new Map<string, { postCount: number; msgCount: number }>();
  const bump = (id: string | undefined, key: "postCount" | "msgCount") => {
    if (!id) return;
    const cur = map.get(id) || { postCount: 0, msgCount: 0 };
    cur[key] += 1;
    map.set(id, cur);
  };
  posts.forEach((p) => bump(p.authorId, "postCount"));
  messages.forEach((m) => bump(m.authorId, "msgCount"));
  return map;
}
