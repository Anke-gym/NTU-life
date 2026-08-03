import { useMemo, useRef, useState } from 'react'
import { db } from '../lib/db'
import { goldenScheduleText } from '../lib/fixtures'
import { parseScheduleText } from '../lib/parser'
import { runOcr } from '../lib/ocrWorker'
import type { AppLanguage } from '../lib/i18n'
import type { ParsedImport } from '../lib/types'

const copy = {
  zh: {
    importSchedule: '导入课表',
    loadExample: '载入示例',
    pasteText: '粘贴课表文字',
    placeholder: '粘贴邮件、PDF、Excel 或 NTU 页面中的课表文本',
    parseText: '解析文字',
    uploadImage: '上传截图',
    cancelOcr: '取消 OCR',
    ocrLabel: 'OCR 识别文本',
    ocrRunning: '正在本地识别图片',
    ocrFailed: 'OCR 不可用或已取消。可以编辑识别文本后重新解析。',
    review: '导入确认',
    lowConfidence: (count: number) => `${count} 条规则置信度较低，请检查后再导入。`,
    courseCode: '课程代码',
    courseTitle: '课程名称',
    lecturer: '教师',
    confirmImport: '确认导入',
    cancelImport: '取消导入',
  },
  en: {
    importSchedule: 'Import Schedule',
    loadExample: 'Load Example',
    pasteText: 'Paste Schedule Text',
    placeholder: 'Paste schedule text from email, PDF, Excel, or an NTU page',
    parseText: 'Parse Text',
    uploadImage: 'Upload Screenshot',
    cancelOcr: 'Cancel OCR',
    ocrLabel: 'OCR recognized text',
    ocrRunning: 'Recognizing image locally',
    ocrFailed: 'OCR is unavailable or was canceled. Edit the recognized text and parse again.',
    review: 'Import Review',
    lowConfidence: (count: number) => `${count} rules have low confidence. Check them before importing.`,
    courseCode: 'Course Code',
    courseTitle: 'Course Title',
    lecturer: 'Lecturer',
    confirmImport: 'Confirm Import',
    cancelImport: 'Cancel Import',
  },
} as const

export function ImportPanel({ language = 'zh', onDone }: { language?: AppLanguage; onDone: () => Promise<void> }) {
  const [text, setText] = useState('')
  const [draft, setDraft] = useState<ParsedImport>()
  const [ocrText, setOcrText] = useState('')
  const [status, setStatus] = useState('')
  const [progress, setProgress] = useState(0)
  const abortRef = useRef<AbortController | null>(null)
  const t = copy[language]

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
      setStatus(t.ocrRunning)
      const result = await runOcr(file, (next) => {
        setProgress(Math.round(next.progress * 100))
        setStatus(next.status)
      }, abortRef.current.signal)
      setOcrText(result)
      setText(result)
      parse(result)
    } catch {
      setStatus(t.ocrFailed)
    }
  }

  return (
    <section className="panel import-panel" aria-label={t.importSchedule}>
      <div className="panel-title">
        <h2>{t.importSchedule}</h2>
        <button className="button ghost" type="button" onClick={() => { setText(goldenScheduleText); parse(goldenScheduleText) }}>{t.loadExample}</button>
      </div>
      <label className="field">
        <span>{t.pasteText}</span>
        <textarea value={text} onChange={(event) => setText(event.target.value)} placeholder={t.placeholder} rows={8} />
      </label>
      <div className="button-row">
        <button className="button primary" type="button" onClick={() => parse()} disabled={!text.trim()}>{t.parseText}</button>
        <label className="button ghost file-button">
          {t.uploadImage}
          <input type="file" accept="image/*" onChange={(event) => void handleImage(event.target.files?.[0])} />
        </label>
        {status && <span className="muted">{status} {progress ? `${progress}%` : ''}</span>}
        {status && <button className="button ghost" type="button" onClick={() => abortRef.current?.abort()}>{t.cancelOcr}</button>}
      </div>
      {ocrText && <textarea className="ocr-text" value={ocrText} onChange={(event) => { setOcrText(event.target.value); setText(event.target.value) }} rows={4} aria-label={t.ocrLabel} />}
      {draft && (
        <div className="draft">
          <h3>{t.review}</h3>
          {lowConfidence > 0 && <p className="warning">{t.lowConfidence(lowConfidence)}</p>}
          {draft.courses.map((course, courseIndex) => (
            <article className="draft-card" key={course.id}>
              <label className="field compact"><span>{t.courseCode}</span><input value={course.code} onChange={(event) => {
                const next = structuredClone(draft); next.courses[courseIndex].code = event.target.value; setDraft(next)
              }} /></label>
              <label className="field compact"><span>{t.courseTitle}</span><input value={course.title} onChange={(event) => {
                const next = structuredClone(draft); next.courses[courseIndex].title = event.target.value; setDraft(next)
              }} /></label>
              <label className="field compact"><span>{t.lecturer}</span><input value={course.lecturer} onChange={(event) => {
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
            <button className="button primary" type="button" onClick={() => void importDraft()}>{t.confirmImport}</button>
            <button className="button ghost" type="button" onClick={() => setDraft(undefined)}>{t.cancelImport}</button>
          </div>
        </div>
      )}
    </section>
  )
}
