export const APP_VERSION = "0.2.0";
export const BACKUP_SCHEMA_VERSION = 2;

export type Id = string;

export type Apparatus =
  "Reformer" | "Cadillac" | "Chair" | "Barrel" | "Mat" | "其他";
export type Level = "初階" | "初中階" | "中階" | "中高階" | "高階";
export type BodyArea =
  | "核心"
  | "臀部"
  | "大腿"
  | "小腿"
  | "背部"
  | "胸部"
  | "肩膀"
  | "手臂"
  | "髖部"
  | "全身"
  | "伸展"
  | "平衡"
  | "穩定";
export type StartPosition =
  | "仰躺"
  | "趴姿"
  | "側躺"
  | "坐姿"
  | "跪姿"
  | "四足跪姿"
  | "站姿"
  | "支撐姿勢"
  | "其他";
export type SpecialCondition =
  | "手腕負重"
  | "肩膀負重"
  | "膝蓋負重"
  | "腰椎負荷"
  | "頸椎負荷"
  | "平衡需求"
  | "單腳"
  | "雙腳"
  | "單側"
  | "雙側";

export type MovementType =
  "力量" | "活動度" | "伸展" | "穩定" | "平衡" | "整合";
export type Familiarity = "familiar" | "unsure" | "new";
export type ThemeMode = "light" | "dark" | "system";
export type AppView =
  | "today"
  | "planner"
  | "library"
  | "study"
  | "courses"
  | "settings"
  | "teaching";
export type StudyMode = "sequence" | "recall" | "cue";
export type TeachingTimerMode = "elapsed" | "countdown";

export interface Cue {
  preparation: string;
  start: string;
  breathing: string;
  core: string;
  movement: string;
  correction: string;
  finish: string;
}

export interface ExerciseDescription {
  startPosition: string;
  flow: string;
  endPosition: string;
}

export interface Exercise {
  id: Id;
  nameZh: string;
  nameEn: string;
  aliases: string[];
  apparatus: Apparatus;
  level: Level;
  primaryAreas: BodyArea[];
  secondaryAreas: BodyArea[];
  startPositions: StartPosition[];
  movementType: MovementType;
  suggestedReps: string;
  suggestedSeconds: number;
  spring: string;
  footbar: string;
  headrest: string;
  usesBox: boolean;
  description: ExerciseDescription;
  defaultCue: Cue;
  breathing: string;
  commonErrors: string;
  corrections: string;
  cautions: string;
  contraindications: string;
  regression: string;
  progression: string;
  alternatives: Id[];
  prerequisites: Id[];
  suggestedNext: Id[];
  personalNote: string;
  specialConditions: SpecialCondition[];
  isFavorite: boolean;
  isCustom: boolean;
  createdAt: string;
  updatedAt: string;
  lastUsedAt?: string;
}

export interface ExerciseSnapshot {
  id: Id;
  nameZh: string;
  nameEn: string;
  apparatus: Apparatus;
  level: Level;
  primaryAreas: BodyArea[];
  startPositions: StartPosition[];
  specialConditions: SpecialCondition[];
  defaultCue: Cue;
  spring: string;
  footbar: string;
  headrest: string;
  suggestedReps: string;
}

export interface Section {
  id: Id;
  title: string;
  accent: string;
}

export interface CourseExercise {
  id: Id;
  exerciseId: Id;
  sectionId: Id;
  order: number;
  reps: string;
  durationSeconds: number;
  spring: string;
  footbar: string;
  headrest: string;
  cue: Cue;
  note: string;
  familiarity: Familiarity;
  snapshot: ExerciseSnapshot;
  actualDurationSeconds?: number;
}

export interface TeachingSession {
  courseId: Id;
  currentItemId: Id;
  currentIndex: number;
  startedAtMs: number;
  currentStartedAtMs: number;
  pausedAtMs?: number;
  totalPausedMs: number;
  currentPausedMs: number;
  extraTargetSeconds: number;
}

export interface Course {
  id: Id;
  title: string;
  date: string;
  time: string;
  durationMinutes: number;
  apparatus: Apparatus;
  level: Level;
  theme: string;
  studentType: string;
  notes: string;
  sections: Section[];
  exercises: CourseExercise[];
  createdAt: string;
  updatedAt: string;
  lastOpenedAt?: string;
  lastStudiedItemId?: Id;
  teachingSession?: TeachingSession;
  lastTaughtAt?: string;
}

export interface Template {
  id: Id;
  name: string;
  description: string;
  course: Course;
  createdAt: string;
  updatedAt: string;
}

export interface UsageHistory {
  id: Id;
  exerciseId: Id;
  courseId: Id;
  usedAt: string;
}

export interface AppSettings {
  id: "app";
  theme: ThemeMode;
  leadFontSize: "normal" | "large" | "xlarge";
  showCueInTeaching: boolean;
  showNextInTeaching: boolean;
  keepScreenAwake: boolean;
  speechEnabled: boolean;
  showTeachingTimer: boolean;
  teachingTimerMode: TeachingTimerMode;
  timerSound: boolean;
  timerVibration: boolean;
}

export interface AppData {
  exercises: Exercise[];
  courses: Course[];
  templates: Template[];
  usageHistory: UsageHistory[];
  settings: AppSettings;
}

export interface BackupEnvelope {
  app: "pilates-prep";
  schemaVersion: number;
  appVersion: string;
  exportedAt: string;
  data: AppData;
}

export interface CourseDraft {
  title: string;
  date: string;
  time: string;
  durationMinutes: number;
  apparatus: Apparatus;
  level: Level;
  theme: string;
  studentType: string;
  notes: string;
}

export interface ExerciseFilters {
  apparatus: Apparatus | "全部";
  level: Level | "全部";
  bodyArea: BodyArea | "全部";
  position: StartPosition | "全部";
  favoritesOnly: boolean;
}

export const APPARATUS_OPTIONS: Apparatus[] = [
  "Reformer",
  "Cadillac",
  "Chair",
  "Barrel",
  "Mat",
  "其他",
];
export const LEVEL_OPTIONS: Level[] = [
  "初階",
  "初中階",
  "中階",
  "中高階",
  "高階",
];
export const BODY_AREA_OPTIONS: BodyArea[] = [
  "核心",
  "臀部",
  "大腿",
  "小腿",
  "背部",
  "胸部",
  "肩膀",
  "手臂",
  "髖部",
  "全身",
  "伸展",
  "平衡",
  "穩定",
];
export const POSITION_OPTIONS: StartPosition[] = [
  "仰躺",
  "趴姿",
  "側躺",
  "坐姿",
  "跪姿",
  "四足跪姿",
  "站姿",
  "支撐姿勢",
  "其他",
];
export const SECTION_COLORS = [
  "#c99b67",
  "#6a9b95",
  "#9a7eb4",
  "#d48378",
  "#7b99c8",
  "#7c9a75",
  "#c687a4",
];

export const EMPTY_CUE: Cue = {
  preparation: "",
  start: "",
  breathing: "",
  core: "",
  movement: "",
  correction: "",
  finish: "",
};

export const DEFAULT_SETTINGS: AppSettings = {
  id: "app",
  theme: "system",
  leadFontSize: "large",
  showCueInTeaching: true,
  showNextInTeaching: true,
  keepScreenAwake: true,
  speechEnabled: false,
  showTeachingTimer: true,
  teachingTimerMode: "elapsed",
  timerSound: false,
  timerVibration: false,
};
