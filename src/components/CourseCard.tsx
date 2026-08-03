import type { CSSProperties } from 'react'
import type { CourseOccurrence } from '../lib/types'

export function CourseCard({ occurrence }: { occurrence: CourseOccurrence }) {
  return (
    <article className="course-card" style={{ '--course': occurrence.course.color } as CSSProperties}>
      <div>
        <strong>{occurrence.course.code}</strong>
        <span>{occurrence.course.title}</span>
      </div>
      <p>{occurrence.rule.startTime} - {occurrence.rule.endTime} · {occurrence.rule.venue}</p>
      <small>{occurrence.course.lecturer || '未填写教师'}</small>
    </article>
  )
}
