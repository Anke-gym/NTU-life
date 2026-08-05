import { Download, ExternalLink, Plus } from 'lucide-react'
import { useRef, useState, type CSSProperties, type Dispatch, type FormEvent, type SetStateAction, type TouchEvent } from 'react'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { ImportPanel } from '../components/ImportPanel'
import { db } from '../lib/db'
import { commonCopy, getLanguage } from '../lib/i18n'
import { dateForWeekday, expandRules, onlineTasks, weekdays, weekPeriod } from '../lib/term'
import type { AcademicTerm, Course, CourseOccurrence, ScheduleRule, Weekday } from '../lib/types'
import type { AppData } from '../lib/useData'

const dayStartMinutes = 8 * 60
const dayEndMinutes = 22 * 60
const rowHeight = 40
const timeLabels = Array.from({ length: 15 }, (_, index) => `${String(index + 8).padStart(2, '0')}:00`)

const copy = {
  zh: {
    title: '课表',
    addCourse: '新增课程',
    teachingWeeks: '教学周',
    week: (week: number) => `第 ${week} 周`,
    import: '导入',
    onlineTasks: '本周网课任务',
    done: '已完成',
    pending: '待完成',
    calendarLabel: (week: number) => `第 ${week} 周课表`,
    myCourses: '我的课程',
    empty: '还没有课表。点击右上角“导入”或“+”开始添加。',
    courseAndNote: '课程与备注',
    code: '代码',
    name: '名称',
    lecturer: '教师',
    weeks: '周次',
    weekday: '星期',
    start: '开始',
    end: '结束',
    venue: '地点',
    openMaps: '打开 NTU Maps',
    note: '课程备注',
    notePlaceholder: '例如：带电脑、课前看视频、作业截止提醒',
    deleteRule: '删除课程规则',
    deleteBody: '删除后该规则对应周次不再显示。',
    closeImport: '关闭',
    to: '至',
    noteBadge: '备注',
    today: '今天',
  },
  en: {
    title: 'Schedule',
    addCourse: 'Add Course',
    teachingWeeks: 'Teaching Weeks',
    week: (week: number) => `Week ${week}`,
    import: 'Import',
    onlineTasks: 'This Week Online Tasks',
    done: 'Done',
    pending: 'Pending',
    calendarLabel: (week: number) => `Week ${week} schedule`,
    myCourses: 'My Courses',
    empty: 'No schedule yet. Tap Import or + in the top right to start.',
    courseAndNote: 'Course & Notes',
    code: 'Code',
    name: 'Name',
    lecturer: 'Lecturer',
    weeks: 'Weeks',
    weekday: 'Day',
    start: 'Start',
    end: 'End',
    venue: 'Venue',
    openMaps: 'Open NTU Maps',
    note: 'Course Note',
    notePlaceholder: 'For example: bring laptop, watch video before class, assignment deadline',
    deleteRule: 'Delete Course Rule',
    deleteBody: 'After deletion, this rule will no longer appear for its weeks.',
    closeImport: 'Close',
    to: 'to',
    noteBadge: 'Note',
    today: 'Today',
  },
} as const

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
  const language = getLanguage(data)
  const t = copy[language]
  const common = commonCopy[language]
  const occurrences = expandRules(term, data.courses, data.rules, week)
  const tasks = onlineTasks(data.courses, data.rules, week)
  const period = weekPeriod(term, week)
  const halfHourMarkers = uniqueHalfHourMarkers(occurrences)
  const todayDate = formatLocalDate(new Date())

  async function toggleTask(rule: ScheduleRule) {
    await db.scheduleRules.put({ ...rule, completed: !rule.completed })
    await data.reload()
  }

  return (
    <div className="page schedule-page">
      <header className="page-header">
        <div>
          <h1>{t.title}</h1>
          <p className="muted">{period.startDate} {t.to} {period.endDate}</p>
        </div>
        <button className="icon-button" type="button" aria-label={t.addCourse} onClick={() => setEditing({ course: newCourse() })}><Plus /></button>
      </header>
      <div className="schedule-toolbar">
        <div className="week-pills" role="tablist" aria-label={t.teachingWeeks}>
          {term.weekPeriods.map((item) => (
            <button
              className={item.weekNumber === week ? 'pill active' : 'pill'}
              type="button"
              key={item.weekNumber}
              onPointerDown={() => setWeek(item.weekNumber)}
              onClick={() => setWeek(item.weekNumber)}
            >
              {t.week(item.weekNumber)}
            </button>
          ))}
        </div>
        <button className="button primary import-button" type="button" onClick={() => setImportOpen(true)}>
          <Download size={18} />{t.import}
        </button>
      </div>
      {tasks.length > 0 && (
        <section className="online-strip" aria-label={t.onlineTasks}>
          {tasks.map((task) => (
            <button
              className={`online-task ${task.rule.completed ? 'done' : ''}`}
              type="button"
              key={task.rule.id}
              onClick={() => void toggleTask(task.rule)}
            >
              <span>{task.course?.code} Online Video</span>
              <b>{task.rule.completed ? t.done : t.pending}</b>
            </button>
          ))}
        </section>
      )}
      <section className="calendar-board" aria-label={t.calendarLabel(week)}>
        <div className="calendar-header" style={{ gridTemplateColumns: '48px repeat(6, minmax(70px, 1fr))' }}>
          <span />
          {weekdays.slice(0, 6).map((day, index) => {
            const date = dateForWeekday(term, week, day.value)
            const isCurrentDay = date === todayDate
            return (
              <strong className={`day-heading ${isCurrentDay ? 'today' : ''}`} key={day.value} aria-current={isCurrentDay ? 'date' : undefined}>
                <span>{common.weekdays[index].short}</span>
                <small>{formatHeaderDate(date)}</small>
                {isCurrentDay && <em>{t.today}</em>}
              </strong>
            )
          })}
        </div>
        <div className="calendar-grid" style={{ height: `${timeLabels.length * rowHeight}px` }}>
          <div className="time-axis">
            {timeLabels.map((time) => <span key={time}>{time}</span>)}
            {halfHourMarkers.map((minute) => <span className="half-time-label" style={{ '--top': `${markerTop(minute)}px` } as CSSProperties} key={minute}>{formatMinute(minute)}</span>)}
          </div>
          {weekdays.slice(0, 6).map((day) => <div className="day-column" key={day.value} />)}
          {halfHourMarkers.map((minute) => <div className="half-hour-line" style={{ '--top': `${markerTop(minute)}px` } as CSSProperties} key={minute} />)}
          {occurrences.map((item) => (
            <CalendarCourse
              key={item.id}
              occurrence={item}
              noteBadge={t.noteBadge}
              onClick={() => setEditing({ course: item.course, rule: item.rule })}
            />
          ))}
        </div>
      </section>
      {data.courses.length > 0 && (
        <section className="course-summary panel">
          <h2>{t.myCourses}</h2>
          <div className="course-legend">
            {data.courses.map((course) => (
              <span key={course.id}>
                <i style={{ background: course.color }} />
                <b>{course.code}</b>
                {course.title}
              </span>
            ))}
          </div>
        </section>
      )}
      {!data.courses.length && <p className="empty panel">{t.empty}</p>}
      {importOpen && (
        <div className="sheet">
          <div className="sheet-content">
            <ImportPanel language={language} onDone={async () => { await data.reload(); setImportOpen(false) }} />
            <button className="button ghost full-width" type="button" onClick={() => setImportOpen(false)}>{t.closeImport}</button>
          </div>
        </div>
      )}
      {editing && <CourseEditor course={editing.course} rule={editing.rule} language={language} onDelete={setDeleteRule} onClose={() => setEditing(undefined)} onDone={data.reload} />}
      <ConfirmDialog
        open={Boolean(deleteRule)}
        title={t.deleteRule}
        destructive
        cancelLabel={common.cancel}
        confirmLabel={common.confirm}
        onCancel={() => setDeleteRule(undefined)}
        onConfirm={() => {
          if (deleteRule) void db.scheduleRules.delete(deleteRule.id).then(data.reload)
          setDeleteRule(undefined)
          setEditing(undefined)
        }}
      >
        {t.deleteBody}
      </ConfirmDialog>
    </div>
  )
}

