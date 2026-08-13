import { describe, expect, it } from "vitest";
import { createDemoData } from "./demoData";
import {
  averageActualDurationSeconds,
  courseSimilarity,
  getUsageStats,
  rankReplacementExercises,
} from "./utils";

describe("planning rules", () => {
  it("ranks similar replacements and removes avoided loading conditions", () => {
    const data = createDemoData();
    const source =
      data.exercises.find((exercise) => exercise.nameEn === "Long Stretch") ??
      data.exercises[0];
    const ranked = rankReplacementExercises(source, data.exercises, [
      "手腕負重",
    ]);
    expect(
      ranked.every(
        ({ exercise }) => !exercise.specialConditions.includes("手腕負重"),
      ),
    ).toBe(true);
    expect(ranked).toEqual(ranked.slice().sort((a, b) => b.score - a.score));
  });

  it("calculates 7 and 30 day usage windows", () => {
    const now = Date.UTC(2026, 7, 13);
    const stats = getUsageStats(
      [
        {
          id: "1",
          exerciseId: "e",
          courseId: "c",
          usedAt: new Date(now - 2 * 86_400_000).toISOString(),
        },
        {
          id: "2",
          exerciseId: "e",
          courseId: "c",
          usedAt: new Date(now - 20 * 86_400_000).toISOString(),
        },
        {
          id: "3",
          exerciseId: "e",
          courseId: "c",
          usedAt: new Date(now - 40 * 86_400_000).toISOString(),
        },
      ],
      "e",
      now,
    );
    expect(stats).toMatchObject({ total: 3, last7Days: 1, last30Days: 2 });
  });

  it("compares course exercise overlap", () => {
    const course = createDemoData().courses[0];
    expect(courseSimilarity(course, structuredClone(course))).toBe(100);
  });

  it("uses completed teaching durations as the next planning estimate", () => {
    const data = createDemoData();
    const exerciseId = data.courses[0].exercises[0].exerciseId;
    const courses = [data.courses[0], structuredClone(data.courses[0])].map(
      (course, courseIndex) => ({
        ...course,
        exercises: course.exercises.map((item, itemIndex) => ({
          ...item,
          actualDurationSeconds:
            item.exerciseId === exerciseId && itemIndex === 0
              ? courseIndex === 0
                ? 120
                : 180
              : undefined,
        })),
      }),
    );
    expect(averageActualDurationSeconds(courses, exerciseId)).toBe(150);
    expect(averageActualDurationSeconds(courses, "missing")).toBeUndefined();
  });
});
