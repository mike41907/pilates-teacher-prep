import { describe, expect, it } from "vitest";
import { createDemoData } from "./demoData";
import { mergeBackup, parseBackup, serializeBackup } from "./backup";

describe("backup validation", () => {
  it("round-trips every local data collection", () => {
    const source = createDemoData();
    const parsed = parseBackup(serializeBackup(source));
    expect(parsed.schemaVersion).toBe(4);
    expect(parsed.data.exercises).toHaveLength(source.exercises.length);
    expect(parsed.data.courses[0].exercises[0].snapshot.nameEn).toBe(
      source.courses[0].exercises[0].snapshot.nameEn,
    );
    expect(parsed.media).toEqual([]);
  });

  it("validates and restores video backup metadata", () => {
    const source = createDemoData();
    const videoReference = {
      id: "video-1",
      fileName: "footwork.mp4",
      mimeType: "video/mp4",
      sizeBytes: 3,
      updatedAt: "2026-08-13T00:00:00.000Z",
    };
    source.exercises[0].videoRefs = { overview: videoReference };
    const raw = serializeBackup(source, [
      {
        ...videoReference,
        exerciseId: source.exercises[0].id,
        slot: "overview",
        dataUrl: "data:video/mp4;base64,AQID",
      },
    ]);
    const parsed = parseBackup(raw);
    expect(parsed.media).toHaveLength(1);
    expect(parsed.media[0].fileName).toBe("footwork.mp4");
  });

  it("keeps device videos when merging a data-only backup", () => {
    const current = createDemoData();
    current.exercises[0].videoRefs = {
      overview: {
        id: "local-video",
        fileName: "local.mp4",
        mimeType: "video/mp4",
        sizeBytes: 10,
        updatedAt: "2026-08-13T00:00:00.000Z",
      },
    };
    const incoming = createDemoData();
    const merged = mergeBackup(current, incoming);
    expect(merged.exercises[0].videoRefs?.overview?.id).toBe("local-video");
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
