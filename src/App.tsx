import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type PointerEvent, type ReactNode } from 'react'
import {
  APPARATUS_OPTIONS,
  BODY_AREA_OPTIONS,
  DEFAULT_SETTINGS,
  EMPTY_CUE,
  LEVEL_OPTIONS,
  POSITION_OPTIONS,
  SECTION_COLORS,
  type AppData,
  type AppSettings,
  type AppView,
  type Apparatus,
  type BodyArea,
  type Course,
  type CourseDraft,
  type CourseExercise,
  type Cue,
  type Exercise,
  type ExerciseFilters,
  type Familiarity,
  type Level,
  type Section,
  type StartPosition,
  type StudyMode,
  type Template,
  type ThemeMode,
} from './types'
import { loadData, replaceData } from './lib/db'
import { createDemoData } from './lib/demoData'
import { mergeBackup, parseBackup, serializeBackup } from './lib/backup'
import {
  classNames,
  clone,
  courseSimilarity,
  estimateCourseSeconds,
  formatCompactDate,
  formatDate,
  formatDateTime,
  formatSeconds,
  getCourseExerciseLabel,
  getCourseExerciseTitle,
  localDateIso,
  newId,
  nowIso,
  percentage,
  snapshotFromExercise,
} from './lib/utils'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BrainIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  CloseIcon,
  CopyIcon,
  CoursesIcon,
  DownloadIcon,
  DragIcon,
  EditIcon,
  HomeIcon,
  LibraryIcon,
  MaximizeIcon,
  MoonIcon,
  MonitorIcon,
  PlayIcon,
  PlusIcon,
  PlannerIcon,
  SearchIcon,
  SettingsIcon,
  StarIcon,
  SunIcon,
  TrashIcon,
  UploadIcon,
  VolumeIcon,
} from './components/Icons'
import './styles.css'

const cueFields: Array<[keyof Cue, string]> = [
  ['preparation', '準備口令'],
  ['start', '起始姿勢'],
  ['breathing', '呼吸口令'],
  ['core', '核心提示'],
  ['movement', '動作口令'],
  ['correction', '修正口令'],
  ['finish', '結束口令'],
]

const navItems: Array<{ view: AppView; label: string; shortLabel: string; icon: typeof HomeIcon }> = [
  { view: 'today', label: '今日', shortLabel: '今日', icon: HomeIcon },
  { view: 'planner', label: '備課', shortLabel: '備課', icon: PlannerIcon },
  { view: 'library', label: '動作庫', shortLabel: '動作', icon: LibraryIcon },
  { view: 'study', label: '背課', shortLabel: '背課', icon: BrainIcon },
  { view: 'courses', label: '課表', shortLabel: '課表', icon: CoursesIcon },
]

const initialDraft: CourseDraft = {
  title: '', date: localDateIso(), time: '10:00', durationMinutes: 50, apparatus: 'Reformer', level: '初中階', theme: '', studentType: '', notes: '',
}

function makeBlankExercise(): Exercise {
  const timestamp = nowIso()
  return {
    id: newId('exercise'), nameZh: '', nameEn: '', aliases: [], apparatus: 'Reformer', level: '初階',
    primaryAreas: [], secondaryAreas: [], startPositions: [], movementType: '力量', suggestedReps: '8–10 次', suggestedSeconds: 180,
    spring: '', footbar: '', headrest: '', usesBox: false,
    description: { startPosition: '', flow: '', endPosition: '' }, defaultCue: clone(EMPTY_CUE), breathing: '', commonErrors: '', corrections: '', cautions: '', contraindications: '', regression: '', progression: '', alternatives: [], prerequisites: [], suggestedNext: [], personalNote: '', specialConditions: [], isFavorite: false, isCustom: true, createdAt: timestamp, updatedAt: timestamp,
  }
}

function createCourseFromDraft(draft: CourseDraft): Course {
  const timestamp = nowIso()
  return { id: newId('course'), ...draft, sections: [{ id: newId('section'), title: '暖身', accent: SECTION_COLORS[0] }], exercises: [], createdAt: timestamp, updatedAt: timestamp }
}

function cloneCourseForNew(course: Course, title = `${course.title}（副本）`): Course {
  const timestamp = nowIso()
  const idMap = new Map(course.sections.map((section) => [section.id, newId('section')]))
  return {
    ...clone(course), id: newId('course'), title, date: localDateIso(), time: course.time,
    sections: course.sections.map((section) => ({ ...section, id: idMap.get(section.id)! })),
    exercises: course.exercises.map((item) => ({ ...clone(item), id: newId('course-exercise'), sectionId: idMap.get(item.sectionId) ?? idMap.get(course.sections[0]?.id ?? '') ?? newId('section'), })),
    createdAt: timestamp, updatedAt: timestamp, lastOpenedAt: undefined,
  }
}

function displayTitle(view: AppView, course?: Course): string {
  if (view === 'today') return '今日'
  if (view === 'planner') return course ? '編輯課表' : '備課'
  if (view === 'library') return '動作庫'
  if (view === 'study') return '背課'
  if (view === 'courses') return '我的課表'
  return '設定'
}

function usePersistedData() {
  const [data, setData] = useState<AppData | null>(null)
  const [loadError, setLoadError] = useState('')
  const [toast, setToast] = useState('')

  useEffect(() => {
    let active = true
    void (async () => {
      try {
        let loaded = await loadData()
        if (!loaded.exercises.length) {
          const demo = createDemoData()
          try { await replaceData(demo) } catch { /* keep the in-memory demo when storage is unavailable */ }
          loaded = demo
        }
        if (active) setData(loaded)
      } catch (error) {
        const demo = createDemoData()
        try { await replaceData(demo) } catch { setLoadError('本機資料庫目前無法使用，這次工作階段會暫存在記憶體中。') }
        if (active) {
          setData(demo)
          setToast(error instanceof Error ? '已建立示範資料，可以直接開始試用。' : '已建立示範資料。')
        }
      }
    })()
    return () => { active = false }
  }, [])

  const update = useCallback((updater: (current: AppData) => AppData, message?: string) => {
    setData((current) => {
      if (!current) return current
      const next = updater(current)
      void replaceData(next).catch(() => setToast('資料儲存失敗，請重新嘗試。'))
      if (message) setToast(message)
      return next
    })
  }, [])

  return { data, update, setData, toast, setToast, loadError }
}

