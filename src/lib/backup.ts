import {
  APP_VERSION,
  BACKUP_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  type AppData,
  type BackupEnvelope,
  type Course,
  type CourseExercise,
  type Cue,
  type Exercise,
  type Template,
  type UsageHistory,
} from "../types";
import { clone, nowIso } from "./utils";
import { migrateTeachingLevels } from "./teachingLevels";

type JsonObject = Record<string, unknown>;

function objectAt(value: unknown, path: string): JsonObject {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error(`${path} 格式不正確。`);
  return value as JsonObject;
}

function stringAt(value: unknown, path: string): string {
  if (typeof value !== "string") throw new Error(`${path} 必須是文字。`);
  return value;
}

function numberAt(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value))
    throw new Error(`${path} 必須是有效數字。`);
  return value;
}

function booleanAt(value: unknown, path: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${path} 必須是布林值。`);
  return value;
}

function enumAt<T extends string>(
  value: unknown,
  options: readonly T[],
  path: string,
): T {
  const text = stringAt(value, path);
  if (!options.includes(text as T)) throw new Error(`${path} 不是支援的選項。`);
  return text as T;
}

function stringArrayAt(value: unknown, path: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string"))
    throw new Error(`${path} 必須是文字陣列。`);
  return value;
}

function cueAt(value: unknown, path: string): Cue {
  const cue = objectAt(value, path);
  return {
    preparation: stringAt(cue.preparation, `${path}.preparation`),
    start: stringAt(cue.start, `${path}.start`),
    breathing: stringAt(cue.breathing, `${path}.breathing`),
    core: stringAt(cue.core, `${path}.core`),
    movement: stringAt(cue.movement, `${path}.movement`),
    correction: stringAt(cue.correction, `${path}.correction`),
    finish: stringAt(cue.finish, `${path}.finish`),
  };
}

function exerciseAt(value: unknown, index: number): Exercise {
  const path = `data.exercises[${index}]`;
  const item = objectAt(value, path);
  const description = objectAt(item.description, `${path}.description`);
  const requiredText = [
    "id",
    "nameZh",
    "nameEn",
    "apparatus",
    "level",
    "movementType",
    "suggestedReps",
    "spring",
    "footbar",
    "headrest",
    "breathing",
    "commonErrors",
    "corrections",
    "cautions",
    "contraindications",
    "regression",
    "progression",
    "personalNote",
    "createdAt",
    "updatedAt",
  ];
  for (const key of requiredText) stringAt(item[key], `${path}.${key}`);
  for (const key of [
    "aliases",
    "primaryAreas",
    "secondaryAreas",
    "startPositions",
    "alternatives",
    "prerequisites",
    "suggestedNext",
    "specialConditions",
  ])
    stringArrayAt(item[key], `${path}.${key}`);
  numberAt(item.suggestedSeconds, `${path}.suggestedSeconds`);
  booleanAt(item.usesBox, `${path}.usesBox`);
  booleanAt(item.isFavorite, `${path}.isFavorite`);
  booleanAt(item.isCustom, `${path}.isCustom`);
  stringAt(description.startPosition, `${path}.description.startPosition`);
  stringAt(description.flow, `${path}.description.flow`);
  stringAt(description.endPosition, `${path}.description.endPosition`);
  cueAt(item.defaultCue, `${path}.defaultCue`);
  if (item.defaultTeachingLevels !== undefined) {
    if (!Array.isArray(item.defaultTeachingLevels))
      throw new Error(`${path}.defaultTeachingLevels 必須是陣列。`);
    item.defaultTeachingLevels.forEach((level, levelIndex) => {
      const levelPath = `${path}.defaultTeachingLevels[${levelIndex}]`;
      const levelObject = objectAt(level, levelPath);
      for (const key of ["title", "instruction", "cue", "reps"])
        stringAt(levelObject[key], `${levelPath}.${key}`);
      enumAt(
        levelObject.kind,
        ["regression", "standard", "variation"],
        `${levelPath}.kind`,
      );
      numberAt(levelObject.durationSeconds, `${levelPath}.durationSeconds`);
    });
    const kinds = item.defaultTeachingLevels.map((level) =>
      stringAt(
        objectAt(level, `${path}.defaultTeachingLevels`).kind,
        `${path}.defaultTeachingLevels.kind`,
      ),
    );
    if (
      item.defaultTeachingLevels.length !== 3 ||
      !["regression", "standard", "variation"].every((kind) =>
        kinds.includes(kind),
      )
    )
      throw new Error(
        `${path}.defaultTeachingLevels 必須包含退階、正常與變化。`,
      );
  }
  return clone(item) as unknown as Exercise;
}

function courseExerciseAt(
  value: unknown,
  path: string,
  schemaVersion: number,
): CourseExercise {
  const item = objectAt(value, path);
  for (const key of [
    "id",
    "exerciseId",
    "sectionId",
    "reps",
    "spring",
    "footbar",
    "headrest",
    "note",
    "familiarity",
  ])
    stringAt(item[key], `${path}.${key}`);
  numberAt(item.order, `${path}.order`);
  numberAt(item.durationSeconds, `${path}.durationSeconds`);
  if (item.actualDurationSeconds !== undefined)
    numberAt(item.actualDurationSeconds, `${path}.actualDurationSeconds`);
  cueAt(item.cue, `${path}.cue`);
  const snapshot = objectAt(item.snapshot, `${path}.snapshot`);
  for (const key of [
    "id",
    "nameZh",
    "nameEn",
    "apparatus",
    "level",
    "spring",
    "footbar",
    "headrest",
    "suggestedReps",
  ])
    stringAt(snapshot[key], `${path}.snapshot.${key}`);
  for (const key of ["regression", "progression"])
    if (schemaVersion >= 3 || snapshot[key] !== undefined)
      stringAt(snapshot[key], `${path}.snapshot.${key}`);
  for (const key of ["primaryAreas", "startPositions", "specialConditions"])
    stringArrayAt(snapshot[key], `${path}.snapshot.${key}`);
  cueAt(snapshot.defaultCue, `${path}.snapshot.defaultCue`);
  if (schemaVersion >= 3 && !Array.isArray(item.teachingLevels))
    throw new Error(`${path}.teachingLevels 必須是陣列。`);
  if (item.teachingLevels !== undefined) {
    if (!Array.isArray(item.teachingLevels))
      throw new Error(`${path}.teachingLevels 必須是陣列。`);
    item.teachingLevels.forEach((level, levelIndex) => {
      const levelPath = `${path}.teachingLevels[${levelIndex}]`;
      const levelObject = objectAt(level, levelPath);
      for (const key of ["id", "kind", "title", "instruction", "cue", "reps"])
        stringAt(levelObject[key], `${levelPath}.${key}`);
      enumAt(
        levelObject.kind,
        ["regression", "standard", "variation"],
        `${levelPath}.kind`,
      );
      numberAt(levelObject.durationSeconds, `${levelPath}.durationSeconds`);
    });
    if (schemaVersion >= 3) {
      const kinds = item.teachingLevels.map((level) =>
        stringAt(
          objectAt(level, `${path}.teachingLevels`).kind,
          `${path}.teachingLevels.kind`,
        ),
      );
      if (
        item.teachingLevels.length !== 3 ||
        !["regression", "standard", "variation"].every((kind) =>
          kinds.includes(kind),
        )
      )
        throw new Error(`${path}.teachingLevels 必須包含退階、正常與變化。`);
    }
  }
  return clone(item) as unknown as CourseExercise;
}

function courseAt(
  value: unknown,
  index: number,
  schemaVersion: number,
  prefix = "data.courses",
): Course {
  const path = `${prefix}[${index}]`;
  const item = objectAt(value, path);
  for (const key of [
    "id",
    "title",
    "date",
    "time",
    "apparatus",
    "level",
    "theme",
    "studentType",
    "notes",
    "createdAt",
    "updatedAt",
  ])
    stringAt(item[key], `${path}.${key}`);
  numberAt(item.durationMinutes, `${path}.durationMinutes`);
  if (!Array.isArray(item.sections))
    throw new Error(`${path}.sections 必須是陣列。`);
  item.sections.forEach((section, sectionIndex) => {
    const sectionObject = objectAt(
      section,
      `${path}.sections[${sectionIndex}]`,
    );
    for (const key of ["id", "title", "accent"])
      stringAt(sectionObject[key], `${path}.sections[${sectionIndex}].${key}`);
  });
  if (!Array.isArray(item.exercises))
    throw new Error(`${path}.exercises 必須是陣列。`);
  item.exercises.forEach((exercise, exerciseIndex) =>
    courseExerciseAt(
      exercise,
      `${path}.exercises[${exerciseIndex}]`,
      schemaVersion,
    ),
  );
  for (const key of ["lastOpenedAt", "lastStudiedItemId", "lastTaughtAt"])
    if (item[key] !== undefined) stringAt(item[key], `${path}.${key}`);
  if (item.teachingSession !== undefined) {
    const session = objectAt(item.teachingSession, `${path}.teachingSession`);
    for (const key of ["courseId", "currentItemId"])
      stringAt(session[key], `${path}.teachingSession.${key}`);
    for (const key of [
      "currentIndex",
      "startedAtMs",
      "currentStartedAtMs",
      "totalPausedMs",
      "currentPausedMs",
      "extraTargetSeconds",
    ])
      numberAt(session[key], `${path}.teachingSession.${key}`);
    if (session.pausedAtMs !== undefined)
      numberAt(session.pausedAtMs, `${path}.teachingSession.pausedAtMs`);
  }
  return clone(item) as unknown as Course;
}

function usageAt(value: unknown, index: number): UsageHistory {
  const path = `data.usageHistory[${index}]`;
  const item = objectAt(value, path);
  for (const key of ["id", "exerciseId", "courseId", "usedAt"])
    stringAt(item[key], `${path}.${key}`);
  return clone(item) as unknown as UsageHistory;
}

function templateAt(
  value: unknown,
  index: number,
  schemaVersion: number,
): Template {
  const path = `data.templates[${index}]`;
  const item = objectAt(value, path);
  for (const key of ["id", "name", "description", "createdAt", "updatedAt"])
    stringAt(item[key], `${path}.${key}`);
  courseAt(item.course, 0, schemaVersion, `${path}.course`);
  return clone(item) as unknown as Template;
}

function validateData(value: unknown, schemaVersion: number): AppData {
  const data = objectAt(value, "data");
  if (
    !Array.isArray(data.exercises) ||
    !Array.isArray(data.courses) ||
    !Array.isArray(data.templates) ||
    !Array.isArray(data.usageHistory)
  ) {
    throw new Error("備份檔案缺少必要資料陣列。");
  }
  const settings = objectAt(data.settings, "data.settings");
  if (settings.id !== "app") throw new Error("data.settings.id 格式不正確。");
  const normalizedSettings = {
    ...DEFAULT_SETTINGS,
    ...settings,
    id: "app" as const,
  };
  enumAt(
    normalizedSettings.theme,
    ["light", "dark", "system"],
    "data.settings.theme",
  );
  enumAt(
    normalizedSettings.leadFontSize,
    ["normal", "large", "xlarge"],
    "data.settings.leadFontSize",
  );
  enumAt(
    normalizedSettings.teachingTimerMode,
    ["elapsed", "countdown"],
    "data.settings.teachingTimerMode",
  );
  for (const key of [
    "showCueInTeaching",
    "showNextInTeaching",
    "keepScreenAwake",
    "speechEnabled",
    "showTeachingTimer",
    "timerSound",
    "timerVibration",
  ] as const)
    booleanAt(normalizedSettings[key], `data.settings.${key}`);
  return {
    exercises: data.exercises.map(exerciseAt),
    courses: data.courses.map((course, index) =>
      courseAt(course, index, schemaVersion),
    ),
    templates: data.templates.map((template, index) =>
      templateAt(template, index, schemaVersion),
    ),
    usageHistory: data.usageHistory.map(usageAt),
    settings: normalizedSettings,
  };
}

export function createBackup(data: AppData): BackupEnvelope {
  return {
    app: "pilates-prep",
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: nowIso(),
    data: clone(data),
  };
}

export function serializeBackup(data: AppData): string {
  return JSON.stringify(createBackup(data), null, 2);
}

export function parseBackup(raw: string): BackupEnvelope {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("備份檔案不是有效的 JSON。");
  }
  const envelope = objectAt(value, "備份檔案");
  if (envelope.app !== "pilates-prep")
    throw new Error("這不是 Pilates Prep 的備份檔案。");
  const schemaVersion = numberAt(envelope.schemaVersion, "schemaVersion");
  if (schemaVersion < 1 || schemaVersion > BACKUP_SCHEMA_VERSION)
    throw new Error(`備份版本 ${schemaVersion} 與目前版本不相容。`);
  const exportedAt = stringAt(envelope.exportedAt, "exportedAt");
  const appVersion = stringAt(envelope.appVersion, "appVersion");
  return {
    app: "pilates-prep",
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion,
    exportedAt,
    data: migrateTeachingLevels(validateData(envelope.data, schemaVersion)),
  };
}

export function mergeBackup(current: AppData, incoming: AppData): AppData {
  const mergeById = <T extends { id: string }>(
    first: T[],
    second: T[],
  ): T[] => {
    const map = new Map(first.map((item) => [item.id, item]));
    for (const item of second) map.set(item.id, clone(item));
    return [...map.values()];
  };
  return {
    exercises: mergeById(current.exercises, incoming.exercises),
    courses: mergeById(current.courses, incoming.courses),
    templates: mergeById(current.templates, incoming.templates),
    usageHistory: mergeById(current.usageHistory, incoming.usageHistory),
    settings: { ...DEFAULT_SETTINGS, ...incoming.settings, id: "app" },
  };
}
