import { describe, expect, it } from "vitest";
import { createDemoData } from "./demoData";
import {
  EXERCISE_CATALOG_VERSION,
  createExerciseCatalog,
  mergeExerciseCatalog,
  migrateExerciseCatalog,
} from "./exerciseCatalog";

describe("built-in equipment exercise catalog", () => {
  it("contains at least 100 unique exercises across four apparatus types", () => {
    const catalog = createExerciseCatalog("2026-08-13T00:00:00.000Z");
    expect(catalog.length).toBeGreaterThanOrEqual(100);
    expect(new Set(catalog.map((exercise) => exercise.id)).size).toBe(
      catalog.length,
    );
    for (const apparatus of ["Reformer", "Cadillac", "Chair", "Barrel"])
      expect(
        catalog.filter((exercise) => exercise.apparatus === apparatus).length,
      ).toBeGreaterThanOrEqual(15);
  });

  it("provides searchable metadata and source links for every catalog item", () => {
    const catalog = createExerciseCatalog("2026-08-13T00:00:00.000Z");
    for (const exercise of catalog) {
      expect(exercise.nameZh).not.toBe("");
      expect(exercise.nameEn).not.toBe("");
      expect(exercise.primaryAreas.length).toBeGreaterThan(0);
      expect(exercise.startPositions.length).toBeGreaterThan(0);
      expect(exercise.sourceUrl).toMatch(/^https:\/\//);
      expect(exercise.defaultCue.movement).toContain(exercise.nameZh);
    }
    expect(
      catalog.filter((exercise) => exercise.demoVideoUrl).length,
    ).toBeGreaterThanOrEqual(20);
  });

  it("adds missing items without overwriting teacher edits", () => {
    const catalog = createExerciseCatalog("2026-08-13T00:00:00.000Z");
    const edited = {
      ...catalog[0],
      nameZh: "老師自己的名稱",
      defaultCue: {
        ...catalog[0].defaultCue,
        movement: "老師自己的 Cue",
      },
      sourceUrl: undefined,
    };
    const merged = mergeExerciseCatalog([edited], "2026-08-13T00:00:00.000Z");
    expect(merged).toHaveLength(catalog.length);
    expect(merged.find((exercise) => exercise.id === edited.id)?.nameZh).toBe(
      "老師自己的名稱",
    );
    expect(
      merged.find((exercise) => exercise.id === edited.id)?.defaultCue.movement,
    ).toBe("老師自己的 Cue");
    expect(
      merged.find((exercise) => exercise.id === edited.id)?.sourceUrl,
    ).toMatch(/^https:\/\//);
  });

  it("runs the catalog migration once", () => {
    const data = createDemoData();
    const oldData = {
      ...data,
      exercises: data.exercises.slice(0, 13),
      settings: { ...data.settings, exerciseCatalogVersion: 0 },
    };
    const migrated = migrateExerciseCatalog(oldData);
    expect(migrated.exercises.length).toBeGreaterThanOrEqual(100);
    expect(migrated.settings.exerciseCatalogVersion).toBe(
      EXERCISE_CATALOG_VERSION,
    );
    expect(migrateExerciseCatalog(migrated)).toBe(migrated);
  });
});