export default function App() {
  const { data, update, setData, toast, setToast, loadError } = usePersistedData()
  const [view, setView] = useState<AppView>('today')
  const [activeCourseId, setActiveCourseId] = useState<string | null>(null)
  const [showCreateCourse, setShowCreateCourse] = useState(false)
  const [showExercisePicker, setShowExercisePicker] = useState(false)
  const [pickerMode, setPickerMode] = useState<'add' | 'replace'>('add')
  const [replaceTargetId, setReplaceTargetId] = useState<string | null>(null)
  const [exerciseEditor, setExerciseEditor] = useState<Exercise | null>(null)
  const [pendingBackup, setPendingBackup] = useState<ReturnType<typeof parseBackup> | null>(null)

  useEffect(() => {
    if (!data) return
    const root = document.documentElement
    const applyTheme = () => {
      const theme = data.settings.theme === 'system' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : data.settings.theme
      root.dataset.theme = theme
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', theme === 'dark' ? '#171918' : '#f7f7f5')
    }
    applyTheme()
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener?.('change', applyTheme)
    return () => media.removeEventListener?.('change', applyTheme)
  }, [data])

  useEffect(() => {
    if (window.__PILATES_SW_REGISTERED__ || !('serviceWorker' in navigator)) return
    window.__PILATES_SW_REGISTERED__ = true
    void navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => setToast('離線快取尚未啟用，但本機資料仍可正常使用。'))
  }, [setToast])

  const notify = useCallback((message: string) => setToast(message), [setToast])
  const activeCourse = useMemo(() => data?.courses.find((course) => course.id === activeCourseId), [data, activeCourseId])
  const latestCourse = useMemo(() => data?.courses.slice().sort((a, b) => `${b.date}T${b.time}`.localeCompare(`${a.date}T${a.time}`))[0], [data])

  const navigate = (nextView: AppView) => {
    if (nextView === 'study' && !activeCourseId && latestCourse) setActiveCourseId(latestCourse.id)
    setView(nextView)
  }

  const openCourse = (courseId: string, nextView: AppView = 'planner') => {
    setActiveCourseId(courseId)
    setView(nextView)
    update((current) => ({ ...current, courses: current.courses.map((course) => course.id === courseId ? { ...course, lastOpenedAt: nowIso() } : course) }))
  }

  const saveNewCourse = (draft: CourseDraft, templateId?: string) => {
    if (!data) return
    const template = templateId ? data.templates.find((item) => item.id === templateId) : undefined
    const course = template ? cloneCourseForNew(template.course, draft.title || template.course.title) : createCourseFromDraft(draft)
    const adjusted = { ...course, ...draft, title: draft.title || course.title, updatedAt: nowIso() }
    update((current) => ({ ...current, courses: [adjusted, ...current.courses] }), '課表已建立。')
    setShowCreateCourse(false)
    setActiveCourseId(adjusted.id)
    setView('planner')
  }

  const duplicateCourse = (course: Course) => {
    const copy = cloneCourseForNew(course)
    update((current) => ({ ...current, courses: [copy, ...current.courses] }), '已複製課表，可以繼續調整。')
    setActiveCourseId(copy.id)
    setView('planner')
  }

  const updateCourse = (courseId: string, updater: (course: Course) => Course, message?: string) => {
    update((current) => ({ ...current, courses: current.courses.map((course) => course.id === courseId ? { ...updater(clone(course)), updatedAt: nowIso() } : course) }), message)
  }

  const deleteCourse = (course: Course) => {
    if (!window.confirm(`確定要刪除「${course.title}」嗎？`)) return
    update((current) => ({ ...current, courses: current.courses.filter((item) => item.id !== course.id) }), '課表已刪除。')
    if (activeCourseId === course.id) { setActiveCourseId(null); setView('courses') }
  }

  const saveTemplate = (course: Course) => {
    const template: Template = { id: newId('template'), name: course.title, description: `${course.apparatus}・${course.durationMinutes} 分鐘・${course.level}`, course: clone(course), createdAt: nowIso(), updatedAt: nowIso() }
    update((current) => ({ ...current, templates: [template, ...current.templates] }), '已儲存為課程模板。')
  }

  const addExerciseToCourse = (exercise: Exercise) => {
    if (!data || !activeCourseId) return
    const course = data.courses.find((item) => item.id === activeCourseId)
    if (!course) return
    const sectionId = course.sections[0]?.id ?? newId('section')
    const item: CourseExercise = { id: newId('course-exercise'), exerciseId: exercise.id, sectionId, order: course.exercises.length, reps: exercise.suggestedReps, durationSeconds: exercise.suggestedSeconds, spring: exercise.spring, footbar: exercise.footbar, headrest: exercise.headrest, cue: clone(exercise.defaultCue), note: '', familiarity: 'new', snapshot: snapshotFromExercise(exercise) }
    const nextCourse: Course = { ...course, exercises: [...course.exercises, item], sections: course.sections.length ? course.sections : [{ id: sectionId, title: '暖身', accent: SECTION_COLORS[0] }] }
    updateCourse(course.id, () => nextCourse, '動作已加入課表。')
    update((current) => ({ ...current, usageHistory: [...current.usageHistory, { id: newId('usage'), exerciseId: exercise.id, courseId: course.id, usedAt: nowIso() }] }))
    setShowExercisePicker(false)
  }

  const replaceExerciseInCourse = (exercise: Exercise) => {
    if (!activeCourseId || !replaceTargetId) return
    updateCourse(activeCourseId, (course) => ({ ...course, exercises: course.exercises.map((item) => item.id === replaceTargetId ? { ...item, exerciseId: exercise.id, reps: exercise.suggestedReps, durationSeconds: exercise.suggestedSeconds, spring: exercise.spring, footbar: exercise.footbar, headrest: exercise.headrest, cue: clone(exercise.defaultCue), snapshot: snapshotFromExercise(exercise) } : item) }), '動作已替換。')
    setShowExercisePicker(false)
    setReplaceTargetId(null)
  }

  const toggleFavorite = (exerciseId: string) => update((current) => ({ ...current, exercises: current.exercises.map((exercise) => exercise.id === exerciseId ? { ...exercise, isFavorite: !exercise.isFavorite, updatedAt: nowIso() } : exercise) }))

  const saveDefaultCue = (exerciseId: string, cue: Cue) => update((current) => ({ ...current, exercises: current.exercises.map((exercise) => exercise.id === exerciseId ? { ...exercise, defaultCue: clone(cue), updatedAt: nowIso() } : exercise) }), '已儲存為這個動作的預設 Cue。')

  const saveExercise = (exercise: Exercise, previousId?: string) => {
    const next = { ...exercise, updatedAt: nowIso() }
    update((current) => ({ ...current, exercises: previousId ? current.exercises.map((item) => item.id === previousId ? next : item) : [next, ...current.exercises] }), previousId ? '動作已更新。' : '自訂動作已建立。')
    setExerciseEditor(null)
  }

  const deleteExercise = (exercise: Exercise) => {
    if (!window.confirm(`確定要刪除「${exercise.nameZh || exercise.nameEn}」嗎？歷史課表中的快照不會受影響。`)) return
    update((current) => ({ ...current, exercises: current.exercises.filter((item) => item.id !== exercise.id) }), '動作已刪除；歷史課表仍保留快照。')
    setExerciseEditor(null)
  }

  const beginTeaching = async (courseId: string) => {
    setActiveCourseId(courseId)
    setView('teaching')
    try { await document.documentElement.requestFullscreen?.() } catch { /* fullscreen is optional */ }
  }

  const exportBackup = () => {
    if (!data) return
    const blob = new Blob([serializeBackup(data)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `pilates-prep-backup-${localDateIso()}.json`
    anchor.click()
    URL.revokeObjectURL(url)
    notify('完整備份已下載。')
  }

  const selectBackup = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try { setPendingBackup(parseBackup(await file.text())) } catch (error) { notify(error instanceof Error ? error.message : '備份檔案格式不正確。') }
  }

  const importBackup = (mode: 'merge' | 'replace') => {
    if (!data || !pendingBackup) return
    const next = mode === 'merge' ? mergeBackup(data, pendingBackup.data) : pendingBackup.data
    setData(next)
    void replaceData(next).catch(() => notify('資料儲存失敗，請重新嘗試。'))
    setPendingBackup(null)
    notify(mode === 'merge' ? '備份已合併。' : '備份已還原，現有資料已被覆蓋。')
  }

  if (!data) return <LoadingScreen error={loadError} />
  if (view === 'teaching' && activeCourse) return <TeachingView course={activeCourse} settings={data.settings} onExit={() => { void document.exitFullscreen?.(); setView('today') }} onNotify={notify} onUpdateCourse={updateCourse} />

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-lockup" onClick={() => navigate('today')} role="button" tabIndex={0} onKeyDown={(event) => { if (event.key === 'Enter') navigate('today') }}>
          <div className="brand-mark">P</div>
          <div><span className="brand-name">Pilates Prep</span><span className="brand-subtitle">器械皮拉提斯備課</span></div>
        </div>
        <div className="topbar-title">{displayTitle(view, activeCourse)}</div>
        <button className="icon-button" aria-label="開啟設定" onClick={() => navigate('settings')}><SettingsIcon /></button>
      </header>
      <main className="page-content">
        {view === 'today' && <TodayView data={data} onCreate={() => setShowCreateCourse(true)} onOpenCourse={(id) => openCourse(id)} onStudy={(id) => openCourse(id, 'study')} onTeach={beginTeaching} onNavigate={navigate} />}
        {view === 'planner' && (activeCourse ? <CourseEditorView course={activeCourse} exercises={data.exercises} settings={data.settings} onBack={() => navigate('today')} onUpdateCourse={updateCourse} onSaveDefaultCue={saveDefaultCue} onOpenPicker={(mode, targetId) => { setPickerMode(mode); setReplaceTargetId(targetId ?? null); setShowExercisePicker(true) }} onStudy={() => setView('study')} onTeach={() => void beginTeaching(activeCourse.id)} onDuplicate={() => duplicateCourse(activeCourse)} onSaveTemplate={() => saveTemplate(activeCourse)} onDelete={() => deleteCourse(activeCourse)} onAddSection={(section) => updateCourse(activeCourse.id, (course) => ({ ...course, sections: [...course.sections, section] }))} onNotify={notify} /> : <PlannerLanding courses={data.courses} templates={data.templates} onCreate={() => setShowCreateCourse(true)} onOpen={(id) => openCourse(id)} onUseTemplate={(id) => setShowCreateCourse(true)} />)}
        {view === 'library' && <LibraryView exercises={data.exercises} usageHistory={data.usageHistory} onToggleFavorite={toggleFavorite} onEdit={(exercise) => setExerciseEditor(exercise)} onCreate={() => setExerciseEditor(makeBlankExercise())} />}
        {view === 'study' && <StudyView courses={data.courses} activeCourseId={activeCourseId} settings={data.settings} onSelectCourse={setActiveCourseId} onBack={() => navigate('today')} onTeach={beginTeaching} onUpdateCourse={updateCourse} onNotify={notify} />}
        {view === 'courses' && <CoursesView courses={data.courses} templates={data.templates} onOpen={(id) => openCourse(id)} onStudy={(id) => openCourse(id, 'study')} onTeach={beginTeaching} onDuplicate={duplicateCourse} onDelete={deleteCourse} onSaveTemplate={saveTemplate} onCreate={() => setShowCreateCourse(true)} />}
        {view === 'settings' && <SettingsView data={data} onSettings={(settings) => update((current) => ({ ...current, settings }))} onExport={exportBackup} onSelectBackup={selectBackup} />}
      </main>
      <BottomNav view={view} onNavigate={navigate} />
      {showCreateCourse && <CreateCourseModal templates={data.templates} onClose={() => setShowCreateCourse(false)} onSave={saveNewCourse} />}
      {showExercisePicker && <ExercisePickerModal exercises={data.exercises} mode={pickerMode} onClose={() => { setShowExercisePicker(false); setReplaceTargetId(null) }} onPick={pickerMode === 'add' ? addExerciseToCourse : replaceExerciseInCourse} />}
      {exerciseEditor && <ExerciseModal exercise={exerciseEditor} onClose={() => setExerciseEditor(null)} onSave={(exercise) => saveExercise(exercise, data.exercises.some((item) => item.id === exercise.id) ? exercise.id : undefined)} onDelete={exerciseEditor.isCustom ? deleteExercise : undefined} />}
      {pendingBackup && <BackupImportModal backup={pendingBackup} onClose={() => setPendingBackup(null)} onImport={importBackup} />}
      {toast && <Toast message={toast} onClose={() => setToast('')} />}
      {loadError && <div className="storage-banner">{loadError}</div>}
    </div>
  )
}

function LoadingScreen({ error }: { error?: string }) {
  return <div className="loading-screen"><div className="brand-mark large">P</div><h1>正在準備你的備課空間</h1><p>{error || '資料只會儲存在此裝置。'}</p><div className="loading-dots"><i /><i /><i /></div></div>
}

function BottomNav({ view, onNavigate }: { view: AppView; onNavigate: (view: AppView) => void }) {
  return <nav className="bottom-nav" aria-label="主要導覽">{navItems.map(({ view: itemView, label, icon: Icon }) => <button key={itemView} className={classNames('nav-item', view === itemView && 'active')} onClick={() => onNavigate(itemView)}><Icon size={21} /><span>{label}</span></button>)}<button className={classNames('nav-item', view === 'settings' && 'active')} onClick={() => onNavigate('settings')}><SettingsIcon size={21} /><span>設定</span></button></nav>
}

function Toast({ message, onClose }: { message: string; onClose: () => void }) {
  return <div className="toast" role="status"><span>{message}</span><button className="toast-close" onClick={onClose} aria-label="關閉訊息"><CloseIcon size={16} /></button></div>
}

function Tag({ children, tone = 'soft' }: { children: ReactNode; tone?: 'soft' | 'accent' | 'danger' | 'muted' }) { return <span className={`tag tag-${tone}`}>{children}</span> }

