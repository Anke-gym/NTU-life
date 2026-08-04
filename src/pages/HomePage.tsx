import { endOfDay, format, isToday, isWithinInterval, parseISO, startOfDay } from 'date-fns'
import { UserRound } from 'lucide-react'
import { useMemo, useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { CourseCard } from '../components/CourseCard'
import { db } from '../lib/db'
import { commonCopy, getLanguage } from '../lib/i18n'
import { expandAllRules, expandRules, getCurrentWeek, onlineTasks, weekPeriod } from '../lib/term'
import type { AcademicTerm, CourseOccurrence } from '../lib/types'
import type { AppData } from '../lib/useData'

const copy = {
  zh: {
    profile: '个人主页',
    missingName: '未填写姓名',
    missingStudentNumber: '点击填写学号',
    todayCourses: '今天的课程',
    noTodayCourses: '今天暂无已导入课程。',
    onlineTasks: '本周 Online Video',
    noOnlineTasks: '本周没有在线学习任务。',
    nextCourse: '下一节课',
    none: '暂无',
    todayExpense: '今日支出',
    profileTitle: '个人信息',
    name: '姓名',
    namePlaceholder: '输入姓名',
    studentNumber: '学号',
    studentNumberPlaceholder: '输入学号',
    to: '至',
    week: (week: number) => `第 ${week} 周`,
  },
  en: {
    profile: 'Profile',
    missingName: 'Name not set',
    missingStudentNumber: 'Tap to add student number',
    todayCourses: "Today's Courses",
    noTodayCourses: 'No imported courses today.',
    onlineTasks: 'This Week Online Video',
    noOnlineTasks: 'No online learning tasks this week.',
    nextCourse: 'Next Class',
    none: 'None',
    todayExpense: "Today's Expense",
    profileTitle: 'Profile',
    name: 'Name',
    namePlaceholder: 'Enter name',
    studentNumber: 'Student Number',
    studentNumberPlaceholder: 'Enter student number',
    to: 'to',
    week: (week: number) => `Week ${week}`,
  },
} as const

export function HomePage({
  data,
  term,
  week,
}: {
  data: AppData
  term: AcademicTerm
  week: number
  setWeek: Dispatch<SetStateAction<number>>
}) {
  const [editingProfile, setEditingProfile] = useState(false)
  const language = getLanguage(data)
  const t = copy[language]
  const common = commonCopy[language]
  const today = format(new Date(), language === 'zh' ? 'yyyy年M月d日' : 'MMM d, yyyy')
  const currentWeek = getCurrentWeek(term)
  const occurrences = expandRules(term, data.courses, data.rules, currentWeek)
  const todayCourses = occurrences.filter((item) => isToday(parseISO(item.date))).slice(0, 3)
  const tasks = onlineTasks(data.courses, data.rules, currentWeek)
  const period = weekPeriod(term, week)
  const todayRange = { start: startOfDay(new Date()), end: endOfDay(new Date()) }
  const todayExpense = data.transactions
    .filter((item) => item.direction === 'expense' && isWithinInterval(parseISO(item.occurredAt), todayRange))
    .reduce((sum, item) => sum + item.amountCents, 0)
  const nextCourse = useMemo(() => findNextCourse(term, data), [data, term])

  return (
    <div className="page">
      <header className="large-title">
        <span>{today}</span>
        <h1>NTU Life</h1>
        <p>{term.name} · Week {week} · {period.startDate} {t.to} {period.endDate}</p>
      </header>
      <section className="profile-panel">
        <div className="profile-avatar"><UserRound size={26} /></div>
        <div>
          <span>{t.profile}</span>
          <strong>{data.settings?.displayName || t.missingName}</strong>
          <small>{data.settings?.studentNumber || t.missingStudentNumber}</small>
        </div>
        <button className="button ghost" type="button" onClick={() => setEditingProfile(true)}>{common.edit}</button>
      </section>
      <section className="panel">
        <h2>{t.todayCourses}</h2>
        {todayCourses.length ? todayCourses.map((item) => <CourseCard key={item.id} occurrence={item} language={language} />) : <p className="empty">{t.noTodayCourses}</p>}
      </section>
      <section className="panel">
        <h2>{t.onlineTasks}</h2>
        {tasks.length ? tasks.map((item) => <p className={`task-line ${item.rule.completed ? 'done' : ''}`} key={item.rule.id}>{item.course?.code} · {item.rule.sourceText}</p>) : <p className="empty">{t.noOnlineTasks}</p>}
      </section>
      <section className="metric-grid">
        <div className="metric"><span>{t.nextCourse}</span><strong>{nextCourse ? formatNextCourse(nextCourse, term, language) : t.none}</strong></div>
        <div className="metric"><span>{t.todayExpense}</span><strong>{formatMoney(todayExpense)}</strong></div>
      </section>
      {editingProfile && <ProfileEditor data={data} language={language} onClose={() => setEditingProfile(false)} />}
    </div>
  )
}

function findNextCourse(term: AcademicTerm, data: AppData) {
  const now = new Date()
  return expandAllRules(term, data.courses, data.rules).find((item) => item.startAt && parseISO(item.startAt) > now)
}

function formatNextCourse(occurrence: CourseOccurrence, term: AcademicTerm, language: 'zh' | 'en') {
  const common = commonCopy[language]
  const t = copy[language]
  const week = term.weekPeriods.find((item) => occurrence.date >= item.startDate && occurrence.date <= item.endDate)?.weekNumber ?? 1
  return `${t.week(week)} ${common.weekdays[occurrence.weekday - 1].short} · ${occurrence.course.title} · ${occurrence.rule.startTime}-${occurrence.rule.endTime}`
}

function formatMoney(cents: number) {
  return `S$${(cents / 100).toFixed(2)}`
}

function ProfileEditor({ data, language, onClose }: { data: AppData; language: 'zh' | 'en'; onClose: () => void }) {
  const [name, setName] = useState(data.settings?.displayName ?? '')
  const [studentNumber, setStudentNumber] = useState(data.settings?.studentNumber ?? '')
  const t = copy[language]
  const common = commonCopy[language]
  async function submit(event: FormEvent) {
    event.preventDefault()
    if (!data.settings) return
    await db.settings.put({ ...data.settings, displayName: name.trim(), studentNumber: studentNumber.trim() })
    await data.reload()
    onClose()
  }
  return (
    <div className="sheet">
      <form className="sheet-content" onSubmit={(event) => void submit(event)}>
        <h2>{t.profileTitle}</h2>
        <label className="field"><span>{t.name}</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder={t.namePlaceholder} /></label>
        <label className="field"><span>{t.studentNumber}</span><input value={studentNumber} onChange={(event) => setStudentNumber(event.target.value)} placeholder={t.studentNumberPlaceholder} /></label>
        <div className="dialog-actions">
          <button className="button ghost" type="button" onClick={onClose}>{common.cancel}</button>
          <button className="button primary" type="submit">{common.save}</button>
        </div>
      </form>
    </div>
  )
}
