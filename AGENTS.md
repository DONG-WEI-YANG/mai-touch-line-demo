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

## 住戶取消流程修正（2026-09-08）

- 我的預約改用頁面內確認與結果提示，支援待確認／已確認預約取消、重複點擊保護、設施名稱與讀取失敗重試。
- src/lib/booking-cancellation.ts 區分伺服器確認與離線排隊；儲存失敗會顯示錯誤，伺服器 4xx/5xx 拒絕不誤排入離線佇列。
- 住戶取消在容量鎖內重新檢查所有權與狀態；已完成預約回 CONFLICT，已取消重送不再寫入。
- 99 個測試檔、678 項測試通過；行覆蓋率 54.81%；型別、lint、Web 建置、SQLite 隔離 smoke 通過。Web 建置會重寫 dist，smoke 必須在建置完成後執行。

## 發布授權與基準（2026-09-08）

- 使用者已要求記憶、commit、push、deploy。本次發布包含 d8550b1、c063b31、06b76dd、9968708：完整性驗證、預約容量、物業後台及住戶取消流程。
- 發布前本機驗證：99 檔／678 項測試、型別、lint、Web 建置及 SQLite 隔離 smoke 通過；行覆蓋率 54.81%。
- origin 為 DONG-WEI-YANG/mai-touch-line-demo；前端 .vercel/project.json 對應 mai-touch-web；render.yaml 指出現行後端為 mai-touch-line-us（Oregon），舊 blueprint mai-touch-demo 不是現行目標。
- 2026-09-08 實查 Vercel CLI 59.11.2 已安裝；名為 render 的本機命令是模板工具，不是 Render 雲端 CLI。
- 發布完成狀態須另以遠端部署結果確認，此記錄不代表部署已完成。

## LINE 無回覆修正與模型切換（2026-09-08）

- 線上 webhook active 且指向 mai-touch-line-us；日誌確認供應商 503，原 8 次重試加 SDK 內建重試造成長時間無回覆。
- 使用者指定 LINE 回應／預約解析改用 gemini-3.5-flash-lite，並提供主用及備援憑證。兩組皆已實際呼叫成功；僅寫入 Render 環境，不保存憑證於 Git。
- 現行 Render 服務 OPENAI_MODEL 已設定 gemini-3.5-flash-lite；OPENAI_API_KEY 依主用、備援順序逗號分隔。部署後 getAi() 載入，首組失敗才切換下一組。
- OpenAIIntent 預設最多 2 次，每次 timeout 8000ms，停用 SDK 重試，避免 LINE 長時間沒有錯誤回覆。679 項測試、型別及 lint 通過。

## LINE 日期與逾時備援（2026-09-08）

- 截圖對應日誌確認兩組模型均 timeout；居民 AI 不可用時提供服務選單及可直接操作的設施卡片。較晚完成的 AI 請求不覆寫已開始的會話。
- 日期快捷鍵改為本地化標籤及台北日期 YYYY-MM-DD，補接 LINE 原生日期／時間選擇器 params。
- 99 檔／682 項測試、型別及 lint 通過。尚需真實 LINE 點擊驗收。
- 使用者詢問常用語料／RAG；建議常用意圖先規則辨識，RAG 查社區文件，即時空位與預約仍由資料庫處理；本次尚未實作 RAG。

## LINE 公設、空檔與紀錄串聯（2026-09-08）

- 使用者要求擴充公設常用辨識、列出空時段供物業查詢，並串聯空間預約、訪客與車號紀錄。
- facility-phrases.ts 以完整短句／別名辨識既有六類設施；複雜日期、否定、報修、取消不以片段關鍵字誤判。Gemini 保留為複雜語句解析。
- LINE 選擇日期後從 amenities.getSlots 讀可用名額、排除台北過去時間，分頁提供選項；寫入改為 createCheckedBooking 並依設施實際 slotDuration 取得結束時間。
- 查詢指令：查空檔 泳池 YYYY-MM-DD、查詢空間預約單、查詢訪客、查詢車號 ABC-1234、查詢 BK-1。住戶依 appUserId 限制，LINE housekeeper/admin 可查物業紀錄。
- 關聯 BK-1 V-2 P-3：SQLite migration 0016 保存雙向關聯與建立者／時間；交易驗證單號存在及同一住戶所有權，不依姓名或車號自動猜測關聯。V 對應既有 [visitor] 工單，P 對應 parking_assignments；查單號／車號展開關聯。
- 此功能沿用目前 SQLite demo 儲存；Render 免費服務部署重建資料的既有限制仍在，正式歷史保存須持久化資料庫。RAG 尚未實作。

