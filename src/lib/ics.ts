import { addMinutes, format, parseISO } from 'date-fns'
import type { AcademicTerm, AgendaItem, Course, ScheduleRule } from './types'
import { dateForWeekday } from './term'

function escapeText(value: string) {
  return value.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function stamp(date: Date) {
  return format(date, "yyyyMMdd'T'HHmmss")
}

function dateStamp(date: Date) {
  return format(date, 'yyyyMMdd')
}

function alarm(minutes?: number) {
  if (minutes === undefined) return ''
  return [`BEGIN:VALARM`, `TRIGGER:-PT${minutes}M`, `ACTION:DISPLAY`, `DESCRIPTION:Reminder`, `END:VALARM`].join('\r\n')
}

function calendar(events: string[]) {
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//NTU Life//PWA//ZH-CN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')
}

export function scheduleToIcs(
  term: AcademicTerm,
  courses: Course[],
  rules: ScheduleRule[],
  options: { weeks?: number[]; includeOnline?: boolean; reminderMinutes?: number } = {},
) {
  const events: string[] = []
  const selectedWeeks = options.weeks ?? term.weekPeriods.map((week) => week.weekNumber)
  for (const rule of rules) {
    const course = courses.find((item) => item.id === rule.courseId)
    if (!course) continue
    for (const week of rule.weeks.filter((item) => selectedWeeks.includes(item))) {
      if (rule.type === 'onlineTask') {
        if (!options.includeOnline) continue
        const date = parseISO(term.weekPeriods[week - 1].startDate)
        events.push([
          'BEGIN:VEVENT',
          `UID:${rule.id}-w${week}@ntu-life`,
          `DTSTAMP:${stamp(new Date())}`,
          `DTSTART;VALUE=DATE:${dateStamp(date)}`,
          `DTEND;VALUE=DATE:${dateStamp(addMinutes(date, 24 * 60))}`,
          `SUMMARY:${escapeText(`${course.code} Online Video`)}`,
          `DESCRIPTION:${escapeText(rule.sourceText)}`,
          'END:VEVENT',
        ].join('\r\n'))
        continue
      }
      if (!rule.weekday || !rule.startTime || !rule.endTime) continue
      const date = dateForWeekday(term, week, rule.weekday)
      const start = parseISO(`${date}T${rule.startTime}:00+08:00`)
      const end = parseISO(`${date}T${rule.endTime}:00+08:00`)
      events.push([
        'BEGIN:VEVENT',
        `UID:${rule.id}-w${week}@ntu-life`,
        `DTSTAMP:${stamp(new Date())}`,
        `DTSTART;TZID=Asia/Singapore:${stamp(start)}`,
        `DTEND;TZID=Asia/Singapore:${stamp(end)}`,
        `SUMMARY:${escapeText(`${course.code} ${course.title}`)}`,
        `LOCATION:${escapeText(rule.venue ?? '')}`,
        `DESCRIPTION:${escapeText(`${course.lecturer}\n${rule.sourceText}`)}`,
        alarm(options.reminderMinutes),
        'END:VEVENT',
      ].filter(Boolean).join('\r\n'))
    }
  }
  return calendar(events)
}

export function agendaToIcs(items: AgendaItem[]) {
  const events = items.map((item) => {
    const start = parseISO(item.startAt)
    const end = item.endAt ? parseISO(item.endAt) : addMinutes(start, 30)
    return [
      'BEGIN:VEVENT',
      `UID:${item.id}@ntu-life`,
      `DTSTAMP:${stamp(new Date())}`,
      `DTSTART;TZID=Asia/Singapore:${stamp(start)}`,
      `DTEND;TZID=Asia/Singapore:${stamp(end)}`,
      `SUMMARY:${escapeText(item.title)}`,
      `DESCRIPTION:${escapeText(item.notes)}`,
      alarm(item.reminderMinutes),
      'END:VEVENT',
    ].filter(Boolean).join('\r\n')
  })
  return calendar(events)
}
