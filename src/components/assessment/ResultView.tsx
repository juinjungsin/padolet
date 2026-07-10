"use client";

import { useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import RadarChart from "./RadarChart";
import { DIMENSIONS } from "@/lib/assessment/questions";
import {
  LEVELS,
  choiceQuality,
  questionById,
  recommendationFor,
} from "@/lib/assessment/engine";
import { AssessmentResult, DimensionId } from "@/lib/assessment/types";

const QUALITY_LABEL = ["부적절", "미흡", "양호", "모범"] as const;
const QUALITY_COLOR = [
  "text-terracotta",
  "text-ochre",
  "text-dusk-blue",
  "text-sage",
] as const;

interface ResultViewProps {
  result: AssessmentResult;
  onRetry: () => void;
}

export default function ResultView({ result, onRetry }: ResultViewProps) {
  const dimensionName = (id: DimensionId) =>
    DIMENSIONS.find((d) => d.id === id)!;

  const perceptionGap = result.level.tier - result.selfPerceptionTier;

  return (
    <div className="w-full max-w-2xl mx-auto flex flex-col gap-6">
      {/* 레벨 배지 */}
      <Card className="p-8 text-center rounded-2xl">
        <p className="text-xs text-ash-text uppercase tracking-wider font-semibold mb-3">
          측정 결과
        </p>
        <div className="inline-flex items-center gap-2 bg-linen text-ochre text-sm font-bold px-4 py-1.5 rounded-full mb-4">
          Lv.{result.level.tier} / 5
        </div>
        <h2 className="font-display text-4xl md:text-5xl text-graphite mb-1">
          {result.level.name}
        </h2>
        <p className="text-sm text-ash-text mb-4">{result.level.en}</p>
        <p className="text-sm text-slate-text max-w-md mx-auto leading-relaxed">
          {result.level.description}
        </p>
        <div className="mt-6 flex items-baseline justify-center gap-1">
          <span className="font-display text-5xl text-blueprint font-bold">
            {result.total}
          </span>
          <span className="text-sm text-ash-text">/ 100</span>
        </div>

        {/* 레벨 진행 표시 */}
        <div className="mt-6 flex justify-center gap-1.5" aria-hidden="true">
          {LEVELS.map((lv) => (
            <div
              key={lv.tier}
              className={`h-2 w-10 rounded-full ${
                lv.tier <= result.level.tier ? "bg-blueprint" : "bg-silver-mist"
              }`}
            />
          ))}
        </div>
      </Card>

      {/* 자기 인식 vs 실측 */}
      <Card className="p-6 rounded-2xl">
        <h3 className="text-sm font-bold text-graphite mb-2">
          자기 인식 vs 실측
        </h3>
        <p className="text-sm text-slate-text leading-relaxed">
          시작 전 자기 평가로 추정한 레벨은{" "}
          <strong className="text-graphite">
            Lv.{result.selfPerceptionTier}
          </strong>
          , 문항으로 실측한 레벨은{" "}
          <strong className="text-graphite">Lv.{result.level.tier}</strong>
          입니다.{" "}
          {perceptionGap > 0 &&
            "스스로 생각하는 것보다 실전 판단력이 좋으세요. 자신감을 가져도 됩니다."}
          {perceptionGap === 0 &&
            "자기 인식과 실제 역량이 잘 일치합니다. 자신의 강점과 한계를 정확히 알고 있다는 뜻이에요."}
          {perceptionGap < 0 &&
            "사용 경험에 비해 판단 기준이 아직 덜 다져진 상태예요. 아래 약점 차원부터 보완하면 빠르게 올라갑니다."}
        </p>
      </Card>

      {/* 레이더 차트 */}
      <Card className="p-6 rounded-2xl">
        <h3 className="text-sm font-bold text-graphite mb-1">
          5차원 역량 프로필
        </h3>
        <p className="text-xs text-ash-text mb-4">
          Anthropic AI Fluency 4D(위임·묘사·분별·성실) + AX 실행력
        </p>
        <RadarChart
          axes={result.dimensions.map((d) => ({
            label: dimensionName(d.dimension).name,
            value: d.score,
          }))}
        />
      </Card>

      {/* 차원별 상세 + 추천 */}
      <Card className="p-6 rounded-2xl">
        <h3 className="text-sm font-bold text-graphite mb-4">
          차원별 진단과 다음 걸음
        </h3>
        <div className="flex flex-col gap-5">
          {[...result.dimensions]
            .sort((a, b) => a.score - b.score)
            .map((d) => {
              const meta = dimensionName(d.dimension);
              return (
                <div key={d.dimension}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-semibold text-ink">
                      {meta.name}
                      <span className="text-xs text-ash-text font-normal ml-1.5">
                        {meta.en}
                      </span>
                    </span>
                    <span className="text-sm font-bold text-blueprint">
                      {d.score}
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-vellum border border-silver-mist/60 overflow-hidden mb-2">
                    <div
                      className="h-full rounded-full bg-blueprint transition-all"
                      style={{ width: `${d.score}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-text leading-relaxed">
                    {recommendationFor(d.dimension, d.score)}
                  </p>
                </div>
              );
            })}
        </div>
        <p className="mt-5 pt-4 border-t border-silver-mist/60 text-xs text-ash-text leading-relaxed">
          더 깊이 배우고 싶다면 Anthropic의 무료 교육 과정{" "}
          <a
            href="https://www.anthropic.com/learn"
            target="_blank"
            rel="noreferrer"
            className="text-blueprint underline underline-offset-2"
          >
            Claude Academy — AI Fluency
          </a>
          를 추천합니다. 이 측정의 4D 프레임워크가 이 과정에 기반해요.
        </p>
      </Card>

      {/* 문항 리뷰 */}
      <Card className="p-6 rounded-2xl">
        <h3 className="text-sm font-bold text-graphite mb-1">내 답안 돌아보기</h3>
        <p className="text-xs text-ash-text mb-4">
          각 문항의 내 선택과 모범 접근을 비교해 보세요.
        </p>
        <div className="flex flex-col gap-2">
          {result.dimensions.map((d) =>
            d.answers.map((a) => (
              <AnswerReview key={a.questionId} questionId={a.questionId} choiceId={a.choiceId} />
            ))
          )}
        </div>
      </Card>

      <div className="flex justify-center gap-3 pb-4">
        <Button onClick={onRetry}>다시 측정하기</Button>
      </div>
    </div>
  );
}

function AnswerReview({
  questionId,
  choiceId,
}: {
  questionId: string;
  choiceId: string;
}) {
  const [open, setOpen] = useState(false);
  const question = questionById(questionId);
  const myChoice = question.choices.find((c) => c.id === choiceId)!;
  const bestChoice = [...question.choices].sort(
    (a, b) => b.quality - a.quality
  )[0];
  const quality = choiceQuality({ questionId, choiceId });
  const dimension = DIMENSIONS.find((d) => d.id === question.dimension)!;

  return (
    <div className="border border-silver-mist rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left cursor-pointer hover:bg-vellum transition-colors"
        aria-expanded={open}
      >
        <span className="text-sm text-ink flex-1 min-w-0">
          <span className="text-xs font-semibold text-ash-text mr-2">
            {dimension.name}
          </span>
          <span className="line-clamp-1">{question.prompt}</span>
        </span>
        <span
          className={`text-xs font-bold shrink-0 ${QUALITY_COLOR[quality]}`}
        >
          {QUALITY_LABEL[quality]}
        </span>
      </button>
      {open && (
        <div className="px-4 pb-4 pt-1 text-sm flex flex-col gap-3 bg-vellum/50">
          <p className="text-xs text-slate-text leading-relaxed">
            {question.scenario}
          </p>
          <div>
            <p className="text-xs font-semibold text-ash-text mb-1">내 선택</p>
            <p className="text-sm text-ink leading-relaxed">{myChoice.text}</p>
            <p className="text-xs text-slate-text mt-1 leading-relaxed">
              {myChoice.feedback}
            </p>
          </div>
          {myChoice.id !== bestChoice.id && (
            <div>
              <p className="text-xs font-semibold text-sage mb-1">모범 선택</p>
              <p className="text-sm text-ink leading-relaxed">
                {bestChoice.text}
              </p>
            </div>
          )}
          <p className="text-xs text-ochre bg-buttercup/60 rounded-md px-3 py-2 leading-relaxed">
            {question.insight}
          </p>
        </div>
      )}
    </div>
  );
}
