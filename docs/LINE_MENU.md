# LINE 社區服務入口

手機 LINE 開啟聊天室後，展開底部「社區服務」即可操作六格選單。若尚未更新，先離開聊天室再重新進入。電腦版可輸入「服務首頁」，使用訊息內的大按鈕。

| 入口 | 住戶 | 物業 |
|---|---|---|
| 預約公設 | 選設施、日期、時段 | 查看設施空檔 |
| 查空時段 | 查可用名額 | 查可用名額 |
| 我的預約 | 本人預約與關聯 | 管理範圍內預約 |
| 訪客登記 | 直接開始登記 | 訪客／車號查詢 |
| 報修服務 | 報修、反映問題、查進度 | 工單進度 |
| 服務首頁 | 住戶首頁與行事曆 | 物業首頁與後台 |

文字輸入上述同名入口也可直接操作，不使用 AI 分類。模型保留給複雜自由描述。

## 美編與更新

- `node scripts/generate-line-rich-menu.cjs` 重建 public/line-menu/community.svg、community.png、community.json；圖片與觸控區域使用同一份六格配置。
- `npx tsx scripts/validate-line-ui.ts` 使用環境中的 LINE_CHANNEL_ACCESS_TOKEN 呼叫官方格式驗證，不發訊息。
- 先部署後端，確認健康與既有資料，再以 `node scripts/publish-line-rich-menu.cjs --apply` 設定預設選單。token 不得寫入 Git 或命令列文字。
- 發布脚本依圖片與配置 hash 重用選單，保存先前 default 到忽略的 `_local/line-rich-menu-*.json`，保留舊選單供回復。若先前沒有 default，回復應移除 default 設定，不能誤刪其他選單。
- Firebase 靜態資產沿用 firebase.gcp.json 部署；住戶／物業首頁 Flex 在 VM 後端產生。

## 驗證限制

官方驗證與圖片回讀通過，不等於實際手機點擊驗收。Rich menu 可能受用戶端支援與既有個人選單覆寫影響；本次發布前 API richmenu/list 無既有選單。各入口仍在伺服器依 LINE 身分及資料權限處理。
