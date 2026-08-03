import { Plus, Trash2 } from 'lucide-react'
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
import { db, defaultMoneyCategories } from '../lib/db'
import { commonCopy, getLanguage } from '../lib/i18n'
import { makeTransactionDraft } from '../lib/naturalLanguage'
import type { Transaction } from '../lib/types'
import type { AppData } from '../lib/useData'

type MoneyRangeKey = 'today' | 'week' | 'month'
type CurrencyCode = 'CNY' | 'SGD'

const copy = {
  zh: {
    title: '记账',
    newTransaction: '新增账目',
    rangeLabel: { today: '今天', week: '本周', month: '本月' },
    income: '收入',
    expense: '支出',
    balance: '结余',
    quickExpense: '快捷消费',
    customizable: '可自定义',
    done: '完成',
    newCategoryPlaceholder: '新增快捷项，例如咖啡',
    categoryExists: '这个分类已经存在',
    categoryEmpty: '先输入分类名称',
    spendingShare: '消费占比',
    noExpense: '暂无支出记录。',
    quickRecord: '快速记录',
    speechWarning: '当前 Safari/PWA 不支持 SpeechRecognition。可点输入框后使用 iPhone 键盘麦克风听写。',
    textOrDictation: '文字或听写',
    voicePlaceholder: '今天午饭花了12.5块',
    generate: '生成账目',
    transactions: '交易',
    summary: '汇总',
    noTransactions: '暂无交易',
    noDetails: '这个时间范围内没有明细。',
    amount: '金额',
    type: '类型',
    category: '分类',
    dateTime: '日期时间',
    note: '备注',
    currency: '货币',
    account: '账目',
    deleteTitle: '删除账目',
    deleteBody: '删除后无法撤销。',
  },
  en: {
    title: 'Money',
    newTransaction: 'New transaction',
    rangeLabel: { today: 'Today', week: 'This Week', month: 'This Month' },
    income: 'Income',
    expense: 'Expense',
    balance: 'Balance',
    quickExpense: 'Quick Expense',
    customizable: 'Customizable',
    done: 'Done',
    newCategoryPlaceholder: 'New shortcut, e.g. Coffee',
    categoryExists: 'This category already exists',
    categoryEmpty: 'Enter a category name first',
    spendingShare: 'Spending Share',
    noExpense: 'No expenses in this range.',
    quickRecord: 'Quick Record',
    speechWarning: 'SpeechRecognition is unavailable in this Safari/PWA. Tap the input and use iPhone keyboard dictation instead.',
    textOrDictation: 'Text or dictation',
    voicePlaceholder: 'Lunch 12.5 today',
    generate: 'Create Transaction',
    transactions: 'Transactions',
    summary: 'Summary',
    noTransactions: 'No transactions',
    noDetails: 'No details in this range.',
    amount: 'Amount',
    type: 'Type',
    category: 'Category',
    dateTime: 'Date & Time',
    note: 'Note',
    currency: 'Currency',
    account: 'Transaction',
    deleteTitle: 'Delete Transaction',
    deleteBody: 'This cannot be undone.',
  },
} as const

const currencies = [
  { value: 'CNY', zh: '人民币', en: 'CNY', symbol: '¥' },
  { value: 'SGD', zh: '新币', en: 'SGD', symbol: 'S$' },
] as const

const pieColors = ['#007aff', '#34c759', '#ff9500', '#af52de', '#ff3b30', '#5ac8fa', '#5856d6', '#8e8e93', '#ffcc00', '#30d158']

