import { describe, expect, it } from 'vitest'
import { parseAgendaText, parseAmountCents, parseTransactionText } from './naturalLanguage'

describe('natural language parser', () => {
  const base = new Date('2026-08-03T10:00:00+08:00')

  it('stores money as integer cents', () => {
    expect(parseAmountCents('今天午饭花了12.5块')).toBe(1250)
  })

  it('parses Chinese expense and income', () => {
    expect(parseTransactionText('今天午饭花了12.5块', base)).toMatchObject({ direction: 'expense', amountCents: 1250, category: '餐饮' })
    expect(parseTransactionText('昨天打车8新币', base)).toMatchObject({ direction: 'expense', amountCents: 800, category: '交通' })
    expect(parseTransactionText('收到兼职工资100新币', base)).toMatchObject({ direction: 'income', amountCents: 10000, category: '其他' })
  })

  it('parses Chinese agenda text', () => {
    const result = parseAgendaText('周三下午三点去学院办公室，提前半小时提醒', base)
    expect(result.title).toContain('去学院办公室')
    expect(result.reminderMinutes).toBe(30)
    expect(result.startAt).toBeTruthy()
    expect(parseAgendaText('明天晚上八点交作业', base).title).toBe('交作业')
  })
})
