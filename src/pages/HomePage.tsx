import { format, isToday, parseISO, startOfMonth } from 'date-fns'
import { UserRound } from 'lucide-react'
import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { CourseCard } from '../components/CourseCard'
import { db } from '../lib/db'
import { expandRules, onlineTasks, weekdays, weekPeriod } from '../lib/term'
import type { AcademicTerm } from '../lib/types'
import type { AppData } from '../lib/useData'

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
      <section className="profile-panel">
        <div className="profile-avatar"><UserRound size={26} /></div>
        <div>
          <span>个人主页</span>
          <strong>{data.settings?.displayName || '未填写姓名'}</strong>
          <small>{data.settings?.studentNumber || '点击填写学号'}</small>
        </div>
        <button className="button ghost" type="button" onClick={() => setEditingProfile(true)}>编辑</button>
      </section>
      <section className="panel">
        <h2>今天的课程</h2>
        {todayCourses.length ? todayCourses.map((item) => <CourseCard key={item.id} occurrence={item} />) : <p className="empty">今天暂无已导入课程。</p>}
      </section>
      <section className="panel">
        <h2>本周 Online Video</h2>
        {tasks.length ? tasks.map((item) => <p className={`task-line ${item.rule.completed ? 'done' : ''}`} key={item.rule.id}>{item.course?.code} · {item.rule.sourceText}</p>) : <p className="empty">本周没有在线学习任务。</p>}
      </section>
      <section className="metric-grid">
        <div className="metric"><span>下一节课</span><strong>{nextCourse ? `${weekdays[nextCourse.weekday - 1].label} ${nextCourse.rule.startTime}` : '暂无'}</strong></div>
        <div className="metric"><span>本月收支</span><strong>${((income - expense) / 100).toFixed(2)}</strong></div>
      </section>
      {editingProfile && <ProfileEditor data={data} onClose={() => setEditingProfile(false)} />}
    </div>
  )
}

function ProfileEditor({ data, onClose }: { data: AppData; onClose: () => void }) {
  const [name, setName] = useState(data.settings?.displayName ?? '')
  const [studentNumber, setStudentNumber] = useState(data.settings?.studentNumber ?? '')
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
        <h2>个人信息</h2>
        <label className="field"><span>姓名</span><input value={name} onChange={(event) => setName(event.target.value)} placeholder="输入姓名" /></label>
        <label className="field"><span>学号</span><input value={studentNumber} onChange={(event) => setStudentNumber(event.target.value)} placeholder="输入学号" /></label>
        <div className="dialog-actions">
          <button className="button ghost" type="button" onClick={onClose}>取消</button>
          <button className="button primary" type="submit">保存</button>
        </div>
      </form>
    </div>
  )
}
