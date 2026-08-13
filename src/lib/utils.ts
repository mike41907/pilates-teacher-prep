import type { Cue, Course, CourseExercise, Exercise, ExerciseSnapshot } from '../types'

export function newId(prefix = 'id'): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `${prefix}-${crypto.randomUUID()}`
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function nowIso(): string {
  return new Date().toISOString()
}

export function localDateIso(date = new Date()): string {
  const year = date.getFullYear()
  const month = `${date.getMonth() + 1}`.padStart(2, '0')
  const day = `${date.getDate()}`.padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function formatDate(dateString: string): string {
  if (!dateString) return '未設定日期'
  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateString
  return new Intl.DateTimeFormat('zh-TW', { month: 'long', day: 'numeric', weekday: 'short' }).format(date)
}

export function formatCompactDate(dateString: string): string {
  if (!dateString) return '未設定'
  const date = new Date(`${dateString}T00:00:00`)
  if (Number.isNaN(date.getTime())) return dateString
  return new Intl.DateTimeFormat('zh-TW', { year: 'numeric', month: '2-digit', day: '2-digit' }).format(date)
}

export function formatDateTime(dateString?: string): string {
  if (!dateString) return '尚未使用'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '尚未使用'
  return new Intl.DateTimeFormat('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(date)
}

export function formatSeconds(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  if (remaining === 0) return `${minutes} 分鐘`
  return `${minutes} 分 ${remaining} 秒`
}

export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds))
  const minutes = Math.floor(seconds / 60).toString().padStart(2, '0')
  const remaining = (seconds % 60).toString().padStart(2, '0')
  return `${minutes}:${remaining}`
}

export function estimateCourseSeconds(course: Course): number {
  return course.exercises.reduce((sum, item) => sum + (Number.isFinite(item.durationSeconds) ? item.durationSeconds : 0), 0)
}

export function clone<T>(value: T): T {
  return structuredClone(value)
}

export function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ')
}

export function percentage(value: number, total: number): number {
  if (!total) return 0
  return Math.round((value / total) * 100)
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)]
}

export function getCourseExerciseLabel(item: CourseExercise): string {
  return item.snapshot.nameEn || item.snapshot.nameZh
}

export function getCourseExerciseTitle(item: CourseExercise): string {
  return item.snapshot.nameZh || item.snapshot.nameEn
}

export function snapshotFromExercise(exercise: Exercise): ExerciseSnapshot {
  return {
    id: exercise.id,
    nameZh: exercise.nameZh,
    nameEn: exercise.nameEn,
    apparatus: exercise.apparatus,
    level: exercise.level,
    primaryAreas: [...exercise.primaryAreas],
    startPositions: [...exercise.startPositions],
    specialConditions: [...exercise.specialConditions],
    defaultCue: clone(exercise.defaultCue),
    spring: exercise.spring,
    footbar: exercise.footbar,
    headrest: exercise.headrest,
    suggestedReps: exercise.suggestedReps,
  }
}

export function emptyCue(): Cue {
  return { preparation: '', start: '', breathing: '', core: '', movement: '', correction: '', finish: '' }
}

export function courseSimilarity(a: Course, b: Course): number {
  if (!a.exercises.length || !b.exercises.length) return 0
  const aIds = new Set(a.exercises.map((item) => item.exerciseId))
  const bIds = new Set(b.exercises.map((item) => item.exerciseId))
  const intersection = [...aIds].filter((id) => bIds.has(id)).length
  const denominator = Math.max(aIds.size, bIds.size)
  return denominator ? Math.round((intersection / denominator) * 100) : 0
}

export function normalizeCourseOrder(course: Course): Course {
  return {
    ...course,
    exercises: course.exercises.map((item, index) => ({ ...item, order: index })),
  }
}

export function isSameDay(dateString: string, target = new Date()): boolean {
  return dateString === localDateIso(target)
}

export function safeText(value: unknown): string {
  return typeof value === 'string' ? value : ''
}
