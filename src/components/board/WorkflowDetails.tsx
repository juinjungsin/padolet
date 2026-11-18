"use client";
import type { FlowNode } from "@/lib/flowchart";
import { ACTIONS, WorkDetails } from "@/lib/workflow";

const field = "w-full min-w-0 rounded-lg border border-silver-mist bg-white p-2 text-sm";
export default function WorkflowDetails({ node, editable, onChange }: { node: FlowNode; editable: boolean; onChange: (work: WorkDetails) => void }) {
  const work = node.work ?? {};
  function patch(value: Partial<WorkDetails>) { onChange({ ...work, ...value }); }
  return <aside className="min-w-0 rounded-xl border border-silver-mist bg-white p-3 space-y-3 max-h-[640px] overflow-y-auto" aria-label="업무 상세">
    <div><h3 className="font-semibold">업무 파악 · {node.label}</h3><p className="text-xs text-slate-text mt-1">누가, 무엇을 받아, 어떤 결과를 만드는지 기록하세요. 아래 개선안은 현재 업무와 함께 보존됩니다.</p></div>
    <fieldset disabled={!editable} className="space-y-3 min-w-0">
      {([["organization", "담당 조직", "예: 영업팀"], ["owner", "담당 역할", "예: 견적 담당자"], ["system", "사용 시스템", "예: ERP, 엑셀, 메신저"]] as const).map(([key, label, placeholder]) => <label key={key} className="block text-xs space-y-1"><span>{label}</span><input className={field} maxLength={key === "system" ? 1000 : 80} value={work[key] ?? ""} placeholder={placeholder} onChange={e => patch({ [key]: e.target.value })} /></label>)}
      {([["input", "입력·시작 조건", "무엇을 받으면 시작하나요?"], ["output", "산출물·완료 결과", "다음 담당자에게 무엇을 넘기나요?"]] as const).map(([key, label, placeholder]) => <label key={key} className="block text-xs space-y-1"><span>{label}</span><textarea aria-label={label} rows={2} className={field} maxLength={1000} value={work[key] ?? ""} placeholder={placeholder} onChange={e => patch({ [key]: e.target.value })} /></label>)}
      <div className="grid grid-cols-2 gap-2">{([["minutes", "작업 시간(분)"], ["waitMinutes", "대기 시간(분)"]] as const).map(([key, label]) => <label key={key} className="block text-xs space-y-1"><span>{label}</span><input className={field} type="number" min={0} max={1000000} step="any" value={work[key] ?? ""} placeholder="미입력" onChange={e => {
        if (e.target.value === "") { const next = { ...work }; delete next[key]; onChange(next); }
        else { const value = e.target.valueAsNumber; if (Number.isFinite(value) && value >= 0 && value <= 1000000) patch({ [key]: value }); }
      }} /></label>)}</div>
      <label className="block text-xs space-y-1"><span>현재 문제점</span><textarea aria-label="현재 문제점" className={field} rows={2} maxLength={1000} placeholder="중복 입력, 재작업, 승인 대기 등" value={work.issue ?? ""} onChange={e => patch({ issue: e.target.value })} /></label>
      <label className="block text-xs space-y-1"><span>개선 방향</span><select aria-label="개선 방향" className={field} value={work.action ?? ""} onChange={e => { if (!e.target.value) { const next = { ...work }; delete next.action; onChange(next); } else patch({ action: e.target.value as WorkDetails["action"] }); }}><option value="">아직 미정</option>{Object.entries(ACTIONS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label className="block text-xs space-y-1"><span>개선 후 업무안</span><textarea aria-label="개선 후 업무안" className={field} rows={3} maxLength={1000} placeholder="무엇을 어떻게 바꾸고, 누구와 합의해야 하나요?" value={work.improvement ?? ""} onChange={e => patch({ improvement: e.target.value })} /></label>
    </fieldset>
  </aside>;
}
