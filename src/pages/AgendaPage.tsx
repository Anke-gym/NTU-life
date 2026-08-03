import { Plus } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { db } from '../lib/db'
import { commonCopy, getLanguage } from '../lib/i18n'
import { makeAgendaDraft } from '../lib/naturalLanguage'
import type { AgendaItem } from '../lib/types'
import type { AppData } from '../lib/useData'

const copy = {
  zh: {
    title: '日程',
    newAgenda: '新建日程',
    quickRecord: '快速记录',
    speechWarning: '语音 API 不可用。请使用 iPhone 键盘麦克风听写，文本解析仍可使用。',
    textOrDictation: '文字或听写',
    placeholder: '明天晚上八点交作业',
    generate: '生成草稿',
    today: '今日',
    future: '未来',
    done: '已完成',
    empty: '暂无日程',
    completeStatus: '完成状态',
    reminderPrefix: '提前',
    minutes: '分钟',
    agenda: '日程',
    itemTitle: '标题',
    start: '开始',
    end: '结束',
    reminder: '提醒',
    none: '无',
    tenMinutes: '提前10分钟',
    thirtyMinutes: '提前30分钟',
    oneHour: '提前1小时',
    notes: '备注',
    deleteTitle: '删除日程',
    deleteBody: '删除后无法撤销。',
  },
  en: {
    title: 'Agenda',
    newAgenda: 'New Agenda Item',
    quickRecord: 'Quick Record',
    speechWarning: 'Speech API is unavailable. Use iPhone keyboard microphone dictation; text parsing still works.',
    textOrDictation: 'Text or dictation',
    placeholder: 'Submit assignment tomorrow at 8 pm',
    generate: 'Create Draft',
    today: 'Today',
    future: 'Future',
    done: 'Done',
    empty: 'No agenda items',
    completeStatus: 'Completion status',
    reminderPrefix: '',
    minutes: 'minutes before',
    agenda: 'Agenda',
    itemTitle: 'Title',
    start: 'Start',
    end: 'End',
    reminder: 'Reminder',
    none: 'None',
    tenMinutes: '10 minutes before',
    thirtyMinutes: '30 minutes before',
    oneHour: '1 hour before',
    notes: 'Notes',
    deleteTitle: 'Delete Agenda Item',
    deleteBody: 'This cannot be undone.',
  },
} as const

