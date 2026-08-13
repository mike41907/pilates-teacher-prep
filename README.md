# Pilates Prep｜器械皮拉提斯備課

器械皮拉提斯老師的本機優先 PWA：從動作庫挑選、排課、調整 Cue，到背課與現場帶課。

## 開發

```bash
pnpm install
pnpm dev
```

生產建置與預覽：

```bash
pnpm run typecheck
pnpm run build
pnpm run preview
```

## 第一版已完成

- React + TypeScript + Vite PWA，支援 standalone、Service Worker 離線快取與 safe-area
- IndexedDB 本機資料：動作、課表、課程內快照、模板、使用紀錄、設定
- Reformer 示範資料與可編輯的自訂動作
- 動作搜尋、器械／程度／部位／姿勢篩選、收藏
- 課程建立、動作加入／替換／複製／刪除、段落、桌面拖曳與手機長按排序
- 課程時間計算、結構分析與提醒
- 本堂課 Cue 與動作預設 Cue 分離
- 完整腳本、順序背誦、隱藏答案、Cue 背誦、熟悉度
- 大字高對比帶課模式、左右鍵／觸控操作、下一個提示、Speech Synthesis、Wake Lock fallback
- 課程歷史、複製課程、模板、JSON 備份與合併／覆蓋還原

目前資料僅儲存在使用者裝置；第一版沒有登入、後端、雲端同步或 AI。
