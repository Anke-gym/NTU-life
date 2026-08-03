import { Plus, X } from 'lucide-react'
import {
  endOfDay,
  endOfMonth,
  endOfWeek,
  isWithinInterval,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
} from 'date-fns'
import { useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { db } from '../lib/db'
import { makeTransactionDraft } from '../lib/naturalLanguage'
import type { Transaction } from '../lib/types'
import type { AppData } from '../lib/useData'

type MoneyRangeKey = 'today' | 'week' | 'month'

const defaultCategories = ['吃饭', '交通', '饮料', '生活用品', '学习资料', '房租水电', '医疗', '其他']
const rangeOptions: Array<{ key: MoneyRangeKey; label: string }> = [
  { key: 'today', label: '今天' },
  { key: 'week', label: '本周' },
  { key: 'month', label: '本月' },
]
const currencies = [
  { value: 'CNY', label: '人民币', symbol: '¥' },
  { value: 'SGD', label: '新币', symbol: 'S$' },
] as const
const pieColors = ['#007aff', '#34c759', '#ff9500', '#af52de', '#ff3b30', '#5ac8fa', '#5856d6', '#8e8e93', '#ffcc00', '#30d158']

export function MoneyPage({ data }: { data: AppData }) {
  const [params] = useSearchParams()
  const [editing, setEditing] = useState<Transaction | undefined>()
  const [quickCategory, setQuickCategory] = useState<string | undefined>()
  const [voiceText, setVoiceText] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [deleting, setDeleting] = useState<Transaction | undefined>()
  const [rangeKey, setRangeKey] = useState<MoneyRangeKey>('today')
  const [speechSupported] = useState(() => 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  const categoryOptions = data.settings?.moneyCategories?.length ? data.settings.moneyCategories : defaultCategories

  useEffect(() => { if (params.get('new')) setEditing(newTransaction(categoryOptions[0] ?? '其他')) }, [params, categoryOptions])

  const stats = useMemo(() => {
    const range = getRange(rangeKey)
    const filtered = data.transactions.filter((item) => isWithinInterval(parseISO(item.occurredAt), range))
    const income = sum(filtered, 'income')
    const expense = sum(filtered, 'expense')
    const byCurrency = currencies.map((currency) => {
      const items = filtered.filter((item) => item.currency === currency.value)
      return {
        currency: currency.value,
        income: sum(items, 'income'),
        expense: sum(items, 'expense'),
      }
    }).filter((item) => item.income || item.expense)
    const categoryUniverse = [...new Set([...categoryOptions, ...filtered.map((item) => item.category)])]
    const categoryItems = categoryUniverse.map((category, index) => ({
      category,
      color: pieColors[index % pieColors.length],
      amount: filtered.filter((item) => item.direction === 'expense' && item.category === category).reduce((total, item) => total + item.amountCents, 0),
    })).filter((item) => item.amount > 0)
    return {
      filtered,
      income,
      expense,
      byCurrency,
      categoryItems,
      categoryTotal: categoryItems.reduce((total, item) => total + item.amount, 0),
    }
  }, [categoryOptions, data.transactions, rangeKey])

  async function saveVoice() {
    if (!voiceText.trim()) return
    await db.transactions.add(makeTransactionDraft(voiceText))
    setVoiceText('')
    await data.reload()
  }

  async function saveCategories(nextCategories: string[]) {
    if (!data.settings) return
    await db.settings.put({ ...data.settings, moneyCategories: nextCategories })
    await data.reload()
  }

  async function addCategory(event: FormEvent) {
    event.preventDefault()
    const clean = newCategory.trim()
    if (!clean || categoryOptions.includes(clean)) return
    await saveCategories([...categoryOptions, clean])
    setNewCategory('')
  }

  async function removeCategory(category: string) {
    await saveCategories(categoryOptions.filter((item) => item !== category))
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>记账</h1>
        <button className="icon-button" type="button" aria-label="新增账目" onClick={() => setEditing(newTransaction(categoryOptions[0] ?? '其他'))}><Plus /></button>
      </header>
      <div className="range-tabs" role="tablist" aria-label="统计时间范围">
        {rangeOptions.map((option) => (
          <button className={rangeKey === option.key ? 'active' : ''} type="button" key={option.key} onClick={() => setRangeKey(option.key)}>
            {option.label}
          </button>
        ))}
      </div>
      <section className="metric-grid">
        <div className="metric"><span>{rangeLabel(rangeKey)}收入</span><strong>{formatMoney(stats.income)}</strong></div>
        <div className="metric"><span>{rangeLabel(rangeKey)}支出</span><strong>{formatMoney(stats.expense)}</strong></div>
        <div className="metric"><span>{rangeLabel(rangeKey)}结余</span><strong>{formatMoney(stats.income - stats.expense)}</strong></div>
      </section>
      <section className="panel">
        <div className="panel-title">
          <h2>快捷消费</h2>
          <span className="muted">可自定义</span>
        </div>
        <div className="preset-grid">
          {categoryOptions.map((category) => (
            <div className="preset-edit" key={category}>
              <button className="preset-button" type="button" onClick={() => setQuickCategory(category)}>{category}</button>
              <button className="mini-remove" type="button" aria-label={`删除${category}`} onClick={() => void removeCategory(category)}><X size={15} /></button>
            </div>
          ))}
        </div>
        <form className="inline-add" onSubmit={(event) => void addCategory(event)}>
          <input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder="新增快捷项，例如咖啡" />
          <button className="button ghost" type="submit">添加</button>
        </form>
      </section>
      <section className="panel">
        <h2>{rangeLabel(rangeKey)}消费占比</h2>
        {stats.categoryItems.length ? (
          <div className="pie-layout">
            <div className="pie-chart" style={{ background: pieBackground(stats.categoryItems, stats.categoryTotal) }} aria-label={`${rangeLabel(rangeKey)}分类消费饼图`} />
            <div className="pie-legend">
              {stats.categoryItems.map((item) => <p key={item.category}><i style={{ background: item.color }} />{item.category}<b>{Math.round(item.amount / stats.categoryTotal * 100)}%</b></p>)}
            </div>
          </div>
        ) : <p className="empty">{rangeLabel(rangeKey)}暂无支出记录。</p>}
      </section>
      <section className="panel">
        <h2>快速记录</h2>
        {!speechSupported && <p className="warning">当前 Safari/PWA 不支持 SpeechRecognition。可点输入框后使用 iPhone 键盘麦克风听写。</p>}
        <label className="field"><span>文字或听写</span><input value={voiceText} onChange={(event) => setVoiceText(event.target.value)} placeholder="今天午饭花了12.5块" /></label>
        <button className="button primary" type="button" onClick={() => void saveVoice()}>生成账目</button>
      </section>
      <details className="panel compact-list" open>
        <summary>{rangeLabel(rangeKey)}交易</summary>
        <div className="daily-summary">
          <strong>汇总</strong>
          {stats.byCurrency.length ? stats.byCurrency.map((item) => (
            <p key={item.currency}>
              <span>{item.currency}</span>
              <b>收入 {formatMoney(item.income, item.currency)}</b>
              <b>支出 {formatMoney(item.expense, item.currency)}</b>
              <b>结余 {formatMoney(item.income - item.expense, item.currency)}</b>
            </p>
          )) : <p><span>暂无交易</span></p>}
        </div>
        {stats.filtered.length ? stats.filtered.map((item) => (
          <article className="list-row" key={item.id}>
            <div><strong>{item.note || item.category}</strong><span>{new Date(item.occurredAt).toLocaleString()} · {item.category} · {item.currency}</span></div>
            <b className={item.direction}>{item.direction === 'income' ? '+' : '-'}{formatMoney(item.amountCents, item.currency)}</b>
            <button className="button ghost" type="button" onClick={() => setEditing(item)}>编辑</button>
            <button className="button ghost danger-text" type="button" onClick={() => setDeleting(item)}>删除</button>
          </article>
        )) : <p className="empty">这个时间范围内没有明细。</p>}
      </details>
      {quickCategory && <QuickExpense category={quickCategory} onClose={() => setQuickCategory(undefined)} onDone={data.reload} />}
      {editing && <MoneyEditor item={editing} categories={categoryOptions} onClose={() => setEditing(undefined)} onDone={data.reload} />}
      <ConfirmDialog open={Boolean(deleting)} title="删除账目" destructive onCancel={() => setDeleting(undefined)} onConfirm={() => { if (deleting) void db.transactions.delete(deleting.id).then(data.reload); setDeleting(undefined) }}>删除后无法撤销。</ConfirmDialog>
    </div>
  )
}

function getRange(key: MoneyRangeKey) {
  const now = new Date()
  if (key === 'week') return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
  if (key === 'month') return { start: startOfMonth(now), end: endOfMonth(now) }
  return { start: startOfDay(now), end: endOfDay(now) }
}

function rangeLabel(key: MoneyRangeKey) {
  return rangeOptions.find((item) => item.key === key)?.label ?? '今天'
}

function sum(items: Transaction[], direction: Transaction['direction']) {
  return items.filter((item) => item.direction === direction).reduce((total, item) => total + item.amountCents, 0)
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

function MoneyEditor({ item, categories, onClose, onDone }: { item: Transaction; categories: string[]; onClose: () => void; onDone: () => Promise<void> }) {
  const [form, setForm] = useState(item)
  const categoryOptions = categories.includes(form.category) ? categories : [...categories, form.category]
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
      <label className="field"><span>分类</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categoryOptions.map((category) => <option key={category}>{category}</option>)}</select></label>
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
