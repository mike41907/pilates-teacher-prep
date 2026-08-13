import { describe, expect, it } from "vitest";
import { createDemoData } from "./demoData";
import { parseBackup, serializeBackup } from "./backup";

describe("backup validation", () => {
  it("round-trips every local data collection", () => {
    const source = createDemoData();
    const parsed = parseBackup(serializeBackup(source));
    expect(parsed.schemaVersion).toBe(2);
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
});
