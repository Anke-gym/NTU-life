import { describe, expect, it } from 'vitest'
import { backupSchema } from './db'

describe('backup schema', () => {
  it('validates complete JSON backups', () => {
    const result = backupSchema.safeParse({
      schemaVersion: 2,
      exportedAt: new Date().toISOString(),
      terms: [],
      courses: [],
      scheduleRules: [],
      transactions: [],
      agendaItems: [],
      settings: [],
    })
    expect(result.success).toBe(true)
  })
})