export function AgendaPage({ data }: { data: AppData }) {
  const [params] = useSearchParams()
  const [editing, setEditing] = useState<AgendaItem | undefined>()
  const [deleting, setDeleting] = useState<AgendaItem | undefined>()
  const [text, setText] = useState('')
  const [speechSupported] = useState(() => 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  const language = getLanguage(data)
  const t = copy[language]
  const common = commonCopy[language]

  useEffect(() => { if (params.get('new') || params.get('voice')) setEditing(newAgenda()) }, [params])

  async function saveText() {
    if (!text.trim()) return
    setEditing(makeAgendaDraft(text))
    setText('')
  }

  const today = data.agendaItems.filter((item) => new Date(item.startAt).toDateString() === new Date().toDateString() && !item.completed)
  const future = data.agendaItems.filter((item) => new Date(item.startAt) > new Date() && !today.includes(item) && !item.completed)
  const done = data.agendaItems.filter((item) => item.completed)

  return (
    <div className="page">
      <header className="page-header"><h1>{t.title}</h1><button className="icon-button" type="button" aria-label={t.newAgenda} onClick={() => setEditing(newAgenda())}><Plus /></button></header>
      <section className="panel">
        <h2>{t.quickRecord}</h2>
        {!speechSupported && <p className="warning">{t.speechWarning}</p>}
        <label className="field"><span>{t.textOrDictation}</span><input value={text} onChange={(event) => setText(event.target.value)} placeholder={t.placeholder} /></label>
        <button className="button primary" type="button" onClick={() => void saveText()}>{t.generate}</button>
      </section>
      <AgendaGroup title={t.today} items={today} language={language} onEdit={setEditing} onDelete={setDeleting} onToggle={data.reload} />
      <AgendaGroup title={t.future} items={future} language={language} onEdit={setEditing} onDelete={setDeleting} onToggle={data.reload} />
      <AgendaGroup title={t.done} items={done} language={language} onEdit={setEditing} onDelete={setDeleting} onToggle={data.reload} />
      {editing && <AgendaEditor item={editing} language={language} onClose={() => setEditing(undefined)} onDone={data.reload} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        title={t.deleteTitle}
        destructive
        cancelLabel={common.cancel}
        confirmLabel={common.confirm}
        onCancel={() => setDeleting(undefined)}
        onConfirm={() => {
          if (deleting) void db.agendaItems.delete(deleting.id).then(data.reload)
          setDeleting(undefined)
        }}
      >
        {t.deleteBody}
      </ConfirmDialog>
    </div>
  )
}

function AgendaGroup({
  title,
  items,
  language,
  onEdit,
  onDelete,
  onToggle,
}: {
  title: string
  items: AgendaItem[]
  language: 'zh' | 'en'
  onEdit: (item: AgendaItem) => void
  onDelete: (item: AgendaItem) => void
  onToggle: () => Promise<void>
}) {
  const t = copy[language]
  const common = commonCopy[language]
  return (
    <section className="panel">
      <h2>{title}</h2>
      {items.length ? items.map((item) => (
        <article className="list-row" key={item.id}>
          <input aria-label={t.completeStatus} type="checkbox" checked={item.completed} onChange={async () => {
            await db.agendaItems.put({ ...item, completed: !item.completed, updatedAt: new Date().toISOString() })
            await onToggle()
          }} />
          <div>
            <strong>{item.title}</strong>
            <span>{new Date(item.startAt).toLocaleString()} · {t.reminderPrefix} {item.reminderMinutes ?? 0} {t.minutes}</span>
          </div>
          <button className="button ghost" type="button" onClick={() => onEdit(item)}>{common.edit}</button>
          <button className="button ghost danger-text" type="button" onClick={() => onDelete(item)}>{common.delete}</button>
        </article>
      )) : <p className="empty">{t.empty}</p>}
    </section>
  )
}

function newAgenda(): AgendaItem {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), title: '', startAt: now, notes: '', completed: false, source: 'manual', createdAt: now, updatedAt: now }
}

function AgendaEditor({ item, language, onClose, onDone }: { item: AgendaItem; language: 'zh' | 'en'; onClose: () => void; onDone: () => Promise<void> }) {
  const [form, setForm] = useState(item)
  const t = copy[language]
  const common = commonCopy[language]
  async function submit(event: FormEvent) {
    event.preventDefault()
    await db.agendaItems.put({ ...form, updatedAt: new Date().toISOString() })
    await onDone()
    onClose()
  }
  return (
    <div className="sheet">
      <form className="sheet-content" onSubmit={(event) => void submit(event)}>
        <h2>{t.agenda}</h2>
        <label className="field"><span>{t.itemTitle}</span><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label className="field"><span>{t.start}</span><input type="datetime-local" value={form.startAt.slice(0, 16)} onChange={(event) => setForm({ ...form, startAt: new Date(event.target.value).toISOString() })} /></label>
        <label className="field"><span>{t.end}</span><input type="datetime-local" value={form.endAt?.slice(0, 16) ?? ''} onChange={(event) => setForm({ ...form, endAt: event.target.value ? new Date(event.target.value).toISOString() : undefined })} /></label>
        <label className="field">
          <span>{t.reminder}</span>
          <select value={form.reminderMinutes ?? ''} onChange={(event) => setForm({ ...form, reminderMinutes: event.target.value ? Number(event.target.value) : undefined })}>
            <option value="">{t.none}</option>
            <option value="10">{t.tenMinutes}</option>
            <option value="30">{t.thirtyMinutes}</option>
            <option value="60">{t.oneHour}</option>
          </select>
        </label>
        <label className="field"><span>{t.notes}</span><textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label>
        <div className="dialog-actions"><button className="button ghost" type="button" onClick={onClose}>{common.cancel}</button><button className="button primary" type="submit">{common.save}</button></div>
      </form>
    </div>
  )
}
