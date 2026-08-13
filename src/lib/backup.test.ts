import { describe, expect, it } from "vitest";
import { createDemoData } from "./demoData";
import { parseBackup, serializeBackup } from "./backup";

describe("backup validation", () => {
  it("round-trips every local data collection", () => {
    const source = createDemoData();
    const parsed = parseBackup(serializeBackup(source));
    expect(parsed.schemaVersion).toBe(3);
    expect(parsed.data.exercises).toHaveLength(source.exercises.length);
    expect(parsed.data.courses[0].exercises[0].snapshot.nameEn).toBe(
      source.courses[0].exercises[0].snapshot.nameEn,
    );
  });

  it("migrates a schema v1 backup with missing v2 settings", () => {
    const envelope = JSON.parse(serializeBackup(createDemoData()));
    envelope.schemaVersion = 1;
    delete envelope.data.settings.showTeachingTimer;
    delete envelope.data.settings.teachingTimerMode;
    const parsed = parseBackup(JSON.stringify(envelope));
    expect(parsed.data.settings.showTeachingTimer).toBe(true);
    expect(parsed.data.settings.teachingTimerMode).toBe("elapsed");
  });

  it("migrates v2 course items into regression, standard and variation", () => {
    const envelope = JSON.parse(serializeBackup(createDemoData()));
    envelope.schemaVersion = 2;
    for (const course of [
      ...envelope.data.courses,
      ...envelope.data.templates.map(
        (template: { course: unknown }) => template.course,
      ),
    ]) {
      for (const item of course.exercises) {
        delete item.teachingLevels;
        delete item.snapshot.regression;
        delete item.snapshot.progression;
      }
    }
    const parsed = parseBackup(JSON.stringify(envelope));
    const item = parsed.data.courses[0].exercises[0];
    expect(item.teachingLevels.map((level) => level.kind)).toEqual([
      "regression",
      "standard",
      "variation",
    ]);
    expect(
      item.teachingLevels.reduce(
        (total, level) => total + level.durationSeconds,
        0,
      ),
    ).toBe(item.durationSeconds);
  });

  it("rejects malformed nested exercise fields", () => {
    const envelope = JSON.parse(serializeBackup(createDemoData()));
    envelope.data.exercises[0].defaultCue = "invalid";
    expect(() => parseBackup(JSON.stringify(envelope))).toThrow(/defaultCue/);
  });

  it("rejects invalid settings without touching current data", () => {
    const envelope = JSON.parse(serializeBackup(createDemoData()));
    envelope.data.settings.teachingTimerMode = "unknown";
    expect(() => parseBackup(JSON.stringify(envelope))).toThrow(
      /teachingTimerMode/,
    );
  });

  it("rejects a current backup that omits the required regression stage", () => {
    const envelope = JSON.parse(serializeBackup(createDemoData()));
    envelope.data.courses[0].exercises[0].teachingLevels =
      envelope.data.courses[0].exercises[0].teachingLevels.filter(
        (level: { kind: string }) => level.kind !== "regression",
      );
    expect(() => parseBackup(JSON.stringify(envelope))).toThrow(
      /退階、正常與變化/,
    );
  });
});
