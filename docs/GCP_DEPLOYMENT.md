# GCP 專用環境

## 最新狀態：免費 Demo VM 已建立（2026-09-09）

- 新帳務帳戶 `01C823-3F2E66-0A509A` 已確認 `open=true`，新專案已綁定且 `billingEnabled=true`。帳戶屬於 openclaw19830331@gmail.com；NT$2,000 是付款門檻，不是免費點數。
- `mai-touch-demo`：`RUNNING`、`e2-micro`、Debian 12、`us-west1-b`、內網 `10.77.0.2`，無公開 IP、無 VM service account。
- 20 GB 開機磁碟 `mai-touch-demo`＋10 GB 資料磁碟 `mai-touch-history-data`，均為 `pd-standard`。資料磁碟 `autoDelete=false`，ext4 掛載 `/var/data`，`maitouch` 系統帳戶擁有該目錄。
- 專用網路 `mai-touch-demo-net`、子網 `mai-touch-demo-us-west1`（`10.77.0.0/24`，Private Google Access）；SSH 僅允許 IAP `35.235.240.0/20` 到帶 `mai-touch-iap` 標籤的 VM。
- `scripts/gcp-demo-startup.sh` 已套用。實際 IAP SSH 驗證啟動腳本 `Result=success / ExecMainStatus=0`、20 GB 根目錄擴容、獨立磁碟掛載。建立測試檔後執行 OS reboot，確認 boot ID 改變、掛載恢復且測試檔仍存在；這是磁碟持久化驗收，不是應用資料遷移驗收。
- 新帳務帳戶另一個已連結專案 `project-73b71309-ebb9-4158-937` 當下未啟用 Compute Engine；這是現況盤點，不代表已核對當月完整帳單。免費額度以帳務帳戶用量合計。
- openclaw 帳號在此專案具 `roles/billing.projectManager` 與 `roles/compute.viewer`；原管理帳號執行基礎設施建立及 IAP SSH，不把新帳號擴權為 Owner／Editor。

### 尚未上線的部分

VM 尚未安裝 Node.js／部署後端／匯入 SQLite；沒有一般網際網路出口或公開 HTTPS。尚未切換 LINE webhook 或 Vercel API URL。HF 僅保留為公設語料辨識與 RAG 測試方向。

後續須解決免費條件下的對外連線、取得並確認來源資料可還原範圍、補上 GCP 真實 mount 啟動防護，再驗證後端、備份還原、LINE 與 HTTPS。保持現行 Render，暫不 push 觸發 ephemeral DB 重建。

管理指令（明確指定原管理帳號及本專案）：

```powershell
gcloud compute ssh mai-touch-demo --project=mai-touch-history-20260908 --account=kevin19830331@gmail.com --zone=us-west1-b --tunnel-through-iap
```

## 免費 Demo 配置決定（2026-09-08）

使用者指定「demo用先配置free 建立VM」，取代下方付費提案。目標為 `e2-micro`（1 GiB）、Debian 12、`us-west1-b`；20 GB 開機磁碟＋10 GB 資料磁碟均使用 `pd-standard`，資料磁碟禁止隨 VM 自動刪除。免費用量以帳務帳戶合計，建立前仍需核對其他專案當月使用量，不能保證新專案自動取得額外免費額度。

初始 VM 不配置 external IPv4、Cloud NAT、負載平衡器或額外備份服務；透過 IAP SSH 管理。此配置尚不能直接提供公開 LINE webhook，亦無一般網際網路出口，套件安裝及 Gemini 呼叫的連線方式需另行處理，不能視為後端已可上線。

9 月 8 日原帳務帳戶 billing link 曾回覆 `FAILED_PRECONDITION: Cloud billing quota exceeded`；當時未建立 VM／磁碟。9 月 9 日改綁新帳務帳戶後已解除此阻塞，沒有解除其他專案的帳務連結。

原額度調升申請已非建立此 VM 的必要條件。現行 Render 保持運作，未切換 webhook；完整來源快照仍未取得。

