import { describe, expect, it } from "vitest";
import { createDemoData } from "./demoData";
import {
  createTeachingLevels,
  dataNeedsTeachingLevelMigration,
  migrateTeachingLevels,
} from "./teachingLevels";

describe("three-level teaching flow", () => {
  it("splits one movement duration without inflating the course", () => {
    const exercise = createDemoData().exercises[0];
    const levels = createTeachingLevels(exercise, 240, "test");
    expect(levels.map((level) => level.kind)).toEqual([
      "regression",
      "standard",
      "variation",
    ]);
    expect(
      levels.reduce((total, level) => total + level.durationSeconds, 0),
    ).toBe(240);
  });

  it("upgrades existing local courses using exercise defaults", () => {
    const data = createDemoData();
    const legacy = structuredClone(data);
    const item = legacy.courses[0].exercises[0] as unknown as {
      teachingLevels?: unknown;
    };
    delete item.teachingLevels;
    expect(dataNeedsTeachingLevelMigration(legacy)).toBe(true);
    const migrated = migrateTeachingLevels(legacy);
    expect(migrated.courses[0].exercises[0].teachingLevels).toHaveLength(3);
    expect(
      migrated.courses[0].exercises[0].teachingLevels[0].instruction,
    ).toContain("幅度");
  });

  it("reuses the teacher's saved three-level flow and rescales its time", () => {
    const exercise = createDemoData().exercises[0];
    const saved = createTeachingLevels(exercise, 240, "saved").map((level) => ({
      kind: level.kind,
      title: level.title,
      instruction: level.instruction,
      cue: level.cue,
      reps: level.reps,
      durationSeconds: level.durationSeconds,
    }));
    saved[0].instruction = "老師慣用退階";
    const reused = createTeachingLevels(
      { ...exercise, defaultTeachingLevels: saved },
      120,
      "new-course",
    );
    expect(reused[0].instruction).toBe("老師慣用退階");
    expect(
      reused.reduce((total, level) => total + level.durationSeconds, 0),
    ).toBe(120);
  });
});
