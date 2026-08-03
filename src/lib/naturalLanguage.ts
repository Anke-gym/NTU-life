import { addDays, nextWednesday, set, subDays } from 'date-fns'
import type { AgendaItem, Transaction } from './types'

const expenseCategories: Array<[string, string]> = [
  ['饭|餐|午饭|晚饭|早餐|咖啡|奶茶', '餐饮'],
  ['打车|地铁|公交|车|交通', '交通'],
  ['买|购物', '购物'],
  ['电影|游戏|娱乐', '娱乐'],
  ['书|课程|学习', '学习'],
  ['房租|租', '房租'],
]

function nowIso(date = new Date()) {
  return date.toISOString()
}

export function parseAmountCents(text: string): number | undefined {
  const match = text.match(/(\d+(?:\.\d{1,2})?)\s*(?:块|元|新币|sgd|s\$)?/i)
  if (!match) return undefined
  return Math.round(Number(match[1]) * 100)
}

export function parseTransactionText(text: string, base = new Date()): Partial<Transaction> & { missing: string[] } {
  const amountCents = parseAmountCents(text)
  const direction = /收到|收入|工资|兼职/.test(text) ? 'income' : 'expense'
  const category = direction === 'income'
    ? '其他'
    : (expenseCategories.find(([pattern]) => new RegExp(pattern).test(text))?.[1] ?? '其他')
  const occurred = text.includes('昨天') ? subDays(base, 1) : base
  const note = text
    .replace(/今天|昨天|收到|收入|花了?|新币|块|元|sgd|S\$/gi, '')
    .replace(/\d+(?:\.\d{1,2})?/g, '')
    .trim()
  return {
    direction,
    amountCents,
    currency: 'SGD',
    category,
    occurredAt: occurred.toISOString(),
    note,
    source: 'voice',
    missing: amountCents ? [] : ['amountCents'],
  }
}

function parseChineseTime(text: string): { hour: number; minute: number } | undefined {
  const digit = text.match(/(上午|下午|晚上|早上)?\s*(\d{1,2})[:点](\d{1,2})?/)
  if (digit) {
    let hour = Number(digit[2])
    if ((digit[1] === '下午' || digit[1] === '晚上') && hour < 12) hour += 12
    return { hour, minute: digit[3] ? Number(digit[3]) : 0 }
  }
  const cn: Record<string, number> = { 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }
  const match = text.match(/(上午|下午|晚上|早上)?([一二两三四五六七八九十])点/)
  if (!match) return undefined
  let hour = cn[match[2]]
  if ((match[1] === '下午' || match[1] === '晚上') && hour < 12) hour += 12
  return { hour, minute: 0 }
}

export function parseAgendaText(text: string, base = new Date()): Partial<AgendaItem> & { missing: string[] } {
  const time = parseChineseTime(text)
  let date = base
  if (text.includes('明天')) date = addDays(base, 1)
  if (text.includes('周三') || text.includes('星期三')) date = nextWednesday(base)
  const startAt = time ? set(date, { hours: time.hour, minutes: time.minute, seconds: 0, milliseconds: 0 }).toISOString() : undefined
  const reminderMinutes = /半小时|30分钟/.test(text) ? 30 : /10分钟|十分钟/.test(text) ? 10 : /1小时|一小时/.test(text) ? 60 : undefined
  const title = text
    .replace(/今天|明天|周三|星期三|上午|下午|晚上|早上|提前|提醒|半小时|30分钟|10分钟|十分钟|1小时|一小时/g, '')
    .replace(/\d{1,2}[:点]\d{0,2}/g, '')
    .replace(/[一二两三四五六七八九十]点/g, '')
    .replace(/[，,。]/g, '')
    .trim()
  return {
    title,
    startAt,
    reminderMinutes,
    notes: '',
    completed: false,
    source: 'voice',
    missing: [!title && 'title', !startAt && 'startAt'].filter(Boolean) as string[],
  }
}

export function makeTransactionDraft(text: string): Transaction {
  const parsed = parseTransactionText(text)
  const now = nowIso()
  return {
    id: crypto.randomUUID(),
    direction: parsed.direction ?? 'expense',
    amountCents: parsed.amountCents ?? 0,
    currency: parsed.currency ?? 'SGD',
    category: parsed.category ?? '其他',
    occurredAt: parsed.occurredAt ?? now,
    note: parsed.note ?? '',
    source: 'voice',
    createdAt: now,
    updatedAt: now,
  }
}

export function makeAgendaDraft(text: string): AgendaItem {
  const parsed = parseAgendaText(text)
  const now = nowIso()
  return {
    id: crypto.randomUUID(),
    title: parsed.title || text,
    startAt: parsed.startAt ?? now,
    endAt: undefined,
    reminderMinutes: parsed.reminderMinutes,
    notes: parsed.notes ?? '',
    completed: false,
    source: 'voice',
    createdAt: now,
    updatedAt: now,
  }
}
