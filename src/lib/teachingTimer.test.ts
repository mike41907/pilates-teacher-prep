import { describe, expect, it } from "vitest";
import { createDemoData } from "./demoData";
import {
  createTeachingSession,
  formatTimer,
  itemElapsedSeconds,
  moveTeachingSession,
  pauseTeachingSession,
  resumeTeachingSession,
  totalElapsedSeconds,
} from "./teachingTimer";

describe("teaching timer", () => {
  it("uses timestamps so background time remains accurate", () => {
    const course = createDemoData().courses[0];
    const session = createTeachingSession(course, 1_000);
    expect(session).not.toBeNull();
    expect(totalElapsedSeconds(session!, 61_000)).toBe(60);
    expect(itemElapsedSeconds(session!, 31_000)).toBe(30);
  });

  it("excludes paused time and resets item timing when moving", () => {
    const course = createDemoData().courses[0];
    const session = createTeachingSession(course, 1_000)!;
    const paused = pauseTeachingSession(session, 11_000);
    const resumed = resumeTeachingSession(paused, 21_000);
    expect(totalElapsedSeconds(resumed, 31_000)).toBe(20);
    const moved = moveTeachingSession(
      resumed,
      1,
      course.exercises[1].id,
      31_000,
    );
    expect(itemElapsedSeconds(moved, 36_000)).toBe(5);
  });

  it("formats classroom timers consistently", () => {
    expect(formatTimer(65)).toBe("01:05");
    expect(formatTimer(3_661)).toBe("1:01:01");
  });
});
