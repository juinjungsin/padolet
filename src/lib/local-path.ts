// 로컬 경로 안내 (P1-06) — 내 컴퓨터에서만 열리는 주소를 감지한다. 경로에 접속해 검사하지 않는다.
// 줄 처음이나 공백·괄호·따옴표 뒤에서 시작하는 경우만 (웹 주소 안에 섞인 문자열은 제외)
const LOCAL_PATH = /(?:^|[\s("'<[])((?:file:\/\/\/?|obsidian:\/\/)\S*)/i;

export const LOCAL_PATH_NOTICE =
  "내 컴퓨터의 파일 경로일 수 있습니다. 다른 사람이 볼 수 있도록 파일을 첨부해 주세요.";

/** 감지된 첫 경로 (없으면 null) */
export function findLocalPath(text: string): string | null {
  return text.match(LOCAL_PATH)?.[1] ?? null;
}
