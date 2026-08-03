import { addDays, format, isWithinInterval, parseISO } from 'date-fns'
import type { AcademicTerm, Course, CourseOccurrence, ScheduleRule, WeekPeriod, Weekday } from './types'

export const AY26_T1: AcademicTerm = {
  id: 'ay26-t1',
  name: 'AY26 T1',
  timezone: 'Asia/Singapore',
  year: 2026,
  weekPeriods: [
    ['2026-08-03', '2026-08-08'],
    ['2026-08-10', '2026-08-15'],
    ['2026-08-17', '2026-08-22'],
    ['2026-08-24', '2026-08-29'],
    ['2026-08-31', '2026-09-05'],
    ['2026-09-07', '2026-09-12'],
    ['2026-09-14', '2026-09-19'],
    ['2026-09-21', '2026-09-26'],
    ['2026-09-28', '2026-10-03'],
    ['2026-10-05', '2026-10-10'],
    ['2026-10-12', '2026-10-17'],
    ['2026-10-19', '2026-10-24'],
  ].map(([startDate, endDate], index) => ({ weekNumber: index + 1, startDate, endDate })),
}

export const weekdays: Array<{ value: Weekday; label: string; short: string }> = [
  { value: 1, label: '星期一', short: '一' },
  { value: 2, label: '星期二', short: '二' },
  { value: 3, label: '星期三', short: '三' },
  { value: 4, label: '星期四', short: '四' },
  { value: 5, label: '星期五', short: '五' },
  { value: 6, label: '星期六', short: '六' },
  { value: 7, label: '星期日', short: '日' },
]

export function getCurrentWeek(term: AcademicTerm, now = new Date()): number {
  const hit = term.weekPeriods.find((week) =>
    isWithinInterval(now, { start: parseISO(week.startDate), end: addDays(parseISO(week.endDate), 1) }),
  )
  return hit?.weekNumber ?? 1
}

export function weekPeriod(term: AcademicTerm, week: number): WeekPeriod {
  return term.weekPeriods.find((item) => item.weekNumber === week) ?? term.weekPeriods[0]
}

export function dateForWeekday(term: AcademicTerm, week: number, weekday: Weekday): string {
  const period = weekPeriod(term, week)
  return format(addDays(parseISO(period.startDate), weekday - 1), 'yyyy-MM-dd')
}

export function expandRules(
  term: AcademicTerm,
  courses: Course[],
  rules: ScheduleRule[],
  week: number,
): CourseOccurrence[] {
  const occurrences: CourseOccurrence[] = []
  rules
    .filter((rule) => rule.weeks.includes(week) && rule.type === 'class' && rule.weekday && rule.startTime && rule.endTime)
    .forEach((rule) => {
      const course = courses.find((item) => item.id === rule.courseId)
      if (!course || !rule.weekday || !rule.startTime || !rule.endTime) return
      const date = dateForWeekday(term, week, rule.weekday)
      occurrences.push({
        id: `${rule.id}-${week}`,
        course,
        rule,
        date,
        weekday: rule.weekday,
        startAt: `${date}T${rule.startTime}:00+08:00`,
        endAt: `${date}T${rule.endTime}:00+08:00`,
      })
    })
  return occurrences.sort((a, b) => (a.startAt ?? '').localeCompare(b.startAt ?? ''))
}

export function onlineTasks(courses: Course[], rules: ScheduleRule[], week: number) {
  return rules
    .filter((rule) => rule.weeks.includes(week) && rule.type === 'onlineTask')
    .map((rule) => ({ rule, course: courses.find((course) => course.id === rule.courseId) }))
    .filter((item) => item.course)
}
