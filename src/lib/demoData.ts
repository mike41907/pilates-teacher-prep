import { DEFAULT_SETTINGS, type AppData, type BodyArea, type Course, type CourseExercise, type Cue, type Exercise, type Level, type MovementType, type StartPosition } from '../types'
import { localDateIso, newId, nowIso, snapshotFromExercise } from './utils'

type ExerciseSeed = {
  id: string
  nameZh: string
  nameEn: string
  level: Level
  areas: BodyArea[]
  secondaryAreas?: BodyArea[]
  positions: StartPosition[]
  movementType: MovementType
  reps: string
  seconds: number
  spring: string
  footbar: string
  headrest: string
  cue: Partial<Cue>
  breathing?: string
  flow?: string
  errors?: string
  corrections?: string
  conditions?: Exercise['specialConditions']
}

const demonstrationNote = '示範資料：請依你的培訓系統、學生狀況與教學習慣自行調整。'

function createExercise(seed: ExerciseSeed, timestamp: string): Exercise {
  const cue: Cue = {
    preparation: seed.cue.preparation ?? '確認器械與學生的準備狀態。',
    start: seed.cue.start ?? '找到舒適、穩定的起始位置。',
    breathing: seed.cue.breathing ?? '吸氣準備，吐氣時開始動作。',
    core: seed.cue.core ?? '維持軀幹穩定，讓動作從控制開始。',
    movement: seed.cue.movement ?? '慢慢移動，保持全程可控制。',
    correction: seed.cue.correction ?? '若失去穩定，先減少幅度與速度。',
    finish: seed.cue.finish ?? '控制回到起始位置，確認身體狀態。',
  }
  return {
    id: seed.id,
    nameZh: seed.nameZh,
    nameEn: seed.nameEn,
    aliases: [],
    apparatus: 'Reformer',
    level: seed.level,
    primaryAreas: seed.areas,
    secondaryAreas: seed.secondaryAreas ?? [],
    startPositions: seed.positions,
    movementType: seed.movementType,
    suggestedReps: seed.reps,
    suggestedSeconds: seed.seconds,
    spring: seed.spring,
    footbar: seed.footbar,
    headrest: seed.headrest,
    usesBox: false,
    description: {
      startPosition: seed.cue.start ?? '穩定地進入起始位置。',
      flow: seed.flow ?? '依照自己的節奏完成動作。',
      endPosition: '控制回到安全、穩定的結束位置。',
    },
    defaultCue: cue,
    breathing: seed.breathing ?? cue.breathing,
    commonErrors: seed.errors ?? '速度過快、代償或呼吸停止。',
    corrections: seed.corrections ?? '降低幅度，回到呼吸與軀幹穩定。',
    cautions: '示範內容不取代個別評估；請依學生當日狀態調整。',
    contraindications: '',
    regression: '減少幅度、次數或阻力。',
    progression: '增加控制時間或加入進階變化。',
    alternatives: [],
    prerequisites: [],
    suggestedNext: [],
    personalNote: demonstrationNote,
    specialConditions: seed.conditions ?? [],
    isFavorite: seed.id === 'demo-footwork' || seed.id === 'demo-feet-straps',
    isCustom: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
}

function makeCourseExercise(exercise: Exercise, sectionId: string, order: number): CourseExercise {
  return {
    id: newId('course-exercise'),
    exerciseId: exercise.id,
    sectionId,
    order,
    reps: exercise.suggestedReps,
    durationSeconds: exercise.suggestedSeconds,
    spring: exercise.spring,
    footbar: exercise.footbar,
    headrest: exercise.headrest,
    cue: structuredClone(exercise.defaultCue),
    note: '',
    familiarity: order < 3 ? 'familiar' : order < 7 ? 'unsure' : 'new',
    snapshot: snapshotFromExercise(exercise),
  }
}

export function createDemoData(): AppData {
  const timestamp = nowIso()
  const exercises = [
    createExercise({ id: 'demo-footwork', nameZh: '腳踩踏板', nameEn: 'Footwork', level: '初階', areas: ['大腿', '臀部', '核心'], positions: ['仰躺'], movementType: '力量', reps: '10–12 次', seconds: 240, spring: '3R1B', footbar: '中高位', headrest: '低', cue: { preparation: '仰躺，腳掌平行踩在 Footbar。', core: '骨盆保持 Neutral，肋骨向內。', movement: '吐氣推遠，吸氣控制回來。', correction: '膝蓋方向跟著腳尖，不要鎖死。' }, flow: '平行、V 位、寬站位依序練習。' }, timestamp),
    createExercise({ id: 'demo-bridge', nameZh: '肩橋', nameEn: 'Bridge', level: '初階', areas: ['臀部', '大腿', '核心'], secondaryAreas: ['穩定'], positions: ['仰躺'], movementType: '穩定', reps: '6–8 次', seconds: 240, spring: '3R1B', footbar: '中高位', headrest: '低', cue: { preparation: '雙腳踩踏板，腳跟與坐骨對齊。', core: '先找到骨盆穩定，再讓脊椎逐節移動。', movement: '吐氣抬起骨盆，吸氣停留，吐氣逐節回來。' }, flow: '脊椎捲起與捲下，保持動作連續。' }, timestamp),
    createExercise({ id: 'demo-hundred-prep', nameZh: '百次預備', nameEn: 'Hundred Prep', level: '初階', areas: ['核心', '胸部'], secondaryAreas: ['穩定'], positions: ['仰躺'], movementType: '力量', reps: '5–8 組呼吸', seconds: 180, spring: '2R1B', footbar: '收起', headrest: '低', cue: { preparation: '雙腿進入桌面式，手臂伸向前方。', breathing: '吸五拍、吐五拍，維持呼吸流動。', core: '腹壁向內，肩膀保持寬。', movement: '手臂小幅度上下拍動，眼睛看向膝蓋方向。' }, flow: '先練呼吸與手臂，再視情況伸長腿。' }, timestamp),
    createExercise({ id: 'demo-feet-straps', nameZh: '腳套系列', nameEn: 'Feet in Straps', level: '初中階', areas: ['髖部', '大腿', '核心'], secondaryAreas: ['穩定'], positions: ['仰躺'], movementType: '活動度', reps: '8–10 次', seconds: 300, spring: '2R', footbar: '收起', headrest: '低', cue: { preparation: '腳套套在前腳掌，雙腿垂直。', core: '骨盆重量平均落在墊上。', movement: '吐氣下壓腿，吸氣回到垂直。', correction: '腿下放的幅度以骨盆不移動為準。' }, flow: '腿下壓、青蛙、畫圈。', conditions: ['雙腳'] }, timestamp),
    createExercise({ id: 'demo-frog', nameZh: '青蛙', nameEn: 'Frog', level: '初中階', areas: ['大腿', '髖部', '核心'], positions: ['仰躺'], movementType: '力量', reps: '8–10 次', seconds: 180, spring: '2R', footbar: '收起', headrest: '低', cue: { start: '髖關節屈曲，腳跟併攏、腳趾微開。', core: '保持骨盆安靜，不用腰椎代償。', movement: '吐氣伸長雙腿，吸氣收回。' }, flow: '延伸腿部後控制回收。' }, timestamp),
    createExercise({ id: 'demo-leg-circle', nameZh: '腿部畫圈', nameEn: 'Leg Circle', level: '初中階', areas: ['髖部', '核心'], secondaryAreas: ['伸展'], positions: ['仰躺'], movementType: '活動度', reps: '5–8 圈', seconds: 240, spring: '2R', footbar: '收起', headrest: '低', cue: { start: '雙腿向上，腳套維持張力。', core: '兩側髖骨保持同高。', movement: '腿向外、下、回到中線，保持圓順。', correction: '圈小一點，先確保軀幹不晃動。' }, flow: '雙向各做數圈，再回到中線。' }, timestamp),
    createExercise({ id: 'demo-short-spine', nameZh: '短脊柱', nameEn: 'Short Spine', level: '中階', areas: ['核心', '背部', '髖部'], secondaryAreas: ['伸展'], positions: ['仰躺'], movementType: '整合', reps: '3–5 次', seconds: 300, spring: '2R', footbar: '收起', headrest: '低', cue: { preparation: '腳套在腳掌，腿延伸向前上方。', core: '先保持肩帶寬，再讓骨盆向上移動。', movement: '控制脊椎捲起與回到墊面。', correction: '以舒服的幅度練習，不追求腿碰頭。' }, flow: '腿部延伸、骨盆抬起、脊椎逐節回到墊面。', conditions: ['頸椎負荷'] }, timestamp),
    createExercise({ id: 'demo-elephant', nameZh: '大象', nameEn: 'Elephant', level: '初中階', areas: ['大腿', '背部', '核心'], secondaryAreas: ['伸展'], positions: ['站姿'], movementType: '伸展', reps: '6–8 次', seconds: 180, spring: '2R1B', footbar: '高位', headrest: '收起', cue: { preparation: '雙手推在 Footbar，坐骨往後上方。', core: '讓脊椎長，不用肩膀頂住。', movement: '腿部後推，再由腹部帶回。', correction: '膝蓋可微彎，先找到背部長度。' }, flow: '保持身體倒 V，完成來回控制。' }, timestamp),
    createExercise({ id: 'demo-long-stretch', nameZh: '長伸展', nameEn: 'Long Stretch', level: '中階', areas: ['核心', '肩膀', '手臂'], secondaryAreas: ['全身', '穩定'], positions: ['支撐姿勢'], movementType: '整合', reps: '5–8 次', seconds: 240, spring: '1R1B', footbar: '高位', headrest: '收起', cue: { preparation: '雙手在 Footbar，身體形成長斜線。', core: '肋骨與骨盆保持連結。', movement: '整個身體一起前後移動。', correction: '先減少行程，維持肩膀遠離耳朵。' }, flow: '全身整合的前後移動。', conditions: ['手腕負重', '肩膀負重'] }, timestamp),
    createExercise({ id: 'demo-knee-stretch', nameZh: '跪姿收膝', nameEn: 'Knee Stretch', level: '初中階', areas: ['核心', '大腿'], secondaryAreas: ['肩膀'], positions: ['跪姿'], movementType: '力量', reps: '8–10 次', seconds: 240, spring: '1R1B', footbar: '高位', headrest: '收起', cue: { preparation: '膝蓋在墊上，手掌推穩 Footbar。', core: '脊椎保持圓長，先固定肩帶。', movement: '吐氣讓大腿往後，吸氣從腹部回來。', correction: '讓動作來自髖部，不要只推膝蓋。' }, flow: '圓背版本，視學生狀況加入平背。', conditions: ['手腕負重', '膝蓋負重'] }, timestamp),
    createExercise({ id: 'demo-scooter', nameZh: '滑板車', nameEn: 'Scooter', level: '中階', areas: ['臀部', '大腿', '髖部'], secondaryAreas: ['平衡'], positions: ['站姿'], movementType: '平衡', reps: '6–8 次／側', seconds: 240, spring: '1R1B', footbar: '中高位', headrest: '收起', cue: { preparation: '一腳踩穩平台，一腳在 Carriage。', core: '站立腿保持穩定，骨盆朝前。', movement: '後腳推遠，再用臀部拉回。', correction: '先縮小幅度，避免身體左右移動。' }, flow: '左右側分別完成。', conditions: ['單腳', '單側', '平衡需求'] }, timestamp),
    createExercise({ id: 'demo-mermaid', nameZh: '美人魚', nameEn: 'Mermaid', level: '初中階', areas: ['髖部', '背部', '伸展'], secondaryAreas: ['全身'], positions: ['坐姿'], movementType: '伸展', reps: '3–5 次／側', seconds: 180, spring: '1R', footbar: '中位', headrest: '收起', cue: { preparation: '側坐於墊上，一手輕放 Footbar。', core: '坐骨保持有重量，肩膀放鬆。', movement: '吐氣側彎，吸氣回到中線。', correction: '側彎幅度以兩側腰部都能呼吸為準。' }, flow: '側彎後可加入旋轉變化。' }, timestamp),
    createExercise({ id: 'demo-eves-lunge', nameZh: 'Eve’s Lunge', nameEn: "Eve's Lunge", level: '中階', areas: ['髖部', '大腿', '伸展'], secondaryAreas: ['核心'], positions: ['跪姿'], movementType: '伸展', reps: '3–5 次／側', seconds: 240, spring: '1R', footbar: '低位', headrest: '收起', cue: { preparation: '前腳站穩，後膝跪在墊上。', core: '骨盆保持朝前，先建立支撐。', movement: '由髖部帶動前後移動，保持呼吸。', correction: '減少幅度，避免腰椎過度前凸。' }, flow: '左右側各自完成，再回到中立。', conditions: ['單側', '膝蓋負重'] }, timestamp),
  ]

  const warmup = { id: 'section-warmup', title: '暖身與腿部', accent: '#c99b67' }
  const lower = { id: 'section-lower', title: '髖腿控制', accent: '#6a9b95' }
  const core = { id: 'section-core', title: '核心整合', accent: '#9a7eb4' }
  const standing = { id: 'section-standing', title: '站姿與伸展', accent: '#d48378' }
  const byId = new Map(exercises.map((exercise) => [exercise.id, exercise]))
  const sequence: Array<[string, string]> = [
    ['demo-footwork', warmup.id], ['demo-bridge', warmup.id], ['demo-hundred-prep', core.id], ['demo-feet-straps', lower.id],
    ['demo-frog', lower.id], ['demo-leg-circle', lower.id], ['demo-short-spine', lower.id], ['demo-elephant', standing.id],
    ['demo-long-stretch', core.id], ['demo-knee-stretch', core.id], ['demo-scooter', standing.id], ['demo-mermaid', standing.id], ['demo-eves-lunge', standing.id],
  ]
  const courseExercises = sequence.map(([exerciseId, sectionId], order) => makeCourseExercise(byId.get(exerciseId)!, sectionId, order))
  const course: Course = {
    id: 'demo-course', title: '初階 Reformer 50 分鐘', date: localDateIso(), time: '10:00', durationMinutes: 50,
    apparatus: 'Reformer', level: '初階', theme: '臀腿＋核心', studentType: '一般小班',
    notes: '示範課表，可直接複製後調整成自己的版本。', sections: [warmup, lower, core, standing], exercises: courseExercises,
    createdAt: timestamp, updatedAt: timestamp,
  }
  const usageHistory = exercises.slice(0, 7).flatMap((exercise, exerciseIndex) => Array.from({ length: Math.max(1, 5 - exerciseIndex) }, (_, index) => ({
    id: `demo-usage-${exercise.id}-${index}`, exerciseId: exercise.id, courseId: course.id,
    usedAt: new Date(Date.now() - (index + exerciseIndex) * 86400000).toISOString(),
  })))
  return { exercises, courses: [course], templates: [], usageHistory, settings: { ...DEFAULT_SETTINGS } }
}
