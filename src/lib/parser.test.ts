import { describe, expect, it } from 'vitest'
import { goldenScheduleText } from './fixtures'
import { parseScheduleText, parseTimeRange, parseWeeks } from './parser'
import { expandRules } from './term'
import { AY26_T1 } from './term'

describe('schedule parser', () => {
  it('parses week expressions', () => {
    expect(parseWeeks('W1-6')).toEqual([1, 2, 3, 4, 5, 6])
    expect(parseWeeks('W9')).toEqual([9])
    expect(parseWeeks('W7-8,10-12')).toEqual([7, 8, 10, 11, 12])
  })

  it('parses compact time ranges', () => {
    expect(parseTimeRange('2000 - 2200')).toEqual({ startTime: '20:00', endTime: '22:00' })
    expect(parseTimeRange('1930-2130')).toEqual({ startTime: '19:30', endTime: '21:30' })
  })

  it('parses the golden schedule and special overrides', () => {
    const parsed = parseScheduleText(goldenScheduleText)
    expect(parsed.courses).toHaveLength(4)
    expect(parsed.rules.filter((rule) => rule.type === 'onlineTask')).toHaveLength(4)
    const week1 = expandRules(AY26_T1, parsed.courses, parsed.rules, 1)
    expect(week1.some((item) => item.course.code === 'CA6000' && item.rule.startTime === '20:00')).toBe(true)
    expect(week1.some((item) => item.course.code === 'CA6002' && item.rule.startTime === '20:00')).toBe(true)
    const week2 = expandRules(AY26_T1, parsed.courses, parsed.rules, 2)
    expect(week2.filter((item) => item.rule.startTime === '17:00')).toHaveLength(2)
    const week7 = expandRules(AY26_T1, parsed.courses, parsed.rules, 7)
    expect(week7.some((item) => item.course.code === 'CA6001')).toBe(true)
    expect(week7.some((item) => item.course.code === 'CA6003')).toBe(true)
    expect(expandRules(AY26_T1, parsed.courses, parsed.rules, 9).find((item) => item.course.code === 'CA6003' && item.weekday === 2)?.rule.venue).toBe('LT28')
    expect(expandRules(AY26_T1, parsed.courses, parsed.rules, 10).find((item) => item.course.code === 'CA6003' && item.weekday === 2)?.rule.venue).toBe('LT29')
    expect(expandRules(AY26_T1, parsed.courses, parsed.rules, 12).find((item) => item.course.code === 'CA6001' && item.weekday === 4)?.rule.venue).toBe('LT2A')
  })
})
