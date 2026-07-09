/**
 * 클로드 사용자 레벨 측정 — 도메인 타입.
 *
 * Anthropic AI Fluency 프레임워크(Claude Academy)의 4D
 * (위임 Delegation / 묘사 Description / 분별 Discernment / 성실 Diligence)에
 * 조직·워크플로 관점의 AX 실행력을 더한 5개 차원을 측정한다.
 */

export type DimensionId =
  | "delegation"
  | "description"
  | "discernment"
  | "diligence"
  | "ax";

export type Difficulty = "easy" | "medium" | "hard";

/** 선택지 품질 점수. 3=모범, 2=양호, 1=미흡, 0=부적절 */
export type ChoiceQuality = 0 | 1 | 2 | 3;

export interface Choice {
  id: string;
  text: string;
  quality: ChoiceQuality;
  /** 결과 화면에서 보여줄 선택지별 해설 */
  feedback: string;
}

export interface Question {
  id: string;
  dimension: DimensionId;
  difficulty: Difficulty;
  /** 실무 상황 설명 — 지식 암기가 아닌 판단을 묻기 위한 맥락 */
  scenario: string;
  prompt: string;
  choices: Choice[];
  /** 모범 접근에 대한 종합 해설 */
  insight: string;
}

export interface DimensionMeta {
  id: DimensionId;
  /** 한국어 이름 */
  name: string;
  /** 영문 원어 (4D 표기) */
  en: string;
  /** 한 줄 정의 */
  summary: string;
}

/** 응답 기록 — 채점 엔진의 입력 */
export interface AnswerRecord {
  questionId: string;
  choiceId: string;
}

export interface DimensionResult {
  dimension: DimensionId;
  /** 0–100 능력치 (난이도 가중 반영) */
  score: number;
  answers: AnswerRecord[];
}

export type LevelTier = 1 | 2 | 3 | 4 | 5;

export interface LevelInfo {
  tier: LevelTier;
  /** 파도 테마 레벨명 */
  name: string;
  en: string;
  description: string;
  /** 총점 하한 (이상) */
  minTotal: number;
  /** 모든 차원이 넘어야 하는 최소 점수 (게이트). 없으면 0 */
  minEachDimension: number;
}

/** 시작 전 자기 평가 프로파일 — 점수에는 미반영, 자기 인식 vs 실측 비교용 */
export interface SelfProfile {
  /** 사용 빈도 자기 평가 (0–3) */
  frequency: number;
  /** 활용 범위 자기 평가 (0–3) */
  breadth: number;
}

export interface AssessmentResult {
  total: number;
  level: LevelInfo;
  dimensions: DimensionResult[];
  profile: SelfProfile;
  /** 자기 인식 레벨(프로파일 기반 추정, 1–5)과 실측 레벨의 차이 */
  selfPerceptionTier: LevelTier;
}
