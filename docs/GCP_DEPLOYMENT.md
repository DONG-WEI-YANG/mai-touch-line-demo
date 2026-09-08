# GCP 專用環境

## 已建立

- Project ID: `mai-touch-history-20260908`
- Project number: `331315864522`
- Display name: `MAI Touch History`
- Labels: `app=mai-touch`, `environment=production`
- 不改變操作者的 gcloud 全域預設專案；所有後續指令明確帶 `--project=mai-touch-history-20260908`。
- 目前僅建立 project；VM、磁碟、bucket、對外 IP 均尚未建立，計費綁定待確認。

## 待核准配置

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

尚未取得付費同意，未建立 VM 或切換 webhook，也未宣稱持久化已上線。