## 預約歷史行事曆（2026-09-08）

- 使用者追加要求以行事曆顯示歷史；住戶 my-bookings 與物業 admin/bookings 加入月曆、日期筆數、前後月份、今天與全部紀錄，點日期依時間列出當日預約，保留取消／完成紀錄。
- 預約卡可展開關聯訪客／車號，bookings.relatedRecords 依 web 登入者再次檢查所有權；住戶限本人，admin/logistics 可查管理紀錄。
- 104 檔／713 項測試通過，型別、lint、Web 建置通過；涵蓋閏年／跨年、台北日期、關聯越權、物業查詢與空檔分頁。瀏覽器初始化依然失敗，未完成點擊驗收。

## LINE 角色服務首頁與 SVG 圖示（2026-09-08）

- 使用者要求 LINE UI/UX 更豐富、擴展角色服務、直覺操作減少 token，並以 SVG 美編減少 emoji。
- 服務首頁依住戶／物業角色顯示入口；首頁、公設選擇、空檔、紀錄卡片、訪客／報修流程入口均使用 postback／固定辨識，不呼叫模型。自由描述仍使用 Gemini。
- 訊息「服務首頁」可開首頁；住戶與物業皆可用查空檔流程，queryOnly 不可建立預約。工單 WO 亦可與 BK/V/P 同住戶紀錄關聯；訪客單統一 V 編號。
- 新增 12 組 public/line-icons SVG 原稿與 PNG，scripts/generate-line-icons.cjs 可重建。LINE Flex 官方只支援 JPEG/PNG，因此使用 SVG 轉圖；前端靜態部署提供 /line-icons/。
- 新版住戶／物業首頁、公設卡、成功卡、紀錄卡及時段訊息共 6 組已通過 LINE validate/reply（未發送用戶訊息）。716 項測試、型別、lint、Web 建置與隔離 smoke 通過；未完成真實 LINE 點擊及瀏覽器驗收。

## 持久化準備（2026-09-08，尚未套用線上）

- 使用者要求長期歷史保存。實查現行 mai-touch-line-us 為 free、無 disk，build npm ci && npm run db:init:demo、start npm run server。
- 已準備 render.persistent.yaml：既有 Oregon 服務改付費與 1 GB /var/data，build 僅 npm ci，start server:persistent；保留現有憑證。官方價格估算 US$7.25/月（另計其他用量），付費升級尚待使用者確認。
- persistent startup 要求已掛載目錄與既有／可還原的驗證快照，拒絕遺失資料庫時默默建立空白歷史；持久模式 migration 失敗即停止。
- SQLite Online Backup、完整性／外鍵檢查、每日備份保留14份、只還原到新檔、不覆写既有目的檔已實作。管理 token 保護 /admin/database/backup 下載，no-store；同磁碟備份不等於異地備份。
- 切換前 API 匯出保存在忽略的 _local/pre-persistence-*：3預約、9工單、6設施、3帳戶、0 LINE 綁定、0停車紀錄。這是部分 API 匯出，不是完整 SQLite 快照；尚未取得完整線上快照，不得宣稱無損遷移。
- 切換與還原程序見 docs/PERSISTENT_HISTORY.md。暫不 push，以免自動部署重建 ephemeral DB；線上磁碟、長期保存與跨部署驗收尚未完成。
- 驗證：107 檔／722 項測試、type-check、lint、隔離 smoke 通過；包含快照下载權限、WAL 還原與不覆寫測試。

## GCP 專用專案（2026-09-08）

- 使用者選擇為本系統新建 GCP 專案，已建立 mai-touch-history-20260908（project number 331315864522），ACTIVE。不改動 gcloud 原預設專案。
- 尚未綁定 billing 或建立 VM／磁碟／bucket。待核准方案為 Oregon e2-small 2GiB + 20GB boot + 10GB data + static IPv4 + Cloud Storage 備份，初估 US$18–22/月，另計流量等；詳見 docs/GCP_DEPLOYMENT.md。
- 後端 HTTPS 自有網域尚待指定；來源仍只有 API 匯出，未取得完整 SQLite 快照。Render 持久磁碟方案尚未套用；GCP 路線接續資料保存目標。
