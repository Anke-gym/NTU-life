import { useCallback, useEffect, useState } from 'react'
import { db, ensureSeedData, settingsId } from './db'
import type { AcademicTerm, AgendaItem, AppSettings, Course, ScheduleRule, Transaction } from './types'

export interface AppData {
  ready: boolean
  terms: AcademicTerm[]
  settings?: AppSettings
  courses: Course[]
  rules: ScheduleRule[]
  transactions: Transaction[]
  agendaItems: AgendaItem[]
  reload: () => Promise<void>
}

export function useData(): AppData {
  const [ready, setReady] = useState(false)
  const [terms, setTerms] = useState<AcademicTerm[]>([])
  const [settings, setSettings] = useState<AppSettings>()
  const [courses, setCourses] = useState<Course[]>([])
  const [rules, setRules] = useState<ScheduleRule[]>([])
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [agendaItems, setAgendaItems] = useState<AgendaItem[]>([])

  const reload = useCallback(async () => {
    await ensureSeedData()
    const [nextTerms, nextSettings, nextCourses, nextRules, nextTransactions, nextAgenda] = await Promise.all([
      db.terms.toArray(),
      db.settings.get(settingsId),
      db.courses.toArray(),
      db.scheduleRules.toArray(),
      db.transactions.orderBy('occurredAt').reverse().toArray(),
      db.agendaItems.orderBy('startAt').toArray(),
    ])
    setTerms(nextTerms)
    setSettings(nextSettings)
    setCourses(nextCourses)
    setRules(nextRules)
    setTransactions(nextTransactions)
    setAgendaItems(nextAgenda)
    setReady(true)
  }, [])

  useEffect(() => {
    void reload()
    void navigator.storage?.persist?.().catch(() => false)
  }, [reload])

  return { ready, terms, settings, courses, rules, transactions, agendaItems, reload }
}