function SectionTitle({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: ReactNode }) {
  return <div className="section-title"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2></div>{action}</div>
}

function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description: string; action?: ReactNode }) {
  return <div className="empty-state">{icon && <div className="empty-icon">{icon}</div>}<h3>{title}</h3><p>{description}</p>{action}</div>
}

function TodayView({ data, onCreate, onOpenCourse, onStudy, onTeach, onNavigate }: { data: AppData; onCreate: () => void; onOpenCourse: (id: string) => void; onStudy: (id: string) => void; onTeach: (id: string) => void; onNavigate: (view: AppView) => void }) {
  const today = localDateIso()
  const todayCourse = data.courses.find((course) => course.date === today) ?? data.courses.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
  const recentCourses = data.courses.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, 4)
  return <div className="view-stack today-view">
    <section className="welcome-row"><div><span className="eyebrow">{formatDate(today)}</span><h1>今天要教什麼？</h1><p>把備課變成幾個清楚、快速的選擇。</p></div><button className="primary-button desktop-create" onClick={onCreate}><PlusIcon size={18} /> 新增課程</button></section>
    <section className="today-hero card-surface">
      <div className="hero-copy"><div className="eyebrow">今日課程</div>{todayCourse ? <><h2>{todayCourse.title}</h2><div className="hero-meta"><span>{todayCourse.time || '時間未設定'}</span><span>{todayCourse.apparatus}</span><span>{todayCourse.level}</span><span>{todayCourse.durationMinutes} 分鐘</span><span>{todayCourse.exercises.length} 個動作</span></div><div className="hero-actions"><button className="primary-button" onClick={() => onTeach(todayCourse.id)}><PlayIcon size={17} /> 開始帶課</button><button className="secondary-button" onClick={() => onStudy(todayCourse.id)}><BrainIcon size={17} /> 開始背課</button><button className="text-button" onClick={() => onOpenCourse(todayCourse.id)}>查看課表 <ArrowRightIcon size={16} /></button></div></> : <><h2>還沒有今天的課程</h2><p>建立第一堂課，從動作庫挑選並排好順序。</p><button className="primary-button" onClick={onCreate}><PlusIcon size={17} /> 建立第一堂課</button></>}</div>
      <div className="hero-orbit"><div className="orbit-ring ring-one" /><div className="orbit-ring ring-two" /><div className="orbit-center"><span>{todayCourse ? todayCourse.exercises.length : 0}</span><small>動作</small></div></div>
    </section>
    <div className="dashboard-grid">
      <section className="card-surface recent-panel"><SectionTitle eyebrow="最近使用" title="最近編輯" action={<button className="text-button" onClick={() => onNavigate('courses')}>全部課表 <ArrowRightIcon size={15} /></button>} />{recentCourses.length ? <div className="recent-list">{recentCourses.map((course) => <button className="recent-course" key={course.id} onClick={() => onOpenCourse(course.id)}><div className="recent-date">{formatCompactDate(course.date)}</div><div className="recent-course-main"><strong>{course.title}</strong><span>{course.apparatus} · {course.level} · {course.exercises.length} 個動作</span></div><ArrowRightIcon size={17} /></button>)}</div> : <EmptyState title="還沒有建立任何課程" description="從第一堂課開始累積你的教學資料。" action={<button className="secondary-button" onClick={onCreate}>建立第一堂課</button>} />}</section>
      <section className="card-surface quick-panel"><SectionTitle eyebrow="不用找" title="快速功能" /><div className="quick-grid"><button onClick={onCreate}><span className="quick-icon warm"><PlusIcon /></span><strong>新增課程</strong><small>從零開始排課</small></button><button onClick={() => onNavigate('planner')}><span className="quick-icon green"><PlannerIcon /></span><strong>快速排課</strong><small>繼續上次備課</small></button><button onClick={() => onNavigate('study')}><span className="quick-icon purple"><BrainIcon /></span><strong>開始背課</strong><small>測試動作順序</small></button><button onClick={() => onNavigate('library')}><span className="quick-icon blue"><SearchIcon /></span><strong>動作搜尋</strong><small>找下一個動作</small></button></div></section>
    </div>
    <section className="offline-note"><CheckIcon size={16} /><span>資料只儲存在此裝置，離線時也可以備課、背課與帶課。</span><button onClick={() => onNavigate('settings')}>備份資料</button></section>
  </div>
}

function PlannerLanding({ courses, templates, onCreate, onOpen }: { courses: Course[]; templates: Template[]; onCreate: () => void; onOpen: (id: string) => void; onUseTemplate: (id: string) => void }) {
  return <div className="view-stack"><section className="welcome-row"><div><span className="eyebrow">備課工作台</span><h1>準備下一堂好課</h1><p>先設定課程條件，再從動作庫快速加入。</p></div><button className="primary-button" onClick={onCreate}><PlusIcon size={18} /> 新增課程</button></section><div className="planner-landing-grid"><div className="card-surface"><SectionTitle title="最近課表" action={<Tag>{courses.length} 堂</Tag>} />{courses.slice(0, 3).map((course) => <button className="course-mini-row" key={course.id} onClick={() => onOpen(course.id)}><div><strong>{course.title}</strong><span>{formatCompactDate(course.date)} · {course.durationMinutes} 分鐘</span></div><ArrowRightIcon size={17} /></button>)}{!courses.length && <EmptyState title="還沒有課表" description="建立一堂課，開始把自己的教學流程留下來。" action={<button className="secondary-button" onClick={onCreate}>建立課表</button>} />}</div><div className="card-surface"><SectionTitle title="模板" action={<Tag>{templates.length} 個</Tag>} />{templates.length ? templates.slice(0, 3).map((template) => <div className="template-mini-row" key={template.id}><div><strong>{template.name}</strong><span>{template.description}</span></div><button className="small-button" onClick={onCreate}>使用</button></div>) : <EmptyState title="把好用的課留下來" description="在課表中儲存模板，下次五分鐘內開始修改。" />}</div></div></div>
}

function ExerciseLibraryCard({ exercise, usageCount, onToggleFavorite, onEdit, compact = false, onPick }: { exercise: Exercise; usageCount: number; onToggleFavorite?: () => void; onEdit?: () => void; compact?: boolean; onPick?: () => void }) {
  return <article className={classNames('exercise-card', compact && 'exercise-card-compact')}><div className="exercise-card-top"><div className="exercise-index-mark">{exercise.nameEn.slice(0, 1).toUpperCase() || 'P'}</div><div className="exercise-card-title"><strong>{exercise.nameZh || '未命名動作'}</strong><span>{exercise.nameEn || 'Custom exercise'}</span></div>{onToggleFavorite && <button className={classNames('star-button', exercise.isFavorite && 'selected')} aria-label={exercise.isFavorite ? '取消收藏' : '收藏'} onClick={onToggleFavorite}><StarIcon size={18} filled={exercise.isFavorite} /></button>}</div><div className="tag-row"><Tag tone="accent">{exercise.apparatus}</Tag><Tag>{exercise.level}</Tag>{exercise.primaryAreas.slice(0, 2).map((area) => <Tag key={area}>{area}</Tag>)}</div><div className="exercise-facts"><span><b>⏱</b> {formatSeconds(exercise.suggestedSeconds)}</span><span><b>Spring</b> {exercise.spring || '—'}</span><span><b>使用</b> {usageCount} 次</span></div>{!compact && <div className="exercise-card-bottom"><span className="muted-text">{exercise.startPositions.join('、') || '姿勢未設定'}{exercise.usesBox ? ' · Box' : ''}</span><div className="row-actions">{onEdit && <button className="small-button" onClick={onEdit}><EditIcon size={14} /> 編輯</button>}{onPick && <button className="small-button primary-small" onClick={onPick}><PlusIcon size={15} /> 加入</button>}</div></div>}{compact && onPick && <button className="compact-pick-button" onClick={onPick}><PlusIcon size={16} /> 加入課表</button>}</article>
}

function LibraryView({ exercises, usageHistory, onToggleFavorite, onEdit, onCreate }: { exercises: Exercise[]; usageHistory: AppData['usageHistory']; onToggleFavorite: (id: string) => void; onEdit: (exercise: Exercise) => void; onCreate: () => void }) {
  const [query, setQuery] = useState('')
  const [filters, setFilters] = useState<ExerciseFilters>({ apparatus: '全部', level: '全部', bodyArea: '全部', position: '全部', favoritesOnly: false })
  const usageCounts = useMemo(() => usageHistory.reduce<Record<string, number>>((counts, item) => { counts[item.exerciseId] = (counts[item.exerciseId] || 0) + 1; return counts }, {}), [usageHistory])
  const filtered = useMemo(() => exercises.filter((exercise) => {
    const needle = query.trim().toLowerCase()
    const matchesQuery = !needle || [exercise.nameZh, exercise.nameEn, ...exercise.aliases, ...exercise.primaryAreas, exercise.apparatus, exercise.level].join(' ').toLowerCase().includes(needle)
    return matchesQuery && (filters.apparatus === '全部' || exercise.apparatus === filters.apparatus) && (filters.level === '全部' || exercise.level === filters.level) && (filters.bodyArea === '全部' || [...exercise.primaryAreas, ...exercise.secondaryAreas].includes(filters.bodyArea)) && (filters.position === '全部' || exercise.startPositions.includes(filters.position)) && (!filters.favoritesOnly || exercise.isFavorite)
  }), [exercises, filters, query])
  return <div className="view-stack"><section className="welcome-row compact-welcome"><div><span className="eyebrow">{exercises.length} 個動作</span><h1>動作庫</h1><p>把你常教、常用的動作整理成自己的工具箱。</p></div><button className="primary-button" onClick={onCreate}><PlusIcon size={18} /> 新增動作</button></section><section className="library-toolbar card-surface"><div className="search-field large-search"><SearchIcon size={19} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋中文、英文、別名或部位…" /><kbd>⌘ K</kbd></div><div className="filter-row"><FilterSelect label="器械" value={filters.apparatus} options={['全部', ...APPARATUS_OPTIONS]} onChange={(value) => setFilters((current) => ({ ...current, apparatus: value as ExerciseFilters['apparatus'] }))} /><FilterSelect label="程度" value={filters.level} options={['全部', ...LEVEL_OPTIONS]} onChange={(value) => setFilters((current) => ({ ...current, level: value as ExerciseFilters['level'] }))} /><FilterSelect label="部位" value={filters.bodyArea} options={['全部', ...BODY_AREA_OPTIONS]} onChange={(value) => setFilters((current) => ({ ...current, bodyArea: value as ExerciseFilters['bodyArea'] }))} /><FilterSelect label="姿勢" value={filters.position} options={['全部', ...POSITION_OPTIONS]} onChange={(value) => setFilters((current) => ({ ...current, position: value as ExerciseFilters['position'] }))} /><button className={classNames('filter-favorite', filters.favoritesOnly && 'active')} onClick={() => setFilters((current) => ({ ...current, favoritesOnly: !current.favoritesOnly }))}><StarIcon size={16} filled={filters.favoritesOnly} /> 我的收藏</button></div></section><div className="results-summary"><span>顯示 {filtered.length} 個動作</span>{query || filters.apparatus !== '全部' || filters.level !== '全部' || filters.bodyArea !== '全部' || filters.position !== '全部' || filters.favoritesOnly ? <button className="text-button" onClick={() => { setQuery(''); setFilters({ apparatus: '全部', level: '全部', bodyArea: '全部', position: '全部', favoritesOnly: false }) }}>清除篩選</button> : <span className="muted-text">即時篩選</span>}</div>{filtered.length ? <div className="exercise-grid">{filtered.map((exercise) => <ExerciseLibraryCard key={exercise.id} exercise={exercise} usageCount={usageCounts[exercise.id] || 0} onToggleFavorite={() => onToggleFavorite(exercise.id)} onEdit={() => onEdit(exercise)} />)}</div> : <EmptyState icon={<SearchIcon size={26} />} title="找不到符合條件的動作" description="試試清除部分標籤，或建立一個自己的動作。" action={<button className="secondary-button" onClick={onCreate}>新增自訂動作</button>} />}</div>
}

