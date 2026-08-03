import { describe, expect, it } from 'vitest'
import { goldenScheduleText } from './fixtures'
import { parseScheduleText } from './parser'
import { AY26_T1 } from './term'
import { agendaToIcs, scheduleToIcs } from './ics'

describe('ics export', () => {
  it('generates schedule events with date, venue, uid and alarm', () => {
    const parsed = parseScheduleText(goldenScheduleText)
    const ics = scheduleToIcs(AY26_T1, parsed.courses, parsed.rules, { weeks: [9], reminderMinutes: 30 })
    
    // =========新增打印代码=========
    console.log("====完整ICS输出====")
    console.log(ics)
    console.log(JSON.stringify(ics))
    // ==============================

    expect(ics).toContain('BEGIN:VCALENDAR')
    expect(ics).toContain('UID:')
    expect(ics).toMatch(/DTSTART;TZID=Asia\/Singapore:20260929T193000/)
    expect(ics).toContain('LOCATION:LT28')
    expect(ics).toContain('TRIGGER:-PT30M')
  })

  it('generates agenda alarms', () => {
    const ics = agendaToIcs([{
      id: 'a1',
      title: '交作业',
      startAt: '2026-08-04T20:00:00+08:00',
      reminderMinutes: 10,
      notes: '',
      completed: false,
      source: 'manual',
      createdAt: '2026-08-03T00:00:00+08:00',
      updatedAt: '2026-08-03T00:00:00+08:00',
    }])
    expect(ics).toContain('SUMMARY:交作业')
    expect(ics).toContain('TRIGGER:-PT10M')
  })
})
