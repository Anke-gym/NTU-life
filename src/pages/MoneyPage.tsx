import { Plus } from 'lucide-react'
import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { db } from '../lib/db'
import { makeTransactionDraft } from '../lib/naturalLanguage'
import type { Transaction } from '../lib/types'
import type { AppData } from '../lib/useData'

const categories = ['餐饮', '交通', '购物', '娱乐', '学习', '房租', '其他']

export function MoneyPage({ data }: { data: AppData }) {
  const [params] = useSearchParams()
  const [editing, setEditing] = useState<Transaction | undefined>()
  const [voiceText, setVoiceText] = useState('')
  const [deleting, setDeleting] = useState<Transaction | undefined>()
  const [speechSupported] = useState(() => 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  useEffect(() => { if (params.get('new')) setEditing(newTransaction()) }, [params])

  const totals = useMemo(() => {
    const income = data.transactions.filter((item) => item.direction === 'income').reduce((sum, item) => sum + item.amountCents, 0)
    const expense = data.transactions.filter((item) => item.direction === 'expense').reduce((sum, item) => sum + item.amountCents, 0)
    const byCategory = categories.map((category) => ({
      category,
      amount: data.transactions.filter((item) => item.direction === 'expense' && item.category === category).reduce((sum, item) => sum + item.amountCents, 0),
    })).filter((item) => item.amount > 0)
    return { income, expense, byCategory }
  }, [data.transactions])

  async function saveVoice() {
    if (!voiceText.trim()) return
    await db.transactions.add(makeTransactionDraft(voiceText))
    setVoiceText('')
    await data.reload()
  }

  return (
    <div className="page">
      <header className="page-header"><h1>记账</h1><button className="icon-button" type="button" aria-label="新增账目" onClick={() => setEditing(newTransaction())}><Plus /></button></header>
      <section className="metric-grid">
        <div className="metric"><span>收入</span><strong>${(totals.income / 100).toFixed(2)}</strong></div>
        <div className="metric"><span>支出</span><strong>${(totals.expense / 100).toFixed(2)}</strong></div>
        <div className="metric"><span>结余</span><strong>${((totals.income - totals.expense) / 100).toFixed(2)}</strong></div>
      </section>
      <section className="panel">
        <h2>快速记录</h2>
        {!speechSupported && <p className="warning">当前 Safari/PWA 不支持 SpeechRecognition。可点输入框后使用 iPhone 键盘麦克风听写。</p>}
        <label className="field"><span>文字或听写</span><input value={voiceText} onChange={(event) => setVoiceText(event.target.value)} placeholder="今天午饭花了12.5块" /></label>
        <button className="button primary" type="button" onClick={() => void saveVoice()}>生成账目</button>
      </section>
      <section className="panel">
        <h2>分类占比</h2>
        {totals.byCategory.length ? totals.byCategory.map((item) => <div className="bar" key={item.category}><span>{item.category}</span><i style={{ width: `${Math.max(8, item.amount / Math.max(1, totals.expense) * 100)}%` }} /><b>${(item.amount / 100).toFixed(2)}</b></div>) : <p className="empty">暂无支出记录。</p>}
      </section>
      <section className="panel">
        <h2>交易列表</h2>
        {data.transactions.map((item) => <article className="list-row" key={item.id}><div><strong>{item.note || item.category}</strong><span>{new Date(item.occurredAt).toLocaleString()} · {item.category}</span></div><b className={item.direction}>{item.direction === 'income' ? '+' : '-'}${(item.amountCents / 100).toFixed(2)}</b><button className="button ghost" type="button" onClick={() => setEditing(item)}>编辑</button><button className="button ghost danger-text" type="button" onClick={() => setDeleting(item)}>删除</button></article>)}
      </section>
      {editing && <MoneyEditor item={editing} onClose={() => setEditing(undefined)} onDone={data.reload} />}
      <ConfirmDialog open={Boolean(deleting)} title="删除账目" destructive onCancel={() => setDeleting(undefined)} onConfirm={() => { if (deleting) void db.transactions.delete(deleting.id).then(data.reload); setDeleting(undefined) }}>删除后无法撤销。</ConfirmDialog>
    </div>
  )
}

function newTransaction(): Transaction {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), direction: 'expense', amountCents: 0, currency: 'SGD', category: '餐饮', occurredAt: now, note: '', source: 'manual', createdAt: now, updatedAt: now }
}

function MoneyEditor({ item, onClose, onDone }: { item: Transaction; onClose: () => void; onDone: () => Promise<void> }) {
  const [form, setForm] = useState(item)
  async function submit(event: FormEvent) {
    event.preventDefault()
    await db.transactions.put({ ...form, amountCents: Math.round(form.amountCents), updatedAt: new Date().toISOString() })
    await onDone()
    onClose()
  }
  return (
    <div className="sheet"><form className="sheet-content" onSubmit={(event) => void submit(event)}>
      <h2>账目</h2>
      <label className="field"><span>类型</span><select value={form.direction} onChange={(event) => setForm({ ...form, direction: event.target.value as Transaction['direction'] })}><option value="expense">支出</option><option value="income">收入</option></select></label>
      <label className="field"><span>金额 SGD</span><input required inputMode="decimal" value={(form.amountCents / 100).toString()} onChange={(event) => setForm({ ...form, amountCents: Math.round(Number(event.target.value || 0) * 100) })} /></label>
      <label className="field"><span>分类</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label className="field"><span>日期时间</span><input type="datetime-local" value={form.occurredAt.slice(0, 16)} onChange={(event) => setForm({ ...form, occurredAt: new Date(event.target.value).toISOString() })} /></label>
      <label className="field"><span>备注</span><input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label>
      <div className="dialog-actions"><button className="button ghost" type="button" onClick={onClose}>取消</button><button className="button primary" type="submit">保存</button></div>
    </form></div>
  )
}
