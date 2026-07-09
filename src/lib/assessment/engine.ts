import { DIMENSIONS, QUESTIONS, findQuestion } from "./questions";
import {
  AnswerRecord,
  AssessmentResult,
  ChoiceQuality,
  DimensionId,
  DimensionResult,
  LevelInfo,
  LevelTier,
  Question,
  SelfProfile,
} from "./types";

/**
 * 적응형 채점 엔진 — 순수 함수로만 구성 (UI 비의존, 시뮬레이션 가능).
 *
 * 진행 규칙:
 * - 차원마다 2문항. 1라운드는 항상 medium.
 * - 1라운드 품질 ≥ 2 → 2라운드 hard, 아니면 easy.
 *
 * 채점 규칙:
 * - 능력치 = Σ(품질 × 난이도 가중) / 최대치(= medium 만점 + hard 만점) × 100
 * - easy로 분기한 경로는 만점을 받아도 상한이 낮다(적응형의 의미).
 */

export const DIFFICULTY_WEIGHT = { easy: 0.6, medium: 1.0, hard: 1.4 } as const;

/** 차원당 도달 가능한 최대 원점수: medium 3점 + hard 3×1.4 */
const MAX_RAW = 3 * DIFFICULTY_WEIGHT.medium + 3 * DIFFICULTY_WEIGHT.hard;

/** 1라운드에서 hard로 승급하는 최소 품질 */
export const PROMOTE_THRESHOLD: ChoiceQuality = 2;

/** 문항 ID로 조회 */
export function questionById(id: string): Question {
  const q = QUESTIONS.find((q) => q.id === id);
  if (!q) throw new Error(`문항 없음: ${id}`);
  return q;
}

export function choiceQuality(answer: AnswerRecord): ChoiceQuality {
  const q = questionById(answer.questionId);
  const c = q.choices.find((c) => c.id === answer.choiceId);
  if (!c) throw new Error(`선택지 없음: ${answer.questionId}/${answer.choiceId}`);
  return c.quality;
}

/** 1라운드 응답을 보고 2라운드 문항을 결정 */
export function nextQuestionFor(
  dimension: DimensionId,
  firstAnswer: AnswerRecord
): Question {
  const promoted = choiceQuality(firstAnswer) >= PROMOTE_THRESHOLD;
  return findQuestion(dimension, promoted ? "hard" : "easy");
}

/** 한 차원의 응답 2건 → 0–100 능력치 */
export function scoreDimension(answers: AnswerRecord[]): number {
  const raw = answers.reduce((sum, a) => {
    const q = questionById(a.questionId);
    return sum + choiceQuality(a) * DIFFICULTY_WEIGHT[q.difficulty];
  }, 0);
  return Math.round((raw / MAX_RAW) * 100);
}

export const LEVELS: LevelInfo[] = [
  {
    tier: 1,
    name: "잔물결",
    en: "Ripple",
    description:
      "AI와의 첫 만남 단계예요. 기본 개념부터 차근차근 익히면 금방 물결이 커집니다.",
    minTotal: 0,
    minEachDimension: 0,
  },
  {
    tier: 2,
    name: "물결",
    en: "Wave Rider",
    description:
      "기본적인 활용은 할 수 있지만 아직 결과가 들쭉날쭉한 단계예요. 요청을 구체화하는 연습이 효과적입니다.",
    minTotal: 25,
    minEachDimension: 0,
  },
  {
    tier: 3,
    name: "서퍼",
    en: "Surfer",
    description:
      "일상 업무에서 AI를 능숙하게 활용하는 단계예요. 검증 습관과 과정 설계를 더하면 한 단계 올라섭니다.",
    minTotal: 45,
    minEachDimension: 0,
  },
  {
    tier: 4,
    name: "항해사",
    en: "Navigator",
    description:
      "복잡한 작업을 설계하고 산출물을 비판적으로 다루는 단계예요. 이제 팀과 워크플로로 시야를 넓힐 때입니다.",
    minTotal: 65,
    minEachDimension: 40,
  },
  {
    tier: 5,
    name: "파도를 이끄는 자",
    en: "Wave Maker",
    description:
      "개인의 숙련을 넘어 팀의 변화를 이끌 수 있는 단계예요. 균형 잡힌 역량을 갖춘 AX 리더입니다.",
    minTotal: 83,
    minEachDimension: 60,
  },
];

/**
 * 총점 + 차원 게이트로 레벨 산정.
 * 상위 레벨은 총점 조건과 함께 "모든 차원이 최소치 이상"이어야 한다 —
 * 한 차원이 크게 비면 그 레벨의 역량으로 보기 어렵기 때문.
 */
