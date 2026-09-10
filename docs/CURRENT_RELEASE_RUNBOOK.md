# Firebase + GCP 可重現發布（現行 Demo）

唯一現行入口為 https://mai-touch-history-20260908.web.app 。Firebase Hosting → Cloud Run `mai-touch-gateway` → `mai-touch-demo`（`mai-touch-history-20260908`、`us-west1-b`）。Render／Vercel 不共享現行資料，不是本流程目標。

2026-09-10已使用這些腳本建置並發布audit-20260910，遠端manifest、快照與健康檢查通過。發布不會建立雲端資源、改 webhook、修改憑證或初始化資料庫。`APP_PROFILE=production` 的正式認證限制與目前公開 Demo 是不同設定；本前端 builder 明確保留現行 Demo。

## 本機準備

先執行 `npm ci`、`npm test`、`npm run type-check`、`npm run lint`。準備兩份 Git 忽略的環境檔：

- `_local/frontend-release.env`：`EXPO_PUBLIC_API_URL=https://mai-touch-history-20260908.web.app` 及三組實際 `EXPO_PUBLIC_DEMO_ADMIN_TOKEN`／`LOGISTICS_TOKEN`／`RESIDENT_TOKEN`。
- `_local/backend-release.env`：從現行安全部署環境取得的 `WEB_ADMIN_TOKEN`／`WEB_LOGISTICS_TOKEN`／`WEB_RESIDENT_TOKEN`，供一致性比對。不要以示意值代替，不要提交這份檔案。

```powershell
node scripts/build-firebase-release.cjs _local/frontend-release.env _local/backend-release.env
npm run smoke:system
node scripts/prepare-gcp-release.cjs
```

前端 builder 拒絕錯誤 API origin、缺少／過短／示意 token、未忽略環境檔及前後端不一致憑證。禁用 dotenv 隱式載入，清除既有公開環境值，使用 `--clear`。它不記錄憑證值。檢查依賴本機後端環境檔確實代表現行 VM；不是線上憑證驗證。Demo 公開 token 仍會嵌入客戶端，是 Demo 功能的既有設計。

後端輸出 `_local/gcp/release-<timestamp>`，只含 `server.js`、`snapshot.js`、精確版本 `package.json`、目前 repo 的完整 migrations 與 `SHA256SUMS`。不包含初始化入口、資料庫或環境檔。記錄此次 Git commit、工作區異動與這份 manifest；未提交工作區建置不可宣稱完全等同 commit。

## VM 發布

將輸出目錄上傳為 `/tmp/mai-touch-<release-id>`，並上傳 `scripts/deploy-gcp-release.sh`。所有 gcloud 命令明確指定 project、zone、account；不可沿用全域預設專案。以下是格式，實際目錄與已授權帳戶由操作者替換：

```powershell
gcloud compute scp --recurse _local/gcp/release-TIMESTAMP mai-touch-demo:/tmp/mai-touch-RELEASE --tunnel-through-iap --project=mai-touch-history-20260908 --zone=us-west1-b --account=AUTHORIZED_ACCOUNT
gcloud compute scp scripts/deploy-gcp-release.sh mai-touch-demo:/tmp/deploy-gcp-release.sh --tunnel-through-iap --project=mai-touch-history-20260908 --zone=us-west1-b --account=AUTHORIZED_ACCOUNT
gcloud compute ssh mai-touch-demo --tunnel-through-iap --project=mai-touch-history-20260908 --zone=us-west1-b --account=AUTHORIZED_ACCOUNT --command="sudo bash /tmp/deploy-gcp-release.sh /tmp/mai-touch-RELEASE RELEASE"
```

腳本取得部署鎖、驗證真實掛載／既有資料庫、完整 manifest、套件 manifest 一致，再由舊版 Online Backup 建立並驗證快照。它建立獨立 release，複製所有 migrations，沿用相同 manifest 的 Linux node_modules，以 atomic symlink 切換後重新啟動服務。必須在期限內得到服務 active、`db=ok`／`line=ready` 與相符檔案 hash；失敗切回舊程式。

若 package.json 不同，腳本拒絕發布；必須另行準備、鎖定及驗證新的 Linux 依賴，不能複製 Windows node_modules 或略過檢查。舊 release 的 node_modules 被新 release 引用，不可刪除其來源目錄。

若 migrations 不同，預設拒絕。人工確認 migration 可由舊程式相容讀写後才可增加 `--schema-rollback-reviewed`。此旗標代表已完成審查，不會自動證明相容。**程式回退不回退 schema，也不覆寫資料庫**；不相容 migration 必須另行設計維護窗口、向前修復或從驗證快照還原到新檔的程序，先處理快照後新增資料，不可盲目還原造成資料遺失。

## 前端發布與遠端驗證

若修改LINE relay，先更新既有gateway；此範例只換image，保留目前網路、環境與資源配置。將TAG及DIGEST替換為本次build產物，禁止使用其他專案預設值：

```powershell
gcloud builds submit infrastructure/firebase-gateway --tag=us-west1-docker.pkg.dev/mai-touch-history-20260908/mai-touch/firebase-gateway:TAG --project=mai-touch-history-20260908 --account=AUTHORIZED_ACCOUNT
gcloud run services update mai-touch-gateway --image=us-west1-docker.pkg.dev/mai-touch-history-20260908/mai-touch/firebase-gateway@sha256:DIGEST --region=us-west1 --project=mai-touch-history-20260908 --account=AUTHORIZED_ACCOUNT
```

確認新revision已承接流量，再部署相依後端。保留舊revision供回退；不要輸出環境內容或在指令中加入token。

後端驗證後，從 repo 根目錄執行：

```powershell
firebase deploy --only hosting --config firebase.gcp.json --project mai-touch-history-20260908
```

確認正式 HTML 指向本次 bundle、HTML Cache-Control 為 no-cache/must-revalidate，API health 可用，再以本人／管理角色驗收核心旅程。LINE webhook test 是官方契約測試，不等於手機點擊驗收；不得代發住戶訊息。前端發布失敗不會自動還原後端；應確認前後版本 API 相容。

部署前快照位於 `/var/data/backups/pre-<release-id>`。腳本不刪除 release 或快照；每日同磁碟備份不等於異地備份。遠端執行、LINE 實機、異地還原與 RPO/RTO 必須分別記錄，不以本機語法檢查替代。