export function MoneyPage({ data }: { data: AppData }) {
  const [params] = useSearchParams()
  const [editing, setEditing] = useState<Transaction | undefined>()
  const [quickCategory, setQuickCategory] = useState<string | undefined>()
  const [voiceText, setVoiceText] = useState('')
  const [newCategory, setNewCategory] = useState('')
  const [categoryMessage, setCategoryMessage] = useState('')
  const [deleting, setDeleting] = useState<Transaction | undefined>()
  const [rangeKey, setRangeKey] = useState<MoneyRangeKey>('today')
  const [editingCategories, setEditingCategories] = useState(false)
  const [speechSupported] = useState(() => 'SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
  const language = getLanguage(data)
  const t = copy[language]
  const common = commonCopy[language]
  const categoryOptions = data.settings?.moneyCategories?.length ? data.settings.moneyCategories : defaultMoneyCategories

  useEffect(() => {
    if (params.get('new')) setEditing(newTransaction(categoryOptions[0] ?? defaultMoneyCategories[0]))
  }, [params, categoryOptions])

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
    if (!clean) {
      setCategoryMessage(t.categoryEmpty)
      return
    }
    if (categoryOptions.includes(clean)) {
      setCategoryMessage(t.categoryExists)
      return
    }
    await saveCategories([...categoryOptions, clean])
    setNewCategory('')
    setCategoryMessage('')
  }

  async function removeCategory(category: string) {
    await saveCategories(categoryOptions.filter((item) => item !== category))
  }

  return (
    <div className="page">
      <header className="page-header">
        <h1>{t.title}</h1>
        <button className="icon-button" type="button" aria-label={t.newTransaction} onClick={() => setEditing(newTransaction(categoryOptions[0] ?? defaultMoneyCategories[0]))}><Plus /></button>
      </header>
      <div className="range-tabs three" role="tablist" aria-label={language === 'zh' ? '统计时间范围' : 'Statistics range'}>
        {(['today', 'week', 'month'] as const).map((key) => (
          <button className={rangeKey === key ? 'active' : ''} type="button" key={key} onClick={() => setRangeKey(key)}>
            {t.rangeLabel[key]}
          </button>
        ))}
      </div>
      <section className="metric-grid">
        <div className="metric"><span>{t.rangeLabel[rangeKey]}{t.income}</span><strong>{formatMoney(stats.income)}</strong></div>
        <div className="metric"><span>{t.rangeLabel[rangeKey]}{t.expense}</span><strong>{formatMoney(stats.expense)}</strong></div>
        <div className="metric"><span>{t.rangeLabel[rangeKey]}{t.balance}</span><strong>{formatMoney(stats.income - stats.expense)}</strong></div>
      </section>
      <section className="panel">
        <div className="panel-title">
          <div>
            <h2>{t.quickExpense}</h2>
            <span className="muted">{t.customizable}</span>
          </div>
          <button className="button ghost" type="button" onClick={() => setEditingCategories((value) => !value)}>
            {editingCategories ? t.done : common.edit}
          </button>
        </div>
        <div className="preset-grid">
          {categoryOptions.map((category) => (
            <div className={`preset-edit ${editingCategories ? 'editing' : ''}`} key={category}>
              <button className="preset-button" type="button" onClick={() => !editingCategories && setQuickCategory(category)}>{category}</button>
              {editingCategories && (
                <button className="mini-remove" type="button" aria-label={`${common.delete} ${category}`} onClick={() => void removeCategory(category)}>
                  <Trash2 size={15} />{common.delete}
                </button>
              )}
            </div>
          ))}
        </div>
        {editingCategories && (
          <form className="inline-add" onSubmit={(event) => void addCategory(event)}>
            <input value={newCategory} onChange={(event) => setNewCategory(event.target.value)} placeholder={t.newCategoryPlaceholder} />
            <button className="button ghost" type="submit">{common.add}</button>
          </form>
        )}
        {categoryMessage && <p className="muted form-note">{categoryMessage}</p>}
      </section>
      <section className="panel">
        <h2>{t.rangeLabel[rangeKey]}{t.spendingShare}</h2>
        {stats.categoryItems.length ? (
          <div className="pie-layout">
            <div className="pie-chart" style={{ background: pieBackground(stats.categoryItems, stats.categoryTotal) }} aria-label={`${t.rangeLabel[rangeKey]} ${t.spendingShare}`} />
            <div className="pie-legend">
              {stats.categoryItems.map((item) => <p key={item.category}><i style={{ background: item.color }} />{item.category}<b>{Math.round(item.amount / stats.categoryTotal * 100)}%</b></p>)}
            </div>
          </div>
        ) : <p className="empty">{t.noExpense}</p>}
      </section>
      <section className="panel">
        <h2>{t.quickRecord}</h2>
        {!speechSupported && <p className="warning">{t.speechWarning}</p>}
        <label className="field"><span>{t.textOrDictation}</span><input value={voiceText} onChange={(event) => setVoiceText(event.target.value)} placeholder={t.voicePlaceholder} /></label>
        <button className="button primary" type="button" onClick={() => void saveVoice()}>{t.generate}</button>
      </section>
      <details className="panel compact-list" open>
        <summary>{t.rangeLabel[rangeKey]}{t.transactions}</summary>
        <div className="daily-summary">
          <strong>{t.summary}</strong>
          {stats.byCurrency.length ? stats.byCurrency.map((item) => (
            <p key={item.currency}>
              <span>{item.currency}</span>
              <b>{t.income} {formatMoney(item.income, item.currency)}</b>
              <b>{t.expense} {formatMoney(item.expense, item.currency)}</b>
              <b>{t.balance} {formatMoney(item.income - item.expense, item.currency)}</b>
            </p>
          )) : <p><span>{t.noTransactions}</span></p>}
        </div>
        {stats.filtered.length ? stats.filtered.map((item) => (
          <article className="list-row" key={item.id}>
            <div><strong>{item.note || item.category}</strong><span>{new Date(item.occurredAt).toLocaleString()} · {item.category} · {item.currency}</span></div>
            <b className={item.direction}>{item.direction === 'income' ? '+' : '-'}{formatMoney(item.amountCents, item.currency)}</b>
            <button className="button ghost" type="button" onClick={() => setEditing(item)}>{common.edit}</button>
            <button className="button ghost danger-text" type="button" onClick={() => setDeleting(item)}>{common.delete}</button>
          </article>
        )) : <p className="empty">{t.noDetails}</p>}
      </details>
      {quickCategory && <QuickExpense category={quickCategory} language={language} onClose={() => setQuickCategory(undefined)} onDone={data.reload} />}
      {editing && <MoneyEditor item={editing} categories={categoryOptions} language={language} onClose={() => setEditing(undefined)} onDone={data.reload} />}
      <ConfirmDialog
        open={Boolean(deleting)}
        title={t.deleteTitle}
        destructive
        cancelLabel={common.cancel}
        confirmLabel={common.confirm}
        onCancel={() => setDeleting(undefined)}
        onConfirm={() => {
          if (deleting) void db.transactions.delete(deleting.id).then(data.reload)
          setDeleting(undefined)
        }}
      >
        {t.deleteBody}
      </ConfirmDialog>
    </div>
  )
}

