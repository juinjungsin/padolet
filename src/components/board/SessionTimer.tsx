"use client";

import { useEffect, useState } from "react";
import { SessionTimer, startSessionTimer, stopSessionTimer } from "@/lib/firestore";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { RiTimerFlashLine, RiStopFill } from "react-icons/ri";

const PRESETS = [1, 3, 5, 10, 15, 20, 30];
// 타이머 종료 후 배너를 유지하는 시간 (ms)
const ENDED_BANNER_MS = 30_000;

function format(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/**
 * 세션 동기화 타이머 배너.
 * admin이 시작한 타이머(session.timer)를 모든 참여자 화면 상단에 표시.
 * 남은 시간은 endsAt(서버 기록)과 로컬 시계의 차로 계산 → 모든 화면에서 동일.
 */
export function SessionTimerBanner({
  timer,
  isAdmin,
  sessionId,
}: {
  timer: SessionTimer | null | undefined;
  isAdmin: boolean;
  sessionId: string;
}) {
  const [now, setNow] = useState(() => Date.now());

  const endsAtMs = timer?.endsAt?.toMillis?.() ?? null;
  const active = !!timer?.running && endsAtMs !== null;

  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [active]);

  if (!active || endsAtMs === null) return null;

  const remainingSec = Math.ceil((endsAtMs - now) / 1000);
  const ended = remainingSec <= 0;

  // 종료 후 일정 시간이 지나면 배너 자동 숨김
  if (ended && now - endsAtMs > ENDED_BANNER_MS) return null;

  return (
    <div
      className={`flex items-center justify-center gap-3 px-4 py-2 border-b border-silver-mist text-sm ${
        ended ? "bg-buttercup text-ochre" : "bg-graphite text-chalk-card"
      }`}
      role="timer"
      aria-live="polite"
    >
      <RiTimerFlashLine size={16} />
      {ended ? (
        <span className="font-semibold">시간이 종료되었습니다</span>
      ) : (
        <>
          <span className="font-mono font-bold text-base tabular-nums tracking-wider">
            {format(remainingSec)}
          </span>
          <span className="opacity-70 hidden sm:inline">{timer!.durationMin}분 타이머 진행 중</span>
        </>
      )}
      {isAdmin && (
        <button
          onClick={() => stopSessionTimer(sessionId).catch(() => {})}
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${
            ended
              ? "border-ochre/40 hover:border-ochre"
              : "border-chalk-card/40 hover:border-chalk-card"
          }`}
          title="타이머 중지"
        >
          <RiStopFill size={12} />
          중지
        </button>
      )}
    </div>
  );
}

/** admin 전용 — 세션 타이머 시작 모달 */
export function SessionTimerModal({
  open,
  onClose,
  sessionId,
}: {
  open: boolean;
  onClose: () => void;
  sessionId: string;
}) {
  const [minutes, setMinutes] = useState(5);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");

  async function handleStart() {
    if (minutes < 1 || minutes > 180) {
      setError("1~180분 사이로 설정해주세요.");
      return;
    }
    setStarting(true);
    setError("");
    try {
      await startSessionTimer(sessionId, minutes);
      onClose();
    } catch {
      setError("타이머 시작에 실패했습니다. 잠시 후 다시 시도해주세요.");
    }
    setStarting(false);
  }

  return (
    <Modal open={open} onClose={onClose} className="max-w-sm" showClose>
      <div className="px-6 pb-6">
        <h2
          className="font-display text-2xl text-graphite mb-1 flex items-center gap-2"
          style={{ fontWeight: 700, letterSpacing: "-0.5px" }}
        >
          <RiTimerFlashLine size={20} />
          세션 타이머
        </h2>
        <p className="text-xs text-slate-text mb-5">
          모든 참여자와 프로젝터 화면에 동일한 카운트다운이 표시됩니다.
        </p>

        <div className="flex flex-wrap gap-2 mb-4">
          {PRESETS.map((m) => (
            <button
              key={m}
              onClick={() => setMinutes(m)}
              className={`px-3 py-1.5 rounded-full text-xs font-semibold border cursor-pointer transition-colors ${
                minutes === m
                  ? "bg-graphite text-chalk-card border-graphite"
                  : "bg-chalk-card text-ink border-silver-mist hover:border-graphite"
              }`}
            >
              {m}분
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2 mb-5">
          <input
            type="number"
            min={1}
            max={180}
            value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="w-20 px-3 py-2 text-sm text-ink bg-vellum border border-silver-mist rounded-lg outline-none focus:border-graphite text-center"
            aria-label="타이머 분"
          />
          <span className="text-sm text-slate-text">분</span>
        </div>

        {error && <p className="text-xs text-terracotta mb-3">{error}</p>}

        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            취소
          </Button>
          <Button onClick={handleStart} disabled={starting}>
            {starting ? "시작 중..." : "타이머 시작"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
