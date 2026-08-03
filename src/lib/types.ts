export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type ScheduleType = 'class' | 'onlineTask'

export interface WeekPeriod {
  weekNumber: number
  startDate: string
  endDate: string
}

export interface AcademicTerm {
  id: string
  name: string
  timezone: string
  year: number
  weekPeriods: WeekPeriod[]
}

export interface Course {
  id: string
  code: string
  title: string
  lecturer: string
  aus: number
  color: string
  createdAt: string
  updatedAt: string
}

export interface ScheduleRule {
  id: string
  courseId: string
  weeks: number[]
  weekday?: Weekday
  startTime?: string
  endTime?: string
  venue?: string
  type: ScheduleType
  sourceText: string
  confidence?: number
}

export interface Transaction {
  id: string
  direction: 'expense' | 'income'
  amountCents: number
  currency: string
  category: string
  occurredAt: string
  note: string
  source: 'manual' | 'voice'
  createdAt: string
  updatedAt: string
}

export interface AgendaItem {
  id: string
  title: string
  startAt: string
  endAt?: string
  reminderMinutes?: number
  notes: string
  completed: boolean
  source: 'manual' | 'voice'
  createdAt: string
  updatedAt: string
}

export interface AppSettings {
  id: string
  currentTermId: string
  defaultCurrency: string
  defaultClassReminderMinutes: number
  theme: 'system' | 'light' | 'dark'
  speechLanguage: 'zh-CN' | 'zh-SG' | 'en-SG'
  schemaVersion: number
}

export interface CourseOccurrence {
  id: string
  course: Course
  rule: ScheduleRule
  date: string
  weekday: Weekday
  startAt?: string
  endAt?: string
}

export interface ParsedImport {
  courses: Course[]
  rules: ScheduleRule[]
}

export interface BackupPayload {
  schemaVersion: number
  exportedAt: string
  terms: AcademicTerm[]
  courses: Course[]
  scheduleRules: ScheduleRule[]
  transactions: Transaction[]
  agendaItems: AgendaItem[]
  settings: AppSettings[]
}
