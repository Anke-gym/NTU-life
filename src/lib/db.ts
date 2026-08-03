import Dexie, { type Table } from 'dexie'
import { z } from 'zod'
import type { AcademicTerm, AgendaItem, AppSettings, BackupPayload, Course, ScheduleRule, Transaction } from './types'
import { AY26_T1 } from './term'

export const settingsId = 'default'
export const defaultMoneyCategories = ['吃饭', '交通', '饮料', '生活用品', '学习资料', '房租水电', '医疗', '其他']

export class NtuLifeDb extends Dexie {
  terms!: Table<AcademicTerm, string>
  courses!: Table<Course, string>
  scheduleRules!: Table<ScheduleRule, string>
  transactions!: Table<Transaction, string>
  agendaItems!: Table<AgendaItem, string>
  settings!: Table<AppSettings, string>

  constructor() {
    super('ntu-life-db')
    this.version(1).stores({
      terms: 'id, name, year',
      courses: 'id, code, title',
      scheduleRules: 'id, courseId, type',
      transactions: 'id, occurredAt, direction, category',
      agendaItems: 'id, startAt, completed',
      settings: 'id',
    })
    this.version(2).stores({
      terms: 'id, name, year',
      courses: 'id, code, title',
      scheduleRules: 'id, courseId, type',
      transactions: 'id, occurredAt, direction, category',
      agendaItems: 'id, startAt, completed',
      settings: 'id, schemaVersion',
    })
  }
}

export const db = new NtuLifeDb()

export async function ensureSeedData() {
  const termCount = await db.terms.count()
  if (!termCount) await db.terms.add(AY26_T1)
  const settings = await db.settings.get(settingsId)
  if (!settings) {
    await db.settings.add({
      id: settingsId,
      currentTermId: AY26_T1.id,
      defaultCurrency: 'SGD',
      defaultClassReminderMinutes: 30,
      theme: 'system',
      appLanguage: 'zh',
      speechLanguage: 'zh-CN',
      displayName: '',
      studentNumber: '',
      moneyCategories: defaultMoneyCategories,
      schemaVersion: 2,
    })
    return
  }
  const patched: AppSettings = {
    ...settings,
    appLanguage: settings.appLanguage ?? 'zh',
    moneyCategories: settings.moneyCategories?.length ? settings.moneyCategories : defaultMoneyCategories,
  }
  if (patched.appLanguage !== settings.appLanguage || patched.moneyCategories !== settings.moneyCategories) {
    await db.settings.put(patched)
  }
}

const weekPeriodSchema = z.object({ weekNumber: z.number(), startDate: z.string(), endDate: z.string() })
const termSchema = z.object({
  id: z.string(),
  name: z.string(),
  timezone: z.string(),
  year: z.number(),
  weekPeriods: z.array(weekPeriodSchema),
})
const courseSchema = z.object({
  id: z.string(),
  code: z.string(),
  title: z.string(),
  lecturer: z.string(),
  aus: z.number(),
  color: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
const ruleSchema = z.object({
  id: z.string(),
  courseId: z.string(),
  weeks: z.array(z.number()),
  weekday: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4), z.literal(5), z.literal(6), z.literal(7)]).optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  venue: z.string().optional(),
  type: z.enum(['class', 'onlineTask']),
  sourceText: z.string(),
  confidence: z.number().optional(),
  note: z.string().optional(),
  completed: z.boolean().optional(),
})
const transactionSchema = z.object({
  id: z.string(),
  direction: z.enum(['expense', 'income']),
  amountCents: z.number().int(),
  currency: z.string(),
  category: z.string(),
  occurredAt: z.string(),
  note: z.string(),
  source: z.enum(['manual', 'voice']),
  createdAt: z.string(),
  updatedAt: z.string(),
})
const agendaSchema = z.object({
  id: z.string(),
  title: z.string(),
  startAt: z.string(),
  endAt: z.string().optional(),
  reminderMinutes: z.number().optional(),
  notes: z.string(),
  completed: z.boolean(),
  source: z.enum(['manual', 'voice']),
  createdAt: z.string(),
  updatedAt: z.string(),
})
const settingsSchema = z.object({
  id: z.string(),
  currentTermId: z.string(),
  defaultCurrency: z.string(),
  defaultClassReminderMinutes: z.number(),
  theme: z.enum(['system', 'light', 'dark']),
  appLanguage: z.enum(['zh', 'en']).optional(),
  speechLanguage: z.enum(['zh-CN', 'zh-SG', 'en-SG']),
  displayName: z.string().optional(),
  studentNumber: z.string().optional(),
  moneyCategories: z.array(z.string()).optional(),
  schemaVersion: z.number(),
})

export const backupSchema = z.object({
  schemaVersion: z.number(),
  exportedAt: z.string(),
  terms: z.array(termSchema),
  courses: z.array(courseSchema),
  scheduleRules: z.array(ruleSchema),
  transactions: z.array(transactionSchema),
  agendaItems: z.array(agendaSchema),
  settings: z.array(settingsSchema),
})

export async function exportBackup(): Promise<BackupPayload> {
  return {
    schemaVersion: 2,
    exportedAt: new Date().toISOString(),
    terms: await db.terms.toArray(),
    courses: await db.courses.toArray(),
    scheduleRules: await db.scheduleRules.toArray(),
    transactions: await db.transactions.toArray(),
    agendaItems: await db.agendaItems.toArray(),
    settings: await db.settings.toArray(),
  }
}

export async function restoreBackup(payload: unknown, mode: 'merge' | 'replace') {
  const parsed = backupSchema.parse(payload)
  await db.transaction('rw', [db.terms, db.courses, db.scheduleRules, db.transactions, db.agendaItems, db.settings], async () => {
    if (mode === 'replace') {
      await Promise.all([
        db.terms.clear(),
        db.courses.clear(),
        db.scheduleRules.clear(),
        db.transactions.clear(),
        db.agendaItems.clear(),
        db.settings.clear(),
      ])
    }
    await db.terms.bulkPut(parsed.terms)
    await db.courses.bulkPut(parsed.courses)
    await db.scheduleRules.bulkPut(parsed.scheduleRules)
    await db.transactions.bulkPut(parsed.transactions)
    await db.agendaItems.bulkPut(parsed.agendaItems)
    await db.settings.bulkPut(parsed.settings)
  })
}

export async function clearAllData() {
  await db.transaction('rw', [db.terms, db.courses, db.scheduleRules, db.transactions, db.agendaItems, db.settings], async () => {
    await Promise.all([
      db.terms.clear(),
      db.courses.clear(),
      db.scheduleRules.clear(),
      db.transactions.clear(),
      db.agendaItems.clear(),
      db.settings.clear(),
    ])
  })
  await ensureSeedData()
}
