import { ChevronLeft, ChevronRight, Plus } from 'lucide-react'
import { useState, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { useSearchParams } from 'react-router-dom'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { CourseCard } from '../components/CourseCard'
import { ImportPanel } from '../components/ImportPanel'
import { db } from '../lib/db'
import { expandRules, onlineTasks, weekdays, weekPeriod } from '../lib/term'
import type { AcademicTerm, Course, ScheduleRule, Weekday } from '../lib/types'
import type { AppData } from '../lib/useData'

export function SchedulePage({
  data,
  term,
  week,
  setWeek,
}: {
  data: AppData
  term: AcademicTerm
  week: number
  setWeek: Dispatch<SetStateAction<number>>
}) {
  const [params] = useSearchParams()
  const [editing, setEditing] = useState<Course | undefined>()
  const [deleteRule, setDeleteRule] = useState<ScheduleRule | undefined>()
  const occurrences = expandRules(term, data.courses, data.rules, week)
  const tasks = onlineTasks(data.courses, data.rules, week)

  return (
    <div className="page">
      <header className="page-header">
        <h1>课表</h1>
        <button className="icon-button" type="button" aria-label="新增课程" onClick={() => setEditing(newCourse())}><Plus /></button>
      </header>
      <div className="week-switcher">
        <button className="icon-button" type="button" aria-label="上一周" onClick={() => setWeek(Math.max(1, week - 1))}><ChevronLeft /></button>
        <strong>Week {week}</strong>
        <button className="icon-button" type="button" aria-label="下一周" onClick={() => setWeek(Math.min(12, week + 1))}><ChevronRight /></button>
      </div>
      <div className="week-pills" role="tablist" aria-label="教学周">
        {term.weekPeriods.map((period) => <button className={period.weekNumber === week ? 'pill active' : 'pill'} type="button" key={period.weekNumber} onPointerDown={() => setWeek(period.weekNumber)} onClick={() => setWeek(period.weekNumber)}>W{period.weekNumber}</button>)}
      </div>
      <p className="muted">{weekPeriod(term, week).startDate} 至 {weekPeriod(term, week).endDate}</p>
      {(params.get('import') || !data.courses.length) && <ImportPanel onDone={data.reload} />}
      {tasks.length > 0 && <section className="panel"><h2>本周任务</h2>{tasks.map((task) => <p className="task-line" key={task.rule.id}>{task.course?.code} · Online Video (1hr)</p>)}</section>}
      {weekdays.slice(0, 6).map((day) => {
        const dayItems = occurrences.filter((item) => item.weekday === day.value)
        return (
          <section className="panel day-group" key={day.value}>
            <h2>{day.label}</h2>
            {dayItems.length ? dayItems.map((item) => (
              <div key={item.id} className="card-actions">
                <CourseCard occurrence={item} />
                <button type="button" className="button ghost" onClick={() => setEditing(item.course)}>编辑</button>
                <button type="button" className="button ghost danger-text" onClick={() => setDeleteRule(item.rule)}>删除</button>
              </div>
            )) : <p className="empty">没有课程</p>}
          </section>
        )
      })}
      {editing && <CourseEditor course={editing} onClose={() => setEditing(undefined)} onDone={data.reload} />}
      <ConfirmDialog open={Boolean(deleteRule)} title="删除课程规则" destructive onCancel={() => setDeleteRule(undefined)} onConfirm={() => {
        if (deleteRule) void db.scheduleRules.delete(deleteRule.id).then(data.reload)
        setDeleteRule(undefined)
      }}>删除后该规则对应周次不再显示。</ConfirmDialog>
    </div>
  )
}

function newCourse(): Course {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), code: '', title: '', lecturer: '', aus: 3, color: '#2f80ed', createdAt: now, updatedAt: now }
}

function CourseEditor({ course, onClose, onDone }: { course: Course; onClose: () => void; onDone: () => Promise<void> }) {
  const [form, setForm] = useState(course)
  const [rule, setRule] = useState({ weeks: '1', weekday: 1, startTime: '09:00', endTime: '10:00', venue: '', type: 'class' })
  async function submit(event: FormEvent) {
    event.preventDefault()
    const updated = { ...form, updatedAt: new Date().toISOString() }
    const weeks = rule.weeks.split(',').flatMap((part) => {
      const [start, end] = part.split('-').map(Number)
      return end ? Array.from({ length: end - start + 1 }, (_, i) => start + i) : [start]
    })
    await db.transaction('rw', db.courses, db.scheduleRules, async () => {
      await db.courses.put(updated)
      await db.scheduleRules.add({
        id: crypto.randomUUID(),
        courseId: updated.id,
        weeks,
        weekday: Number(rule.weekday) as Weekday,
        startTime: rule.type === 'class' ? rule.startTime : undefined,
        endTime: rule.type === 'class' ? rule.endTime : undefined,
        venue: rule.venue,
        type: rule.type as 'class' | 'onlineTask',
        sourceText: 'manual',
        confidence: 1,
      })
    })
    await onDone()
    onClose()
  }
  return (
    <div className="sheet">
      <form className="sheet-content" onSubmit={(event) => void submit(event)}>
        <h2>课程</h2>
        <label className="field"><span>代码</span><input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label>
        <label className="field"><span>名称</span><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label className="field"><span>教师</span><input value={form.lecturer} onChange={(event) => setForm({ ...form, lecturer: event.target.value })} /></label>
        <label className="field"><span>周次</span><input required value={rule.weeks} onChange={(event) => setRule({ ...rule, weeks: event.target.value })} /></label>
        <label className="field"><span>星期</span><select value={rule.weekday} onChange={(event) => setRule({ ...rule, weekday: Number(event.target.value) })}>{weekdays.map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</select></label>
        <div className="form-grid"><label className="field"><span>开始</span><input type="time" value={rule.startTime} onChange={(event) => setRule({ ...rule, startTime: event.target.value })} /></label><label className="field"><span>结束</span><input type="time" value={rule.endTime} onChange={(event) => setRule({ ...rule, endTime: event.target.value })} /></label></div>
        <label className="field"><span>地点</span><input value={rule.venue} onChange={(event) => setRule({ ...rule, venue: event.target.value })} /></label>
        <div className="dialog-actions"><button className="button ghost" type="button" onClick={onClose}>取消</button><button className="button primary" type="submit">保存</button></div>
      </form>
    </div>
  )
}
