import type { Course, ParsedImport, ScheduleRule, Weekday } from './types'

const colors = ['#2f80ed', '#00a878', '#f2994a', '#9b51e0', '#eb5757', '#007aff', '#34c759']
const weekdayMap: Record<string, Weekday> = {
  monday: 1,
  mon: 1,
  tuesday: 2,
  tue: 2,
  wednesday: 3,
  wed: 3,
  thursday: 4,
  thu: 4,
  friday: 5,
  fri: 5,
  saturday: 6,
  sat: 6,
  sunday: 7,
  sun: 7,
}

export function normalizeScheduleText(input: string): string {
  return input
    .replace(/\r\n?/g, '\n')
    .replace(/[–—]/g, '-')
    .replace(/[：]/g, ':')
    .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
    .replace(/\bO(?=\d)/g, '0')
    .replace(/\s+/g, ' ')
    .replace(/\s*(CA\d{4})\s*/g, '\n$1 ')
    .replace(/\s*(W\d)/g, '\n$1')
    .replace(/\s*(Lecturer:|AUs:)/gi, '\n$1')
    .trim()
}

export function parseWeeks(expr: string): number[] {
  const clean = expr.toUpperCase().replace(/^W/, '')
  return [...new Set(clean.split(',').flatMap((part) => {
    const [start, end] = part.split('-').map((value) => Number(value.trim()))
    if (!Number.isFinite(start)) return []
    if (!end) return [start]
    return Array.from({ length: end - start + 1 }, (_, index) => start + index)
  }))].sort((a, b) => a - b)
}

export function parseTimeRange(value: string): { startTime: string; endTime: string } | undefined {
  const match = value.match(/(\d{1,2}:?\d{2})\s*-\s*(\d{1,2}:?\d{2})/)
  if (!match) return undefined
  const normalize = (time: string) => {
    const raw = time.replace(':', '').padStart(4, '0')
    return `${raw.slice(0, 2)}:${raw.slice(2, 4)}`
  }
  return { startTime: normalize(match[1]), endTime: normalize(match[2]) }
}

export function parseScheduleText(input: string): ParsedImport {
  const text = normalizeScheduleText(input)
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean)
  const courses: Course[] = []
  const rules: ScheduleRule[] = []
  let active: Course | undefined
  const now = new Date().toISOString()

  for (const line of lines) {
    const courseMatch = line.match(/^(CA\d{4})\s+(.+)/i)
    if (courseMatch) {
      active = {
        id: crypto.randomUUID(),
        code: courseMatch[1].toUpperCase(),
        title: courseMatch[2].trim(),
        lecturer: '',
        aus: 0,
        color: colors[courses.length % colors.length],
        createdAt: now,
        updatedAt: now,
      }
      courses.push(active)
      continue
    }
    if (!active) continue
    const lecturerMatch = line.match(/^Lecturer:\s*(.+)$/i)
    if (lecturerMatch) {
      active.lecturer = lecturerMatch[1].trim()
      continue
    }
    const auMatch = line.match(/^AUs:\s*(\d+)/i)
    if (auMatch) {
      active.aus = Number(auMatch[1])
      continue
    }
    const ruleMatch = line.match(/^(W[\d,-]+)\s+(.+)$/i)
    if (!ruleMatch) continue
    const body = ruleMatch[2]
    const weeks = parseWeeks(ruleMatch[1])
    const online = /online\s+video/i.test(body)
    if (online) {
      rules.push({
        id: crypto.randomUUID(),
        courseId: active.id,
        weeks,
        type: 'onlineTask',
        sourceText: line,
        confidence: 0.92,
      })
      continue
    }
    const weekdayKey = Object.keys(weekdayMap).find((key) => new RegExp(`\\b${key}\\b`, 'i').test(body))
    const time = parseTimeRange(body)
    const venue = body
      .replace(new RegExp(`\\b${weekdayKey ?? ''}\\b`, 'i'), '')
      .replace(/\d{1,2}:?\d{2}\s*-\s*\d{1,2}:?\d{2}/, '')
      .trim()
    rules.push({
      id: crypto.randomUUID(),
      courseId: active.id,
      weeks,
      weekday: weekdayKey ? weekdayMap[weekdayKey] : undefined,
      startTime: time?.startTime,
      endTime: time?.endTime,
      venue: venue || undefined,
      type: 'class',
      sourceText: line,
      confidence: weekdayKey && time ? 0.9 : 0.58,
    })
  }
  return { courses, rules }
}
