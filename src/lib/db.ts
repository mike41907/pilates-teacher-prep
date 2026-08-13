import type {
  AppData,
  AppSettings,
  Course,
  Exercise,
  ExerciseMediaAsset,
  Template,
  UsageHistory,
} from "../types";

const DB_NAME = "pilates-prep-local";
const DB_VERSION = 2;

type StoreName =
  "exercises" | "courses" | "templates" | "usageHistory" | "settings";
const MEDIA_STORE = "exerciseMedia";

let databasePromise: Promise<IDBDatabase> | null = null;

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("IndexedDB request failed"));
  });
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onerror = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction failed"));
    transaction.onabort = () =>
      reject(transaction.error ?? new Error("IndexedDB transaction aborted"));
  });
}

export function openDatabase(): Promise<IDBDatabase> {
  if (databasePromise) return databasePromise;
  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      const exercises = database.objectStoreNames.contains("exercises")
        ? request.transaction!.objectStore("exercises")
        : database.createObjectStore("exercises", { keyPath: "id" });
      if (!exercises.indexNames.contains("apparatus"))
        exercises.createIndex("apparatus", "apparatus");
      if (!exercises.indexNames.contains("level"))
        exercises.createIndex("level", "level");
      if (!exercises.indexNames.contains("updatedAt"))
        exercises.createIndex("updatedAt", "updatedAt");

      const courses = database.objectStoreNames.contains("courses")
        ? request.transaction!.objectStore("courses")
        : database.createObjectStore("courses", { keyPath: "id" });
      if (!courses.indexNames.contains("date"))
        courses.createIndex("date", "date");
      if (!courses.indexNames.contains("updatedAt"))
        courses.createIndex("updatedAt", "updatedAt");

      const templates = database.objectStoreNames.contains("templates")
        ? request.transaction!.objectStore("templates")
        : database.createObjectStore("templates", { keyPath: "id" });
      if (!templates.indexNames.contains("updatedAt"))
        templates.createIndex("updatedAt", "updatedAt");

      const usage = database.objectStoreNames.contains("usageHistory")
        ? request.transaction!.objectStore("usageHistory")
        : database.createObjectStore("usageHistory", { keyPath: "id" });
      if (!usage.indexNames.contains("exerciseId"))
        usage.createIndex("exerciseId", "exerciseId");
      if (!usage.indexNames.contains("usedAt"))
        usage.createIndex("usedAt", "usedAt");

      if (!database.objectStoreNames.contains("settings"))
        database.createObjectStore("settings", { keyPath: "id" });

      const media = database.objectStoreNames.contains(MEDIA_STORE)
        ? request.transaction!.objectStore(MEDIA_STORE)
        : database.createObjectStore(MEDIA_STORE, { keyPath: "id" });
      if (!media.indexNames.contains("exerciseId"))
        media.createIndex("exerciseId", "exerciseId");
      if (!media.indexNames.contains("updatedAt"))
        media.createIndex("updatedAt", "updatedAt");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () =>
      reject(request.error ?? new Error("無法開啟本機資料庫"));
  });
  return databasePromise;
}

export async function getAll<T>(storeName: StoreName): Promise<T[]> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readonly");
  return requestToPromise(transaction.objectStore(storeName).getAll());
}

export async function getOne<T>(
  storeName: StoreName,
  key: IDBValidKey,
): Promise<T | undefined> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readonly");
  return requestToPromise(transaction.objectStore(storeName).get(key));
}

export async function putOne<T extends { id: IDBValidKey }>(
  storeName: StoreName,
  value: T,
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).put(value);
  await transactionToPromise(transaction);
}

export async function deleteOne(
  storeName: StoreName,
  key: IDBValidKey,
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).delete(key);
  await transactionToPromise(transaction);
}

export async function replaceData(data: AppData): Promise<void> {
  const database = await openDatabase();
  const stores: StoreName[] = [
    "exercises",
    "courses",
    "templates",
    "usageHistory",
    "settings",
  ];
  const transaction = database.transaction(stores, "readwrite");
  for (const storeName of stores) transaction.objectStore(storeName).clear();
  for (const exercise of data.exercises)
    transaction.objectStore("exercises").put(exercise);
  for (const course of data.courses)
    transaction.objectStore("courses").put(course);
  for (const template of data.templates)
    transaction.objectStore("templates").put(template);
  for (const history of data.usageHistory)
    transaction.objectStore("usageHistory").put(history);
  transaction.objectStore("settings").put(data.settings);
  await transactionToPromise(transaction);
}

function changedById<T extends { id: IDBValidKey }>(
  previous: T[],
  next: T[],
): { puts: T[]; deletes: IDBValidKey[] } {
  const before = new Map(previous.map((item) => [item.id, item]));
  const after = new Map(next.map((item) => [item.id, item]));
  return {
    puts: next.filter((item) => before.get(item.id) !== item),
    deletes: previous
      .filter((item) => !after.has(item.id))
      .map((item) => item.id),
  };
}