function FilterSelect({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <label className="filter-select"><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option}>{option}</option>)}</select><ChevronDownIcon size={14} /></label>
}

/* editor implementation */

function CourseEditorView({ course, exercises, settings, onBack, onUpdateCourse, onSaveDefaultCue, onOpenPicker, onStudy, onTeach, onDuplicate, onSaveTemplate, onDelete, onAddSection, onNotify }: { course: Course; exercises: Exercise[]; settings: AppSettings; onBack: () => void; onUpdateCourse: (id: string, updater: (course: Course) => Course, message?: string) => void; onSaveDefaultCue: (exerciseId: string, cue: Cue) => void; onOpenPicker: (mode: 'add' | 'replace', targetId?: string) => void; onStudy: () => void; onTeach: () => void; onDuplicate: () => void; onSaveTemplate: () => void; onDelete: () => void; onAddSection: (section: Section) => void; onNotify: (message: string) => void }) {
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [scriptOpen, setScriptOpen] = useState(false)
  const longPressTimer = useRef<number | null>(null)
  const ordered = useMemo(() => course.exercises.slice().sort((a, b) => a.order - b.order), [course.exercises])
  const totalSeconds = estimateCourseSeconds(course)
  const overTime = totalSeconds > course.durationMinutes * 60
  const exerciseById = new Map(exercises.map((exercise) => [exercise.id, exercise]))
  const updateItem = (itemId: string, patch: Partial<CourseExercise>) => onUpdateCourse(course.id, (current) => ({ ...current, exercises: current.exercises.map((item) => item.id === itemId ? { ...item, ...patch } : item) }))
  const reorder = (fromId: string, toId: string) => {
    if (fromId === toId) return
    onUpdateCourse(course.id, (current) => {
      const items = current.exercises.slice().sort((a, b) => a.order - b.order)
      const from = items.findIndex((item) => item.id === fromId)
      const to = items.findIndex((item) => item.id === toId)
      if (from < 0 || to < 0) return current
      const [moved] = items.splice(from, 1)
      items.splice(to, 0, moved)
      return { ...current, exercises: items.map((item, index) => ({ ...item, order: index })) }
    })
  }
  const moveItem = (itemId: string, direction: -1 | 1) => { const index = ordered.findIndex((item) => item.id === itemId); const target = ordered[index + direction]; if (target) reorder(itemId, target.id) }
  const removeItem = (itemId: string) => { if (!window.confirm('確定要從本堂課移除這個動作嗎？')) return; onUpdateCourse(course.id, (current) => ({ ...current, exercises: current.exercises.filter((item) => item.id !== itemId).map((item, index) => ({ ...item, order: index })) }), '動作已從課表移除。') }
  const duplicateItem = (itemId: string) => onUpdateCourse(course.id, (current) => { const source = current.exercises.find((item) => item.id === itemId); if (!source) return current; const copy = { ...clone(source), id: newId('course-exercise'), order: source.order + 1 }; return { ...current, exercises: current.exercises.map((item) => item.order > source.order ? { ...item, order: item.order + 1 } : item).concat(copy) } }, '動作已複製。')
  const addSection = () => onAddSection({ id: newId('section'), title: `新段落 ${course.sections.length + 1}`, accent: SECTION_COLORS[course.sections.length % SECTION_COLORS.length] })
  const renameSection = (section: Section) => { const title = window.prompt('段落名稱', section.title); if (title?.trim()) onUpdateCourse(course.id, (current) => ({ ...current, sections: current.sections.map((item) => item.id === section.id ? { ...item, title: title.trim() } : item) })) }
  const moveSection = (sectionId: string, direction: -1 | 1) => onUpdateCourse(course.id, (current) => { const sections = current.sections.slice(); const index = sections.findIndex((section) => section.id === sectionId); const target = index + direction; if (index < 0 || target < 0 || target >= sections.length) return current; [sections[index], sections[target]] = [sections[target], sections[index]]; return { ...current, sections } })
  const setField = (field: keyof Course, value: string | number) => onUpdateCourse(course.id, (current) => ({ ...current, [field]: value }))
  const startTouchSort = (event: PointerEvent, itemId: string) => {
    if (event.pointerType === 'mouse') return
    event.currentTarget.setPointerCapture?.(event.pointerId)
    longPressTimer.current = window.setTimeout(() => setDraggingId(itemId), 350)
  }
  const moveTouchSort = (event: PointerEvent) => {
    if (!draggingId) return
    event.preventDefault()
    const target = document.elementsFromPoint(event.clientX, event.clientY).find((element) => element.getAttribute('data-sortable-id'))
    const targetId = target?.getAttribute('data-sortable-id')
    if (targetId && targetId !== draggingId) reorder(draggingId, targetId)
  }
  const endTouchSort = () => {
    if (longPressTimer.current) window.clearTimeout(longPressTimer.current)
    longPressTimer.current = null
    setDraggingId(null)
  }
  const renderItem = (item: CourseExercise, index: number) => {
    const exercise = exerciseById.get(item.exerciseId)
    const expanded = expandedId === item.id
    return <article className={classNames('sortable-card', draggingId === item.id && 'dragging')} data-sortable-id={item.id} key={item.id} draggable onDragStart={() => setDraggingId(item.id)} onDragEnd={() => endTouchSort()} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggingId) reorder(draggingId, item.id); endTouchSort() }}><div className="drag-handle" title="長按拖曳排序" onPointerDown={(event) => startTouchSort(event, item.id)} onPointerMove={moveTouchSort} onPointerUp={endTouchSort} onPointerCancel={endTouchSort}><DragIcon size={18} /></div><div className="course-number">{String(index + 1).padStart(2, '0')}</div><div className="sortable-main"><div className="sortable-heading"><div><strong>{getCourseExerciseTitle(item)}</strong><span>{getCourseExerciseLabel(item)}</span></div><div className="sortable-actions"><Tag tone="accent">{item.snapshot.apparatus}</Tag><button className="familiarity-dot" onClick={() => updateItem(item.id, { familiarity: item.familiarity === 'familiar' ? 'unsure' : item.familiarity === 'unsure' ? 'new' : 'familiar' })}>{item.familiarity === 'familiar' ? '😊' : item.familiarity === 'unsure' ? '😐' : '😵'}</button><button className="icon-button subtle" onClick={() => setExpandedId(expanded ? null : item.id)} aria-label="展開編輯">{expanded ? <ChevronUpIcon size={18} /> : <ChevronDownIcon size={18} />}</button></div></div><div className="sortable-facts"><span><b>Spring</b> {item.spring || '—'}</span><span><b>次數</b> {item.reps || '—'}</span><span><b>時間</b> {formatSeconds(item.durationSeconds)}</span><span><b>段落</b> {course.sections.find((section) => section.id === item.sectionId)?.title || '未分類'}</span></div>{expanded && <div className="course-item-editor"><div className="inline-fields"><label>次數／組數<input value={item.reps} onChange={(event) => updateItem(item.id, { reps: event.target.value })} /></label><label>秒數<input type="number" min="0" value={item.durationSeconds} onChange={(event) => updateItem(item.id, { durationSeconds: Number(event.target.value) || 0 })} /></label><label>Spring<input value={item.spring} onChange={(event) => updateItem(item.id, { spring: event.target.value })} /></label><label>Footbar<input value={item.footbar} onChange={(event) => updateItem(item.id, { footbar: event.target.value })} /></label><label>Headrest<input value={item.headrest} onChange={(event) => updateItem(item.id, { headrest: event.target.value })} /></label><label>課程段落<select value={item.sectionId} onChange={(event) => updateItem(item.id, { sectionId: event.target.value })}>{course.sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}</select></label></div><label className="full-field">本堂課備註<textarea rows={2} value={item.note} onChange={(event) => updateItem(item.id, { note: event.target.value })} placeholder="例如：左側先做、學生需要減少幅度…" /></label><div className="cue-editor"><div className="editor-subtitle"><span>Cue／口令</span><small>本堂課自訂，不會改動資料庫預設</small></div><div className="cue-grid">{cueFields.map(([key, label]) => <label key={key}>{label}<textarea rows={2} value={item.cue[key]} onChange={(event) => updateItem(item.id, { cue: { ...item.cue, [key]: event.target.value } })} /></label>)}</div><button className="text-button" onClick={() => { if (!exercise) return; updateItem(item.id, { cue: clone(exercise.defaultCue) }); onNotify('已還原資料庫預設 Cue。') }}>還原資料庫預設 Cue</button></div><div className="editor-footer"><button className="small-button" onClick={() => { onSaveDefaultCue(item.exerciseId, item.cue) }}>儲存成我的預設 Cue</button><div className="row-actions"><button className="icon-text-button" onClick={() => moveItem(item.id, -1)} disabled={index === 0}><ChevronUpIcon size={15} /> 上移</button><button className="icon-text-button" onClick={() => moveItem(item.id, 1)} disabled={index === ordered.length - 1}><ChevronDownIcon size={15} /> 下移</button><button className="icon-text-button" onClick={() => duplicateItem(item.id)}><CopyIcon size={15} /> 複製</button><button className="icon-text-button" onClick={() => onOpenPicker('replace', item.id)}><ArrowRightIcon size={15} /> 替換</button><button className="icon-text-button danger-text" onClick={() => removeItem(item.id)}><TrashIcon size={15} /> 移除</button></div></div></div>}</div></article>
  }
  return <div className="view-stack planner-view"><div className="editor-topline"><button className="back-button" onClick={onBack}><ArrowLeftIcon size={18} /> 返回</button><div className="editor-top-actions"><button className="secondary-button" onClick={() => setScriptOpen(true)}>查看完整腳本</button><button className="secondary-button" onClick={onStudy}><BrainIcon size={16} /> 背課</button><button className="primary-button" onClick={onTeach}><PlayIcon size={16} /> 開始帶課</button></div></div><section className="course-header-card card-surface"><div className="course-title-edit"><span className="eyebrow">課程設定</span><input className="course-title-input" value={course.title} onChange={(event) => setField('title', event.target.value)} /><span className="saved-indicator"><CheckIcon size={14} /> 自動儲存</span></div><div className="course-fields-grid"><label>日期<input type="date" value={course.date} onChange={(event) => setField('date', event.target.value)} /></label><label>時間<input type="time" value={course.time} onChange={(event) => setField('time', event.target.value)} /></label><label>課程長度（分鐘）<input type="number" min="1" value={course.durationMinutes} onChange={(event) => setField('durationMinutes', Number(event.target.value) || 1)} /></label><label>器械<select value={course.apparatus} onChange={(event) => setField('apparatus', event.target.value)}>{APPARATUS_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label><label>程度<select value={course.level} onChange={(event) => setField('level', event.target.value)}>{LEVEL_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label><label>課程主題<input value={course.theme} onChange={(event) => setField('theme', event.target.value)} placeholder="例如：臀腿＋核心" /></label><label>學生類型<input value={course.studentType} onChange={(event) => setField('studentType', event.target.value)} placeholder="例如：一對一／一般小班" /></label><label>備註<input value={course.notes} onChange={(event) => setField('notes', event.target.value)} placeholder="這堂課想記住什麼？" /></label></div></section><div className="planner-summary-row"><div className={classNames('time-meter card-surface', overTime && 'is-over')}><div><span className="eyebrow">課程時間</span><strong>{formatSeconds(totalSeconds)} <small>/ {course.durationMinutes} 分鐘</small></strong></div><div className="meter-track"><span style={{ width: `${Math.min(100, percentage(totalSeconds, course.durationMinutes * 60))}%` }} /></div><span className="meter-label">{overTime ? '超過設定時間，仍可儲存' : `${Math.max(0, course.durationMinutes * 60 - totalSeconds) / 60} 分鐘可安排`}</span></div><div className="course-actions-card card-surface"><button onClick={() => onOpenPicker('add')}><PlusIcon size={17} /> 加入動作</button><button onClick={addSection}><PlannerIcon size={17} /> 新增段落</button><button onClick={onSaveTemplate}><CoursesIcon size={17} /> 儲存模板</button><button onClick={onDuplicate}><CopyIcon size={17} /> 複製課表</button></div></div><AnalysisPanel course={course} /><section className="section-list"><div className="section-list-title"><div><span className="eyebrow">課程流程</span><h2>{course.exercises.length} 個動作</h2></div><span className="muted-text">桌面可拖曳排序；手機可用每張卡的上下移動</span></div>{course.sections.map((section, sectionIndex) => { const sectionItems = ordered.filter((item) => item.sectionId === section.id); return <div className="section-block" key={section.id} onDragOver={(event) => event.preventDefault()} onDrop={() => { if (draggingId) { updateItem(draggingId, { sectionId: section.id }); setDraggingId(null) } }}><div className="section-heading"><span className="section-color" style={{ background: section.accent }} /><div><strong>{section.title}</strong><small>{sectionItems.length} 個動作</small></div><div className="section-heading-actions"><button className="icon-button subtle" onClick={() => moveSection(section.id, -1)} disabled={sectionIndex === 0}><ChevronUpIcon size={16} /></button><button className="icon-button subtle" onClick={() => moveSection(section.id, 1)} disabled={sectionIndex === course.sections.length - 1}><ChevronDownIcon size={16} /></button><button className="icon-text-button" onClick={() => renameSection(section)}><EditIcon size={14} /> 編輯名稱</button></div></div>{sectionItems.length ? sectionItems.map((item) => renderItem(item, ordered.findIndex((entry) => entry.id === item.id))) : <div className="section-drop-empty">把動作拖到這裡，或在動作卡片選擇段落。</div>}</div>})}{!course.exercises.length && <EmptyState icon={<PlannerIcon size={28} />} title="課表還是空的" description="從動作庫挑選第一個動作，接著排出流程。" action={<button className="primary-button" onClick={() => onOpenPicker('add')}><PlusIcon size={17} /> 挑選動作</button>} />}</section><div className="danger-zone"><button className="text-button danger-text" onClick={onDelete}><TrashIcon size={16} /> 刪除這堂課</button><span>刪除前建議先匯出備份。</span></div>{scriptOpen && <ScriptModal course={course} onClose={() => setScriptOpen(false)} settings={settings} />}</div>
}

function AnalysisPanel({ course }: { course: Course }) {
  const areaCounts = course.exercises.flatMap((item) => item.snapshot.primaryAreas).reduce<Record<string, number>>((counts, area) => { counts[area] = (counts[area] || 0) + 1; return counts }, {})
  const positionCounts = course.exercises.flatMap((item) => item.snapshot.startPositions).reduce<Record<string, number>>((counts, position) => { counts[position] = (counts[position] || 0) + 1; return counts }, {})
  const total = course.exercises.length
  const topAreas = Object.entries(areaCounts).sort((a, b) => b[1] - a[1]).slice(0, 4)
  const topPositions = Object.entries(positionCounts).sort((a, b) => b[1] - a[1]).slice(0, 3)
  const longestPosition = Object.entries(positionCounts).sort((a, b) => b[1] - a[1])[0]
  const consecutive = course.exercises.reduce<{ value: string; count: number; best: { value: string; count: number } }>((result, item) => { const position = item.snapshot.startPositions[0] || '未設定'; if (result.value === position) result.count += 1; else { result.value = position; result.count = 1 } if (result.count > result.best.count) result.best = { value: position, count: result.count }; return result }, { value: '', count: 0, best: { value: '', count: 0 } }).best
  const wristCount = course.exercises.filter((item) => item.snapshot.specialConditions.includes('手腕負重')).length
  return <section className="analysis-panel card-surface"><div className="analysis-heading"><div><span className="eyebrow">快速檢視</span><h3>課程結構</h3></div><span className="muted-text">只提醒，不限制你的安排</span></div>{total ? <div className="analysis-content"><div className="analysis-bars"><strong>訓練重點</strong>{topAreas.map(([label, count]) => <div className="analysis-bar" key={label}><div><span>{label}</span><b>{percentage(count, total)}%</b></div><div className="bar-track"><span style={{ width: `${percentage(count, total)}%` }} /></div></div>)}</div><div className="analysis-bars"><strong>起始姿勢</strong>{topPositions.map(([label, count]) => <div className="analysis-bar" key={label}><div><span>{label}</span><b>{percentage(count, total)}%</b></div><div className="bar-track violet"><span style={{ width: `${percentage(count, total)}%` }} /></div></div>)}</div><div className="analysis-notices">{consecutive.count >= 4 && <div className="notice-pill"><span>↗</span> 目前連續 {consecutive.count} 個動作為{consecutive.value}</div>}{wristCount >= 3 && <div className="notice-pill warning"><span>!</span> 本堂課有 {wristCount} 個手腕負重動作</div>}{longestPosition && <div className="muted-text small">最常見姿勢：{longestPosition[0]}</div>}</div></div> : <p className="muted-text">加入動作後會在這裡看到課程比例與提醒。</p>}</section>
}

function StudyView({ courses, activeCourseId, settings, onSelectCourse, onBack, onTeach, onUpdateCourse, onNotify }: { courses: Course[]; activeCourseId: string | null; settings: AppSettings; onSelectCourse: (id: string) => void; onBack: () => void; onTeach: (id: string) => void; onUpdateCourse: (id: string, updater: (course: Course) => Course, message?: string) => void; onNotify: (message: string) => void }) {
  const course = courses.find((item) => item.id === activeCourseId) ?? courses[0]
  const [mode, setMode] = useState<StudyMode>('sequence')
  const [index, setIndex] = useState(0)
  const [revealed, setRevealed] = useState(false)
  const [showCue, setShowCue] = useState(false)
  useEffect(() => { setIndex(0); setRevealed(false); setShowCue(false) }, [activeCourseId, mode])
  if (!course) return <div className="view-stack"><EmptyState icon={<BrainIcon size={30} />} title="還沒有可以背的課表" description="先建立一堂課，再用三種模式測試自己的記憶。" action={<button className="primary-button" onClick={onBack}>返回首頁</button>} /></div>
  const items = course.exercises.slice().sort((a, b) => a.order - b.order)
  const item = items[index]
  const next = items[index + 1]
  const prev = items[index - 1]
  const go = (nextIndex: number) => { setIndex(Math.max(0, Math.min(items.length - 1, nextIndex))); setRevealed(false); setShowCue(false) }
  const mark = (familiarity: Familiarity) => onUpdateCourse(course.id, (current) => ({ ...current, exercises: current.exercises.map((courseItem) => courseItem.id === item.id ? { ...courseItem, familiarity } : courseItem) }))
  const speak = () => { if (!('speechSynthesis' in window)) { onNotify('此瀏覽器不支援語音朗讀。'); return } window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(next ? `下一個動作，${getCourseExerciseLabel(next)}` : '課程結束')) }
  return <div className="view-stack study-view"><div className="study-header"><button className="back-button" onClick={onBack}><ArrowLeftIcon size={18} /> 返回</button><div className="study-course-select"><span className="eyebrow">正在背課</span><select value={course.id} onChange={(event) => onSelectCourse(event.target.value)}>{courses.slice().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map((option) => <option key={option.id} value={option.id}>{option.title}</option>)}</select></div><button className="secondary-button" onClick={() => onTeach(course.id)}><PlayIcon size={16} /> 帶課模式</button></div><div className="study-mode-tabs"><button className={mode === 'sequence' ? 'active' : ''} onClick={() => setMode('sequence')}><ArrowRightIcon size={17} /> 順序背誦</button><button className={mode === 'recall' ? 'active' : ''} onClick={() => setMode('recall')}><BrainIcon size={17} /> 隱藏答案</button><button className={mode === 'cue' ? 'active' : ''} onClick={() => setMode('cue')}><VolumeIcon size={17} /> Cue 背誦</button></div><section className="study-stage card-surface"><div className="study-progress"><span>第 {index + 1} / {items.length} 個動作</span><div className="progress-line"><span style={{ width: `${percentage(index + 1, items.length)}%` }} /></div><span>{course.durationMinutes} 分鐘課表</span></div><div className="study-main"><div className="study-kicker">{mode === 'sequence' ? '順序背誦' : mode === 'recall' ? '先想一想' : '先自己講 Cue'}</div><h1>{getCourseExerciseTitle(item)}</h1><p className="study-english">{getCourseExerciseLabel(item)}</p><div className="study-tags"><Tag tone="accent">{item.snapshot.apparatus}</Tag><Tag>{item.snapshot.level}</Tag><Tag>{item.reps}</Tag></div>{mode === 'sequence' && <div className="study-answer-box"><span>下一個動作</span><strong>{revealed ? (next ? getCourseExerciseTitle(next) : '課程結束') : '先在心中說出答案，再按下顯示'}</strong>{revealed && next && <small>{getCourseExerciseLabel(next)}</small>}<button className="secondary-button" onClick={() => setRevealed(!revealed)}>{revealed ? '隱藏答案' : '顯示下一個'}</button></div>}{mode === 'recall' && <div className="study-answer-box recall-box"><span>問題</span><strong>下一個動作是什麼？</strong>{revealed ? <div className="revealed-answer"><b>{next ? getCourseExerciseTitle(next) : '課程結束'}</b><small>{next?.snapshot.nameEn}</small></div> : <button className="primary-button" onClick={() => setRevealed(true)}>顯示答案</button>}</div>}{mode === 'cue' && <div className="study-answer-box cue-recall-box"><span>先自己講完，再對照你的口令</span>{showCue ? <CueReadout cue={item.cue} /> : <button className="primary-button" onClick={() => setShowCue(true)}>顯示 Cue</button>}</div>}</div><div className="study-bottom"><div className="familiarity-actions"><span>熟悉度</span><button className={item.familiarity === 'familiar' ? 'selected' : ''} onClick={() => mark('familiar')}>😊 熟悉</button><button className={item.familiarity === 'unsure' ? 'selected' : ''} onClick={() => mark('unsure')}>😐 普通</button><button className={item.familiarity === 'new' ? 'selected' : ''} onClick={() => mark('new')}>😵 不熟</button></div><div className="study-controls"><button className="circle-control" onClick={() => go(index - 1)} disabled={!prev} aria-label="上一個動作"><ArrowLeftIcon /></button><button className="primary-button next-control" onClick={() => go(index + 1)} disabled={!next}>下一個 <ArrowRightIcon size={17} /></button><button className="circle-control" onClick={speak} aria-label="朗讀下一個"><VolumeIcon /></button></div></div></section><p className="study-tip"><CheckIcon size={15} /> 熟悉度會保存在這堂課，下次可以優先練習「不熟」的動作。</p></div>
}

