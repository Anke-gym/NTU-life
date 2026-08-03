import { format, isToday, parseISO, startOfMonth } from 'date-fns'
import type { Dispatch, SetStateAction } from 'react'
import type { LucideIcon } from 'lucide-react'
import { CourseCard } from '../components/CourseCard'
import { expandRules, onlineTasks, weekdays, weekPeriod } from '../lib/term'
import type { AcademicTerm } from '../lib/types'
import type { AppData } from '../lib/useData'

export function HomePage({
  data,
  term,
  week,
  quickActions,
}: {
  data: AppData
  term: AcademicTerm
  week: number
  setWeek: Dispatch<SetStateAction<number>>
  quickActions: Array<{ label: string; icon: LucideIcon; action: () => void }>
}) {
  const today = format(new Date(), 'yyyy年MM月dd日')
  const occurrences = expandRules(term, data.courses, data.rules, week)
  const todayCourses = occurrences.filter((item) => isToday(parseISO(item.date))).slice(0, 3)
  const nextCourse = occurrences.find((item) => item.startAt && parseISO(item.startAt) > new Date())
  const monthStart = startOfMonth(new Date())
  const monthTransactions = data.transactions.filter((item) => parseISO(item.occurredAt) >= monthStart)
  const expense = monthTransactions.filter((item) => item.direction === 'expense').reduce((sum, item) => sum + item.amountCents, 0)
  const income = monthTransactions.filter((item) => item.direction === 'income').reduce((sum, item) => sum + item.amountCents, 0)
  const tasks = onlineTasks(data.courses, data.rules, week)

  return (
    <div className="page">
      <header className="large-title">
        <span>{today}</span>
        <h1>NTU Life</h1>
        <p>{term.name} · Week {week} · {weekPeriod(term, week).startDate} 至 {weekPeriod(term, week).endDate}</p>
      </header>
      <section className="quick-grid" aria-label="快捷操作">
        {quickActions.map((action) => {
          const Icon = action.icon
          return <button className="quick-action" key={action.label} type="button" onClick={action.action}><Icon size={20} />{action.label}</button>
        })}
      </section>
      <section className="panel">
        <h2>今天的课程</h2>
        {todayCourses.length ? todayCourses.map((item) => <CourseCard key={item.id} occurrence={item} />) : <p className="empty">今天暂无已导入课程。</p>}
      </section>
      <section className="panel">
        <h2>本周 Online Video</h2>
        {tasks.length ? tasks.map((item) => <p className="task-line" key={item.rule.id}>{item.course?.code} · {item.rule.sourceText}</p>) : <p className="empty">本周没有在线学习任务。</p>}
      </section>
      <section className="metric-grid">
        <div className="metric"><span>下一节课</span><strong>{nextCourse ? `${weekdays[nextCourse.weekday - 1].label} ${nextCourse.rule.startTime}` : '暂无'}</strong></div>
        <div className="metric"><span>本月收支</span><strong>${((income - expense) / 100).toFixed(2)}</strong></div>
      </section>
    </div>
  )
}