export async function persistDataChanges(
  previous: AppData,
  next: AppData,
): Promise<void> {
  const database = await openDatabase();
  const exercises = changedById(previous.exercises, next.exercises);
  const courses = changedById(previous.courses, next.courses);
  const templates = changedById(previous.templates, next.templates);
  const usageHistory = changedById(previous.usageHistory, next.usageHistory);
  const changedStores: StoreName[] = [];
  if (exercises.puts.length || exercises.deletes.length)
    changedStores.push("exercises");
  if (courses.puts.length || courses.deletes.length)
    changedStores.push("courses");
  if (templates.puts.length || templates.deletes.length)
    changedStores.push("templates");
  if (usageHistory.puts.length || usageHistory.deletes.length)
    changedStores.push("usageHistory");
  if (previous.settings !== next.settings) changedStores.push("settings");
  if (!changedStores.length) return;

  const transaction = database.transaction(changedStores, "readwrite");
  const apply = <T extends { id: IDBValidKey }>(
    storeName: StoreName,
    changes: { puts: T[]; deletes: IDBValidKey[] },
  ) => {
    if (!changedStores.includes(storeName)) return;
    const store = transaction.objectStore(storeName);
    for (const value of changes.puts) store.put(value);
    for (const key of changes.deletes) store.delete(key);
  };
  apply("exercises", exercises);
  apply("courses", courses);
  apply("templates", templates);
  apply("usageHistory", usageHistory);
  if (previous.settings !== next.settings)
    transaction.objectStore("settings").put(next.settings);
  await transactionToPromise(transaction);
}

export async function loadData(): Promise<AppData> {
  const [exercises, courses, templates, usageHistory, settings] =
    await Promise.all([
      getAll<Exercise>("exercises"),
      getAll<Course>("courses"),
      getAll<Template>("templates"),
      getAll<UsageHistory>("usageHistory"),
      getOne<AppSettings>("settings", "app"),
    ]);
  if (!settings) throw new Error("本機設定遺失，請重新載入頁面。");
  return { exercises, courses, templates, usageHistory, settings };
}

export async function clearAllData(): Promise<void> {
  const database = await openDatabase();
  const stores: StoreName[] = [
    "exercises",
    "courses",
    "templates",
    "usageHistory",
    "settings",
  ];
  const transaction = database.transaction(
    [...stores, MEDIA_STORE],
    "readwrite",
  );
  for (const storeName of stores) transaction.objectStore(storeName).clear();
  transaction.objectStore(MEDIA_STORE).clear();
  await transactionToPromise(transaction);
}

export async function getExerciseMedia(
  id: string,
): Promise<ExerciseMediaAsset | undefined> {
  const database = await openDatabase();
  const transaction = database.transaction(MEDIA_STORE, "readonly");
  return requestToPromise(transaction.objectStore(MEDIA_STORE).get(id));
}

export async function getAllExerciseMedia(): Promise<ExerciseMediaAsset[]> {
  const database = await openDatabase();
  const transaction = database.transaction(MEDIA_STORE, "readonly");
  return requestToPromise(transaction.objectStore(MEDIA_STORE).getAll());
}

export async function putExerciseMedia(
  asset: ExerciseMediaAsset,
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(MEDIA_STORE, "readwrite");
  transaction.objectStore(MEDIA_STORE).put(asset);
  await transactionToPromise(transaction);
}

export async function deleteExerciseMedia(id: string): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(MEDIA_STORE, "readwrite");
  transaction.objectStore(MEDIA_STORE).delete(id);
  await transactionToPromise(transaction);
}

export async function deleteExerciseMediaForExercise(
  exerciseId: string,
): Promise<void> {
  const database = await openDatabase();
  const transaction = database.transaction(MEDIA_STORE, "readwrite");
  const index = transaction.objectStore(MEDIA_STORE).index("exerciseId");
  const request = index.openKeyCursor(IDBKeyRange.only(exerciseId));
  request.onsuccess = () => {
    const cursor = request.result;
    if (!cursor) return;
    transaction.objectStore(MEDIA_STORE).delete(cursor.primaryKey);
    cursor.continue();
  };
  await transactionToPromise(transaction);
}

export async function replaceDataAndMedia(
  data: AppData,
  mediaAssets: ExerciseMediaAsset[],
): Promise<void> {
  const database = await openDatabase();
  const stores = [
    "exercises",
    "courses",
    "templates",
    "usageHistory",
    "settings",
    MEDIA_STORE,
  ];
  const transaction = database.transaction(stores, "readwrite");
  for (const storeName of stores) transaction.objectStore(storeName).clear();
  for (const exercise of data.exercises)
    transaction.objectStore("exercises").put(exercise);
  for (const course of data.courses)
    transaction.objectStore("courses").put(course);
  for (const template of data.templates)
    transaction.objectStore("templates").put(template);
  for (const history of data.usageHistory)
    transaction.objectStore("usageHistory").put(history);
  transaction.objectStore("settings").put(data.settings);
  for (const asset of mediaAssets)
    transaction.objectStore(MEDIA_STORE).put(asset);
  await transactionToPromise(transaction);
}
