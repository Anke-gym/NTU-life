import type { CSSProperties } from 'react'
import { commonCopy, type AppLanguage } from '../lib/i18n'
import type { CourseOccurrence } from '../lib/types'

export function CourseCard({ occurrence, language = 'zh' }: { occurrence: CourseOccurrence; language?: AppLanguage }) {
  const common = commonCopy[language]
  return (
    <article className="course-card" style={{ '--course': occurrence.course.color } as CSSProperties}>
      <div>
        <strong>{occurrence.course.code}</strong>
        <span>{occurrence.course.title}</span>
      </div>
      <p>{occurrence.rule.startTime} - {occurrence.rule.endTime} · {occurrence.rule.venue}</p>
      <small>{occurrence.course.lecturer || common.untitledTeacher}</small>
    </article>
  )
}
