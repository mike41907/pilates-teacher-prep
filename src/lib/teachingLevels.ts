import type {
  AppData,
  Course,
  CourseExercise,
  Exercise,
  ExerciseSnapshot,
  TeachingLevel,
  TeachingLevelKind,
} from "../types";

const LEVEL_KINDS: TeachingLevelKind[] = [
  "regression",
  "standard",
  "variation",
];

function splitDuration(totalSeconds: number): [number, number, number] {
  const total = Math.max(0, Math.round(totalSeconds));
  const regression = Math.round(total * 0.25);
  const standard = Math.round(total * 0.5);
  return [regression, standard, Math.max(0, total - regression - standard)];
}

function titleFromSnapshot(snapshot: ExerciseSnapshot): string {
  return snapshot.nameZh || snapshot.nameEn || "正常動作";
}

export function createTeachingLevels(
  source: Pick<
    Exercise,
    | "id"
    | "nameZh"
    | "nameEn"
    | "regression"
    | "progression"
    | "description"
    | "defaultCue"
    | "suggestedReps"
    | "defaultTeachingLevels"
  >,
  totalSeconds: number,
  idPrefix = source.id,
): TeachingLevel[] {
  const [regressionSeconds, standardSeconds, variationSeconds] =
    splitDuration(totalSeconds);
  const normalTitle = source.nameZh || source.nameEn || "正常動作";
  const defaults: TeachingLevel[] = [
    {
      id: `${idPrefix}-level-regression`,
      kind: "regression",
      title: `${normalTitle}（退階）`,
      instruction:
        source.regression || "減少幅度、阻力或次數，依學生狀況調整。",
      cue: source.defaultCue.correction || "先維持穩定，再逐步增加動作幅度。",
      reps: source.suggestedReps,
      durationSeconds: regressionSeconds,
    },
    {
      id: `${idPrefix}-level-standard`,
      kind: "standard",
      title: normalTitle,
      instruction:
        source.description.flow ||
        source.defaultCue.movement ||
        "依正常版本完成動作。",
      cue: source.defaultCue.movement,
      reps: source.suggestedReps,
      durationSeconds: standardSeconds,
    },
    {
      id: `${idPrefix}-level-variation`,
      kind: "variation",
      title: `${normalTitle}（變化）`,
      instruction: source.progression || "依學生控制能力加入合適的動作變化。",
      cue: source.defaultCue.core || "維持原本控制原則，再加入動作變化。",
      reps: source.suggestedReps,
      durationSeconds: variationSeconds,
    },
  ];
  const templates = Array.isArray(source.defaultTeachingLevels)
    ? source.defaultTeachingLevels
    : [];
  if (
    !LEVEL_KINDS.every((kind) => templates.some((level) => level.kind === kind))
  )
    return defaults;
  const templateTotal = templates.reduce(
    (total, level) => total + Math.max(0, level.durationSeconds),
    0,
  );
  let allocated = 0;
  return defaults.map((fallback, index) => {
    const template = templates.find((level) => level.kind === fallback.kind);
    if (!template) return fallback;
    const durationSeconds =
      index === defaults.length - 1
        ? Math.max(0, Math.round(totalSeconds) - allocated)
        : templateTotal > 0
          ? Math.max(
              0,
              Math.round(
                (template.durationSeconds / templateTotal) * totalSeconds,
              ),
            )
          : fallback.durationSeconds;
    allocated += durationSeconds;
    return {
      ...fallback,
      ...template,
      id: `${idPrefix}-level-${fallback.kind}`,
      kind: fallback.kind,
      durationSeconds,
    };
  });
}

function createLevelsFromCourseItem(item: CourseExercise): TeachingLevel[] {
  const snapshot = item.snapshot;
  const normalTitle = titleFromSnapshot(snapshot);
  return createTeachingLevels(
    {
      id: snapshot.id,
      nameZh: snapshot.nameZh,
      nameEn: snapshot.nameEn,
      regression: snapshot.regression || "",
      progression: snapshot.progression || "",
      description: {
        startPosition: "",
        flow: item.cue.movement,
        endPosition: "",
      },
      defaultCue: item.cue,
      suggestedReps: item.reps || snapshot.suggestedReps,
      defaultTeachingLevels: undefined,
    },
    item.durationSeconds,
    item.id,
  ).map((level) =>
    level.kind === "standard" ? { ...level, title: normalTitle } : level,
  );
}

export function teachingLevelLabel(kind: TeachingLevelKind): string {
  if (kind === "regression") return "退階";
  if (kind === "standard") return "正常";
  return "變化";
}

export function normalizeTeachingLevels(
  item: CourseExercise,
  exercise?: Exercise,
): CourseExercise {
  const snapshot: ExerciseSnapshot = {
    ...item.snapshot,
    regression: item.snapshot.regression ?? exercise?.regression ?? "",
    progression: item.snapshot.progression ?? exercise?.progression ?? "",
  };
  const existing = Array.isArray(item.teachingLevels)
    ? item.teachingLevels
    : [];
  const defaults = exercise
    ? createTeachingLevels(exercise, item.durationSeconds, item.id)
    : createLevelsFromCourseItem({ ...item, snapshot });
  const teachingLevels = LEVEL_KINDS.map((kind, index) => {
    const level = existing.find((entry) => entry?.kind === kind);
    const fallback = defaults[index];
    return level
      ? {
          ...fallback,
          ...level,
          id: level.id || fallback.id,
          kind,
          durationSeconds: Number.isFinite(level.durationSeconds)
            ? Math.max(0, level.durationSeconds)
            : fallback.durationSeconds,
        }
      : fallback;
  });
  return {
    ...item,
    snapshot,
    teachingLevels,
    durationSeconds: teachingLevels.reduce(
      (total, level) => total + level.durationSeconds,
      0,
    ),
  };
}

function normalizeCourse(
  course: Course,
  exerciseById: Map<string, Exercise>,
): Course {
  return {
    ...course,
    exercises: course.exercises.map((item) =>
      normalizeTeachingLevels(item, exerciseById.get(item.exerciseId)),
    ),
  };
}

export function dataNeedsTeachingLevelMigration(data: AppData): boolean {
  const courses = [
    ...data.courses,
    ...data.templates.map((template) => template.course),
  ];
  return courses.some((course) =>
    course.exercises.some(
      (item) =>
        !Array.isArray(item.teachingLevels) ||
        item.teachingLevels.length !== LEVEL_KINDS.length ||
        item.snapshot.regression === undefined ||
        item.snapshot.progression === undefined,
    ),
  );
}

export function migrateTeachingLevels(data: AppData): AppData {
  const exerciseById = new Map(
    data.exercises.map((exercise) => [exercise.id, exercise]),
  );
  return {
    ...data,
    courses: data.courses.map((course) =>
      normalizeCourse(course, exerciseById),
    ),
    templates: data.templates.map((template) => ({
      ...template,
      course: normalizeCourse(template.course, exerciseById),
    })),
  };
}
