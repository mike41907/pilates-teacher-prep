import {
  APP_VERSION,
  BACKUP_SCHEMA_VERSION,
  DEFAULT_SETTINGS,
  type AppData,
  type BackupMediaAsset,
  type BackupEnvelope,
  type Course,
  type CourseExercise,
  type Cue,
  type Exercise,
  type ExerciseVideoRef,
  type Template,
  type UsageHistory,
} from "../types";
import { clone, nowIso } from "./utils";
import { migrateTeachingLevels } from "./teachingLevels";
import { migrateExerciseCatalog } from "./exerciseCatalog";

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

function videoRefAt(value: unknown, path: string): ExerciseVideoRef {
  const reference = objectAt(value, path);
  return {
    id: stringAt(reference.id, `${path}.id`),
    fileName: stringAt(reference.fileName, `${path}.fileName`),
    mimeType: stringAt(reference.mimeType, `${path}.mimeType`),
    sizeBytes: numberAt(reference.sizeBytes, `${path}.sizeBytes`),
    updatedAt: stringAt(reference.updatedAt, `${path}.updatedAt`),
  };
}

function optionalHttpsUrlAt(value: unknown, path: string): string | undefined {
  if (value === undefined || value === "") return undefined;
  const url = stringAt(value, path);
  try {
    if (new URL(url).protocol !== "https:") throw new Error();
  } catch {
    throw new Error(`${path} 必須是有效的 HTTPS 網址。`);
  }
  return url;
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
  optionalHttpsUrlAt(item.sourceUrl, `${path}.sourceUrl`);
  optionalHttpsUrlAt(item.demoVideoUrl, `${path}.demoVideoUrl`);
  if (item.videoRefs !== undefined) {
    const references = objectAt(item.videoRefs, `${path}.videoRefs`);
    for (const slot of ["overview", "regression", "standard", "variation"])
      if (references[slot] !== undefined)
        videoRefAt(references[slot], `${path}.videoRefs.${slot}`);
  }
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

function mediaAt(value: unknown, index: number): BackupMediaAsset {
  const path = `media[${index}]`;
  const item = objectAt(value, path);
  const slot = enumAt(
    item.slot,
    ["overview", "regression", "standard", "variation"],
    `${path}.slot`,
  );
  const mimeType = stringAt(item.mimeType, `${path}.mimeType`);
  if (!mimeType.startsWith("video/"))
    throw new Error(`${path}.mimeType 必須是影片格式。`);
  const dataUrl = stringAt(item.dataUrl, `${path}.dataUrl`);
  if (!dataUrl.startsWith("data:video/"))
    throw new Error(`${path}.dataUrl 必須是影片資料。`);
  return {
    id: stringAt(item.id, `${path}.id`),
    exerciseId: stringAt(item.exerciseId, `${path}.exerciseId`),
    slot,
    fileName: stringAt(item.fileName, `${path}.fileName`),
    mimeType,
    sizeBytes: numberAt(item.sizeBytes, `${path}.sizeBytes`),
    updatedAt: stringAt(item.updatedAt, `${path}.updatedAt`),
    dataUrl,
  };
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
  numberAt(
    normalizedSettings.exerciseCatalogVersion,
    "data.settings.exerciseCatalogVersion",
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

export function createBackup(
  data: AppData,
  media: BackupMediaAsset[] = [],
): BackupEnvelope {
  return {
    app: "pilates-prep",
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion: APP_VERSION,
    exportedAt: nowIso(),
    data: clone(data),
    media: clone(media),
  };
}

export function serializeBackup(
  data: AppData,
  media: BackupMediaAsset[] = [],
): string {
  return JSON.stringify(createBackup(data, media), null, 2);
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
  if (schemaVersion >= 4 && !Array.isArray(envelope.media))
    throw new Error("media 必須是陣列。");
  const media = Array.isArray(envelope.media)
    ? envelope.media.map(mediaAt)
    : [];
  const parsedData = migrateExerciseCatalog(
    migrateTeachingLevels(validateData(envelope.data, schemaVersion)),
  );
  for (const exercise of parsedData.exercises) {
    for (const [slot, reference] of Object.entries(exercise.videoRefs ?? {})) {
      if (
        reference &&
        !media.some(
          (asset) =>
            asset.id === reference.id &&
            asset.exerciseId === exercise.id &&
            asset.slot === slot,
        )
      )
        throw new Error(
          `動作「${exercise.nameZh || exercise.nameEn}」的${slot}影片內容缺少。`,
        );
    }
  }
  return {
    app: "pilates-prep",
    schemaVersion: BACKUP_SCHEMA_VERSION,
    appVersion,
    exportedAt,
    data: parsedData,
    media,
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
  const currentExerciseById = new Map(
    current.exercises.map((exercise) => [exercise.id, exercise]),
  );
  const incomingExercises = incoming.exercises.map((exercise) => {
    const existing = currentExerciseById.get(exercise.id);
    return !exercise.videoRefs && existing?.videoRefs
      ? { ...exercise, videoRefs: clone(existing.videoRefs) }
      : exercise;
  });
  return {
    exercises: mergeById(current.exercises, incomingExercises),
    courses: mergeById(current.courses, incoming.courses),
    templates: mergeById(current.templates, incoming.templates),
    usageHistory: mergeById(current.usageHistory, incoming.usageHistory),
    settings: { ...DEFAULT_SETTINGS, ...incoming.settings, id: "app" },
  };
}
