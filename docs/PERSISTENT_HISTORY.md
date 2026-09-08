# SQLite 歷史保存切換

目標：現行 Oregon `mai-touch-line-us`（srv-d81bh0gg4nts739bt1v0）保留預約、工單、訪客、停車、關聯、LINE 綁定及會話。保留 SQLite，避免將依賴 better-sqlite3 的 LINE 功能直接切換至不相容的資料庫。

## 已準備、尚未套用

- `render.persistent.yaml` 是既有服務的審查用設定，不是新服務申請。
- paid web service + 1 GB disk，掛載 `/var/data`，資料庫 `/var/data/mai-touch.db`。
- build 改為 `npm ci`。Render build/pre-deploy 不能存取 disk，禁止在 build 執行 `db:init:demo` 寫入持久路徑。
- start 改為 `npm run server:persistent`。掛載或資料庫遺失會停止，不建立空白歷史、不執行示範種子覆寫。
- 啟動及每 24 小時執行 SQLite Online Backup，驗證完整性及外鍵，轉成單一 DB 檔，保留最近 14 份。備份資料夾只修剪工具自己產生的檔案。
- 同磁碟備份只能防誤操作，不能取代異地備份。定期從管理端下載到另一個儲存位置；尚未接入雲端異地備份供應商。

## 付費與操作限制

2026-09-08 查閱 Render 官方價格：512 MB web service 約 US$7/月；disk US$0.25/GB/月，1 GB 合計約 US$7.25/月，另計稅／其他用量。套用前確認帳戶實際價格及 API plan ID。

Disk 只能由單一 instance 使用，部署有短暫停機。只保留 mountPath 下的資料。

- https://render.com/docs/disks
- https://render.com/pricing

## 切換順序

1. 暫停自動部署及實際寫入操作，盤點原 DB／备份取得方式。**取得完整快照前不得把 API 匯出當成完整備份，也不得直接部署使原 ephemeral DB 消失。**
2. 現有 API 可以額外匯出業務紀錄，供比對與部分救援；它不含所有表、token、會話等資料。
3. 完整快照若能透過原 instance 的 shell 取得，使用下面的 backup 指令。既有免費服務沒有已部署的全庫匯出端點；新增端點本身需要部署，因此不能靠它無損救回部署前的資料。若無全庫快照，先與使用者確認可還原範圍再遷移。
4. 核准付費後為**既有服務**升級並掛載 disk。保留 LINE、Gemini、WEB_* 等環境設定，不輸出憑證。設定固定 SESSION_SECRET。
5. 將驗證過的快照上傳 `/var/data/import/`，還原至尚不存在的 `/var/data/mai-touch.db`；不要對仍在運行的 DB 覆寫。
6. 依模板更新 build/start 與 env。確認 DATABASE_URL 未覆蓋 SQLITE_FILENAME 指向別處。`SQLITE_RESTORE_SOURCE` 僅用於第一次還原，完成後移除。
7. 確認 `/health`、LINE readiness、各表筆數、BK/V/P/WO 關聯及綁定一致。記錄一次快照校驗結果。
8. 做一次重啟／部署，確認同一筆歷史仍存在，再恢復寫入與自動部署。

## 備份與還原指令

```powershell
npm run db:snapshot -- backup /var/data/mai-touch.db /var/data/backups
npm run db:snapshot -- verify /var/data/backups/<snapshot>.db
npm run db:snapshot -- restore /var/data/backups/<snapshot>.db /var/data/restored.db
```

restore 只允許新目的檔，既有 DB 或 WAL/SHM 存在即拒絕。還原成功後，在停止服務時改 SQLITE_FILENAME 指向新 DB；保留舊檔以便回復。請勿使用 db:reset、刪檔、或以 seed 取代還原。

新程式部署後，`GET /admin/database/backup` 可產生並下載完整快照。必須帶 Authorization Bearer ADMIN_DASHBOARD_TOKEN；端點不接受 query token，回應 no-store，暫存快照在下載完成後移除。快照含個資與綁定 token，不加入 Git，不放 public/。

## 驗證

本機測試包含 WAL 資料快照還原、損毀快照拒絕、不覆寫目的檔、磁碟路徑／掛載檢查、備份輪替。仍需實際磁碟掛載與跨部署保留驗收，完成前不能宣稱線上歷史已持久化。
