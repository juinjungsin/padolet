import { PostColor } from "./firestore";

// 포스트잇 색상 태그 팔레트
// bg는 인라인 스타일로 적용 (Tailwind 클래스 순서에 의존하지 않기 위함)
export const POST_COLOR_STYLES: Record<
  PostColor,
  { bg: string; dot: string; label: string }
> = {
  yellow: { bg: "#FFFBE6", dot: "#E8C84D", label: "노랑" },
  blue: { bg: "#EAF2FB", dot: "#7FA8D9", label: "파랑" },
  green: { bg: "#EAF5EC", dot: "#8BC49A", label: "초록" },
  pink: { bg: "#FDEEF1", dot: "#E8A0AE", label: "분홍" },
};

export function postColorBg(color: PostColor | undefined): string {
  return POST_COLOR_STYLES[color || "yellow"].bg;
}
