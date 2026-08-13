import type {
  Cue,
  Course,
  CourseExercise,
  Exercise,
  ExerciseSnapshot,
  SpecialCondition,
  UsageHistory,
} from "../types";

export function newId(prefix = "id"): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto)
    return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function localDateIso(date = new Date()): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function formatDate(dateString: string): string {
  if (!dateString) return "未設定日期";
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat("zh-TW", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
}

export function formatCompactDate(dateString: string): string {
  if (!dateString) return "未設定";
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function formatDateTime(dateString?: string): string {
  if (!dateString) return "尚未使用";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "尚未使用";
  return new Intl.DateTimeFormat("zh-TW", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function formatSeconds(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  if (remaining === 0) return `${minutes} 分鐘`;
  return `${minutes} 分 ${remaining} 秒`;
}

export function formatClock(totalSeconds: number): string {
  const seconds = Math.max(0, Math.round(totalSeconds));
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const remaining = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remaining}`;
}

export function estimateCourseSeconds(course: Course): number {
  return course.exercises.reduce(
    (sum, item) =>
      sum + (Number.isFinite(item.durationSeconds) ? item.durationSeconds : 0),
    0,
  );
}

export function averageActualDurationSeconds(
  courses: Course[],
  exerciseId: string,
): number | undefined {
  const durations = courses.flatMap((course) =>
    course.exercises
      .filter(
        (item) =>
          item.exerciseId === exerciseId &&
          Number.isFinite(item.actualDurationSeconds) &&
          (item.actualDurationSeconds ?? 0) > 0,
      )
      .map((item) => item.actualDurationSeconds as number),
  );
  if (!durations.length) return undefined;
  return Math.round(
    durations.reduce((total, duration) => total + duration, 0) /
      durations.length,
  );
}

export function clone<T>(value: T): T {
  return structuredClone(value);
}

export function classNames(
  ...values: Array<string | false | null | undefined>
): string {
  return values.filter(Boolean).join(" ");
}

export function percentage(value: number, total: number): number {
  if (!total) return 0;
  return Math.round((value / total) * 100);
}

export function unique<T>(values: T[]): T[] {
  return [...new Set(values)];
}

export function getCourseExerciseLabel(item: CourseExercise): string {
  return item.snapshot.nameEn || item.snapshot.nameZh;
}

export function getCourseExerciseTitle(item: CourseExercise): string {
  return item.snapshot.nameZh || item.snapshot.nameEn;
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
  };
}

export function emptyCue(): Cue {
  return {
    preparation: "",
    start: "",
    breathing: "",
    core: "",
    movement: "",
    correction: "",
    finish: "",
  };
}

export function courseSimilarity(a: Course, b: Course): number {
  if (!a.exercises.length || !b.exercises.length) return 0;
  const aIds = new Set(a.exercises.map((item) => item.exerciseId));
  const bIds = new Set(b.exercises.map((item) => item.exerciseId));
  const intersection = [...aIds].filter((id) => bIds.has(id)).length;
  const denominator = Math.max(aIds.size, bIds.size);
  return denominator ? Math.round((intersection / denominator) * 100) : 0;
}

export interface UsageStats {
  total: number;
  last7Days: number;
  last30Days: number;
  lastUsedAt?: string;
}

export function getUsageStats(
  history: UsageHistory[],
  exerciseId: string,
  now = Date.now(),
): UsageStats {
  const entries = history.filter((item) => item.exerciseId === exerciseId);
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;
  const timestamps = entries
    .map((item) => new Date(item.usedAt).getTime())
    .filter(Number.isFinite);
  return {
    total: entries.length,
    last7Days: timestamps.filter((value) => value >= sevenDaysAgo).length,
    last30Days: timestamps.filter((value) => value >= thirtyDaysAgo).length,
    lastUsedAt: entries
      .slice()
      .sort((a, b) => b.usedAt.localeCompare(a.usedAt))[0]?.usedAt,
  };
}

const LEVEL_RANK: Record<Exercise["level"], number> = {
  初階: 0,
  初中階: 1,
  中階: 2,
  中高階: 3,
  高階: 4,
};

export interface ReplacementMatch {
  exercise: Exercise;
  score: number;
  reasons: string[];
}

export function rankReplacementExercises(
  source: Exercise,
  candidates: Exercise[],
  avoid: SpecialCondition[],
): ReplacementMatch[] {
  return candidates
    .filter(
      (candidate) =>
        candidate.id !== source.id &&
        !candidate.specialConditions.some((condition) =>
          avoid.includes(condition),
        ),
    )
    .map((candidate) => {
      let score = 0;
      const reasons: string[] = [];
      if (candidate.apparatus === source.apparatus) {
        score += 35;
        reasons.push("相同器械");
      }
      const levelDistance = Math.abs(
        LEVEL_RANK[candidate.level] - LEVEL_RANK[source.level],
      );
      score += Math.max(0, 22 - levelDistance * 8);
      if (levelDistance === 0) reasons.push("相同難度");
      else if (levelDistance === 1) reasons.push("難度接近");
      const sharedAreas = candidate.primaryAreas.filter((area) =>
        source.primaryAreas.includes(area),
      );
      score += Math.min(28, sharedAreas.length * 14);
      if (sharedAreas.length) reasons.push(`同部位：${sharedAreas.join("、")}`);
      const durationDifference = Math.abs(
        candidate.suggestedSeconds - source.suggestedSeconds,
      );
      score += Math.max(0, 15 - Math.round(durationDifference / 30) * 3);
      if (durationDifference <= 60) reasons.push("時間接近");
      if (
        candidate.startPositions.some((position) =>
          source.startPositions.includes(position),
        )
      ) {
        score += 5;
        reasons.push("姿勢銜接順");
      }
      return { exercise: candidate, score, reasons };
    })
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.exercise.nameZh.localeCompare(b.exercise.nameZh, "zh-Hant"),
    );
}

export function normalizeCourseOrder(course: Course): Course {
  return {
    ...course,
    exercises: course.exercises.map((item, index) => ({
      ...item,
      order: index,
    })),
  };
}

export function isSameDay(dateString: string, target = new Date()): boolean {
  return dateString === localDateIso(target);
}

export function safeText(value: unknown): string {
  return typeof value === "string" ? value : "";
}
