import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  AppSettings,
  Course,
  Familiarity,
  TeachingSession,
} from "../types";
import {
  classNames,
  getCourseExerciseLabel,
  getCourseExerciseTitle,
  nowIso,
  percentage,
} from "../lib/utils";
import {
  createTeachingSession,
  formatTimer,
  itemElapsedSeconds,
  moveTeachingSession,
  pauseTeachingSession,
  resumeTeachingSession,
  totalElapsedSeconds,
} from "../lib/teachingTimer";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CloseIcon,
  MaximizeIcon,
  VolumeIcon,
} from "./Icons";

interface TeachingViewProps {
  course: Course;
  settings: AppSettings;
  onExit: () => void;
  onNotify: (message: string) => void;
  onUpdateCourse: (
    id: string,
    updater: (course: Course) => Course,
    message?: string,
  ) => void;
}

function notifyTimer(settings: AppSettings) {
  if (settings.timerVibration) navigator.vibrate?.([120, 80, 120]);
  if (!settings.timerSound) return;
  try {
    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextClass) return;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 660;
    gain.gain.value = 0.06;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.18);
    oscillator.addEventListener(
      "ended",
      () => {
        void context.close();
      },
      { once: true },
    );
  } catch {
    /* audio is optional */
  }
}

export function TeachingView({
  course,
  settings,
  onExit,
  onNotify,
  onUpdateCourse,
}: TeachingViewProps) {
  const items = useMemo(
    () => course.exercises.slice().sort((a, b) => a.order - b.order),
    [course.exercises],
  );
  const initialSession = useMemo(() => {
    const saved = course.teachingSession;
    if (
      saved &&
      saved.courseId === course.id &&
      items.some((item) => item.id === saved.currentItemId)
    )
      return saved;
    return createTeachingSession(course);
  }, [course.id]);
  const [session, setSession] = useState<TeachingSession | null>(
    initialSession,
  );
  const [now, setNow] = useState(Date.now());
  const [wakeLockActive, setWakeLockActive] = useState(false);
  const wakeLockRef = useRef<WakeLockSentinel | null>(null);
  const notifiedItemRef = useRef("");
  const index = session
    ? Math.max(
        0,
        items.findIndex((item) => item.id === session.currentItemId),
      )
    : 0;
  const item = items[index];
  const next = items[index + 1];

  useEffect(() => {
    if (!session) return;
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (!session || course.teachingSession) return;
    onUpdateCourse(course.id, (current) => ({
      ...current,
      teachingSession: session,
    }));
  }, [course.id, course.teachingSession, onUpdateCourse, session]);

  const requestWakeLock = useCallback(async () => {
    if (!settings.keepScreenAwake) return;
    if (!navigator.wakeLock?.request) {
      onNotify("Wake Lock 在此裝置上不支援。");
      return;
    }
    try {
      const lock = await navigator.wakeLock.request("screen");
      wakeLockRef.current = lock;
      setWakeLockActive(true);
      lock.addEventListener("release", () => setWakeLockActive(false), {
        once: true,
      });
    } catch {
      onNotify("無法防止螢幕關閉，請保持裝置電源充足。");
    }
  }, [onNotify, settings.keepScreenAwake]);

  useEffect(() => {
    void requestWakeLock();
    const visibilityHandler = () => {
      if (
        document.visibilityState === "visible" &&
        settings.keepScreenAwake &&
        (!wakeLockRef.current || wakeLockRef.current.released)
      )
        void requestWakeLock();
    };
    document.addEventListener("visibilitychange", visibilityHandler);
    return () => {
      document.removeEventListener("visibilitychange", visibilityHandler);
      const lock = wakeLockRef.current;
      wakeLockRef.current = null;
      setWakeLockActive(false);
      void lock?.release();
    };
  }, [requestWakeLock, settings.keepScreenAwake]);

  const currentSeconds = session ? itemElapsedSeconds(session, now) : 0;
  const wholeSeconds = session ? totalElapsedSeconds(session, now) : 0;
  const targetSeconds =
    (item?.durationSeconds ?? 0) + (session?.extraTargetSeconds ?? 0);
  const remainingSeconds = Math.max(0, targetSeconds - currentSeconds);
  const section = item
    ? course.sections.find((entry) => entry.id === item.sectionId)
    : undefined;
  const completedSectionSeconds = item
    ? items
        .slice(0, index)
        .filter((entry) => entry.sectionId === item.sectionId)
        .reduce((sum, entry) => sum + (entry.actualDurationSeconds ?? 0), 0)
    : 0;
  const sectionSeconds = completedSectionSeconds + currentSeconds;

  useEffect(() => {
    if (
      !item ||
      !session ||
      session.pausedAtMs ||
      targetSeconds <= 0 ||
      currentSeconds < targetSeconds ||
      notifiedItemRef.current === item.id
    )
      return;
    notifiedItemRef.current = item.id;
    notifyTimer(settings);
  }, [currentSeconds, item, session, settings, targetSeconds]);

  const saveCurrentActual = (
    seconds: number,
    nextSession?: TeachingSession | null,
    finished = false,
  ) => {
    onUpdateCourse(course.id, (current) => ({
      ...current,
      teachingSession: nextSession ?? undefined,
      lastTaughtAt: finished ? nowIso() : current.lastTaughtAt,
      exercises: current.exercises.map((entry) =>
        entry.id === item.id
          ? { ...entry, actualDurationSeconds: seconds }
          : entry,
      ),
    }));
  };

  const move = (amount: number) => {
    if (!session || !item) return;
    const nextIndex = Math.max(0, Math.min(items.length - 1, index + amount));
    if (amount > 0 && index === items.length - 1) {
      saveCurrentActual(currentSeconds, null, true);
      onNotify("帶課完成，實際時間已保存。");
      onExit();
      return;
    }
    if (nextIndex === index) return;
    const nextSession = moveTeachingSession(
      session,
      nextIndex,
      items[nextIndex].id,
    );
    saveCurrentActual(currentSeconds, nextSession);
    setSession(nextSession);
    notifiedItemRef.current = "";
  };

  const togglePause = () => {
    if (!session) return;
    const nextSession = session.pausedAtMs
      ? resumeTeachingSession(session)
      : pauseTeachingSession(session);
    setSession(nextSession);
    onUpdateCourse(course.id, (current) => ({
      ...current,
      teachingSession: nextSession,
    }));
  };

  const addThirtySeconds = () => {
    if (!session) return;
    const nextSession = {
      ...session,
      extraTargetSeconds: session.extraTargetSeconds + 30,
    };
    setSession(nextSession);
    onUpdateCourse(course.id, (current) => ({
      ...current,
      teachingSession: nextSession,
    }));
  };

  const resetCurrent = () => {
    if (!session) return;
    const nextSession = {
      ...session,
      currentStartedAtMs: Date.now(),
      currentPausedMs: 0,
      pausedAtMs: undefined,
      extraTargetSeconds: 0,
    };
    setSession(nextSession);
    onUpdateCourse(course.id, (current) => ({
      ...current,
      teachingSession: nextSession,
    }));
    notifiedItemRef.current = "";
  };

  useEffect(() => {
    const keyHandler = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        move(1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        move(-1);
      }
      if (event.key === " ") {
        event.preventDefault();
        togglePause();
      }
    };
    window.addEventListener("keydown", keyHandler);
    return () => window.removeEventListener("keydown", keyHandler);
  });

  if (!item || !session)
    return (
      <div className="teaching-screen">
        <button className="teach-exit" onClick={onExit}>
          退出帶課
        </button>
        <p>這堂課沒有動作，請回到課表加入動作。</p>
      </div>
    );

  const speak = () => {
    if (!("speechSynthesis" in window)) {
      onNotify("此瀏覽器不支援語音朗讀。");
      return;
    }
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(
      new SpeechSynthesisUtterance(getCourseExerciseLabel(item)),
    );
  };
  const mark = (familiarity: Familiarity) =>
    onUpdateCourse(course.id, (current) => ({
      ...current,
      exercises: current.exercises.map((entry) =>
        entry.id === item.id ? { ...entry, familiarity } : entry,
      ),
    }));
  const shownItemTime =
    settings.teachingTimerMode === "countdown"
      ? remainingSeconds
      : currentSeconds;

  return (
    <div
      className={classNames("teaching-screen", `lead-${settings.leadFontSize}`)}
    >
      <div className="teach-topbar">
        <button
          className="teach-exit"
          onClick={() => {
            saveCurrentActual(currentSeconds, session);
            onExit();
          }}
        >
          <CloseIcon size={20} /> 退出
        </button>
        <div className="teach-course-title">
          <span>{course.title}</span>
          <small>
            {course.apparatus} · {course.level}
          </small>
        </div>
        <div className="teach-tools">
          <span>
            {index + 1} / {items.length}
          </span>
          {settings.keepScreenAwake && (
            <span
              className={classNames("wake-status", wakeLockActive && "active")}
            >
              {wakeLockActive ? "螢幕常亮" : "常亮未啟用"}
            </span>
          )}
          <button
            className="teach-icon-button"
            onClick={speak}
            aria-label="朗讀目前動作"
          >
            <VolumeIcon />
          </button>
          <button
            className="teach-icon-button"
            onClick={() => {
              void document.documentElement.requestFullscreen?.();
            }}
            aria-label="全螢幕"
          >
            <MaximizeIcon />
          </button>
        </div>
      </div>
      <div className="teach-progress">
        <span style={{ width: `${percentage(index + 1, items.length)}%` }} />
      </div>
      <button
        className="teach-tap-zone left"
        onClick={() => move(-1)}
        aria-label="上一個動作"
      />
      <button
        className="teach-tap-zone right"
        onClick={() => move(1)}
        aria-label="下一個動作"
      />
      <main className="teach-main">
        <div className="teach-index">
          {String(index + 1).padStart(2, "0")}{" "}
          <span>/ {String(items.length).padStart(2, "0")}</span>
        </div>
        {settings.showTeachingTimer && (
          <div className="teaching-timers" aria-live="polite">
            <div>
              <span>整堂課</span>
              <strong>
                {formatTimer(wholeSeconds)}{" "}
                <small>/ {formatTimer(course.durationMinutes * 60)}</small>
              </strong>
            </div>
            <div
              className={classNames(
                targetSeconds > 0 &&
                  currentSeconds >= targetSeconds &&
                  "timer-over",
              )}
            >
              <span>
                {settings.teachingTimerMode === "countdown"
                  ? "動作倒數"
                  : "目前動作"}
              </span>
              <strong>
                {formatTimer(shownItemTime)}{" "}
                <small>/ {formatTimer(targetSeconds)}</small>
              </strong>
            </div>
            <div>
              <span>{section?.title ?? "段落"}</span>
              <strong>{formatTimer(sectionSeconds)}</strong>
            </div>
          </div>
        )}
        <h1>{getCourseExerciseLabel(item)}</h1>
        <h2>{getCourseExerciseTitle(item)}</h2>
        <div className="teach-setup">
          <div>
            <span>Spring</span>
            <strong>{item.spring || "—"}</strong>
          </div>
          <div>
            <span>次數</span>
            <strong>{item.reps || "—"}</strong>
          </div>
          <div>
            <span>Footbar</span>
            <strong>{item.footbar || "—"}</strong>
          </div>
        </div>
        {settings.showCueInTeaching && (
          <div className="teach-cue">
            <span className="teach-label">今日 Cue</span>
            <div className="teach-cue-grid">
              {[
                item.cue.preparation,
                item.cue.breathing,
                item.cue.core,
                item.cue.movement,
                item.cue.correction,
              ]
                .filter(Boolean)
                .map((cue, cueIndex) => (
                  <p key={`${cue}-${cueIndex}`}>
                    <i />
                    {cue}
                  </p>
                ))}
            </div>
          </div>
        )}
        {settings.showNextInTeaching && (
          <div className="teach-next">
            <span>下一個</span>
            <strong>{next ? getCourseExerciseLabel(next) : "課程結束"}</strong>
          </div>
        )}
        <div className="teach-familiarity">
          <button
            aria-label="標記熟悉"
            className={item.familiarity === "familiar" ? "selected" : ""}
            onClick={() => mark("familiar")}
          >
            😊
          </button>
          <button
            aria-label="標記普通"
            className={item.familiarity === "unsure" ? "selected" : ""}
            onClick={() => mark("unsure")}
          >
            😐
          </button>
          <button
            aria-label="標記不熟"
            className={item.familiarity === "new" ? "selected" : ""}
            onClick={() => mark("new")}
          >
            😵
          </button>
        </div>
      </main>
      <div className="teach-timer-controls">
        <button onClick={togglePause}>
          {session.pausedAtMs ? "繼續" : "暫停"}
        </button>
        <button onClick={addThirtySeconds}>＋30秒</button>
        <button onClick={resetCurrent}>動作重計</button>
      </div>
      <div className="teach-bottom">
        <button onClick={() => move(-1)} disabled={index === 0}>
          <ArrowLeftIcon size={23} /> 上一個
        </button>
        <button onClick={() => move(1)}>
          {next ? "下一個" : "完成課程"} <ArrowRightIcon size={23} />
        </button>
      </div>
    </div>
  );
}
