import type {
  BackupMediaAsset,
  ExerciseMediaAsset,
  ExerciseVideoRef,
  ExerciseVideoSlot,
} from "../types";
import { newId, nowIso } from "./utils";
import {
  deleteExerciseMedia,
  getAllExerciseMedia,
  getExerciseMedia,
  putExerciseMedia,
} from "./db";

export const MAX_VIDEO_BYTES = 25 * 1024 * 1024;

export const VIDEO_SLOT_LABELS: Record<ExerciseVideoSlot, string> = {
  overview: "動作總覽",
  regression: "退階",
  standard: "正常",
  variation: "變化",
};

export const VIDEO_SLOTS: ExerciseVideoSlot[] = [
  "overview",
  "regression",
  "standard",
  "variation",
];

export function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 MB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function validateVideoFile(file: File): void {
  if (!file.type.startsWith("video/")) throw new Error("請選擇影片檔案。");
  if (file.size > MAX_VIDEO_BYTES)
    throw new Error("單段影片不可超過 25 MB，請先縮短或壓縮影片。");
}

export async function saveExerciseVideo(
  exerciseId: string,
  slot: ExerciseVideoSlot,
  file: File,
  existingId?: string,
): Promise<ExerciseVideoRef> {
  validateVideoFile(file);
  const asset: ExerciseMediaAsset = {
    id: existingId || newId("exercise-video"),
    exerciseId,
    slot,
    fileName: file.name || `${VIDEO_SLOT_LABELS[slot]}.mp4`,
    mimeType: file.type,
    sizeBytes: file.size,
    updatedAt: nowIso(),
    blob: file,
  };
  await putExerciseMedia(asset);
  const {
    blob: _blob,
    exerciseId: _exerciseId,
    slot: _slot,
    ...reference
  } = asset;
  return reference;
}

export async function loadExerciseVideo(
  reference?: ExerciseVideoRef,
): Promise<ExerciseMediaAsset | undefined> {
  if (!reference) return undefined;
  return getExerciseMedia(reference.id);
}

export async function removeExerciseVideo(reference?: ExerciseVideoRef) {
  if (reference) await deleteExerciseMedia(reference.id);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("影片備份讀取失敗。"));
    reader.readAsDataURL(blob);
  });
}

function dataUrlToBlob(dataUrl: string, fallbackType: string): Blob {
  const match = /^data:([^;,]+)?;base64,(.+)$/i.exec(dataUrl);
  if (!match) throw new Error("備份中的影片格式不正確。");
  try {
    const binary = atob(match[2]);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1)
      bytes[index] = binary.charCodeAt(index);
    return new Blob([bytes], { type: match[1] || fallbackType });
  } catch {
    throw new Error("備份中的影片內容無法讀取。");
  }
}

export async function createMediaBackup(): Promise<BackupMediaAsset[]> {
  const assets = await getAllExerciseMedia();
  return Promise.all(
    assets.map(async ({ blob, ...asset }) => ({
      ...asset,
      dataUrl: await blobToDataUrl(blob),
    })),
  );
}

export function restoreMediaBackup(
  records: BackupMediaAsset[],
): ExerciseMediaAsset[] {
  return records.map(({ dataUrl, ...record }) => {
    const blob = dataUrlToBlob(dataUrl, record.mimeType);
    if (blob.size !== record.sizeBytes)
      throw new Error(`影片「${record.fileName}」大小與備份資料不一致。`);
    return { ...record, blob };
  });
}

export function mergeMediaAssets(
  current: ExerciseMediaAsset[],
  incoming: ExerciseMediaAsset[],
): ExerciseMediaAsset[] {
  const merged = new Map(current.map((asset) => [asset.id, asset]));
  for (const asset of incoming) merged.set(asset.id, asset);
  return [...merged.values()];
}
