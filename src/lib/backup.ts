import { APP_VERSION, BACKUP_SCHEMA_VERSION, type AppData, type BackupEnvelope } from '../types'
import { clone, nowIso } from './utils'

export function createBackup(data: AppData): BackupEnvelope {
  return { app: 'pilates-prep', schemaVersion: BACKUP_SCHEMA_VERSION, appVersion: APP_VERSION, exportedAt: nowIso(), data: clone(data) }
}

export function serializeBackup(data: AppData): string {
  return JSON.stringify(createBackup(data), null, 2)
}

export function parseBackup(raw: string): BackupEnvelope {
  let value: unknown
  try { value = JSON.parse(raw) } catch { throw new Error('備份檔案不是有效的 JSON。') }
  if (!value || typeof value !== 'object') throw new Error('備份檔案格式不正確。')
  const envelope = value as Partial<BackupEnvelope>
  if (envelope.app !== 'pilates-prep') throw new Error('這不是 Pilates Prep 的備份檔案。')
  if (envelope.schemaVersion !== BACKUP_SCHEMA_VERSION) throw new Error(`備份版本 ${String(envelope.schemaVersion)} 與目前版本不相容。`)
  if (!envelope.data || typeof envelope.data !== 'object') throw new Error('備份檔案缺少資料內容。')
  const data = envelope.data as Partial<AppData>
  if (!Array.isArray(data.exercises) || !Array.isArray(data.courses) || !Array.isArray(data.templates) || !Array.isArray(data.usageHistory) || !data.settings) {
    throw new Error('備份檔案缺少必要資料欄位。')
  }
  return envelope as BackupEnvelope
}

export function mergeBackup(current: AppData, incoming: AppData): AppData {
  const mergeById = <T extends { id: string }>(first: T[], second: T[]): T[] => {
    const map = new Map(first.map((item) => [item.id, item]))
    for (const item of second) map.set(item.id, clone(item))
    return [...map.values()]
  }
  return {
    exercises: mergeById(current.exercises, incoming.exercises), courses: mergeById(current.courses, incoming.courses),
    templates: mergeById(current.templates, incoming.templates), usageHistory: mergeById(current.usageHistory, incoming.usageHistory),
    settings: clone(incoming.settings),
  }
}
