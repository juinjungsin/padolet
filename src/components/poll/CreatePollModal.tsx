"use client";

import { useState } from "react";
import { createPoll } from "@/lib/firestore";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { RiCloseLine, RiAddLine } from "react-icons/ri";

interface Props {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  createdBy: string;
}

const MAX_OPTIONS = 6;

export default function CreatePollModal({ open, onClose, sessionId, createdBy }: Props) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [isQuiz, setIsQuiz] = useState(false);
  const [correctIndex, setCorrectIndex] = useState<number>(0);
  const [anonymous, setAnonymous] = useState(true);
  const [busy, setBusy] = useState(false);

  function reset() {
    setQuestion("");
    setOptions(["", ""]);
    setIsQuiz(false);
    setCorrectIndex(0);
    setAnonymous(true);
  }

  function handleClose() {
    if (busy) return;
    reset();
    onClose();
  }

  function updateOption(idx: number, value: string) {
    setOptions((prev) => prev.map((o, i) => (i === idx ? value : o)));
  }

  function addOption() {
    if (options.length >= MAX_OPTIONS) return;
    setOptions((prev) => [...prev, ""]);
  }

  function removeOption(idx: number) {
    if (options.length <= 2) return;
    setOptions((prev) => prev.filter((_, i) => i !== idx));
    if (correctIndex >= idx && correctIndex > 0) setCorrectIndex(correctIndex - 1);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const cleanedOptions = options.map((o) => o.trim()).filter(Boolean);
    if (!question.trim() || cleanedOptions.length < 2) return;

    setBusy(true);
    await createPoll(sessionId, {
      question: question.trim(),
      options: cleanedOptions,
      correctIndex: isQuiz ? Math.min(correctIndex, cleanedOptions.length - 1) : null,
      anonymous,
      createdBy,
    });
    setBusy(false);
    reset();
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} className="max-w-lg" showClose={!busy}>
      <div className="px-6 pt-6 pb-2">
        <h2
          className="font-display text-2xl text-graphite"
          style={{ fontWeight: 700, letterSpacing: "-0.5px" }}
        >
          {isQuiz ? "퀴즈 만들기" : "투표 만들기"}
        </h2>
      </div>

      <form onSubmit={handleSubmit} className="px-6 pb-6 flex flex-col gap-4">
        <div>
          <label className="text-xs uppercase tracking-wider text-ash-text font-semibold mb-1.5 block">
            질문
          </label>
          <textarea
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="예: 가장 인상 깊었던 주제는?"
            rows={2}
            className="w-full p-3 text-sm text-ink bg-chalk-card border border-silver-mist rounded-md outline-none focus:border-graphite resize-none"
          />
        </div>

        <div>
          <label className="text-xs uppercase tracking-wider text-ash-text font-semibold mb-1.5 block">
            선택지
          </label>
          <div className="space-y-2">
            {options.map((opt, idx) => (
              <div key={idx} className="flex items-center gap-2">
                {isQuiz && (
                  <input
                    type="radio"
                    name="correct"
                    checked={correctIndex === idx}
                    onChange={() => setCorrectIndex(idx)}
                    className="accent-sage"
                    title="정답으로 설정"
                  />
                )}
                <input
                  value={opt}
                  onChange={(e) => updateOption(idx, e.target.value)}
                  placeholder={`선택지 ${idx + 1}`}
                  className="flex-1 px-3 py-2 text-sm text-ink bg-chalk-card border border-silver-mist rounded-md outline-none focus:border-graphite"
                />
                {options.length > 2 && (
                  <button
                    type="button"
                    onClick={() => removeOption(idx)}
                    className="text-slate-text hover:text-terracotta cursor-pointer"
                    aria-label="선택지 삭제"
                  >
                    <RiCloseLine size={16} />
                  </button>
                )}
              </div>
            ))}
          </div>
          {options.length < MAX_OPTIONS && (
            <button
              type="button"
              onClick={addOption}
              className="mt-2 inline-flex items-center gap-1 text-xs text-slate-text hover:text-graphite cursor-pointer"
            >
              <RiAddLine size={14} />
              선택지 추가
            </button>
          )}
        </div>

        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2 cursor-pointer text-ink">
            <input
              type="checkbox"
              checked={isQuiz}
              onChange={(e) => setIsQuiz(e.target.checked)}
              className="accent-graphite"
            />
            퀴즈로 (정답 표시)
          </label>
          <label className="flex items-center gap-2 cursor-pointer text-ink">
            <input
              type="checkbox"
              checked={anonymous}
              onChange={(e) => setAnonymous(e.target.checked)}
              className="accent-graphite"
            />
            익명 투표
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="outlined" onClick={handleClose} disabled={busy}>
            취소
          </Button>
          <Button
            type="submit"
            disabled={busy || !question.trim() || options.filter((o) => o.trim()).length < 2}
          >
            {busy ? "게시 중..." : "게시"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
