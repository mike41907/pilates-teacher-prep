import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_SETTINGS,
  type AppData,
  type ExerciseMediaAsset,
} from "../types";
import { createDemoData } from "../lib/demoData";
import {
  loadData,
  persistDataChanges,
  replaceData,
  replaceDataAndMedia,
} from "../lib/db";
import {
  dataNeedsTeachingLevelMigration,
  migrateTeachingLevels,
} from "../lib/teachingLevels";
import {
  dataNeedsExerciseCatalogMigration,
  migrateExerciseCatalog,
} from "../lib/exerciseCatalog";

const SAVE_DEBOUNCE_MS = 250;

export function usePersistedData() {
  const [data, setData] = useState<AppData | null>(null);
  const [loadError, setLoadError] = useState("");
  const [toast, setToast] = useState("");
  const persistedRef = useRef<AppData | null>(null);
  const pendingRef = useRef<AppData | null>(null);
  const timerRef = useRef<number | null>(null);
  const queueRef = useRef(Promise.resolve());

  const flush = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
    const previous = persistedRef.current;
    const next = pendingRef.current;
    if (!previous || !next || previous === next) return queueRef.current;
    pendingRef.current = null;
    queueRef.current = queueRef.current
      .then(() => persistDataChanges(previous, next))
      .then(() => {
        persistedRef.current = next;
      })
      .catch(() => {
        pendingRef.current = next;
        setToast("資料儲存失敗，請重新嘗試。");
      });
    return queueRef.current;
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        let loaded = await loadData();
        if (!loaded.exercises.length) {
          loaded = createDemoData();
          await replaceData(loaded);
        }
        loaded = {
          ...loaded,
          settings: { ...DEFAULT_SETTINGS, ...loaded.settings, id: "app" },
        };
        let needsReplace = false;
        if (dataNeedsExerciseCatalogMigration(loaded)) {
          loaded = migrateExerciseCatalog(loaded);
          needsReplace = true;
        }
        if (dataNeedsTeachingLevelMigration(loaded)) {
          loaded = migrateTeachingLevels(loaded);
          needsReplace = true;
        }
        if (needsReplace) await replaceData(loaded);
        persistedRef.current = loaded;
        if (active) setData(loaded);
      } catch (error) {
        const demo = createDemoData();
        try {
          await replaceData(demo);
          persistedRef.current = demo;
        } catch {
          setLoadError(
            "本機資料庫目前無法使用，這次工作階段會暫存在記憶體中。",
          );
        }
        if (active) {
          setData(demo);
          setToast(
            error instanceof Error
              ? "已建立示範資料，可以直接開始試用。"
              : "已建立示範資料。",
          );
        }
      }
      try {
        await navigator.storage?.persist?.();
      } catch {
        /* persistent storage is best-effort */
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") void flush();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
      void flush();
    };
  }, [flush]);

  const update = useCallback(
    (updater: (current: AppData) => AppData, message?: string) => {
      setData((current) => {
        if (!current) return current;
        const next = updater(current);
        pendingRef.current = next;
        if (timerRef.current !== null) window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
          void flush();
        }, SAVE_DEBOUNCE_MS);
        if (message) setToast(message);
        return next;
      });
    },
    [flush],
  );

  const replaceAllData = useCallback(
    async (next: AppData, mediaAssets?: ExerciseMediaAsset[]) => {
      if (mediaAssets) await replaceDataAndMedia(next, mediaAssets);
      else await replaceData(next);
      persistedRef.current = next;
      pendingRef.current = null;
      setData(next);
    },
    [],
  );

  return { data, update, replaceAllData, toast, setToast, loadError, flush };
}
