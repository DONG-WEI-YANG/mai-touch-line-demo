# GCP 帳務專案連結額度申請

2026-09-08 使用者確認：只提高帳務帳戶的專案連結上限，讓建材 Demo 綁定；不升級護理平台或其他專案的運算規格。

## 申請欄位

- 入口：https://support.google.com/code/contact/billing_quota_increase
- Billing account ID：`0147CC-7377E5-35AF65`
- 聯絡帳戶：`kevin19830331@gmail.com`
- 新專案：`mai-touch-history-20260908`
- Project number：`331315864522`
- 目前查得已綁定專案：5 個；若表單詢問額外數量填 `1`，若詢問總數填 `6`。5 是實查連結數，非從 quota API 取得的上限。

## 申請理由（可貼入表單）

Please increase the number of projects that can be linked to billing account 0147CC-7377E5-35AF65 by one, to allow a total of six linked projects. Five projects are currently linked. Linking our new project mai-touch-history-20260908 (project number 331315864522) fails with FAILED_PRECONDITION: Cloud billing quota exceeded.

The new project is an isolated demonstration environment for a property-management and shared-facility booking application. We plan to use an eligible e2-micro VM in us-west1 with up to 30 GB of standard persistent disk, subject to the billing account's shared Free Tier limits. We understand that Free Tier allowances are shared across this billing account and that usage outside those allowances may be charged. We are requesting only one additional project link, without any increase to the compute capacity of our existing projects.

## 實際狀態

此檔是申請草稿，尚未送出或獲准。Chrome 操作工具初始化兩次均報 `e.nodeRepl?.setResponseMeta is not a function`，無法開啟登入表單代送。需在 Google 表單完成提交；如 Google 額外要求付款或預付金，應回報使用者，不自行付款。

提高專案連結上限不會增加免費 VM 額度。核准後仍須先核對本帳務帳戶當月 Compute Engine／磁碟免費用量，再綁定新專案並建立 Demo。既有 Render 後端未切換。