function CueReadout({ cue }: { cue: Cue }) { return <div className="cue-readout">{cueFields.filter(([key]) => cue[key]).map(([key, label]) => <div key={key}><span>{label}</span><p>{cue[key]}</p></div>)}</div> }

function TeachingView({ course, settings, onExit, onNotify, onUpdateCourse }: { course: Course; settings: AppSettings; onExit: () => void; onNotify: (message: string) => void; onUpdateCourse: (id: string, updater: (course: Course) => Course) => void }) {
  const items = course.exercises.slice().sort((a, b) => a.order - b.order)
  const [index, setIndex] = useState(0)
  const [wakeLock, setWakeLock] = useState<WakeLockSentinel | null>(null)
  const wakeLockRef = useRef<WakeLockSentinel | null>(null)
  const item = items[index]
  const next = items[index + 1]
  const move = (amount: number) => setIndex((current) => Math.max(0, Math.min(items.length - 1, current + amount)))
  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => { if (event.key === 'ArrowRight' || event.key === ' ') { event.preventDefault(); move(1) } if (event.key === 'ArrowLeft') { event.preventDefault(); move(-1) } }
    window.addEventListener('keydown', keyHandler)
    return () => window.removeEventListener('keydown', keyHandler)
  }, [])
  useEffect(() => {
    if (!settings.keepScreenAwake) return
    if (!navigator.wakeLock?.request) { onNotify('Wake Lock 在此裝置上不支援。'); return }
    let active = true
    void navigator.wakeLock.request('screen').then((lock) => { if (active) { wakeLockRef.current = lock; setWakeLock(lock) } else { void lock.release() } }).catch(() => onNotify('無法防止螢幕關閉，請保持裝置電源充足。'))
    return () => { active = false; const lock = wakeLockRef.current; wakeLockRef.current = null; setWakeLock(null); void lock?.release() }
  }, [settings.keepScreenAwake])
  const speak = () => { if (!('speechSynthesis' in window)) { onNotify('此瀏覽器不支援語音朗讀。'); return } window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(getCourseExerciseLabel(item))) }
  const mark = (familiarity: Familiarity) => onUpdateCourse(course.id, (current) => ({ ...current, exercises: current.exercises.map((courseItem) => courseItem.id === item.id ? { ...courseItem, familiarity } : courseItem) }))
  if (!item) return <div className="teaching-screen"><button className="teach-exit" onClick={onExit}>退出帶課</button><EmptyState title="這堂課沒有動作" description="回到課表加入動作後再開始帶課。" /></div>
  return <div className={classNames('teaching-screen', `lead-${settings.leadFontSize}`)}><div className="teach-topbar"><button className="teach-exit" onClick={onExit}><CloseIcon size={20} /> 退出</button><div className="teach-course-title"><span>{course.title}</span><small>{course.apparatus} · {course.level}</small></div><div className="teach-tools"><span>{index + 1} / {items.length}</span><button className="teach-icon-button" onClick={speak} aria-label="朗讀目前動作"><VolumeIcon /></button><button className="teach-icon-button" onClick={() => { void document.documentElement.requestFullscreen?.() }} aria-label="全螢幕"><MaximizeIcon /></button></div></div><div className="teach-progress"><span style={{ width: `${percentage(index + 1, items.length)}%` }} /></div><button className="teach-tap-zone left" onClick={() => move(-1)} aria-label="上一個動作" /><button className="teach-tap-zone right" onClick={() => move(1)} aria-label="下一個動作" /><main className="teach-main"><div className="teach-index">{String(index + 1).padStart(2, '0')} <span>/ {String(items.length).padStart(2, '0')}</span></div><h1>{getCourseExerciseLabel(item)}</h1><h2>{getCourseExerciseTitle(item)}</h2><div className="teach-setup"><div><span>Spring</span><strong>{item.spring || '—'}</strong></div><div><span>次數</span><strong>{item.reps || '—'}</strong></div><div><span>Footbar</span><strong>{item.footbar || '—'}</strong></div></div>{settings.showCueInTeaching && <div className="teach-cue"><span className="teach-label">今日 Cue</span><div className="teach-cue-grid">{[item.cue.preparation, item.cue.breathing, item.cue.core, item.cue.movement, item.cue.correction].filter(Boolean).map((cue, cueIndex) => <p key={`${cue}-${cueIndex}`}><i />{cue}</p>)}</div></div>}{settings.showNextInTeaching && <div className="teach-next"><span>下一個</span><strong>{next ? getCourseExerciseLabel(next) : '課程結束'}</strong></div>}<div className="teach-familiarity"><button className={item.familiarity === 'familiar' ? 'selected' : ''} onClick={() => mark('familiar')}>😊</button><button className={item.familiarity === 'unsure' ? 'selected' : ''} onClick={() => mark('unsure')}>😐</button><button className={item.familiarity === 'new' ? 'selected' : ''} onClick={() => mark('new')}>😵</button></div></main><div className="teach-bottom"><button onClick={() => move(-1)} disabled={index === 0}><ArrowLeftIcon size={23} /> 上一個</button><button onClick={() => move(1)} disabled={!next}>下一個 <ArrowRightIcon size={23} /></button></div></div>
}

