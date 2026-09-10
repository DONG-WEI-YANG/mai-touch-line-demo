# 異地備份與還原演練

2026-09-10使用者核准後已建立 `gs://mai-touch-history-20260908-backups`（us-west1），完成真實GCS上傳／下載與新檔還原驗證。Public Access Prevention=enforced、uniform access=true；bucket IAM僅指定操作帳戶kevin19830331@gmail.com，移除新桶預設的projectViewer／Editor legacy授權（專案層繼承權限仍適用）。

生命週期為`mai-touch/`前綴滿14天Delete，soft delete=0，避免刪除後再額外保留7天；沒有retention lock或版本保留。生命週期為非同步執行，不承諾恰好滿14天即刪除。首次驗證receipt：`_local/offsite/30035d97d2a54ec58a9dd74fa473725f/receipt.json`，SHA256=905ec719efdfa45c1eb57378def0a46652646eabf42d29972c54e94a62403816，integrity與foreign keys通過，未覆寫線上DB。

## 核准後的一次性準備

先確認既有私人 bucket，或核准新增 Cloud Storage 的費用與權限後再建立。不要用 Firebase Hosting 的公開素材位置。建議使用專用 bucket，啟用 uniform bucket-level access 與 public access prevention，僅授權指定操作帳戶讀寫備份；不授權 `allUsers`／`allAuthenticatedUsers`。腳本會拒絕沒有明確 enforced 防公開設定的 bucket。

以下保留重建模板，既有bucket不用重建；請先換掉占位名稱與帳號：

```powershell
gcloud storage buckets create gs://PRIVATE_BACKUP_BUCKET --project=mai-touch-history-20260908 --account=OPERATOR_ACCOUNT --location=us-west1 --uniform-bucket-level-access --public-access-prevention --soft-delete-duration=0
gcloud storage buckets update gs://PRIVATE_BACKUP_BUCKET --project=mai-touch-history-20260908 --account=OPERATOR_ACCOUNT --lifecycle-file=scripts/gcp-backup-lifecycle.json
```

生命週期模板只刪除 `mai-touch/` 前綴且已達 14 天的物件；不設定不可逆 retention lock。請核對 bucket 既有生命週期，因 update 會取代現有規則。Cloud Storage 及下載流量可能計費；免費 VM 不表示備份服務免費。

## 執行與驗收

操作電腦需要 Node、專案 `npm ci` 依賴、gcloud、已登入且具有 VM IAP SSH／sudo、bucket metadata read、object create/read 權限的操作帳戶。腳本每次明確指定 project/account；VM 無 service account、IPv6-only 的限制不需要變動，Cloud Storage 流量由操作電腦發出。

```powershell
./scripts/gcp-offsite-backup.ps1 -Bucket PRIVATE_BACKUP_BUCKET -Account OPERATOR_ACCOUNT -DryRun
./scripts/gcp-offsite-backup.ps1 -Bucket PRIVATE_BACKUP_BUCKET -Account OPERATOR_ACCOUNT
```

正式執行先檢查既有 bucket 私密設定，以 IAP 在 VM 呼叫既有 `snapshot.js backup` Online Backup；快照含完整 SQLite 資料，透過 mode 0600 暫存檔下載。比對 VM SHA256、驗證 integrity/FK 後，上傳 UUID 新物件（generation=0，禁止覆寫），再从 GCS 下載到新的本機路徑，驗證 SHA256 並還原到另一個新檔，重跑 integrity/FK。既有目的 DB/WAL/SHM 一律拒絕覆寫，不切換線上資料庫、不執行 seed。

成功才寫 `_local/offsite/<run-id>/receipt.json`，記錄物件、SHA256、驗證時間；結束碼 0 才算成功。失敗結束碼 1，日誌只含階段、不含憑證或 DB 資料。檢查失敗階段後重跑會使用新 UUID；不把僅成功上傳當成已完成演練。快照含個資與 token，本機 `_local` 必須使用受限帳戶／磁碟加密，不可提交或放到 public。腳本保留本機演練檔供查驗，操作人需依保留政策清理；VM 原備份沿用既有 14 份輪替。IAP 中途中斷可能留下 `/tmp/mai-touch-offsite-<run-id>.db`，核對 run ID 後由原操作帳戶清除該單一暫存檔。

## 排程與失敗追蹤

2026-09-10建立Windows工作`MaiTouch-OffsiteBackup`，每日台北09:00執行，錯過後補跑、每15分鐘重試共3次、單次上限1小時、不重疊執行。使用目前Windows帳戶Interactive登入、隱藏PowerShell視窗；不保存帳戶密碼。此為本機操作端排程，仍依賴電腦開機、使用者登入與gcloud有效登入。尚未接外部失敗告警，不可宣稱無人值守VM自主備份。

首次排程實跑16:56:52啟動，16:58:35產生`_local/offsite/b68874d935254da2bf5832da1728d099/receipt.json`，LastTaskResult=0；下一次2026-09-11 09:00。匿名HEAD讀取首份物件回403。兩次驗證均未修改線上資料庫。可用`Get-ScheduledTaskInfo -TaskName MaiTouch-OffsiteBackup`檢查最近結果；不能把一次成功當成未來每日都已成功。

核准並完成一次真實演練後，可在 Windows 工作排程器建立每日工作，使用同一已驗證帳戶執行 `pwsh -NoProfile -File <repo>/scripts/gcp-offsite-backup.ps1 -Bucket <bucket> -Account <account>`；設定錯過時間後補跑與失敗通知，將工作最後結果非 0 或最新 receipt 超過 26 小時視為告警。此方案依賴操作電腦開機、網路、gcloud 登入與 IAP 可用，並非 VM 自主備份。未接好告警前仍需操作人每日檢查工作結果。名目每日 RPO 為 24 小時，離線或工作失敗時會超過；RTO 尚未實測。

獨立復原演練可下載指定物件到 `_local` 的新檔，依成功 receipt 的 SHA256 執行：

```powershell
node --import tsx scripts/offsite-restore-drill.ts _local/download.db EXPECTED_SHA256 _local/NEW-restored.db
```

這只驗證可讀取資料及一致性；災難復原切換仍需停止服務、保留舊檔、設定新 DB 路徑、啟動與業務查詢驗收，參見 [持久化程序](PERSISTENT_HISTORY.md)。不要直接覆寫目前 `/var/data/mai-touch.db`。

官方參考：[cp generation 前置條件](https://docs.cloud.google.com/sdk/gcloud/reference/storage/cp)、[防止公開存取](https://docs.cloud.google.com/storage/docs/using-public-access-prevention)、[統一 bucket 權限](https://docs.cloud.google.com/storage/docs/using-uniform-bucket-level-access)。
