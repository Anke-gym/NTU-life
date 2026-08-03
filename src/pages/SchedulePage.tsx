import { Download, Plus } from 'lucide-react'
import { useState, type CSSProperties, type Dispatch, type FormEvent, type SetStateAction } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ImportPanel } from '../components/ImportPanel'
import { db } from '../lib/db'
import { expandRules, onlineTasks, weekdays, weekPeriod } from '../lib/term'
import type { AcademicTerm, Course, CourseOccurrence, ScheduleRule, Weekday } from '../lib/types'
import type { AppData } from '../lib/useData'

const dayStartMinutes = 8 * 60
const dayEndMinutes = 22 * 60
const rowHeight = 40
const timeLabels = Array.from({ length: 15 }, (_, index) => `${String(index + 8).padStart(2, '0')}:00`)

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
  const [importOpen, setImportOpen] = useState(!data.courses.length)
  const [editing, setEditing] = useState<{ course: Course; rule?: ScheduleRule } | undefined>()
  const [deleteRule, setDeleteRule] = useState<ScheduleRule | undefined>()
  const occurrences = expandRules(term, data.courses, data.rules, week)
  const tasks = onlineTasks(data.courses, data.rules, week)
  const period = weekPeriod(term, week)

  async function toggleTask(rule: ScheduleRule) {
    await db.scheduleRules.put({ ...rule, completed: !rule.completed })
    await data.reload()
  }

  return (
    <div className="page schedule-page">
      <header className="page-header">
        <div>
          <h1>课表</h1>
          <p className="muted">{period.startDate} 至 {period.endDate}</p>
        </div>
        <button className="icon-button" type="button" aria-label="新增课程" onClick={() => setEditing({ course: newCourse() })}><Plus /></button>
      </header>
      <div className="schedule-toolbar">
        <div className="week-pills" role="tablist" aria-label="教学周">
          {term.weekPeriods.map((item) => (
            <button
              className={item.weekNumber === week ? 'pill active' : 'pill'}
              type="button"
              key={item.weekNumber}
              onPointerDown={() => setWeek(item.weekNumber)}
              onClick={() => setWeek(item.weekNumber)}
            >
              第 {item.weekNumber} 周
            </button>
          ))}
        </div>
        <button className="button primary import-button" type="button" onClick={() => setImportOpen(true)}>
          <Download size={18} />导入
        </button>
      </div>
      {tasks.length > 0 && (
        <section className="online-strip" aria-label="本周网课任务">
          {tasks.map((task) => (
            <button
              className={`online-task ${task.rule.completed ? 'done' : ''}`}
              type="button"
              key={task.rule.id}
              onClick={() => void toggleTask(task.rule)}
            >
              <span>{task.course?.code} Online Video</span>
              <b>{task.rule.completed ? '已完成' : '待完成'}</b>
            </button>
          ))}
        </section>
      )}
      <section className="calendar-board" aria-label={`第 ${week} 周课表`}>
        <div className="calendar-header" style={{ gridTemplateColumns: '48px repeat(6, minmax(70px, 1fr))' }}>
          <span />
          {weekdays.slice(0, 6).map((day) => <strong key={day.value}>{day.short}</strong>)}
        </div>
        <div className="calendar-grid" style={{ height: `${timeLabels.length * rowHeight}px` }}>
          <div className="time-axis">
            {timeLabels.map((time) => <span key={time}>{time}</span>)}
          </div>
          {weekdays.slice(0, 6).map((day) => <div className="day-column" key={day.value} />)}
          {occurrences.map((item) => (
            <CalendarCourse
              key={item.id}
              occurrence={item}
              onClick={() => setEditing({ course: item.course, rule: item.rule })}
            />
          ))}
        </div>
      </section>
      {!data.courses.length && <p className="empty panel">还没有课表。点击右上角“导入”或“+”开始添加。</p>}
      {importOpen && (
        <div className="sheet">
          <div className="sheet-content">
            <ImportPanel onDone={async () => { await data.reload(); setImportOpen(false) }} />
            <button className="button ghost full-width" type="button" onClick={() => setImportOpen(false)}>关闭</button>
          </div>
        </div>
      )}
      {editing && <CourseEditor course={editing.course} rule={editing.rule} onDelete={setDeleteRule} onClose={() => setEditing(undefined)} onDone={data.reload} />}
      <ConfirmDialog open={Boolean(deleteRule)} title="删除课程规则" destructive onCancel={() => setDeleteRule(undefined)} onConfirm={() => {
        if (deleteRule) void db.scheduleRules.delete(deleteRule.id).then(data.reload)
        setDeleteRule(undefined)
        setEditing(undefined)
      }}>删除后该规则对应周次不再显示。</ConfirmDialog>
    </div>
  )
}

