import { Plus } from 'lucide-react'
import { endOfWeek, isWithinInterval, parseISO, startOfMonth, startOfWeek } from 'date-fns'
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { db } from '../lib/db'
import { makeTransactionDraft } from '../lib/naturalLanguage'
import type { Transaction } from '../lib/types'
import type { AppData } from '../lib/useData'

const categories = ['吃饭', '交通', '饮料', '生活用品', '学习资料', '房租水电', '医疗', '其他']
const currencies = [
  { value: 'CNY', label: '人民币', symbol: '¥' },
  { value: 'SGD', label: '新币', symbol: 'S$' },
] as const
const pieColors = ['#007aff', '#34c759', '#ff9500', '#af52de', '#ff3b30', '#5ac8fa', '#5856d6', '#8e8e93']

export function MoneyPage({ data }: { data: AppData }) {
  const [params] = useSearchParams()
  const [editing, setEditing] = useState<Transaction | undefined>()
  const [quickCategory, setQuickCategory] = useState<string | undefined>()
  const [voiceText, setVoiceText] = useState('')
  const [deleting, setDeleting] = useState<Transaction | undefined>()
  const [speechSupported] = useState(() => 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window)

  useEffect(() => { if (params.get('new')) setEditing(newTransaction()) }, [params])

  const stats = useMemo(() => {
    const now = new Date()
    const weekRange = { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
    const weekItems = data.transactions.filter((item) => isWithinInterval(parseISO(item.occurredAt), weekRange))
    const monthItems = data.transactions.filter((item) => parseISO(item.occurredAt) >= startOfMonth(now))
    const sum = (items: Transaction[], direction: Transaction['direction']) => items.filter((item) => item.direction === direction).reduce((total, item) => total + item.amountCents, 0)
    const monthlyByCategory = categories.map((category, index) => ({
      category,
      color: pieColors[index],
      amount: monthItems.filter((item) => item.direction === 'expense' && item.category === category).reduce((total, item) => total + item.amountCents, 0),
    })).filter((item) => item.amount > 0)
    return {
      weekIncome: sum(weekItems, 'income'),
      weekExpense: sum(weekItems, 'expense'),
      monthlyByCategory,
      monthExpense: monthlyByCategory.reduce((total, item) => total + item.amount, 0),
    }
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
      <section className="panel">
        <h2>快捷消费</h2>
        <div className="preset-grid">
          {categories.filter((item) => item !== '其他').map((category) => (
            <button className="preset-button" type="button" key={category} onClick={() => setQuickCategory(category)}>{category}</button>
          ))}
        </div>
      </section>
      <section className="metric-grid">
        <div className="metric"><span>本周收入</span><strong>{formatMoney(stats.weekIncome)}</strong></div>
        <div className="metric"><span>本周支出</span><strong>{formatMoney(stats.weekExpense)}</strong></div>
        <div className="metric"><span>本周结余</span><strong>{formatMoney(stats.weekIncome - stats.weekExpense)}</strong></div>
      </section>
      <section className="panel">
        <h2>本月消费占比</h2>
        {stats.monthlyByCategory.length ? (
          <div className="pie-layout">
            <div className="pie-chart" style={{ background: pieBackground(stats.monthlyByCategory, stats.monthExpense) }} aria-label="本月分类消费饼图" />
            <div className="pie-legend">
              {stats.monthlyByCategory.map((item) => <p key={item.category}><i style={{ background: item.color }} />{item.category}<b>{Math.round(item.amount / stats.monthExpense * 100)}%</b></p>)}
            </div>
          </div>
        ) : <p className="empty">本月暂无支出记录。</p>}
      </section>
      <section className="panel">
        <h2>快速记录</h2>
        {!speechSupported && <p className="warning">当前 Safari/PWA 不支持 SpeechRecognition。可点输入框后使用 iPhone 键盘麦克风听写。</p>}
        <label className="field"><span>文字或听写</span><input value={voiceText} onChange={(event) => setVoiceText(event.target.value)} placeholder="今天午饭花了12.5块" /></label>
        <button className="button primary" type="button" onClick={() => void saveVoice()}>生成账目</button>
      </section>
      <details className="panel compact-list">
        <summary>最近交易</summary>
        {data.transactions.slice(0, 12).map((item) => <article className="list-row" key={item.id}><div><strong>{item.note || item.category}</strong><span>{new Date(item.occurredAt).toLocaleString()} · {item.category} · {item.currency}</span></div><b className={item.direction}>{item.direction === 'income' ? '+' : '-'}{formatMoney(item.amountCents, item.currency)}</b><button className="button ghost" type="button" onClick={() => setEditing(item)}>编辑</button><button className="button ghost danger-text" type="button" onClick={() => setDeleting(item)}>删除</button></article>)}
      </details>
      {quickCategory && <QuickExpense category={quickCategory} onClose={() => setQuickCategory(undefined)} onDone={data.reload} />}
      {editing && <MoneyEditor item={editing} onClose={() => setEditing(undefined)} onDone={data.reload} />}
      <ConfirmDialog open={Boolean(deleting)} title="删除账目" destructive onCancel={() => setDeleting(undefined)} onConfirm={() => { if (deleting) void db.transactions.delete(deleting.id).then(data.reload); setDeleting(undefined) }}>删除后无法撤销。</ConfirmDialog>
    </div>
  )
}

function newTransaction(category = '吃饭', currency = 'SGD'): Transaction {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), direction: 'expense', amountCents: 0, currency, category, occurredAt: now, note: '', source: 'manual', createdAt: now, updatedAt: now }
}

