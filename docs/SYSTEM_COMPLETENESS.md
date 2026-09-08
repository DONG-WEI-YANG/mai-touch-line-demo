# 系統完整性驗證基準

更新日期：2026-09-08。本文件取代 2026-02-15 的主觀完成比例；測試通過不代表正式服務或實體硬體已驗收。

## 本輪已驗證

| 項目 | 結果 |
|---|---|
| Vitest | 96 個測試檔、644 項測試通過 |
| 覆蓋率門檻 | 通過；statements 52.50%、branches 46.79%、functions 50.58%、lines 53.33% |
| TypeScript | `npm run type-check` 通過 |
| ESLint | `npm run lint` 通過 |
| Web 靜態輸出 | `npm run web:build` 通過 |
| 隔離系統 smoke | 認證、診斷權限、預約、AI 成功／失敗契約及靜態輸出全部通過 |

## 本輪交付

- PR 與手動驗證工作流程：`.github/workflows/verify.yml`。
- GitHub Pages 部署前加入型別、lint、覆蓋率與隔離 smoke 檢查，任一步失敗即停止後續部署。
- PR 驗證不需要正式環境 token；smoke 建立暫存 SQLite 及本機 HTTP AI 契約服務。
- GitHub Actions 的遠端執行尚未驗證；需推送後檢查實際結果。

## 驗證範圍與剩餘工作

- 現有測試涵蓋預約、權限、聊天、離線同步、LINE、語音、展示資料及帳務等契約；不等同所有畫面已完成人工操作驗收。
- 隔離 smoke 涵蓋住戶認證、管理員診斷權限、預約建立／查詢／取消、AI 失敗不偽造回覆及成功回覆持久化。靜態 Web 檢查僅驗證輸出 HTML 與圖示，不是瀏覽器端到端測試。
- 真實 AI、LINE、NLP 模型及實體 IoT 需各自配置後再做外部整合驗收。
- 錢包加值仍因未設定付款服務而停用，不能標示付款流程完成。
- 正式登入與 demo token 的上線邊界、備份還原、實機語音及跨角色瀏覽器流程仍需獨立驗收。

## 重現方式

依序執行 `npm ci`、`npm run type-check`、`npm run lint`、`npm run test:coverage`、`npm run web:build`、`npm run smoke:system`。
Python NLP 不包含在目前 Node CI。本輪 `python -m pytest -q nlp-service --disable-warnings` 未完成，不能宣稱通過。該目錄的 `test_models.py` 包含模型下載／推理，`test_service.py` 直接連線 `localhost:8000`；需先備妥模型與運行中的 NLP 服務，再做整合驗收。