function CalendarCourse({ occurrence, onClick }: { occurrence: CourseOccurrence; onClick: () => void }) {
  const start = toMinutes(occurrence.rule.startTime ?? '08:00')
  const end = toMinutes(occurrence.rule.endTime ?? '09:00')
  const top = Math.max(0, start - dayStartMinutes) / 60 * rowHeight
  const height = Math.max(34, (Math.min(dayEndMinutes, end) - Math.max(dayStartMinutes, start)) / 60 * rowHeight)
  return (
    <button
      className="calendar-course"
      type="button"
      onClick={onClick}
      style={{
        '--course': occurrence.course.color,
        '--day': occurrence.weekday,
        '--top': `${top}px`,
        '--height': `${height}px`,
      } as CSSProperties}
    >
      <strong>{occurrence.course.code}</strong>
      <span>{occurrence.rule.startTime}-{occurrence.rule.endTime}</span>
      <small>{occurrence.rule.venue}</small>
      {occurrence.rule.note && <em>备注</em>}
    </button>
  )
}

function toMinutes(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

function newCourse(): Course {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), code: '', title: '', lecturer: '', aus: 3, color: '#2f80ed', createdAt: now, updatedAt: now }
}

function CourseEditor({
  course,
  rule,
  onDelete,
  onClose,
  onDone,
}: {
  course: Course
  rule?: ScheduleRule
  onDelete: (rule: ScheduleRule) => void
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const [form, setForm] = useState(course)
  const [ruleForm, setRuleForm] = useState({
    weeks: rule?.weeks.join(',') ?? '1',
    weekday: rule?.weekday ?? 1,
    startTime: rule?.startTime ?? '09:00',
    endTime: rule?.endTime ?? '10:00',
    venue: rule?.venue ?? '',
    note: rule?.note ?? '',
  })
  async function submit(event: FormEvent) {
    event.preventDefault()
    const updated = { ...form, updatedAt: new Date().toISOString() }
    const weeks = ruleForm.weeks.split(',').flatMap((part) => {
      const [start, end] = part.split('-').map(Number)
      return end ? Array.from({ length: end - start + 1 }, (_, i) => start + i) : [start]
    }).filter((item) => Number.isFinite(item))
    const nextRule: ScheduleRule = {
      id: rule?.id ?? crypto.randomUUID(),
      courseId: updated.id,
      weeks,
      weekday: Number(ruleForm.weekday) as Weekday,
      startTime: ruleForm.startTime,
      endTime: ruleForm.endTime,
      venue: ruleForm.venue,
      type: 'class',
      sourceText: rule?.sourceText ?? 'manual',
      confidence: rule?.confidence ?? 1,
      note: ruleForm.note,
      completed: rule?.completed,
    }
    await db.transaction('rw', db.courses, db.scheduleRules, async () => {
      await db.courses.put(updated)
      await db.scheduleRules.put(nextRule)
    })
    await onDone()
    onClose()
  }
  return (
    <div className="sheet">
      <form className="sheet-content" onSubmit={(event) => void submit(event)}>
        <h2>课程与备注</h2>
        <label className="field"><span>代码</span><input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label>
        <label className="field"><span>名称</span><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label className="field"><span>教师</span><input value={form.lecturer} onChange={(event) => setForm({ ...form, lecturer: event.target.value })} /></label>
        <label className="field"><span>周次</span><input required value={ruleForm.weeks} onChange={(event) => setRuleForm({ ...ruleForm, weeks: event.target.value })} /></label>
        <label className="field"><span>星期</span><select value={ruleForm.weekday} onChange={(event) => setRuleForm({ ...ruleForm, weekday: Number(event.target.value) as Weekday })}>{weekdays.slice(0, 6).map((day) => <option key={day.value} value={day.value}>{day.label}</option>)}</select></label>
        <div className="form-grid"><label className="field"><span>开始</span><input type="time" value={ruleForm.startTime} onChange={(event) => setRuleForm({ ...ruleForm, startTime: event.target.value })} /></label><label className="field"><span>结束</span><input type="time" value={ruleForm.endTime} onChange={(event) => setRuleForm({ ...ruleForm, endTime: event.target.value })} /></label></div>
        <label className="field"><span>地点</span><input value={ruleForm.venue} onChange={(event) => setRuleForm({ ...ruleForm, venue: event.target.value })} /></label>
        <label className="field"><span>课程备注</span><textarea rows={3} value={ruleForm.note} onChange={(event) => setRuleForm({ ...ruleForm, note: event.target.value })} placeholder="例如：带电脑、课前看视频、作业截止提醒" /></label>
        <div className="dialog-actions">
          {rule && <button className="button ghost danger-text" type="button" onClick={() => onDelete(rule)}>删除</button>}
          <button className="button ghost" type="button" onClick={onClose}>取消</button>
          <button className="button primary" type="submit">保存</button>
        </div>
      </form>
    </div>
  )
}