function getRange(key: MoneyRangeKey) {
  const now = new Date()
  if (key === 'week') return { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
  if (key === 'month') return { start: startOfMonth(now), end: endOfMonth(now) }
  return { start: startOfDay(now), end: endOfDay(now) }
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

function QuickExpense({ category, language, onClose, onDone }: { category: string; language: 'zh' | 'en'; onClose: () => void; onDone: () => Promise<void> }) {
  const [amount, setAmount] = useState('')
  const [currency, setCurrency] = useState<CurrencyCode>('SGD')
  const t = copy[language]
  const common = commonCopy[language]
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
        <CurrencyPicker value={currency} language={language} onChange={setCurrency} />
        <label className="field"><span>{t.amount}</span><input required autoFocus inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={t.amount} /></label>
        <div className="dialog-actions"><button className="button ghost" type="button" onClick={onClose}>{common.cancel}</button><button className="button primary" type="submit">{common.save}</button></div>
      </form>
    </div>
  )
}

function MoneyEditor({ item, categories, language, onClose, onDone }: { item: Transaction; categories: string[]; language: 'zh' | 'en'; onClose: () => void; onDone: () => Promise<void> }) {
  const [form, setForm] = useState(item)
  const t = copy[language]
  const common = commonCopy[language]
  const categoryOptions = categories.includes(form.category) ? categories : [...categories, form.category]
  async function submit(event: FormEvent) {
    event.preventDefault()
    await db.transactions.put({ ...form, amountCents: Math.round(form.amountCents), updatedAt: new Date().toISOString() })
    await onDone()
    onClose()
  }
  return (
    <div className="sheet"><form className="sheet-content" onSubmit={(event) => void submit(event)}>
      <h2>{t.account}</h2>
      <label className="field"><span>{t.type}</span><select value={form.direction} onChange={(event) => setForm({ ...form, direction: event.target.value as Transaction['direction'] })}><option value="expense">{t.expense}</option><option value="income">{t.income}</option></select></label>
      <CurrencyPicker value={form.currency as CurrencyCode} language={language} onChange={(currency) => setForm({ ...form, currency })} />
      <label className="field"><span>{t.amount}</span><input required inputMode="decimal" value={(form.amountCents / 100).toString()} onChange={(event) => setForm({ ...form, amountCents: Math.round(Number(event.target.value || 0) * 100) })} /></label>
      <label className="field"><span>{t.category}</span><select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>{categoryOptions.map((category) => <option key={category}>{category}</option>)}</select></label>
      <label className="field"><span>{t.dateTime}</span><input type="datetime-local" value={form.occurredAt.slice(0, 16)} onChange={(event) => setForm({ ...form, occurredAt: new Date(event.target.value).toISOString() })} /></label>
      <label className="field"><span>{t.note}</span><input value={form.note} onChange={(event) => setForm({ ...form, note: event.target.value })} /></label>
      <div className="dialog-actions"><button className="button ghost" type="button" onClick={onClose}>{common.cancel}</button><button className="button primary" type="submit">{common.save}</button></div>
    </form></div>
  )
}

function CurrencyPicker({ value, language, onChange }: { value: CurrencyCode; language: 'zh' | 'en'; onChange: (value: CurrencyCode) => void }) {
  const t = copy[language]
  return (
    <fieldset className="segmented">
      <legend>{t.currency}</legend>
      {currencies.map((currency) => (
        <label key={currency.value} className={value === currency.value ? 'active' : ''}>
          <input type="radio" name="currency" checked={value === currency.value} onChange={() => onChange(currency.value)} />
          {currency[language]}
        </label>
      ))}
    </fieldset>
  )
}
