"use client";
import { useState } from "react";
import { updateSession } from "@/lib/firestore";

export default function BoardTitleEditor({ sessionId, title }: { sessionId: string; title: string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return <div className="px-4 py-2 border-b border-silver-mist">
    {!editing ? <button className="text-sm underline" onClick={() => { setDraft(title); setEditing(true); }}>보드 제목 변경</button> : <form className="flex flex-wrap gap-2 items-center" onSubmit={async e => {
      e.preventDefault(); if (!draft.trim() || busy) return;
      setBusy(true); setError("");
      try { await updateSession(sessionId, { title: draft.trim() }); setEditing(false); }
      catch { setError("제목을 저장하지 못했습니다. 관리자 등록 상태와 연결을 확인해 주세요."); }
      finally { setBusy(false); }
    }}>
      <label className="text-sm">보드 제목 <input autoFocus required maxLength={200} value={draft} onChange={e => setDraft(e.target.value)} className="border rounded p-2" /></label>
      <button disabled={busy || !draft.trim()} className="px-3 py-2 rounded bg-graphite text-white">제목 저장</button>
      <button type="button" disabled={busy} onClick={() => setEditing(false)}>취소</button>
    </form>}
    {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
  </div>;
}
