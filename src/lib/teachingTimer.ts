import type { Course, TeachingSession } from "../types";

export function createTeachingSession(
  course: Course,
  now = Date.now(),
): TeachingSession | null {
  const items = course.exercises.slice().sort((a, b) => a.order - b.order);
  const first = items[0];
  if (!first) return null;
  return {
    courseId: course.id,
    currentItemId: first.id,
    currentIndex: 0,
    startedAtMs: now,
    currentStartedAtMs: now,
    totalPausedMs: 0,
    currentPausedMs: 0,
    extraTargetSeconds: 0,
  };
}

export function activeElapsedMs(
  startedAtMs: number,
  pausedMs: number,
  pausedAtMs: number | undefined,
  now = Date.now(),
): number {
  const end = pausedAtMs ?? now;
  return Math.max(0, end - startedAtMs - pausedMs);
}

export function totalElapsedSeconds(
  session: TeachingSession,
  now = Date.now(),
): number {
  return Math.round(
    activeElapsedMs(
      session.startedAtMs,
      session.totalPausedMs,
      session.pausedAtMs,
      now,
    ) / 1000,
  );
}

export function itemElapsedSeconds(
  session: TeachingSession,
  now = Date.now(),
): number {
  return Math.round(
    activeElapsedMs(
      session.currentStartedAtMs,
      session.currentPausedMs,
      session.pausedAtMs,
      now,
    ) / 1000,
  );
}

export function pauseTeachingSession(
  session: TeachingSession,
  now = Date.now(),
): TeachingSession {
  return session.pausedAtMs ? session : { ...session, pausedAtMs: now };
}

export function resumeTeachingSession(
  session: TeachingSession,
  now = Date.now(),
): TeachingSession {
  if (!session.pausedAtMs) return session;
  const pausedDuration = Math.max(0, now - session.pausedAtMs);
  return {
    ...session,
    pausedAtMs: undefined,
    totalPausedMs: session.totalPausedMs + pausedDuration,
    currentPausedMs: session.currentPausedMs + pausedDuration,
  };
}

export function moveTeachingSession(
  session: TeachingSession,
  currentIndex: number,
  currentItemId: string,
  now = Date.now(),
): TeachingSession {
  const pausedSession = session.pausedAtMs
    ? resumeTeachingSession(session, now)
    : session;
  return {
    ...pausedSession,
    currentIndex,
    currentItemId,
    currentStartedAtMs: now,
    currentPausedMs: 0,
    extraTargetSeconds: 0,
  };
}

export function formatTimer(totalSeconds: number): string {
  const safe = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = (safe % 60).toString().padStart(2, "0");
  return hours ? `${hours}:${minutes}:${seconds}` : `${minutes}:${seconds}`;
}
