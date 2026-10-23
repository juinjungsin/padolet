"use client";

import { useState } from "react";
import { Post } from "@/lib/firestore";
import { Module, PracticeLink } from "@/lib/practice";
import { deleteModule, saveModule, setActiveModule } from "@/lib/classroom";
import { isMaterialLike } from "@/lib/post-kind";
import { isSafeExternalUrl } from "@/lib/url-safe";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { RiAddLine, RiCloseLine, RiFlagLine } from "react-icons/ri";

interface Props {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  modules: Module[];
  activeModuleId: string | null;
  posts: Post[] | null;
}

const emptyModule = (order: number): Module => ({
  title: "",
  order,
  practiceTitle: "",
  description: "",
  links: [],
  materialPostIds: [],
  dueAt: null,
  submitUrl: null,
  submissionEnabled: false,
});

const label = "block text-sm font-semibold text-ink mb-1";

/** 실습 안내 편집 (P1-01) — 강사만. 활성 실습은 세션당 하나 */
export default function ModuleEditorModal({ open, onClose, sessionId, modules, activeModuleId, posts }: Props) {
  const [draft, setDraft] = useState<Module | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const editing = draft;
  const materials = (posts ?? []).filter((p) => p.id && isMaterialLike(p));

  function startEdit(m: Module | null) {
    setError("");
    setDraft(m ? { ...emptyModule(m.order), ...m, links: [...(m.links ?? [])], materialPostIds: [...(m.materialPostIds ?? [])] } : emptyModule(modules.length));
  }

  function update(patch: Partial<Module>) {
    setDraft((d) => (d ? { ...d, ...patch } : d));
  }

  function validate(m: Module): string | null {
    if (!m.title.trim()) return "모듈명을 입력하세요.";
    if (!m.practiceTitle.trim()) return "실습 제목을 입력하세요.";
    const badLink = m.links.find((l) => l.url.trim() && !isSafeExternalUrl(l.url.trim()));
    if (badLink) return `자료 링크 주소가 올바르지 않습니다: ${badLink.url} (http:// 또는 https://로 시작)`;
    if (m.submitUrl?.trim() && !isSafeExternalUrl(m.submitUrl.trim())) return "제출 링크 주소가 올바르지 않습니다.";
    return null;
  }

  async function handleSave(makeActive: boolean) {
    if (!editing) return;
    const cleaned: Module = {
      ...editing,
      title: editing.title.trim(),
      practiceTitle: editing.practiceTitle.trim(),
      description: editing.description.trim(),
      links: editing.links
        .map((l) => ({ label: l.label.trim(), url: l.url.trim() }))
        .filter((l) => l.url),
      dueAt: editing.dueAt || null,
      submitUrl: editing.submitUrl?.trim() || null,
    };
    const problem = validate(cleaned);
    if (problem) {
      setError(problem);
      return;
    }
    setSaving(true);
    try {
      const id = await saveModule(sessionId, cleaned);
      if (makeActive) await setActiveModule(sessionId, id);
      setDraft(null);
    } catch {
      setError("저장하지 못했습니다. 다시 시도해주세요.");
    }
    setSaving(false);
  }

  async function handleDelete() {
    if (!editing?.id) return;
    if (!confirm(`"${editing.title}" 실습 안내를 삭제하시겠습니까? 교육생의 진행 기록은 남습니다.`)) return;
    setSaving(true);
    try {
      if (editing.id === activeModuleId) await setActiveModule(sessionId, null);
      await deleteModule(sessionId, editing.id);
      setDraft(null);
    } catch {
      setError("삭제하지 못했습니다.");
    }
    setSaving(false);
  }

  return (
    <Modal
      open={open}
      onClose={() => !saving && (setDraft(null), onClose())}
      className="max-w-2xl max-h-[90vh] flex flex-col"
      labelledBy="module-editor-title"
    >
      <div className="px-6 pb-6 overflow-y-auto">
        <h2 id="module-editor-title" className="text-2xl font-bold text-graphite mb-1">
          실습 안내
        </h2>
        <p className="text-sm text-slate-text mb-4">
          현재 실습으로 지정한 안내가 교육생 화면 맨 위에 고정됩니다. 바꾸면 바로 반영되고, 교육생이 쓰던 글은 지워지지 않습니다.
        </p>

        {!editing ? (
          <>
            <ul className="space-y-2 mb-4" aria-label="실습 목록">
              {modules.length === 0 && <li className="text-sm text-slate-text">아직 만든 실습 안내가 없습니다.</li>}
              {modules.map((m) => {
                const active = m.id === activeModuleId;
                return (
                  <li
                    key={m.id}
                    className={`flex flex-wrap items-center gap-2 p-3 rounded-lg border ${active ? "border-graphite bg-buttercup" : "border-silver-mist"}`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-xs text-slate-text">{m.title}</p>
                      <p className="text-base font-semibold text-ink">{m.practiceTitle}</p>
                    </div>
                    {active ? (
                      <span className="inline-flex items-center gap-1 text-sm font-semibold text-ochre">
                        <RiFlagLine size={14} aria-hidden />
                        현재 실습
                      </span>
                    ) : (
                      <Button variant="outlined" onClick={() => setActiveModule(sessionId, m.id!)}>
                        현재 실습으로 지정
                      </Button>
                    )}
                    <Button variant="ghost" onClick={() => startEdit(m)}>
                      편집
                    </Button>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => startEdit(null)}>
                <RiAddLine size={18} aria-hidden className="mr-1" />새 실습 안내
              </Button>
              {activeModuleId && (
                <Button variant="ghost" onClick={() => setActiveModule(sessionId, null)}>
                  현재 실습 해제
                </Button>
              )}
            </div>
          </>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => {
              e.preventDefault();
              handleSave(false);
            }}
          >
            <div>
              <label htmlFor="module-title" className={label}>
                모듈명 <span className="text-terracotta">*</span>
              </label>
              <Input id="module-title" value={editing.title} onChange={(e) => update({ title: e.target.value })} placeholder="예: 2교시 — 노트 연결" />
            </div>
            <div>
              <label htmlFor="module-practice" className={label}>
                실습 제목 <span className="text-terracotta">*</span>
              </label>
              <Input
                id="module-practice"
                value={editing.practiceTitle}
                onChange={(e) => update({ practiceTitle: e.target.value })}
                placeholder="예: 내 노트 3개를 링크로 연결하기"
              />
            </div>
            <div>
              <label htmlFor="module-desc" className={label}>
                설명 (할 일)
              </label>
              <textarea
                id="module-desc"
                value={editing.description}
                onChange={(e) => update({ description: e.target.value })}
                rows={4}
                className="w-full px-4 py-3 text-base text-ink bg-chalk-card border border-field-border rounded-lg outline-none focus:border-graphite resize-y"
              />
            </div>

            <fieldset>
              <legend className={label}>자료 링크</legend>
              <div className="space-y-2">
                {editing.links.map((l, i) => (
                  <div key={i} className="flex flex-col sm:flex-row gap-2">
                    <Input
                      aria-label={`링크 ${i + 1} 이름`}
                      value={l.label}
                      placeholder="이름 (예: 실습 가이드)"
                      onChange={(e) =>
                        update({ links: editing.links.map((x, j): PracticeLink => (j === i ? { ...x, label: e.target.value } : x)) })
                      }
                    />
                    <Input
                      aria-label={`링크 ${i + 1} 주소`}
                      value={l.url}
                      placeholder="https://"
                      onChange={(e) =>
                        update({ links: editing.links.map((x, j): PracticeLink => (j === i ? { ...x, url: e.target.value } : x)) })
                      }
                    />
                    <button
                      type="button"
                      onClick={() => update({ links: editing.links.filter((_, j) => j !== i) })}
                      aria-label={`링크 ${i + 1} 삭제`}
                      className="touch-target shrink-0 inline-flex items-center justify-center w-10 h-10 rounded-full text-slate-text hover:text-terracotta cursor-pointer"
                    >
                      <RiCloseLine size={18} aria-hidden />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => update({ links: [...editing.links, { label: "", url: "" }] })}
                  className="touch-target inline-flex items-center gap-1 h-9 px-3 rounded-full border border-silver-mist text-sm font-semibold text-ink hover:border-graphite cursor-pointer"
                >
                  <RiAddLine size={16} aria-hidden />
                  링크 추가
                </button>
              </div>
            </fieldset>

            {materials.length > 0 && (
              <fieldset>
                <legend className={label}>보드 자료 연결</legend>
                <div className="max-h-40 overflow-y-auto space-y-1 p-2 border border-silver-mist rounded-lg">
                  {materials.map((p) => {
                    const checked = editing.materialPostIds.includes(p.id!);
                    return (
                      <label key={p.id} className="flex items-center gap-2 text-sm text-ink cursor-pointer min-h-8">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            update({
                              materialPostIds: checked
                                ? editing.materialPostIds.filter((id) => id !== p.id)
                                : [...editing.materialPostIds, p.id!],
                            })
                          }
                          className="accent-graphite w-4 h-4"
                        />
                        <span className="truncate">{p.title || p.fileMeta?.name || p.content.split("\n")[0]}</span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>
            )}

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="module-due" className={label}>
                  마감 (선택)
                </label>
                <Input
                  id="module-due"
                  type="datetime-local"
                  value={editing.dueAt ?? ""}
                  onChange={(e) => update({ dueAt: e.target.value || null })}
                />
              </div>
              <div>
                <label htmlFor="module-submit" className={label}>
                  제출 링크 (선택)
                </label>
                <Input
                  id="module-submit"
                  value={editing.submitUrl ?? ""}
                  placeholder="https://"
                  onChange={(e) => update({ submitUrl: e.target.value })}
                />
              </div>
            </div>

            <label className="flex items-start gap-2 p-3 rounded-lg border border-silver-mist cursor-pointer">
              <input
                type="checkbox"
                checked={!!editing.submissionEnabled}
                onChange={(e) => update({ submissionEnabled: e.target.checked })}
                className="accent-graphite w-4 h-4 mt-0.5"
              />
              <span>
                <span className="block text-sm font-semibold text-ink">앱 안 제출함 열기</span>
                <span className="block text-xs text-slate-text">
                  교육생이 이 실습 결과를 글·파일로 제출합니다. 다시 제출하면 이력이 남고, 제출한 교육생끼리 서로의 최신 제출물을 볼 수 있습니다.
                </span>
              </span>
            </label>

            {error && (
              <p role="alert" className="text-sm text-terracotta">
                {error}
              </p>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              {editing.id && (
                <Button type="button" variant="ghost" onClick={handleDelete} disabled={saving} className="mr-auto text-terracotta!">
                  삭제
                </Button>
              )}
              <Button type="button" variant="outlined" onClick={() => setDraft(null)} disabled={saving}>
                취소
              </Button>
              <Button type="submit" variant="ghost" disabled={saving}>
                저장
              </Button>
              {editing.id !== activeModuleId && (
                <Button type="button" onClick={() => handleSave(true)} disabled={saving}>
                  저장하고 현재 실습으로 지정
                </Button>
              )}
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
