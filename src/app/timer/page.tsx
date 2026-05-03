"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  RiPlayFill,
  RiPauseFill,
  RiRefreshLine,
  RiVolumeUpFill,
  RiVolumeMuteFill,
  RiArrowLeftLine,
} from "react-icons/ri";

const PRESETS = [5, 10, 15, 20, 30, 45, 60];

const MUSIC_SRC = "/audio/break-music.mp3";
const ALARM_SRC = "/audio/ding.mp3";

function format(seconds: number): string {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function TimerContent() {
  const searchParams = useSearchParams();
  const back = searchParams.get("back") || "/";
  const isBoardBack = back.startsWith("/board/");

  const [selectedMin, setSelectedMin] = useState(10);
  const [remaining, setRemaining] = useState(10 * 60);
  const [running, setRunning] = useState(false);
  const [musicOn, setMusicOn] = useState(false);
  const [musicMissing, setMusicMissing] = useState(false);

  const musicRef = useRef<HTMLAudioElement | null>(null);
  const alarmRef = useRef<HTMLAudioElement | null>(null);
  const tickRef = useRef<number | null>(null);

  // 디지털 카운트다운 — setInterval + 절대 시각 보정
  useEffect(() => {
    if (!running) return;

    const startedAt = Date.now();
    const startedRemaining = remaining;

    tickRef.current = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startedAt) / 1000);
      const next = Math.max(0, startedRemaining - elapsed);
      setRemaining(next);
      if (next === 0) {
        setRunning(false);
        if (musicRef.current) {
          musicRef.current.pause();
          musicRef.current.currentTime = 0;
        }
        alarmRef.current?.play().catch(() => {});
      }
    }, 250);

    return () => {
      if (tickRef.current !== null) {
        window.clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [running]);

  // 음악 on/off — 타이머 동작/일시정지에 따라 자동 동기화
  useEffect(() => {
    const audio = musicRef.current;
    if (!audio) return;

    if (musicOn && running) {
      audio.play().catch(() => setMusicMissing(true));
    } else {
      audio.pause();
    }
  }, [musicOn, running]);

  function handleSelect(min: number) {
    if (running) return;
    setSelectedMin(min);
    setRemaining(min * 60);
  }

  function handleStartPause() {
    if (remaining === 0) {
      setRemaining(selectedMin * 60);
      setRunning(true);
      return;
    }
    setRunning((r) => !r);
  }

  function handleReset() {
    setRunning(false);
    setRemaining(selectedMin * 60);
    if (musicRef.current) {
      musicRef.current.pause();
      musicRef.current.currentTime = 0;
    }
  }

  // 진행률 (0~1)
  const total = selectedMin * 60;
  const progress = total > 0 ? 1 - remaining / total : 0;
  const circumference = 2 * Math.PI * 140;
  const strokeOffset = circumference * (1 - progress);

  return (
    <div className="flex-1 flex flex-col bg-parchment">
      {/* 가벼운 헤더 */}
      <div className="max-w-[1200px] mx-auto w-full px-4 md:px-8 h-[72px] flex items-center">
        <Link
          href="/"
          className="flex items-center gap-2 font-display text-xl tracking-tight text-graphite"
          style={{ fontWeight: 700 }}
        >
          <Image src="/icon.png" alt="padolet" width={28} height={28} className="rounded-md" />
          padolet
        </Link>
        <span className="ml-3 text-sm text-slate-text hidden sm:inline">쉬는시간 타이머</span>

        <Link
          href={back}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold bg-transparent text-graphite border border-graphite hover:bg-vellum transition-colors"
        >
          <RiArrowLeftLine size={14} />
          {isBoardBack ? "보드로 돌아가기" : "돌아가기"}
        </Link>
      </div>

      <main className="flex-1 flex flex-col items-center justify-center px-4 py-12">
        <span className="inline-block bg-linen text-ink text-xs font-semibold px-3 py-1 rounded-full mb-6 tracking-wide">
          BREAK · 5–60 MIN
        </span>

        <h1
          className="font-display text-3xl md:text-4xl text-graphite mb-10 text-center"
          style={{ fontWeight: 700, letterSpacing: "-0.9px" }}
        >
          잠시 숨 고르고 돌아오세요
        </h1>

        {/* 디지털 시계 + 진행 링 */}
        <div className="relative w-[320px] h-[320px] flex items-center justify-center mb-10">
          <svg className="absolute inset-0" viewBox="0 0 320 320" aria-hidden="true">
            <circle
              cx="160"
              cy="160"
              r="140"
              fill="none"
              stroke="var(--color-silver-mist)"
              strokeWidth="6"
            />
            <circle
              cx="160"
              cy="160"
              r="140"
              fill="none"
              stroke="var(--color-graphite)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={strokeOffset}
              transform="rotate(-90 160 160)"
              style={{ transition: "stroke-dashoffset 0.4s linear" }}
            />
          </svg>

          <div className="relative flex flex-col items-center">
            <span
              className="font-mono text-graphite tabular-nums"
              style={{
                fontSize: "82px",
                fontWeight: 700,
                letterSpacing: "-0.04em",
                lineHeight: 1,
              }}
            >
              {format(remaining)}
            </span>
            <span className="mt-2 text-xs text-ash-text uppercase tracking-[0.2em]">
              {running ? "RUNNING" : remaining === 0 ? "FINISHED" : "READY"}
            </span>
          </div>
        </div>

        {/* 컨트롤 */}
        <div className="flex items-center gap-3 mb-10">
          <button
            onClick={handleStartPause}
            className="inline-flex items-center justify-center gap-2 rounded-full px-7 py-3 text-sm font-semibold bg-graphite text-chalk-card hover:bg-graphite-dark transition-colors cursor-pointer"
          >
            {running ? <RiPauseFill size={18} /> : <RiPlayFill size={18} />}
            {running ? "일시정지" : remaining === 0 ? "다시 시작" : "시작"}
          </button>

          <button
            onClick={handleReset}
            className="inline-flex items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-semibold bg-transparent text-graphite border border-graphite hover:bg-vellum transition-colors cursor-pointer"
          >
            <RiRefreshLine size={16} />
            초기화
          </button>

          <button
            onClick={() => setMusicOn((m) => !m)}
            disabled={musicMissing}
            title={musicMissing ? "음악 파일이 없어 비활성화 — public/audio/break-music.mp3 추가" : musicOn ? "음악 끄기" : "음악 켜기"}
            className={`inline-flex items-center justify-center w-12 h-12 rounded-full border transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${
              musicOn
                ? "bg-graphite text-chalk-card border-graphite"
                : "bg-transparent text-graphite border-graphite hover:bg-vellum"
            }`}
            aria-pressed={musicOn}
            aria-label="음악 토글"
          >
            {musicOn ? <RiVolumeUpFill size={18} /> : <RiVolumeMuteFill size={18} />}
          </button>
        </div>

        {/* 시간 프리셋 (5분 단위, 5~60분) */}
        <div className="flex flex-wrap justify-center gap-2 max-w-md">
          {PRESETS.map((min) => {
            const active = selectedMin === min;
            return (
              <button
                key={min}
                onClick={() => handleSelect(min)}
                disabled={running}
                className={`px-4 py-2 rounded-full text-xs font-semibold border transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  active
                    ? "bg-graphite text-chalk-card border-graphite"
                    : "bg-chalk-card text-ink border-silver-mist hover:border-graphite"
                }`}
              >
                {min}분
              </button>
            );
          })}
        </div>

        {musicMissing && (
          <p className="mt-3 text-xs text-terracotta">
            음악 파일을 찾을 수 없습니다 — public/audio/break-music.mp3 위치에 추가하세요.
          </p>
        )}
      </main>

      <audio
        ref={musicRef}
        src={MUSIC_SRC}
        loop
        preload="auto"
        onError={() => setMusicMissing(true)}
      />
      <audio ref={alarmRef} src={ALARM_SRC} preload="auto" />
    </div>
  );
}

export default function TimerPage() {
  return (
    <Suspense
      fallback={
        <div className="flex-1 flex items-center justify-center bg-parchment text-slate-text">
          로딩 중...
        </div>
      }
    >
      <TimerContent />
    </Suspense>
  );
}
