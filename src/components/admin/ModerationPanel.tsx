"use client";

import { useState } from "react";
import {
  Session,
  addBannedWord,
  removeBannedWord,
  unblockUserName,
  publishAnnouncement,
  dismissAnnouncement,
} from "@/lib/firestore";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { RiCloseLine, RiDeleteBinLine } from "react-icons/ri";

type Tab = "words" | "users" | "announce";

interface ModerationPanelProps {
  sessionId: string;
  session: Session;
  onClose: () => void;
}

export default function ModerationPanel({ sessionId, session, onClose }: ModerationPanelProps) {
  const [tab, setTab] = useState<Tab>("words");
  const [newWord, setNewWord] = useState("");
  const [announcementText, setAnnouncementText] = useState(
    session.announcement?.content || ""
  );
  const [busy, setBusy] = useState(false);

  const bannedWords = session.bannedWords || [];
  const blockedNames = session.blockedNames || [];
  const announcement = session.announcement;

  async function handleAddWord(e: React.FormEvent) {
    e.preventDefault();
    if (!newWord.trim()) return;
    setBusy(true);
    await addBannedWord(sessionId, newWord);
    setNewWord("");
    setBusy(false);
  }

  async function handlePublish(e: React.FormEvent) {
    e.preventDefault();
    if (!announcementText.trim()) return;
    setBusy(true);
    await publishAnnouncement(sessionId, announcementText);
    setBusy(false);
  }

  async function handleDismiss() {
    setBusy(true);
    await dismissAnnouncement(sessionId);
    setBusy(false);
  }

  return (
    <div className="fixed inset-0 bg-graphite/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-chalk-card border border-silver-mist rounded-3xl shadow-[--shadow-card] w-full max-w-lg max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-silver-mist">
          <h2
            className="font-display text-2xl text-graphite"
            style={{ fontWeight: 700, letterSpacing: "-0.6px" }}
          >
            모더레이션
          </h2>
          <button
            onClick={onClose}
            className="text-slate-text hover:text-graphite cursor-pointer"
            aria-label="닫기"
          >
            <RiCloseLine size={22} />
          </button>
        </div>

        <div className="flex border-b border-silver-mist px-2">
          {([
            ["words", "금칙어"],
            ["users", "차단 사용자"],
            ["announce", "공지"],
          ] as [Tab, string][]).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`px-4 py-3 text-sm cursor-pointer transition-colors ${
                tab === key
                  ? "text-graphite font-semibold border-b-2 border-graphite -mb-px"
                  : "text-slate-text hover:text-graphite"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {tab === "words" && (
            <div>
              <p className="text-xs text-slate-text mb-3">
                대화창과 포스트잇에서 금칙어가 포함된 글 게시를 차단합니다. 대소문자 무시.
              </p>
              <form onSubmit={handleAddWord} className="flex gap-2 mb-4">
                <Input
                  variant="contained"
                  placeholder="금지할 단어"
                  value={newWord}
                  onChange={(e) => setNewWord(e.target.value)}
                />
                <Button type="submit" disabled={busy || !newWord.trim()}>
                  추가
                </Button>
              </form>
              <div className="flex flex-wrap gap-2">
                {bannedWords.length === 0 && (
                  <p className="text-xs text-ash-text">등록된 금칙어가 없습니다.</p>
                )}
                {bannedWords.map((w) => (
                  <span
                    key={w}
                    className="inline-flex items-center gap-1.5 bg-buttercup text-ochre text-xs font-semibold px-3 py-1.5 rounded-full"
                  >
                    {w}
                    <button
                      onClick={() => removeBannedWord(sessionId, w)}
                      className="hover:text-graphite cursor-pointer"
                      aria-label={`${w} 삭제`}
                    >
                      <RiCloseLine size={14} />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {tab === "users" && (
            <div>
              <p className="text-xs text-slate-text mb-3">
                대화 메시지의 점 3개 메뉴에서 사용자를 차단할 수 있습니다. 차단된 이름은 새 메시지를 보낼 수 없습니다.
              </p>
              <div className="space-y-2">
                {blockedNames.length === 0 && (
                  <p className="text-xs text-ash-text">차단된 사용자가 없습니다.</p>
                )}
                {blockedNames.map((name) => (
                  <div
                    key={name}
                    className="flex items-center justify-between border border-silver-mist rounded-lg px-3 py-2"
                  >
                    <span className="text-sm text-ink">{name}</span>
                    <button
                      onClick={() => unblockUserName(sessionId, name)}
                      className="text-xs text-terracotta hover:text-graphite cursor-pointer flex items-center gap-1"
                    >
                      <RiDeleteBinLine size={12} />
                      차단 해제
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === "announce" && (
            <div>
              <p className="text-xs text-slate-text mb-3">
                전체 참여자 화면에 팝업으로 노출됩니다. 동일 내용도 다시 게시하면 새 공지로 처리됩니다.
              </p>
              <form onSubmit={handlePublish} className="flex flex-col gap-3">
                <textarea
                  value={announcementText}
                  onChange={(e) => setAnnouncementText(e.target.value)}
                  placeholder="공지 내용을 입력하세요"
                  rows={5}
                  className="w-full p-3 text-sm text-ink bg-chalk-card border border-silver-mist rounded-md outline-none focus:border-graphite resize-none"
                />
                <div className="flex items-center gap-2">
                  <Button type="submit" disabled={busy || !announcementText.trim()}>
                    게시
                  </Button>
                  {announcement?.active && (
                    <Button type="button" variant="outlined" onClick={handleDismiss} disabled={busy}>
                      현재 공지 철회
                    </Button>
                  )}
                </div>
              </form>
              {announcement?.active && (
                <div className="mt-4 p-3 bg-vellum border border-silver-mist rounded-lg">
                  <p className="text-xs text-slate-text mb-1">현재 활성 공지</p>
                  <p className="text-sm text-ink whitespace-pre-wrap">{announcement.content}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