function CoursesView({ courses, templates, onOpen, onStudy, onTeach, onDuplicate, onDelete, onSaveTemplate, onCreate }: { courses: Course[]; templates: Template[]; onOpen: (id: string) => void; onStudy: (id: string) => void; onTeach: (id: string) => void; onDuplicate: (course: Course) => void; onDelete: (course: Course) => void; onSaveTemplate: (course: Course) => void; onCreate: () => void }) {
  const [tab, setTab] = useState<'courses' | 'templates'>('courses')
  const [query, setQuery] = useState('')
  const filtered = courses.filter((course) => `${course.title} ${course.apparatus} ${course.level} ${course.theme}`.toLowerCase().includes(query.toLowerCase()))
  return <div className="view-stack"><section className="welcome-row compact-welcome"><div><span className="eyebrow">歷史與模板</span><h1>我的課表</h1><p>保留每一次備課，下一堂課從熟悉的基礎開始。</p></div><button className="primary-button" onClick={onCreate}><PlusIcon size={18} /> 新增課程</button></section><div className="segmented-tabs"><button className={tab === 'courses' ? 'active' : ''} onClick={() => setTab('courses')}>課程歷史 <span>{courses.length}</span></button><button className={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')}>我的模板 <span>{templates.length}</span></button></div>{tab === 'courses' && <><div className="search-field course-search"><SearchIcon size={18} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋課程名稱、器械或主題…" /></div>{filtered.length ? <div className="course-history-list">{filtered.map((course, index) => <CourseHistoryCard key={course.id} course={course} latest={index === 0} onOpen={() => onOpen(course.id)} onStudy={() => onStudy(course.id)} onTeach={() => onTeach(course.id)} onDuplicate={() => onDuplicate(course)} onDelete={() => onDelete(course)} onSaveTemplate={() => onSaveTemplate(course)} />)}</div> : <EmptyState title="還沒有符合的課程" description="清除搜尋，或建立你的第一堂課。" action={<button className="primary-button" onClick={onCreate}>建立課程</button>} />}</>}{tab === 'templates' && <TemplateList templates={templates} onCreate={onCreate} />}</div>
}

function CourseHistoryCard({ course, latest, onOpen, onStudy, onTeach, onDuplicate, onDelete, onSaveTemplate }: { course: Course; latest: boolean; onOpen: () => void; onStudy: () => void; onTeach: () => void; onDuplicate: () => void; onDelete: () => void; onSaveTemplate: () => void }) {
  const [menu, setMenu] = useState(false)
  return <article className="history-card card-surface"><button className="history-main" onClick={onOpen}><div className="history-date"><strong>{new Date(`${course.date}T00:00:00`).getDate()}</strong><span>{new Intl.DateTimeFormat('zh-TW', { month: 'short' }).format(new Date(`${course.date}T00:00:00`))}</span></div><div className="history-copy">{latest && <Tag tone="accent">最近編輯</Tag>}<h3>{course.title}</h3><p>{course.theme || '未設定主題'} · {course.apparatus} · {course.level}</p><div className="history-meta"><span>{course.time || '時間未設定'}</span><span>{course.durationMinutes} 分鐘</span><span>{course.exercises.length} 個動作</span></div></div><ArrowRightIcon size={19} /></button><div className="history-actions"><button onClick={onTeach}><PlayIcon size={15} /> 帶課</button><button onClick={onStudy}><BrainIcon size={15} /> 背課</button><button onClick={onDuplicate}><CopyIcon size={15} /> 複製</button><div className="more-wrap"><button onClick={() => setMenu(!menu)} aria-label="更多操作"><span>•••</span></button>{menu && <div className="popover-menu"><button onClick={onSaveTemplate}><CoursesIcon size={15} /> 儲存模板</button><button className="danger-text" onClick={onDelete}><TrashIcon size={15} /> 刪除</button></div>}</div></div></article>
}

function TemplateList({ templates, onCreate }: { templates: Template[]; onCreate: () => void }) {
  return templates.length ? <div className="template-list">{templates.map((template) => <article className="template-card card-surface" key={template.id}><div className="template-icon"><CoursesIcon size={21} /></div><div><h3>{template.name}</h3><p>{template.description}</p><span>{template.course.exercises.length} 個動作 · 更新於 {formatDateTime(template.updatedAt)}</span></div><button className="small-button primary-small" onClick={onCreate}>使用模板</button></article>)}</div> : <EmptyState icon={<CoursesIcon size={29} />} title="目前還沒有模板" description="完成一堂課後，按「儲存模板」，下次可以直接套用。" action={<button className="primary-button" onClick={onCreate}>建立課程</button>} />
}

function SettingsView({ data, onSettings, onExport, onSelectBackup }: { data: AppData; onSettings: (settings: AppSettings) => void; onExport: () => void; onSelectBackup: (event: ChangeEvent<HTMLInputElement>) => void }) {
  const settings = data.settings
  const update = (patch: Partial<AppSettings>) => onSettings({ ...settings, ...patch })
  return <div className="view-stack settings-view"><section className="welcome-row compact-welcome"><div><span className="eyebrow">只在你的裝置</span><h1>設定</h1><p>調整外觀與帶課偏好，資料不會暗中上傳。</p></div></section><div className="settings-grid"><section className="settings-section card-surface"><SectionTitle title="外觀" /><p className="setting-description">選擇你在備課時最舒服的閱讀方式。</p><div className="theme-options"><ThemeOption icon={<SunIcon />} label="淺色" active={settings.theme === 'light'} onClick={() => update({ theme: 'light' })} /><ThemeOption icon={<MoonIcon />} label="深色" active={settings.theme === 'dark'} onClick={() => update({ theme: 'dark' })} /><ThemeOption icon={<MonitorIcon />} label="跟隨系統" active={settings.theme === 'system'} onClick={() => update({ theme: 'system' })} /></div></section><section className="settings-section card-surface"><SectionTitle title="帶課模式" /><p className="setting-description">讓手機或 iPad 放在器械旁也能一眼讀到重點。</p><label className="setting-row"><span><strong>字體大小</strong><small>帶課畫面主標題</small></span><select value={settings.leadFontSize} onChange={(event) => update({ leadFontSize: event.target.value as AppSettings['leadFontSize'] })}><option value="normal">標準</option><option value="large">大字</option><option value="xlarge">超大</option></select></label><ToggleSetting label="顯示 Cue" description="帶課畫面顯示目前口令" checked={settings.showCueInTeaching} onChange={(checked) => update({ showCueInTeaching: checked })} /><ToggleSetting label="顯示下一個動作" description="避免忘記接下來的流程" checked={settings.showNextInTeaching} onChange={(checked) => update({ showNextInTeaching: checked })} /><ToggleSetting label="防止螢幕關閉" description="裝置支援時啟用 Wake Lock" checked={settings.keepScreenAwake} onChange={(checked) => update({ keepScreenAwake: checked })} /></section><section className="settings-section card-surface backup-section"><SectionTitle title="備份與還原" /><div className="privacy-callout"><CheckIcon size={18} /><div><strong>目前資料僅儲存在此裝置。</strong><span>建議定期匯出 JSON，避免清除瀏覽器資料時遺失自己的 Cue 與課表。</span></div></div><div className="backup-actions"><button className="secondary-button" onClick={onExport}><DownloadIcon size={17} /> 匯出完整備份</button><label className="secondary-button file-button"><UploadIcon size={17} /> 匯入備份<input type="file" accept="application/json,.json" onChange={onSelectBackup} /></label></div><p className="muted-text small">匯入前會先檢查版本與資料格式，並讓你選擇合併或覆蓋。</p></section><section className="settings-section card-surface"><SectionTitle title="資料摘要" /><div className="data-stats"><div><strong>{data.exercises.length}</strong><span>動作</span></div><div><strong>{data.courses.length}</strong><span>課程</span></div><div><strong>{data.templates.length}</strong><span>模板</span></div><div><strong>{data.usageHistory.length}</strong><span>使用紀錄</span></div></div><div className="version-row"><span>Pilates Prep MVP</span><span>v0.1.0 · IndexedDB · 離線優先</span></div></section></div></div>
}

function ThemeOption({ icon, label, active, onClick }: { icon: ReactNode; label: string; active: boolean; onClick: () => void }) { return <button className={classNames('theme-option', active && 'active')} onClick={onClick}>{icon}<span>{label}</span>{active && <CheckIcon size={15} />}</button> }
function ToggleSetting({ label, description, checked, onChange }: { label: string; description: string; checked: boolean; onChange: (checked: boolean) => void }) { return <label className="setting-row toggle-row"><span><strong>{label}</strong><small>{description}</small></span><input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} /><span className="toggle-control" /></label> }