function CalendarCourse({ occurrence, noteBadge, onClick }: { occurrence: CourseOccurrence; noteBadge: string; onClick: () => void }) {
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
      {occurrence.rule.note && <em>{noteBadge}</em>}
    </button>
  )
}

function toMinutes(time: string) {
  const [hour, minute] = time.split(':').map(Number)
  return hour * 60 + minute
}

function markerTop(minute: number) {
  return Math.max(0, minute - dayStartMinutes) / 60 * rowHeight
}

function formatMinute(minute: number) {
  return `${String(Math.floor(minute / 60)).padStart(2, '0')}:${String(minute % 60).padStart(2, '0')}`
}

function formatHeaderDate(date: string) {
  const [, month, day] = date.split('-')
  return `${month}/${day}`
}

function formatLocalDate(date: Date) {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function uniqueHalfHourMarkers(occurrences: CourseOccurrence[]) {
  return [...new Set(occurrences.flatMap((item) => [item.rule.startTime, item.rule.endTime])
    .filter((time): time is string => Boolean(time))
    .map(toMinutes)
    .filter((minute) => minute % 60 !== 0 && minute >= dayStartMinutes && minute <= dayEndMinutes))]
    .sort((a, b) => a - b)
}

function ntuMapsUrl(venue: string) {
  return `https://use.mazemap.com/?config=ntu-sg&search=${encodeURIComponent(normalizeVenueForMap(venue))}`
}

function normalizeVenueForMap(venue: string) {
  const clean = venue.trim()
  const aliases: Record<string, string> = {
    'LF LT': 'Lee Foundation Lecture Theatre',
  }
  return aliases[clean.toUpperCase()] ?? clean
}

function newCourse(): Course {
  const now = new Date().toISOString()
  return { id: crypto.randomUUID(), code: '', title: '', lecturer: '', aus: 3, color: '#2f80ed', createdAt: now, updatedAt: now }
}

function CourseEditor({
  course,
  rule,
  language,
  onDelete,
  onClose,
  onDone,
}: {
  course: Course
  rule?: ScheduleRule
  language: 'zh' | 'en'
  onDelete: (rule: ScheduleRule) => void
  onClose: () => void
  onDone: () => Promise<void>
}) {
  const [form, setForm] = useState(course)
  const [pull, setPull] = useState(0)
  const startY = useRef(0)
  const startScrollTop = useRef(0)
  const contentRef = useRef<HTMLFormElement>(null)
  const [ruleForm, setRuleForm] = useState({
    weeks: rule?.weeks.join(',') ?? '1',
    weekday: rule?.weekday ?? 1,
    startTime: rule?.startTime ?? '09:00',
    endTime: rule?.endTime ?? '10:00',
    venue: rule?.venue ?? '',
    note: rule?.note ?? '',
  })
  const t = copy[language]
  const common = commonCopy[language]

  function onTouchStart(event: TouchEvent<HTMLFormElement>) {
    startY.current = event.touches[0].clientY
    startScrollTop.current = contentRef.current?.scrollTop ?? 0
  }

  function onTouchMove(event: TouchEvent<HTMLFormElement>) {
    const delta = event.touches[0].clientY - startY.current
    if (startScrollTop.current <= 0 && delta > 0) {
      setPull(Math.min(delta, 160))
      if (delta > 12) event.preventDefault()
    }
  }

  function onTouchEnd() {
    if (pull > 90) {
      onClose()
      return
    }
    setPull(0)
  }

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
      <form
        ref={contentRef}
        className="sheet-content draggable-sheet"
        style={{ '--pull': `${pull}px` } as CSSProperties}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onSubmit={(event) => void submit(event)}
      >
        <span className="sheet-grabber" aria-hidden="true" />
        <h2>{t.courseAndNote}</h2>
        <label className="field"><span>{t.code}</span><input required value={form.code} onChange={(event) => setForm({ ...form, code: event.target.value })} /></label>
        <label className="field"><span>{t.name}</span><input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} /></label>
        <label className="field"><span>{t.lecturer}</span><input value={form.lecturer} onChange={(event) => setForm({ ...form, lecturer: event.target.value })} /></label>
        <label className="field"><span>{t.weeks}</span><input required value={ruleForm.weeks} onChange={(event) => setRuleForm({ ...ruleForm, weeks: event.target.value })} /></label>
        <label className="field"><span>{t.weekday}</span><select value={ruleForm.weekday} onChange={(event) => setRuleForm({ ...ruleForm, weekday: Number(event.target.value) as Weekday })}>{weekdays.slice(0, 6).map((day, index) => <option key={day.value} value={day.value}>{common.weekdays[index].label}</option>)}</select></label>
        <div className="form-grid"><label className="field"><span>{t.start}</span><input type="time" value={ruleForm.startTime} onChange={(event) => setRuleForm({ ...ruleForm, startTime: event.target.value })} /></label><label className="field"><span>{t.end}</span><input type="time" value={ruleForm.endTime} onChange={(event) => setRuleForm({ ...ruleForm, endTime: event.target.value })} /></label></div>
        <label className="field"><span>{t.venue}</span><input value={ruleForm.venue} onChange={(event) => setRuleForm({ ...ruleForm, venue: event.target.value })} /></label>
        {ruleForm.venue.trim() && (
          <a className="map-link" href={ntuMapsUrl(ruleForm.venue)} target="_blank" rel="noreferrer">
            <ExternalLink size={17} />{t.openMaps}
          </a>
        )}
        <label className="field"><span>{t.note}</span><textarea rows={3} value={ruleForm.note} onChange={(event) => setRuleForm({ ...ruleForm, note: event.target.value })} placeholder={t.notePlaceholder} /></label>
        <div className="dialog-actions">
          {rule && <button className="button ghost danger-text" type="button" onClick={() => onDelete(rule)}>{common.delete}</button>}
          <button className="button ghost" type="button" onClick={onClose}>{common.cancel}</button>
          <button className="button primary" type="submit">{common.save}</button>
        </div>
      </form>
    </div>
  )
}
