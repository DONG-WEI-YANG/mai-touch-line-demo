# 專案記憶

## 工作方式

- 2026-09-08 使用者指出 GitHub Actions CI 額度有問題，預期遠端檢查可能無法通過。後續優先以本機測試、型別、lint、建置及隔離 smoke 推進，不將 CI 額度不足視為程式失敗，也不因等待 CI 停止開發。
- 本輪已加入 PR 驗證與 Pages 部署前檢查，但尚未執行遠端 CI；後續需評估減少重複 CI 消耗。使用者要求先記憶與 commit，尚未調整 workflow 觸發方式。
- 專案記憶更新此檔，不修改 CLAUDE.md。最新完整性基準見 docs/SYSTEM_COMPLETENESS.md，待辦見 docs/NEXT_STEPS.md。

## 2026-09-08 驗證基準

- Vitest 96 個測試檔、644 項測試通過；覆蓋率 statements 52.50%、branches 46.79%、functions 50.58%、lines 53.33%，門檻通過。
- npm run type-check、npm run lint、npm run web:build、npm run smoke:system 均通過。
- smoke 使用暫存 SQLite 與本機 AI HTTP 契約服務，不代表真實外部 AI、LINE、IoT 或瀏覽器端到端驗收通過。
- python -m pytest -q nlp-service --disable-warnings 本輪未完成並已中止。該目錄 test_models.py 會涉及模型下載／推理，test_service.py 連線 localhost:8000；不能當作無外部依賴的單元測試或宣稱通過。
- 錢包加值仍因付款服務未設定而停用。

## 下輪檢查線索（尚未修正）

- 2026-09-08 已修正一般 API 可預約停用設施，以及不同 startTime 的重疊請求超額問題。API 與語音寫入共用 src/server/services/bookingService.ts，按設施／日期鎖定檢查及寫入；僅保障同一程序，多實例仍需資料庫層併發保護。
- 2026-09-08 已補上工單 update/delete 與預約 updateStatus 的 NOT_FOUND；預約重新確認檢查容量，工單重新開啟清除 resolvedAt。
- 上述僅為程式閱讀線索，需先重現與測試，不視為已確認缺陷。

## 工作區注意

- 本輪開始前 docs/slides 已有 PDF 刪除、V2 PDF 及精銳.pptx 新增；本輪完整性提交不包含這些使用者既有異動。

## 預約修正驗證

- 2026-09-08：97 個測試檔、649 項測試通過；行覆蓋率 53.54%；型別、lint、隔離 smoke 通過。新增停用設施、重疊併發、跨 API／語音寫入及相鄰時段回歸測試。

## 物業後台修正驗證

- 2026-09-08：98 個測試檔、665 項測試通過；行覆蓋率 54.50%；型別、lint、擴充 SQLite 隔離 smoke 通過。
- 設施參數驗證、停用時段、重疊容量、預約歷史刪除保護、Web 操作提示／刪除確認、工單指派優先級及住戶 10 秒狀態更新已補齊；詳見 docs/SYSTEM_COMPLETENESS.md。
- 瀏覽器工具初始化報 e.nodeRepl?.setResponseMeta is not a function，未完成點擊驗收；不要把 API smoke 說成瀏覽器驗收。
