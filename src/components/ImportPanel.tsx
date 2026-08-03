import { useMemo, useRef, useState } from 'react'
import { db } from '../lib/db'
import { goldenScheduleText } from '../lib/fixtures'
import { parseScheduleText } from '../lib/parser'
import { runOcr } from '../lib/ocrWorker'
import type { ParsedImport } from '../lib/types'

export function ImportPanel({ onDone }: { onDone: () => Promise<void> }) {
  const [text, setText] = useState('')
  const [draft, setDraft] = useState<ParsedImport>()
  const [ocrText, setOcrText] = useState('')
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  const lowConfidence = useMemo(() => draft?.rules.filter((rule) => (rule.confidence ?? 1) < 0.7).length ?? 0, [draft])

  const parse = (value = text) => setDraft(parseScheduleText(value))

  async function importDraft() {
    if (!draft) return
    await db.transaction('rw', db.courses, db.scheduleRules, async () => {
      await db.courses.bulkPut(draft.courses)
      await db.scheduleRules.bulkPut(draft.rules)
    })
    setText('')
    setDraft(undefined)
    await onDone()
  }

  async function handleImage(file?: File) {
    if (!file) return
    abortRef.current = new AbortController()
    try {
      setStatus('正在本地识别图片')
      const result = await runOcr(file, (next) => {
        setProgress(Math.round(next.progress * 100))
        setStatus(next.status)
      }, abortRef.current.signal)
      setOcrText(result)
      setText(result)
      parse(result)
    } catch {
      setStatus('OCR 不可用或已取消。可以编辑识别文本后重新解析。')
    }
  }

  return (
    <section className="panel import-panel" aria-label="导入课表">
      <div className="panel-title">
        <h2>导入课表</h2>
        <button className="button ghost" type="button" onClick={() => { setText(goldenScheduleText); parse(goldenScheduleText) }}>载入示例</button>
      </div>
      <label className="field">
        <span>粘贴课表文字</span>
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder="粘贴邮件、PDF、Excel 或 NTU 页面中的课表文本" rows={8} />
      </label>
      <div className="button-row">
        <button className="button primary" type="button" onClick={() => parse()} disabled={!text.trim()}>解析文字</button>
        <label className="button ghost file-button">
          上传截图
          <input type="file" accept="image/*" onChange={(event) => void handleImage(event.target.files?.[0])} />
        </label>
        {status && <span className="muted">{status} {progress ? `${progress}%` : ''}</span>}
        {status && <button className="button ghost" type="button" onClick={() => abortRef.current?.abort()}>取消OCR</button>}
      </div>
      {ocrText && <textarea className="ocr-text" value={ocrText} onChange={(event) => { setOcrText(event.target.value); setText(event.target.value) }} rows={4} aria-label="OCR识别文本" />}
      {draft && (
        <div className="draft">
          <h3>导入确认</h3>
          {lowConfidence > 0 && <p className="warning">{lowConfidence} 条规则置信度较低，请检查后再导入。</p>}
          {draft.courses.map((course, courseIndex) => (
            <article className="draft-card" key={course.id}>
              <label className="field compact"><span>课程代码</span><input value={course.code} onChange={(event) => {
                const next = structuredClone(draft); next.courses[courseIndex].code = event.target.value; setDraft(next)
              }} /></label>
              <label className="field compact"><span>课程名称</span><input value={course.title} onChange={(event) => {
                const next = structuredClone(draft); next.courses[courseIndex].title = event.target.value; setDraft(next)
              }} /></label>
              <label className="field compact"><span>教师</span><input value={course.lecturer} onChange={(event) => {
                const next = structuredClone(draft); next.courses[courseIndex].lecturer = event.target.value; setDraft(next)
              }} /></label>
              {draft.rules.filter((rule) => rule.courseId === course.id).map((rule) => (
                <p className={(rule.confidence ?? 1) < 0.7 ? 'low-confidence' : ''} key={rule.id}>
                  W{rule.weeks.join(',')} · {rule.type === 'onlineTask' ? 'Online Video' : `${rule.weekday ?? '?'} ${rule.startTime ?? '?'}-${rule.endTime ?? '?'} ${rule.venue ?? ''}`}
                </p>
              ))}
            </article>
          ))}
          <div className="button-row">
            <button className="button primary" type="button" onClick={() => void importDraft()}>确认导入</button>
            <button className="button ghost" type="button" onClick={() => setDraft(undefined)}>取消导入</button>
          </div>
        </div>
      )}
    </section>
  )
}
