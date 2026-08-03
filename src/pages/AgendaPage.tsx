import { Plus } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { db } from '../lib/db'
import { makeAgendaDraft } from '../lib/naturalLanguage'
import type { AgendaItem } from '../lib/types'
import type { AppData } from '../lib/useData'

export function AgendaPage({ data }: { data: AppData }) {
  const [params] = useSearchParams()
  const [editing, setEditing] = useState<AgendaItem | undefined>()
  const [deleting, setDeleting] = useState<AgendaItem | undefined>()
  const [text, setText] = useState('')
  const [speechSupported] = useState(() => 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

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
      <header className="page-header"><h1>日程</h1><button className="icon-button" type="button" aria-label="新建日程" onClick={() => setEditing(newAgenda())}><Plus /></button></header>
      <section className="panel">
        <h2>快速记录</h2>
        {!speechSupported && <p className="warning">语音 API 不可用。请使用 iPhone 键盘麦克风听写，文本解析仍可使用。</p>}
        <label className="field"><span>文字或听写</span><input value={text} onChange={(event) => setText(event.target.value)} placeholder="明天晚上八点交作业" /></label>
        <button className="button primary" type="button" onClick={() => void saveText()}>生成草稿</button>
      </section>
      <AgendaGroup title="今日" items={today} onEdit={setEditing} onDelete={setDeleting} onToggle={data.reload} />
      <AgendaGroup title="未来" items={future} onEdit={setEditing} onDelete={setDeleting} onToggle={data.reload} />
      <AgendaGroup title="已完成" items={done} onEdit={setEditing} onDelete={setDeleting} onToggle={data.reload} />
      {editing && <AgendaEditor item={editing} onClose={() => setEditing(undefined)} onDone={data.reload} />}
      <ConfirmDialog open={Boolean(deleting)} title="删除日程" destructive onCancel={() => setDeleting(undefined)} onConfirm={() => { if (deleting) void db.agendaItems.delete(deleting.id).then(data.reload); setDeleting(undefined) }}>删除后无法撤销。</ConfirmDialog>
    </div>
  )
}

function AgendaGroup({ title, items, onEdit, onDelete, onToggle }: { title: string; items: AgendaItem[]; onEdit: (item: AgendaItem) => void; onDelete: (item: AgendaItem) => void; onToggle: () => Promise<void> }) {
  return <section className="panel"><h2>{title}</h2>{items.length ? items.map((item) => <article className="list-row" key={item.id}><input aria-label="完成状态" type="checkbox" checked={item.completed} onChange={async () => { await db.agendaItems.put({ ...item, completed: !item.completed, updatedAt: new Date().toISOString() }); await onToggle() }} /><div><strong>{item.title}</strong><span>{new Date(item.startAt).toLocaleString()} · 提前 {item.reminderMinutes ?? 0} 分钟</span></div><button className="button ghost" type="button" onClick={() => onEdit(item)}>编辑</button><button className="button ghost danger-text" type="button" onClick={() => onDelete(item)}>删除</button></article>) : <p className="empty">暂无日程</p>}</section>
}

function newAgenda(): AgendaItem {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), title: '', startAt: now, notes: '', completed: false, source: 'manual', createdAt: now, updatedAt: now }
}

function AgendaEditor({ item, onClose, onDone }: { item: AgendaItem; onClose: () => void; onDone: () => Promise<void> }) {
  const [form, setForm] = useState(item)
  async function submit(event: FormEvent) {
    event.preventDefault()
    await db.agendaItems.put({ ...form, updatedAt: new Date().toISOString() })
    await onDone()
    onClose()
  }
  return <div className="sheet"><form className="sheet-content" onSubmit={(event) => void submit(event)}><h2>日程</h2><label className="field"><span>标题</span><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label><label className="field"><span>开始</span><input type="datetime-local" value={form.startAt.slice(0, 16)} onChange={(event) => setForm({ ...form, startAt: new Date(event.target.value).toISOString() })} /></label><label className="field"><span>结束</span><input type="datetime-local" value={form.endAt?.slice(0, 16) ?? ''} onChange={(event) => setForm({ ...form, endAt: event.target.value ? new Date(event.target.value).toISOString() : undefined })} /></label><label className="field"><span>提醒</span><select value={form.reminderMinutes ?? ''} onChange={(event) => setForm({ ...form, reminderMinutes: event.target.value ? Number(event.target.value) : undefined })}><option value="">无</option><option value="10">提前10分钟</option><option value="30">提前30分钟</option><option value="60">提前1小时</option></select></label><label className="field"><span>备注</span><textarea rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} /></label><div className="dialog-actions"><button className="button ghost" type="button" onClick={onClose}>取消</button><button className="button primary" type="submit">保存</button></div></form></div>
}