官方依據：
- https://docs.cloud.google.com/free/docs/free-cloud-features
- https://cloud.google.com/vpc/pricing
- Google 錯誤提供的額度申請入口：https://support.google.com/code/contact/billing_quota_increase

## 已建立

- Project ID: `mai-touch-history-20260908`
- Project number: `331315864522`
- Display name: `MAI Touch History`
- Labels: `app=mai-touch`, `environment=production`
- 不改變操作者的 gcloud 全域預設專案；所有後續指令明確帶 `--project=mai-touch-history-20260908`。
- Project label 仍為最初的 `environment=production`；本次 VM label 為 `environment=demo`。已建立 VM 與磁碟並完成計費綁定；未建立 bucket 或公開 IP。

## 舊付費提案（已由免費 Demo 決定取代，不執行）

| 資源 | 配置 |
|---|---|
| 後端 VM | `mai-touch-api`，`e2-small`，2 GiB，Debian 12，`us-west1-b` |
| 開機磁碟 | 20 GB `pd-standard` |
| 歷史資料磁碟 | `mai-touch-history-data`，10 GB `pd-balanced`，掛載 `/var/data`，禁止隨 VM 自動刪除 |
| SQLite | `/var/data/mai-touch.db`，沿用既有 schema／LINE 綁定／關聯表 |
| 對外 IP | 專用 static IPv4；僅對外開 80/443，SSH 由 IAP 管理 |
| 備份 bucket | `mai-touch-history-20260908-backups`，us-west1，Uniform bucket-level access，Public Access Prevention |
| 備份 | 每日 SQLite Online Backup＋校驗後上傳，保留 30 日；本機保留14份 |
| 執行身分 | 專用 VM service account；bucket 寫入／讀取僅針對本 bucket，避免專案 Editor 權限 |
| 機密 | Gemini、LINE、網站 token 與 SESSION_SECRET 使用 Secret Manager，禁止寫進 repo、VM startup metadata 或輸出日誌 |
| 執行方式 | Node.js 24，systemd，`npm run server:persistent`，TLS reverse proxy |
| 前端 | 保留既有 Vercel，不搬移 |

選擇 us-west1 是沿用現行 Oregon 後端的區域經驗；實際搬移仍需確認 Gemini 可用，不能由區域相同推定已驗收。

## 費用估算

按 730 小時/月、不計免費額度或承諾折扣粗估：e2-small 約 US$12.23/月；使用中的 IPv4 約 US$3.65/月；磁碟與小量備份另計。建議以 **US$18–22/月** 作起始預算，實際費用視區域 SKU、儲存、流量及稅費調整，不是固定報價。

不包含網域購買、付費負載平衡器、大量對外流量。TLS 將使用自有網域與自動憑證；後端網域仍待指定。預算通知不會自動停止花費。

來源（2026-09-08 查閱）：
- https://cloud.google.com/products/compute/pricing/general-purpose?hl=zh-TW
- https://cloud.google.com/compute/disks-image-pricing
- https://cloud.google.com/vpc/pricing
- https://cloud.google.com/storage/pricing

## 執行順序

1. 確認上述付費預算及計費帳戶，才綁定 billing 並建立資源。
2. 建立專用網路／VM／磁碟／備份 bucket／最小權限 service account，不使用其他專案資源。
3. 明確驗證 /var/data 是實際磁碟掛載（GCP 不使用 RENDER 環境旗標，啟動檢查需補上 mount 驗證）。
4. 依 docs/PERSISTENT_HISTORY.md 取得完整來源快照、核對可還原範圍；目前 _local/pre-persistence-* 只是 API 匯出，不能宣稱完整 DB。
5. 還原到新環境，測試單據關聯、登入、Gemini、LINE 簽章驗證與備份還原。
6. 指定 HTTPS 網域與 DNS，驗證 TLS 後再切換 LINE webhook／前端 API URL。切換前維持 Render 現行服務。
7. 確認重啟後歷史仍存在、異地備份可下載還原後，才停用舊服務，避免雙邊持續寫入。

以上舊付費提案未套用；目前實際資源與未完成項目以本文件最上方 2026-09-09 狀態為準。