function currencySymbol(currency: string) {
  return currencies.find((item) => item.value === currency)?.symbol ?? currency
}

function formatMoney(cents: number, currency = 'SGD') {
  return `${currencySymbol(currency)}${(cents / 100).toFixed(2)}`
}

function pieBackground(items: Array<{ amount: number; color: string }>, total: number): CSSProperties['background'] {
  let cursor = 0
  const slices = items.map((item) => {
    const start = cursor
    cursor += item.amount / total * 360
    return `${item.color} ${start}deg ${cursor}deg`
  })
  return `conic-gradient(${slices.join(', ')})`
}

function QuickExpense({ category, onClose, onDone }: { category: string; onClose: () => void; onDone: () => Promise<void> }) {
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<'CNY' | 'SGD'>('SGD')
  async function submit(event: FormEvent) {
    event.preventDefault()
    const transaction = newTransaction(category, currency)
    await db.transactions.add({ ...transaction, amountCents: Math.round(Number(amount || 0) * 100), note: category })
    await onDone()
    onClose()
  }
  return (
    <div className="sheet">
      <form className="sheet-content" onSubmit={(event) => void submit(event)}>
        <h2>{category}</h2>
        <CurrencyPicker value={currency} onChange={setCurrency} />
        <label className="field"><span>金额</span><input required autoFocus inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="输入金额" /></label>
        <div className="dialog-actions"><button className="button ghost" type="button" onClick={onClose}>取消</button><button className="button primary" type="submit">保存</button></div>
      </form>
    </div>
  )
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
      <CurrencyPicker value={form.currency as 'CNY' | 'SGD'} onChange={(currency) => setForm({ ...form, currency })} />
      <label className="field"><span>金额</span><input required inputMode="decimal" value={(form.amountCents / 100).toString()} onChange={(event) => setForm({ ...form, amountCents: Math.round(Number(event.target.value || 0) * 100) })} /></label>
      <label className="field"><span>分类</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categories.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label className="field"><span>日期时间</span><input type="datetime-local" value={form.occurredAt.slice(0, 16)} onChange={(event) => setForm({ ...form, occurredAt: new Date(event.target.value).toISOString() })} /></label>
      <label className="field"><span>备注</span><input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label>
      <div className="dialog-actions"><button className="button ghost" type="button" onClick={onClose}>取消</button><button className="button primary" type="submit">保存</button></div>
    </form></div>
  )
}

function CurrencyPicker({ value, onChange }: { value: 'CNY' | 'SGD'; onChange: (value: 'CNY' | 'SGD') => void }) {
  return (
    <fieldset className="segmented">
      <legend>货币</legend>
      {currencies.map((currency) => (
        <label key={currency.value} className={value === currency.value ? 'active' : ''}>
          <input type="radio" name="currency" checked={value === currency.value} onChange={() => onChange(currency.value)} />
          {currency.label}
        </label>
      ))}
    </fieldset>
  )
}
