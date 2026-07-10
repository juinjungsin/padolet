"use client";

import { useMemo, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import WaveDecor, { WaveUnderline } from "@/components/ui/WaveDecor";
import ResultView from "@/components/assessment/ResultView";
import { DIMENSIONS, findQuestion } from "@/lib/assessment/questions";
import { computeResult, nextQuestionFor } from "@/lib/assessment/engine";
import {
  AnswerRecord,
  AssessmentResult,
  DimensionId,
  Question,
  SelfProfile,
} from "@/lib/assessment/types";

/**
 * 클로드 사용자 레벨 측정 페이지.
 *
 * 흐름: 소개 → 자기 평가(2문항, 점수 미반영) → 적응형 측정(10문항) → 결과.
 * 1라운드는 차원별 medium 5문항, 응답 품질에 따라 2라운드에서
 * hard/easy로 분기해 적은 문항으로 변별력을 높인다.
 */

type Stage = "intro" | "profile" | "quiz" | "result";

/* ───────────── 자기 평가 프로파일 문항 ───────────── */

const PROFILE_QUESTIONS = [
  {
    key: "frequency" as const,
    prompt: "클로드(또는 다른 AI 어시스턴트)를 얼마나 자주 사용하나요?",
    options: [
      "거의 안 써봤다",
      "가끔 궁금할 때 써본다",
      "주 몇 회, 업무·학습에 쓴다",
      "매일 업무 깊숙이 쓰고 있다",
    ],
  },
  {
    key: "breadth" as const,
    prompt: "주로 어떤 범위까지 활용하나요?",
    options: [
      "간단한 질문·답변 정도",
      "글쓰기·요약 등 문서 작업",
      "분석·코드 등 복잡한 작업",
      "자동화·에이전트 등 워크플로 통합",
    ],
  },
];

/** 문항 id 기반 결정적 셔플 — 렌더마다 순서가 흔들리지 않도록 */
function seededShuffle<T>(items: T[], seed: string): T[] {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const rand = () => {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    h >>>= 0;
    return h / 4294967296;
  };
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

const TOTAL_QUIZ_QUESTIONS = DIMENSIONS.length * 2;

export default function ClaudeLevelPage() {
  const [stage, setStage] = useState<Stage>("intro");
  const [profile, setProfile] = useState<SelfProfile>({
    frequency: -1,
    breadth: -1,
  });
  const [profileStep, setProfileStep] = useState(0);

  // 적응형 큐: 1라운드(medium 5문항)로 시작, 응답에 따라 2라운드 문항이 붙는다
  const [queue, setQueue] = useState<Question[]>([]);
  const [queueIndex, setQueueIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<DimensionId, AnswerRecord[]>>(
    new Map()
  );
  const [selectedChoice, setSelectedChoice] = useState<string | null>(null);
  const [result, setResult] = useState<AssessmentResult | null>(null);

  function startQuiz() {
    setQueue(DIMENSIONS.map((d) => findQuestion(d.id, "medium")));
    setQueueIndex(0);
    setAnswers(new Map());
    setSelectedChoice(null);
    setStage("quiz");
  }

  function restart() {
    setStage("intro");
    setProfile({ frequency: -1, breadth: -1 });
    setProfileStep(0);
    setResult(null);
  }

  function answerProfile(value: number) {
    const key = PROFILE_QUESTIONS[profileStep].key;
    const next = { ...profile, [key]: value };
    setProfile(next);
    if (profileStep + 1 < PROFILE_QUESTIONS.length) {
      setProfileStep(profileStep + 1);
    } else {
      startQuiz();
    }
  }

  function confirmAnswer() {
    if (!selectedChoice) return;
    const question = queue[queueIndex];
    const record: AnswerRecord = {
      questionId: question.id,
      choiceId: selectedChoice,
    };

    const nextAnswers = new Map(answers);
    const list = [...(nextAnswers.get(question.dimension) ?? []), record];
    nextAnswers.set(question.dimension, list);
    setAnswers(nextAnswers);

    // 1라운드(medium) 응답이면 2라운드 문항을 큐 끝에 추가
    const nextQueue =
      question.difficulty === "medium"
        ? [...queue, nextQuestionFor(question.dimension, record)]
        : queue;
    setQueue(nextQueue);
    setSelectedChoice(null);

    if (queueIndex + 1 < nextQueue.length) {
      setQueueIndex(queueIndex + 1);
    } else {
      setResult(computeResult(nextAnswers, profile));
      setStage("result");
    }
  }

  return (
    <main className="flex-1 relative flex flex-col items-center px-4 py-10 md:py-16 overflow-hidden">
      <div className="relative z-10 w-full flex flex-col items-center">
        {stage === "intro" && <Intro onStart={() => setStage("profile")} />}

        {stage === "profile" && (
          <ProfileStep
            step={profileStep}
            question={PROFILE_QUESTIONS[profileStep]}
            onAnswer={answerProfile}
          />
        )}

        {stage === "quiz" && queue[queueIndex] && (
          <QuizStep
            question={queue[queueIndex]}
            index={queueIndex}
            total={TOTAL_QUIZ_QUESTIONS}
            selectedChoice={selectedChoice}
            onSelect={setSelectedChoice}
            onConfirm={confirmAnswer}
          />
        )}

        {stage === "result" && result && (
          <ResultView result={result} onRetry={restart} />
        )}
      </div>

      {stage !== "quiz" && <WaveDecor />}
    </main>
  );
}

/* ───────────── 소개 화면 ───────────── */

function Intro({ onStart }: { onStart: () => void }) {
  return (
    <div className="w-full max-w-xl text-center">
      <span className="inline-block bg-linen text-ochre text-xs font-semibold px-3.5 py-1.5 rounded-full mb-6 tracking-wide">
        AI Fluency 레벨 테스트
      </span>
      <h1
        className="font-display text-4xl md:text-5xl text-graphite mb-4"
        style={{ fontWeight: 700, letterSpacing: "-1px", lineHeight: 1.15 }}
      >
        나의 클로드 레벨은?
      </h1>
      <WaveUnderline className="mx-auto mb-5" />
      <p className="text-sm md:text-base text-slate-text leading-relaxed mb-8 max-w-md mx-auto">
        지식 암기가 아닌 <strong className="text-ink">실무 상황에서의 판단</strong>
        으로 측정합니다. 응답에 따라 문항 난이도가 달라지는 적응형 방식이라,
        단 10문항으로 정밀하게 진단해요.
      </p>

      <Card className="p-6 rounded-2xl text-left mb-8">
        <p className="text-xs text-ash-text uppercase tracking-wider font-semibold mb-4">
          측정하는 5가지 역량
        </p>
        <ul className="flex flex-col gap-3">
          {DIMENSIONS.map((d) => (
            <li key={d.id} className="flex items-baseline gap-3">
              <span className="shrink-0 text-xs font-bold text-blueprint bg-blossom px-2.5 py-1 rounded-full">
                {d.name}
              </span>
              <span className="text-sm text-slate-text leading-relaxed">
                {d.summary}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 pt-4 border-t border-silver-mist/60 text-xs text-ash-text leading-relaxed">
          Anthropic <strong>Claude Academy</strong>의 AI Fluency 프레임워크
          (4D: Delegation·Description·Discernment·Diligence)에 기반한 설계입니다.
        </p>
      </Card>

      <Button onClick={onStart} className="px-8 py-3 text-base">
        측정 시작하기
      </Button>
      <p className="mt-3 text-xs text-ash-text">약 5분 · 자기 평가 2문항 + 측정 10문항</p>
    </div>
  );
}

/* ───────────── 자기 평가 단계 ───────────── */

function ProfileStep({
  step,
  question,
  onAnswer,
}: {
  step: number;
  question: (typeof PROFILE_QUESTIONS)[number];
  onAnswer: (value: number) => void;
}) {
  return (
    <div className="w-full max-w-xl">
      <p className="text-xs text-ash-text uppercase tracking-wider font-semibold mb-2 text-center">
        시작 전 자기 평가 {step + 1} / {PROFILE_QUESTIONS.length}
      </p>
      <p className="text-xs text-slate-text text-center mb-6">
        점수에 반영되지 않아요. 결과에서 자기 인식과 실측을 비교해 드립니다.
      </p>
      <Card className="p-6 md:p-8 rounded-2xl">
        <h2 className="text-lg font-bold text-graphite mb-6">{question.prompt}</h2>
        <div className="flex flex-col gap-3">
          {question.options.map((opt, i) => (
            <button
              key={i}
              onClick={() => onAnswer(i)}
              className="text-left px-4 py-3.5 rounded-xl border border-silver-mist bg-chalk-card hover:border-blueprint hover:bg-vellum transition-colors cursor-pointer text-sm text-ink"
            >
              {opt}
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
}

/* ───────────── 측정 문항 단계 ───────────── */

function QuizStep({
  question,
  index,
  total,
  selectedChoice,
  onSelect,
  onConfirm,
}: {
  question: Question;
  index: number;
  total: number;
  selectedChoice: string | null;
  onSelect: (id: string) => void;
  onConfirm: () => void;
}) {
  const dimension = DIMENSIONS.find((d) => d.id === question.dimension)!;
  const shuffledChoices = useMemo(
    () => seededShuffle(question.choices, question.id),
    [question.id, question.choices]
  );

  return (
    <div className="w-full max-w-xl">
      {/* 진행 바 */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-semibold text-slate-text">
            {index + 1} / {total}
          </span>
          <span className="text-xs font-bold text-blueprint bg-blossom px-2.5 py-1 rounded-full">
            {dimension.name} · {dimension.en}
          </span>
        </div>
        <div
          className="h-1.5 rounded-full bg-silver-mist/60 overflow-hidden"
          role="progressbar"
          aria-valuenow={index + 1}
          aria-valuemin={1}
          aria-valuemax={total}
        >
          <div
            className="h-full rounded-full bg-blueprint transition-all duration-300"
            style={{ width: `${((index + 1) / total) * 100}%` }}
          />
        </div>
      </div>

      <Card className="p-6 md:p-8 rounded-2xl">
        <p className="text-sm text-slate-text leading-relaxed bg-vellum border border-silver-mist/60 rounded-xl px-4 py-3 mb-5">
          {question.scenario}
        </p>
        <h2 className="text-lg font-bold text-graphite mb-6 leading-snug">
          {question.prompt}
        </h2>
        <div className="flex flex-col gap-3">
          {shuffledChoices.map((choice) => {
            const selected = selectedChoice === choice.id;
            return (
              <button
                key={choice.id}
                onClick={() => onSelect(choice.id)}
                aria-pressed={selected}
                className={`text-left px-4 py-3.5 rounded-xl border transition-colors cursor-pointer text-sm leading-relaxed ${
                  selected
                    ? "border-blueprint bg-buttercup/70 text-graphite font-medium"
                    : "border-silver-mist bg-chalk-card hover:border-blueprint/50 hover:bg-vellum text-ink"
                }`}
              >
                {choice.text}
              </button>
            );
          })}
        </div>
        <div className="mt-6 flex justify-end">
          <Button onClick={onConfirm} disabled={!selectedChoice}>
            {index + 1 === total ? "결과 보기" : "다음"}
          </Button>
        </div>
      </Card>
    </div>
  );
}