export function resolveLevel(
  total: number,
  dimensionScores: number[]
): LevelInfo {
  const minDim = Math.min(...dimensionScores);
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    const lv = LEVELS[i];
    if (total >= lv.minTotal && minDim >= lv.minEachDimension) return lv;
  }
  return LEVELS[0];
}

/** 프로파일(자기 평가 0–3 × 2)을 1–5 레벨로 사상 — 자기 인식 vs 실측 비교용 */
export function profileToTier(profile: SelfProfile): LevelTier {
  const sum = profile.frequency + profile.breadth; // 0–6
  if (sum <= 1) return 1;
  if (sum <= 2) return 2;
  if (sum <= 4) return 3;
  if (sum <= 5) return 4;
  return 5;
}

/** 전체 응답 → 최종 결과 */
export function computeResult(
  answersByDimension: Map<DimensionId, AnswerRecord[]>,
  profile: SelfProfile
): AssessmentResult {
  const dimensions: DimensionResult[] = DIMENSIONS.map((d) => {
    const answers = answersByDimension.get(d.id) ?? [];
    return { dimension: d.id, score: scoreDimension(answers), answers };
  });
  const total = Math.round(
    dimensions.reduce((s, d) => s + d.score, 0) / dimensions.length
  );
  return {
    total,
    level: resolveLevel(total, dimensions.map((d) => d.score)),
    dimensions,
    profile,
    selfPerceptionTier: profileToTier(profile),
  };
}

/* ───────────── 차원별 학습 추천 (결과 화면용) ───────────── */

interface Recommendation {
  weak: string;
  mid: string;
  strong: string;
}

export const RECOMMENDATIONS: Record<DimensionId, Recommendation> = {
  delegation: {
    weak: "오늘 한 일 중 '입력과 검증 기준이 명확한 일' 하나를 골라 AI에 맡겨보세요. 요약·형식 변환부터 시작하면 안전합니다.",
    mid: "작업을 맡기기 전에 '내가 남길 일'을 먼저 정하는 습관을 들여보세요. 채팅 외에 에이전트·자동화 같은 형태도 살펴볼 때입니다.",
    strong: "작업 성격에 따라 대화형·에이전트형·API를 가려 쓰고 계시네요. 팀의 위임 기준을 문서화해 공유해 보세요.",
  },
  description: {
    weak: "요청에 '독자·톤·필수 내용·분량' 네 가지를 넣는 것부터 연습하세요. 이 한 가지로 결과가 크게 달라집니다.",
    mid: "결과가 아쉬울 때 '무엇이 아쉬운지'를 구체적 피드백과 좋은 예시로 전달하는 반복 대화를 연습해 보세요.",
    strong: "결과물을 넘어 과정(단계·샘플 검증)까지 설계하고 계시네요. 자주 쓰는 요청을 템플릿 자산으로 정리해 보세요.",
  },
  discernment: {
    weak: "AI가 제시한 수치·인용·사실은 '검증 전까지 초안'이라는 원칙부터 세우세요. 원 출처 확인이 기본입니다.",
    mid: "존재 확인을 넘어 '내용이 맞게 인용됐는지'까지 보는 2단계 검증을 습관화하세요.",
    strong: "논리 검증까지 하고 계시네요. 반대 논증 생성·교차 검증 같은 기법을 팀의 검토 절차로 만들어 보세요.",
  },
  diligence: {
    weak: "민감정보는 '넣기 전에' 가린다 — 이 원칙부터 시작하세요. 소속 조직의 AI 사용 지침도 확인해 보세요.",
    mid: "AI 활용 범위를 투명하게 밝히되 최종 책임은 본인이 지는 태도를 일관되게 유지하세요.",
    strong: "조직 차원의 데이터 정책·검증 책임까지 보고 계시네요. 팀의 사용 지침 초안을 직접 만들어 볼 단계입니다.",
  },
  ax: {
    weak: "매번 반복하는 요청 하나를 템플릿으로 저장하는 것부터 시작하세요. 프롬프트는 소모품이 아니라 자산입니다.",
    mid: "동료의 반복 업무 하나를 골라 함께 템플릿을 만들어 보세요. 확산은 '내 업무에 바로 쓰는 경험'에서 시작됩니다.",
    strong: "워크플로 설계 감각이 좋으시네요. 사람의 검토 지점과 품질 지표를 갖춘 자동화를 실제로 구축해 볼 단계입니다.",
  },
};

export function recommendationFor(dimension: DimensionId, score: number): string {
  const r = RECOMMENDATIONS[dimension];
  if (score >= 80) return r.strong;
  if (score >= 50) return r.mid;
  return r.weak;
}