function CreateCourseModal({ templates, onClose, onSave }: { templates: Template[]; onClose: () => void; onSave: (draft: CourseDraft, templateId?: string) => void }) {
  const [draft, setDraft] = useState<CourseDraft>(initialDraft)
  const [templateId, setTemplateId] = useState('')
  const update = <K extends keyof CourseDraft>(key: K, value: CourseDraft[K]) => setDraft((current) => ({ ...current, [key]: value }))
  return <Modal title="建立新課程" onClose={onClose} wide><div className="modal-intro"><span className="modal-icon warm"><PlannerIcon size={22} /></span><div><h3>先設定今天的條件</h3><p>之後可以在課程編輯頁快速挑選動作與排列流程。</p></div></div><div className="form-grid"><label className="span-two">課程名稱<input autoFocus value={draft.title} onChange={(event) => update('title', event.target.value)} placeholder="例如：初階臀腿 50 分鐘" /></label><label>日期<input type="date" value={draft.date} onChange={(event) => update('date', event.target.value)} /></label><label>上課時間<input type="time" value={draft.time} onChange={(event) => update('time', event.target.value)} /></label><label>課程長度（分鐘）<input type="number" min="1" value={draft.durationMinutes} onChange={(event) => update('durationMinutes', Number(event.target.value) || 1)} /></label><label>器械<select value={draft.apparatus} onChange={(event) => update('apparatus', event.target.value as Apparatus)}>{APPARATUS_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label><label>程度<select value={draft.level} onChange={(event) => update('level', event.target.value as Level)}>{LEVEL_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label><label>課程主題<input value={draft.theme} onChange={(event) => update('theme', event.target.value)} placeholder="例如：臀腿＋核心" /></label><label>學生類型<input value={draft.studentType} onChange={(event) => update('studentType', event.target.value)} placeholder="例如：一對一" /></label><label className="span-two">備註<textarea rows={3} value={draft.notes} onChange={(event) => update('notes', event.target.value)} placeholder="今天想特別留意什麼？" /></label></div>{templates.length > 0 && <label className="template-choice">從模板開始（選填）<select value={templateId} onChange={(event) => setTemplateId(event.target.value)}><option value="">空白課表</option>{templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select></label>}<div className="modal-actions"><button className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" onClick={() => onSave({ ...draft, title: draft.title.trim() || `${draft.level} ${draft.apparatus} 課程` }, templateId || undefined)}>建立並開始排課 <ArrowRightIcon size={17} /></button></div></Modal>
}

function ExercisePickerModal({ exercises, mode, onClose, onPick }: { exercises: Exercise[]; mode: 'add' | 'replace'; onClose: () => void; onPick: (exercise: Exercise) => void }) {
  const [query, setQuery] = useState('')
  const [apparatus, setApparatus] = useState<Apparatus | '全部'>('全部')
  const filtered = exercises.filter((exercise) => (!query || [exercise.nameZh, exercise.nameEn, ...exercise.primaryAreas].join(' ').toLowerCase().includes(query.toLowerCase())) && (apparatus === '全部' || exercise.apparatus === apparatus))
  return <Modal title={mode === 'add' ? '挑選動作' : '替換動作'} onClose={onClose} wide><div className="picker-intro"><span>{mode === 'add' ? '點一下＋，動作會直接加入本堂課。' : '依照器械、程度與訓練部位挑選相近動作。'}</span><Tag>{filtered.length} 個結果</Tag></div><div className="picker-toolbar"><div className="search-field"><SearchIcon size={18} /><input autoFocus value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜尋動作…" /></div><div className="pill-scroll">{['全部', ...APPARATUS_OPTIONS].map((option) => <button key={option} className={apparatus === option ? 'active' : ''} onClick={() => setApparatus(option as Apparatus | '全部')}>{option}</button>)}</div></div><div className="picker-grid">{filtered.map((exercise) => <ExerciseLibraryCard key={exercise.id} exercise={exercise} usageCount={0} compact onPick={() => onPick(exercise)} />)}</div>{!filtered.length && <EmptyState title="找不到動作" description="換一個搜尋詞，或先到動作庫新增自訂動作。" />}</Modal>
}

function ExerciseModal({ exercise: initial, onClose, onSave, onDelete }: { exercise: Exercise; onClose: () => void; onSave: (exercise: Exercise) => void; onDelete?: (exercise: Exercise) => void }) {
  const [exercise, setExercise] = useState<Exercise>(clone(initial))
  const [advanced, setAdvanced] = useState(false)
  const update = <K extends keyof Exercise>(key: K, value: Exercise[K]) => setExercise((current) => ({ ...current, [key]: value }))
  const toggleList = <T extends string>(key: 'primaryAreas' | 'startPositions' | 'specialConditions', value: T) => setExercise((current) => { const list = current[key] as T[]; return { ...current, [key]: list.includes(value) ? list.filter((item) => item !== value) : [...list, value] } })
  const save = () => { if (!exercise.nameZh.trim() && !exercise.nameEn.trim()) { window.alert('請至少填寫中文名稱或英文名稱。'); return } onSave({ ...exercise, nameZh: exercise.nameZh.trim(), nameEn: exercise.nameEn.trim(), aliases: exercise.aliases.flatMap((alias) => alias.split(/[,，]/).map((part) => part.trim()).filter(Boolean)) }) }
  return <Modal title={initial.nameZh || initial.nameEn ? '編輯動作' : '新增自訂動作'} onClose={onClose} wide extraClass="exercise-modal"><div className="form-grid"><label>中文名稱<input autoFocus value={exercise.nameZh} onChange={(event) => update('nameZh', event.target.value)} placeholder="例如：側躺腿部系列" /></label><label>英文名稱<input value={exercise.nameEn} onChange={(event) => update('nameEn', event.target.value)} placeholder="例如：Side Leg Series" /></label><label className="span-two">自訂別名<span className="input-hint">用逗號分隔</span><input value={exercise.aliases.join('、')} onChange={(event) => update('aliases', event.target.value.split(/[,，、]/))} placeholder="例如：側躺腿、Side Kicks" /></label><label>器械<select value={exercise.apparatus} onChange={(event) => update('apparatus', event.target.value as Apparatus)}>{APPARATUS_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label><label>難度<select value={exercise.level} onChange={(event) => update('level', event.target.value as Level)}>{LEVEL_OPTIONS.map((option) => <option key={option}>{option}</option>)}</select></label><label>動作類型<select value={exercise.movementType} onChange={(event) => update('movementType', event.target.value as Exercise['movementType'])}>{['力量', '活動度', '伸展', '穩定', '平衡', '整合'].map((option) => <option key={option}>{option}</option>)}</select></label><label>建議次數<input value={exercise.suggestedReps} onChange={(event) => update('suggestedReps', event.target.value)} /></label><label>預估秒數<input type="number" min="0" value={exercise.suggestedSeconds} onChange={(event) => update('suggestedSeconds', Number(event.target.value) || 0)} /></label><label>Spring 設定<input value={exercise.spring} onChange={(event) => update('spring', event.target.value)} placeholder="例如：2R" /></label><label>Footbar 設定<input value={exercise.footbar} onChange={(event) => update('footbar', event.target.value)} /></label><label>Headrest 設定<input value={exercise.headrest} onChange={(event) => update('headrest', event.target.value)} /></label><label className="checkbox-field"><input type="checkbox" checked={exercise.usesBox} onChange={(event) => update('usesBox', event.target.checked)} /><span>使用 Box</span></label></div><div className="chip-field"><span>主要訓練部位（可複選）</span><div className="chip-options">{BODY_AREA_OPTIONS.map((option) => <button key={option} className={exercise.primaryAreas.includes(option) ? 'active' : ''} onClick={() => toggleList('primaryAreas', option)}>{exercise.primaryAreas.includes(option) && <CheckIcon size={13} />}{option}</button>)}</div></div><div className="chip-field"><span>起始姿勢（可複選）</span><div className="chip-options">{POSITION_OPTIONS.map((option) => <button key={option} className={exercise.startPositions.includes(option) ? 'active' : ''} onClick={() => toggleList('startPositions', option)}>{exercise.startPositions.includes(option) && <CheckIcon size={13} />}{option}</button>)}</div></div><div className="cue-editor modal-cue-editor"><div className="editor-subtitle"><span>預設 Cue</span><small>加入課表後可再做「本堂課自訂」</small></div><div className="cue-grid">{cueFields.map(([key, label]) => <label key={key}>{label}<textarea rows={2} value={exercise.defaultCue[key]} onChange={(event) => update('defaultCue', { ...exercise.defaultCue, [key]: event.target.value })} /></label>)}</div></div><button className="advanced-toggle" onClick={() => setAdvanced(!advanced)}>{advanced ? <ChevronUpIcon size={16} /> : <ChevronDownIcon size={16} />} {advanced ? '收起其他欄位' : '展開其他欄位：說明、錯誤、注意事項'}</button>{advanced && <div className="advanced-fields"><label>動作流程<textarea rows={3} value={exercise.description.flow} onChange={(event) => update('description', { ...exercise.description, flow: event.target.value })} /></label><label>常見錯誤<textarea rows={3} value={exercise.commonErrors} onChange={(event) => update('commonErrors', event.target.value)} /></label><label>修正方式<textarea rows={3} value={exercise.corrections} onChange={(event) => update('corrections', event.target.value)} /></label><label>注意事項<textarea rows={3} value={exercise.cautions} onChange={(event) => update('cautions', event.target.value)} /></label><label>個人備註<textarea rows={3} value={exercise.personalNote} onChange={(event) => update('personalNote', event.target.value)} /></label></div>}<div className="modal-actions">{onDelete && <button className="text-button danger-text mr-auto" onClick={() => onDelete(exercise)}><TrashIcon size={16} /> 刪除動作</button>}<button className="secondary-button" onClick={onClose}>取消</button><button className="primary-button" onClick={save}><CheckIcon size={17} /> 儲存動作</button></div></Modal>
}

function ScriptModal({ course, onClose }: { course: Course; onClose: () => void; settings: AppSettings }) {
  return <Modal title="完整課程腳本" onClose={onClose} wide extraClass="script-modal"><div className="script-meta"><Tag tone="accent">{course.apparatus}</Tag><Tag>{course.level}</Tag><span>{course.exercises.length} 個動作 · 約 {formatSeconds(estimateCourseSeconds(course))}</span></div><div className="script-list">{course.exercises.slice().sort((a, b) => a.order - b.order).map((item, index) => <article className="script-item" key={item.id}><div className="script-number">{String(index + 1).padStart(2, '0')}</div><div className="script-body"><div className="script-title-row"><div><h3>{getCourseExerciseLabel(item)}</h3><strong>{getCourseExerciseTitle(item)}</strong></div><div className="script-setups"><Tag>{item.spring || 'Spring —'}</Tag><Tag>{item.reps || '次數 —'}</Tag></div></div><div className="script-cue-list">{[item.cue.preparation, item.cue.breathing, item.cue.core, item.cue.movement, item.cue.correction].filter(Boolean).map((cue, cueIndex) => <p key={`${cue}-${cueIndex}`}><i />{cue}</p>)}</div>{item.note && <div className="script-note">備註：{item.note}</div>}</div></article>)}</div></Modal>
}

function BackupImportModal({ backup, onClose, onImport }: { backup: ReturnType<typeof parseBackup>; onClose: () => void; onImport: (mode: 'merge' | 'replace') => void }) {
  return <Modal title="確認匯入備份" onClose={onClose}><div className="backup-preview"><div className="backup-preview-icon"><UploadIcon size={24} /></div><h3>這份備份可以匯入</h3><p>匯出時間：{formatDateTime(backup.exportedAt)}</p><div className="backup-counts"><span><b>{backup.data.exercises.length}</b> 個動作</span><span><b>{backup.data.courses.length}</b> 堂課程</span><span><b>{backup.data.templates.length}</b> 個模板</span></div><div className="import-choice"><button onClick={() => onImport('merge')}><strong>合併</strong><span>保留目前資料，同 ID 項目以備份為準。</span></button><button className="danger-choice" onClick={() => { if (window.confirm('覆蓋會清除目前本機資料，再寫入這份備份。確定嗎？')) onImport('replace') }}><strong>覆蓋</strong><span>清除目前資料，完整還原這份備份。</span></button></div></div></Modal>
}

function Modal({ title, onClose, children, wide, extraClass = '' }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean; extraClass?: string }) {
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className={classNames('modal-sheet', wide && 'modal-wide', extraClass)} role="dialog" aria-modal="true" aria-label={title}><div className="modal-header"><h2>{title}</h2><button className="icon-button" onClick={onClose} aria-label="關閉"><CloseIcon /></button></div><div className="modal-content">{children}</div></section></div>
}
