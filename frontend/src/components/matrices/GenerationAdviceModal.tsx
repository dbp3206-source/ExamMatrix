import { useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Eye,
  RefreshCw,
  Table2,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { difficultyLabel, examTypeLabel } from '@/constants'
import type { AdviceAllocationCell, DifficultyLevel, ExamType, GenerationAdviceResponse } from '@/types/domain'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AnimatedNumber } from '@/components/motion-primitives/animated-number'
import { cn } from '@/lib/utils'

function formatCellTag(chapterName: string, difficulty: DifficultyLevel, examType?: ExamType) {
  return `${chapterName} · ${difficultyLabel(difficulty)} · ${examTypeLabel(examType || 'OBJECTIVE')}`
}

export interface GenerationAdviceModalProps {
  advice: GenerationAdviceResponse | null
  busy?: boolean
  staleError?: string
  onRefreshAdvice?: () => void
  onKeepOriginal: () => void
  onApplyAdvice: () => void
  onClose: () => void
}

export default function GenerationAdviceModal({
  advice,
  busy = false,
  staleError = '',
  onRefreshAdvice,
  onKeepOriginal,
  onApplyAdvice,
  onClose,
}: GenerationAdviceModalProps) {
  const prefersReducedMotion = useReducedMotion()
  const [showEvidence, setShowEvidence] = useState(false)
  const [showFullMatrix, setShowFullMatrix] = useState(false)
  const [showQuestionDrilldown, setShowQuestionDrilldown] = useState(false)
  const [selectedCellKey, setSelectedCellKey] = useState(
    advice?.increaseCell
      ? `${advice.increaseCell.chapterId}-${advice.increaseCell.difficulty}`
      : ''
  )

  const inc = advice?.increaseCell
  const dec = advice?.decreaseCell
  const batchHistory = useMemo(() => advice?.batchHistory || [], [advice?.batchHistory])
  const cellEvidences = useMemo(() => advice?.cellEvidences || [], [advice?.cellEvidences])

  const allocationSeries = useMemo(() => {
    if (!advice || !inc || !dec) return []
    const findPct = (cells: AdviceAllocationCell[] | undefined, chapterId: number, difficulty: DifficultyLevel) => {
      const match = (cells || []).find(
        (c) => c.chapterId === chapterId && c.difficulty === difficulty
      )
      return match ? { count: match.count, percent: Number(match.percent || 0) } : { count: 0, percent: 0 }
    }

    const stages = [
      ...batchHistory.map((b) => ({
        stage: b.label,
        totalQuestions: b.totalQuestions,
        source: b.source,
        inc: findPct(b.allocations, inc.chapterId, inc.difficulty),
        dec: findPct(b.allocations, dec.chapterId, dec.difficulty),
      })),
      {
        stage: 'Hiện tại',
        totalQuestions: advice.totalQuestions,
        source: 'CURRENT',
        inc: findPct(advice.currentAllocation, inc.chapterId, inc.difficulty),
        dec: findPct(advice.currentAllocation, dec.chapterId, dec.difficulty),
      },
      {
        stage: 'Đề xuất',
        totalQuestions: advice.totalQuestions,
        source: 'PROPOSED',
        inc: findPct(advice.proposedAllocation, inc.chapterId, inc.difficulty),
        dec: findPct(advice.proposedAllocation, dec.chapterId, dec.difficulty),
      },
    ]

    return stages.map((s) => ({
      stage: s.stage,
      totalQuestions: s.totalQuestions,
      incPercent: s.inc.percent,
      incLabel: `${s.inc.count}/${s.totalQuestions} câu · ${s.inc.percent}%`,
      decPercent: s.dec.percent,
      decLabel: `${s.dec.count}/${s.totalQuestions} câu · ${s.dec.percent}%`,
      incCount: s.inc.count,
      decCount: s.dec.count,
    }))
  }, [advice, batchHistory, dec, inc])

  const relevantEvidences = useMemo(() => {
    const focused = cellEvidences.filter((e) => e.isTargetIncrease || e.isTargetDecrease)
    return focused.length ? focused : cellEvidences
  }, [cellEvidences])

  const activeEvidence = useMemo(() => {
    const found = cellEvidences.find((e) => `${e.chapterId}-${e.difficulty}` === selectedCellKey)
    return found || relevantEvidences[0] || null
  }, [cellEvidences, relevantEvidences, selectedCellKey])

  const evidenceChartData = useMemo(
    () =>
      relevantEvidences.map((ev) => ({
        key: `${ev.chapterId}-${ev.difficulty}`,
        name: `${ev.chapterName} (${difficultyLabel(ev.difficulty)})`,
        rate: Number(ev.strugglingRatePercent || 0),
        label:
          ev.eligibleStudents > 0
            ? `${ev.strugglingStudents}/${ev.eligibleStudents} em (${ev.strugglingRatePercent}%)`
            : 'Chưa đủ mẫu',
        isTargetIncrease: Boolean(ev.isTargetIncrease),
        isTargetDecrease: Boolean(ev.isTargetDecrease),
      })),
    [relevantEvidences]
  )

  if (!advice || !inc || !dec) return null

  return (
    <Dialog open onOpenChange={(open: boolean) => { if (!open && !busy) onClose() }}>
      <DialogContent wide className={cn('max-h-[90vh] overflow-y-auto', showEvidence && 'max-w-5xl')}>
        <DialogHeader>
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="indigo">Gợi ý điều chỉnh trước khi sinh đề</Badge>
            {advice.className && (
              <Badge variant="neutral">
                Lớp: {advice.className} ({advice.classStudentCount} học sinh)
              </Badge>
            )}
          </div>
          <DialogTitle className="text-lg leading-snug pt-1">
            {advice.actionTitle}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {staleError && (
            <Alert variant="destructive">
              <AlertDescription className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span>{staleError}</span>
                {onRefreshAdvice && (
                  <Button type="button" size="sm" variant="outline" onClick={onRefreshAdvice} disabled={busy}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Làm mới đề xuất
                  </Button>
                )}
              </AlertDescription>
            </Alert>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm text-left">
              <thead className="border-b border-slate-200 bg-slate-50">
                <tr>
                  <th className="px-4 py-2.5 text-xs font-semibold text-slate-600">Ô ma trận</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600">Hiện tại</th>
                  <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-600">Sau điều chỉnh</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                <tr className="bg-teal-50/40">
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {formatCellTag(inc.chapterName, inc.difficulty, advice.examType)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700 tabular-nums">
                    {inc.currentCount}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-teal-800 tabular-nums">
                    <span className="inline-flex items-center justify-end gap-1">
                      <AnimatedNumber value={inc.proposedCount} />
                      <ArrowUp className="h-3.5 w-3.5 text-teal-700" aria-label="tăng" />
                    </span>
                  </td>
                </tr>
                <tr className="bg-amber-50/40">
                  <td className="px-4 py-3 font-semibold text-slate-900">
                    {formatCellTag(dec.chapterName, dec.difficulty, advice.examType)}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-700 tabular-nums">
                    {dec.currentCount}
                  </td>
                  <td className="px-4 py-3 text-right font-bold text-amber-800 tabular-nums">
                    <span className="inline-flex items-center justify-end gap-1">
                      <AnimatedNumber value={dec.proposedCount} />
                      <ArrowDown className="h-3.5 w-3.5 text-amber-700" aria-label="giảm" />
                    </span>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50/80 p-3.5 text-xs leading-relaxed text-slate-700">
            <p>
              <strong className="text-teal-800">Lý do tăng (+1 {inc.chapterName}):</strong> {inc.reason}
            </p>
            <p>
              <strong className="text-amber-800">Lý do giảm (-1 {dec.chapterName}):</strong> {dec.reason}
            </p>
            <p className="border-t border-slate-200 pt-2 text-[11px] text-slate-600">
              Bảo toàn tổng <strong>{advice.totalQuestions} câu</strong> · tổng điểm dự kiến{' '}
              <strong>{advice.totalPoints} điểm</strong> · sinh <strong>{advice.requestedNumberOfPapers} mã đề</strong>{' '}
              (các mã dùng chung nguồn câu hỏi trong ngân hàng, không làm thay đổi cấu hình ma trận gốc hay đề đã phát).
            </p>
          </div>

          <AnimatePresence initial={false}>
            {showEvidence && (
              <motion.section
                aria-label="Căn cứ và lịch sử phân bổ"
                initial={prefersReducedMotion ? false : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={prefersReducedMotion ? undefined : { opacity: 0, y: -4 }}
                transition={{ duration: prefersReducedMotion ? 0 : 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="grid grid-cols-1 gap-4 border-t border-slate-200 pt-4 lg:grid-cols-2"
              >

                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="flex items-center gap-1.5 text-sm font-bold text-slate-900">
                      <BarChart3 className="h-4 w-4 text-indigo-600" />
                      Lịch sử phân bổ đề (thang 0–100%)
                    </h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setShowFullMatrix((prev) => !prev)}
                    >
                      <Table2 className="h-3.5 w-3.5" />
                      {showFullMatrix ? 'Thu gọn bảng' : 'Xem toàn bộ ma trận'}
                    </Button>
                  </div>

                  <div className="space-y-1 text-[11px] text-slate-600">
                    {batchHistory.map((b) => (
                      <div key={b.requestId} className="flex flex-wrap items-center justify-between gap-1">
                        <span>
                          <strong>{b.label}</strong> · {b.matrixTitle} ({b.totalQuestions} câu, {b.paperCount} mã)
                        </span>
                        <Badge variant="neutral" className="text-[10px]">
                          {b.source === 'ALLOCATION_SNAPSHOT' ? 'Ảnh chụp phân bổ' : 'Tái dựng từ đề phát'}
                        </Badge>
                      </div>
                    ))}
                  </div>

                  <div className="h-56 w-full" role="img" aria-label="Biểu đồ tỷ trọng câu hỏi hai ô thay đổi qua các đợt">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={allocationSeries}
                        layout="vertical"
                        margin={{ top: 4, right: 64, left: 8, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="stage" width={92} tick={{ fontSize: 11 }} />
                        <Tooltip
                          formatter={(_value, name, props) => {
                            const payload = props?.payload as { incLabel?: string; decLabel?: string } | undefined
                            if (name === 'incPercent') return [payload?.incLabel ?? '', `${inc.chapterName} (↑)`]
                            return [payload?.decLabel ?? '', `${dec.chapterName} (↓)`]
                          }}
                        />
                        <Bar dataKey="incPercent" name="incPercent" fill="#0d9488" radius={[0, 4, 4, 0]} barSize={12}>
                          <LabelList dataKey="incLabel" position="right" style={{ fontSize: 10, fill: '#0f766e' }} />
                        </Bar>
                        <Bar dataKey="decPercent" name="decPercent" fill="#d97706" radius={[0, 4, 4, 0]} barSize={12}>
                          <LabelList dataKey="decLabel" position="right" style={{ fontSize: 10, fill: '#b45309' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="overflow-x-auto rounded-lg border border-slate-100">
                    <table className="w-full text-[11px] text-left">
                      <thead className="bg-slate-50 text-slate-600">
                        <tr>
                          <th className="px-2.5 py-1.5 font-semibold">Mốc</th>
                          <th className="px-2.5 py-1.5 font-semibold text-teal-800">{inc.chapterName} (↑)</th>
                          <th className="px-2.5 py-1.5 font-semibold text-amber-800">{dec.chapterName} (↓)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {allocationSeries.map((row) => (
                          <tr key={row.stage}>
                            <td className="px-2.5 py-1.5 font-medium text-slate-800">{row.stage}</td>
                            <td className="px-2.5 py-1.5 tabular-nums">{row.incLabel}</td>
                            <td className="px-2.5 py-1.5 tabular-nums">{row.decLabel}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {showFullMatrix && (
                    <div className="overflow-x-auto rounded-lg border border-slate-200">
                      <table className="w-full text-[11px] text-left">
                        <thead className="bg-slate-50 text-slate-600">
                          <tr>
                            <th className="px-2.5 py-1.5 font-semibold">Toàn bộ ô ma trận</th>
                            <th className="px-2.5 py-1.5 text-right font-semibold">Hiện tại</th>
                            <th className="px-2.5 py-1.5 text-right font-semibold">Đề xuất</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {(advice.currentAllocation || []).map((cell) => {
                            const prop = (advice.proposedAllocation || []).find(
                              (p) => p.chapterId === cell.chapterId && p.difficulty === cell.difficulty
                            )
                            const changed = Boolean(prop && prop.count !== cell.count)
                            return (
                              <tr key={`${cell.chapterId}-${cell.difficulty}`} className={cn(changed && 'bg-indigo-50/40 font-semibold')}>
                                <td className="px-2.5 py-1.5">
                                  {cell.chapterName} · {difficultyLabel(cell.difficulty)}
                                </td>
                                <td className="px-2.5 py-1.5 text-right tabular-nums">
                                  {cell.count} ({cell.percent}%)
                                </td>
                                <td className="px-2.5 py-1.5 text-right tabular-nums">
                                  {prop ? `${prop.count} (${prop.percent}%)` : '—'}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h3 className="text-sm font-bold text-slate-900">
                      Kết quả thực tế của lớp
                    </h3>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => setShowQuestionDrilldown((prev) => !prev)}
                    >
                      <Eye className="h-3.5 w-3.5" />
                      {showQuestionDrilldown ? 'Ẩn số liệu từng câu' : 'Xem số liệu từng câu'}
                    </Button>
                  </div>

                  <div className="h-40 w-full" role="img" aria-label="Tỷ lệ học sinh gặp khó theo ô ma trận">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={evidenceChartData}
                        layout="vertical"
                        margin={{ top: 4, right: 95, left: 8, bottom: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                        <XAxis type="number" domain={[0, 100]} unit="%" tick={{ fontSize: 11 }} />
                        <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                        <Tooltip
                          formatter={(_val, _name, props) => {
                            const payload = props?.payload as { label?: string } | undefined
                            return [payload?.label ?? '', 'Gặp khó / Đủ mẫu']
                          }}
                        />
                        <Bar dataKey="rate" radius={[0, 4, 4, 0]} barSize={18}>
                          {evidenceChartData.map((entry) => (
                            <Cell
                              key={entry.key}
                              fill={entry.isTargetIncrease ? '#e11d48' : '#64748b'}
                            />
                          ))}
                          <LabelList dataKey="label" position="right" style={{ fontSize: 10, fill: '#334155' }} />
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {relevantEvidences.map((ev) => {
                      const key = `${ev.chapterId}-${ev.difficulty}`
                      const isSelected = Boolean(activeEvidence && `${activeEvidence.chapterId}-${activeEvidence.difficulty}` === key)
                      return (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setSelectedCellKey(key)}
                          className={cn(
                            'rounded-lg border px-2.5 py-1 text-xs font-semibold transition-colors cursor-pointer',
                            isSelected
                              ? 'border-indigo-600 bg-indigo-50 text-indigo-900'
                              : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                          )}
                        >
                          {ev.chapterName} · {difficultyLabel(ev.difficulty)}
                        </button>
                      )
                    })}
                  </div>

                  {activeEvidence && (
                    <div className="space-y-2.5 text-xs">
                      <div className="grid grid-cols-2 gap-2 rounded-lg bg-slate-50 p-2.5">
                        <div>
                          <div className="text-[11px] text-slate-500">Gặp khó / Đủ mẫu</div>
                          <div className="font-bold text-slate-900 tabular-nums">
                            {activeEvidence.eligibleStudents > 0
                              ? `${activeEvidence.strugglingStudents}/${activeEvidence.eligibleStudents} em (${activeEvidence.strugglingRatePercent}%)`
                              : 'Chưa có dữ liệu'}
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">Độ phủ lớp</div>
                          <div className="font-bold text-slate-900 tabular-nums">
                            {activeEvidence.observedStudents}/{activeEvidence.classStudentCount} em ({activeEvidence.coveragePercent}%)
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">Đúng / Sai</div>
                          <div className="font-semibold text-slate-800 tabular-nums">
                            {activeEvidence.correctCount} đúng · {activeEvidence.wrongCount} sai
                          </div>
                        </div>
                        <div>
                          <div className="text-[11px] text-slate-500">Bỏ trống / Điểm phần / Chờ chấm</div>
                          <div className="font-semibold text-slate-800 tabular-nums">
                            {activeEvidence.blankCount} trống · {activeEvidence.partialCount} phần · {activeEvidence.waitingGradingCount} chờ
                          </div>
                        </div>
                      </div>

                      <div className="overflow-x-auto rounded-lg border border-slate-100">
                        <table className="w-full text-[11px] text-left">
                          <thead className="bg-slate-50 text-slate-600">
                            <tr>
                              <th className="px-2 py-1.5 font-semibold">Đợt</th>
                              <th className="px-2 py-1.5 text-right font-semibold">Học sinh</th>
                              <th className="px-2 py-1.5 text-right font-semibold">Số câu</th>
                              <th className="px-2 py-1.5 text-right font-semibold">Sai</th>
                              <th className="px-2 py-1.5 text-right font-semibold">Bỏ trống</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {(activeEvidence.batchBreakdowns || []).map((b) => (
                              <tr key={b.requestId}>
                                <td className="px-2 py-1.5 font-medium">{b.label}</td>
                                <td className="px-2 py-1.5 text-right tabular-nums">{b.studentCount}</td>
                                <td className="px-2 py-1.5 text-right tabular-nums">{b.distinctQuestionCount}</td>
                                <td className="px-2 py-1.5 text-right tabular-nums text-rose-700 font-semibold">{b.wrongCount}</td>
                                <td className="px-2 py-1.5 text-right tabular-nums text-slate-600">{b.blankCount}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {showQuestionDrilldown && (
                        <div className="overflow-x-auto rounded-lg border border-slate-200">
                          <table className="w-full text-[11px] text-left">
                            <thead className="bg-slate-50 text-slate-600">
                              <tr>
                                <th className="px-2 py-1.5 font-semibold">Câu hỏi gốc</th>
                                <th className="px-2 py-1.5 text-right font-semibold">Em gặp</th>
                                <th className="px-2 py-1.5 text-right font-semibold">Đúng</th>
                                <th className="px-2 py-1.5 text-right font-semibold">Sai</th>
                                <th className="px-2 py-1.5 text-right font-semibold">Trống</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {activeEvidence.questions?.length ? (
                                activeEvidence.questions.map((q) => (
                                  <tr key={q.questionId}>
                                    <td className="px-2 py-1.5 max-w-[200px]">
                                      <div className="line-clamp-2 text-slate-800">{q.questionSnippet || q.questionId}</div>
                                      <div className="text-[10px] text-slate-400">{(q.batchLabels || []).join(', ')}</div>
                                    </td>
                                    <td className="px-2 py-1.5 text-right tabular-nums">{q.observedStudents}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums text-emerald-700">{q.correctCount}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums text-rose-700 font-semibold">{q.wrongCount}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums text-slate-500">{q.blankCount}</td>
                                  </tr>
                                ))
                              ) : (
                                <tr>
                                  <td colSpan={5} className="px-2 py-3 text-center text-slate-500">
                                    Chưa có dữ liệu từng câu hỏi cho ô này.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </motion.section>
            )}
          </AnimatePresence>
        </div>

        <DialogFooter className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-slate-100">
          <Button
            type="button"
            variant="outline"
            disabled={busy}
            onClick={() => setShowEvidence((prev) => !prev)}
          >
            {showEvidence ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            {showEvidence ? 'Ẩn căn cứ' : 'Xem căn cứ'}
          </Button>
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={busy}
              onClick={onKeepOriginal}
            >
              {busy ? 'Đang sinh đề...' : 'Giữ nguyên và sinh'}
            </Button>
            <Button
              type="button"
              variant="teal"
              disabled={busy || Boolean(staleError)}
              onClick={onApplyAdvice}
            >
              {busy ? 'Đang sinh đề...' : 'Áp dụng và sinh'}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
