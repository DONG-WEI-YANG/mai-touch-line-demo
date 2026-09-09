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

## GCP 免費 Demo 決定與阻塞（2026-09-08）

- 使用者改指定免費 Demo VM，取代前述付費提案；目標 e2-micro、us-west1-b、20 GB boot + 10 GB data，皆 pd-standard。免費用量由帳務帳戶共享，建立前需核對其他專案用量。
- billing link 實際回覆 FAILED_PRECONDITION: Cloud billing quota exceeded；唯一可見帳務帳戶專案連結額度已滿。複查 mai-touch-history-20260908 billingEnabled=false，Compute API 未啟用，VM／磁碟均未建立。
- 需額度調升或另一可用帳務帳戶；不得自行解除其他專案 billing。初始無 external IPv4／NAT／LB，以 IAP 管理，但公開 webhook 與 Gemini 對外連線尚需處理，不能宣稱可上線。
- 已更新 docs/GCP_DEPLOYMENT.md；仍暫不 push，避免 Render ephemeral DB 因部署重建。
- 使用者後續確認只提高帳務帳戶專案連結數，讓建材 Demo 綁定，不提高護理平台規格。實查已連結 5 個專案；申請增加 1 個（總數 6），草稿見 docs/GCP_BILLING_QUOTA_REQUEST.md。Chrome 初始化兩次失敗，申請尚未送出，不能記為核准。

## GCP 新帳號接續（2026-09-09）

- 使用者確認 GCP 承接免費 Demo，HF 留作公設語料辨識與 RAG 測試，不搬移目前後端到 HF。
- gcloud 已登入並切換 openclaw19830331@gmail.com；後續指令仍必須明確指定 --project，不能沿用全域 internship-checkin-system。
- 新帳號可見 My Billing Account（01C823-3F2E66-0A509A，TWD），list 與 describe 都回 open=false。帳務尚未開啟，不能記為可部署；需使用者在 Google 帳務頁完成啟用／處理頁面提示。
- 已由原管理帳號授予 openclaw19830331@gmail.com 在 mai-touch-history-20260908 的 roles/billing.projectManager，限帳務綁定管理，不是 Owner／Editor。VM 尚未建立，Render 未切換。

## GCP 免費 Demo VM 已建立（2026-09-09，取代上述帳務阻塞）

- 新帳務帳戶 01C823-3F2E66-0A509A 已 open=true，mai-touch-history-20260908 已綁定且 billingEnabled=true。使用者頁面顯示 NT$1,000 手動付款與 NT$2,000 後付扣款門檻；扣款門檻不等於免費額度。
- mai-touch-demo：us-west1-b、e2-micro、Debian 12、內網10.77.0.2、無公開IPv4／NAT／LB／VM service account；20 GB boot＋10 GB data 都是 pd-standard，data autoDelete=false。
- scripts/gcp-demo-startup.sh 只對明確命名且無檔案系統／分割／掛載的資料磁碟初始化 ext4，掛載 /var/data，建立 maitouch 系統帳戶。IAP SSH 實測成功，OS reboot 後 boot ID 改變、啟動腳本成功、掛載與測試檔均保留。
- 網路 mai-touch-demo-net，子網 mai-touch-demo-us-west1，IAP SSH 僅35.235.240.0/20→tcp22。openclaw 另獲 compute.viewer；管理 SSH 暫以原 kevin19830331@gmail.com 明確 --account 操作。
- VM 尚未部署 Node／後端／資料庫；一般對外連線、HTTPS、來源完整快照與 GCP mount 啟動防護尚未完成。不要宣稱 LINE／長期歷史已遷移；Render 與 Vercel 未切換，暫不 push。詳細現況見 docs/GCP_DEPLOYMENT.md。

## LINE 搬移準備（2026-09-09，尚未切換）

- VM／子網已改 IPV4_IPV6，外部 IPv6 為2600:1900:4040:21b::，未加公開 IPv4／NAT／入站規則；IPv6 IP 本身免費，流量仍受免費額度限制。實測 nodejs.org IPv6 HTTPS 可達，api.line.me DNS 目前僅IPv4，LINE 出口仍需處理。
- scripts/gcp-install-node.sh 已在 VM 安裝 Node24.20.0/npm11.19.0，官方 SHA256 校驗通過。
- persistentMountInfo 在 Linux REQUIRE_PERSISTENT_STORAGE=1 時會驗證真實 mount，不再僅認 RENDER；回歸測試先重現未掛載卻通過，再修正通過。
- 現行 Render 全庫備份端點再次確認404。已詢問固定 HTTPS 網域與是否接受部分 API 資料搬移，尚待回覆；不能以使用者要求搬移推定接受資料遺失。後端未部署、LINE未切換。

## Firebase／GCP LINE 已切換（2026-09-09）

- 使用者指定 Firebase，並接受 Demo 不保留舊紀錄；此次建立新示範資料庫，並非無損移轉 Render 歷史。
- 正式 Demo 入口 https://mai-touch-history-20260908.web.app 。LINE webhook 已改為此網址的 `/line/webhook`，GET endpoint 確認 active=true，切換前後官方 test 均 success=true、HTTP 200（2026-09-09 05:03 UTC）。
- Firebase Hosting 靜態前端與 HTTPS → Cloud Run `mai-touch-gateway`（us-west1，min=0/max=2，256Mi）→ Direct VPC → VM 10.77.0.2:3000。只有 gateway 網路標籤可通過新增的 API 防火牆。
- VM 使用 Node24.20.0、systemd `mai-touch`、`/opt/mai-touch/current`；資料庫 `/var/data/mai-touch.db` 位於獨立10GB磁碟。REQUIRE_PERSISTENT_STORAGE=1，拒絕缺掛載或缺資料庫的啟動；首次種子僅在本次明確初始化時執行。
- LINE 出口透過 Cloud Run 的 `/_line` 白名單及 token 驗證，沒有新增付費 IPv4／NAT／負載平衡器。Gemini 3.5 Flash-Lite API 實測200，LINE bot/info 及 validate/reply 亦200，未代發真實用戶訊息。
- Firebase 六項公設可查；測試預約 #4 建立並取消，VM OS 重啟後仍為 cancelled；完整 SQLite 快照下載及 integrity 驗證成功。啟動與每24小時備份，保留14份；自動異地備份尚未配置。
- 108檔／728項測試、type-check、lint、Web build 通過。尚未完成真實 LINE 點擊與瀏覽器 UI 驗收。
- Render 與舊 Vercel 網址仍是舊環境，不共享新資料；請使用 Firebase 入口。HF 仍留作語料／RAG 測試。
- 憑證只存在忽略的本機暫存、VM `/etc/mai-touch.env` 與 Cloud Run 環境，不可提交。前端 EXPO_PUBLIC_DEMO_* 必須與 VM WEB_*_TOKEN 一致，重新建置使用 `--clear` 防止 Metro 沿用舊值。
- 帳務已啟用後付；此配置以免費額度為目標，超量仍可計費，NT$2,000付款門檻不是免費額度。先前不得 push 的原因為保留舊 Demo；本次已获准重新初始化，完成切換後可提交推送。

## LINE 直覺入口（2026-09-10）

- 使用者同意六格固定選單、兩欄首頁、操作後下一步及物業管理入口。LINE 預設 rich menu 已啟用 `richmenu-e20db206cf73bbb882c8cd5b14908661`，selected=true、chatBarText=社區服務；六格為預約公設／查空時段／我的預約／訪客登記／報修服務／服務首頁。
- 選單原稿、LINE PNG 與觸控區域位於 public/line-menu；scripts/generate-line-rich-menu.cjs 由既有 SVG 圖示重建。使用文字標籤與 SVG，不以 emoji 當主要入口。
- serviceHome 改兩欄大按鈕；報修、訪客查詢、行事曆使用保留於訊息內的 Flex 按鈕。預約完成卡保留查看這筆預約、繼續預約與回首頁；取消亦有快捷入口。
- 六個預設入口依真實 LINE 角色分流。visitorRegister 對住戶直接詢問訪客姓名，對物業開查詢；文字入口轉流程時不把「訪客登記」或「我要報修」誤當欄位值。物業公設入口維持僅查空檔。
- 底部 rich menu 主要供手機 LINE 使用；電腦版保留「服務首頁」及六格同名文字入口。尚未完成使用者真實手機點擊驗收，不能宣稱所有 LINE 用戶端顯示一致。
- 官方 validate/reply 通過8組訊息，richmenu/validate 通過；啟用後回讀 default 及圖片 SHA256 與本機一致，webhook/test success=true／200。未代發用戶訊息。
- 108檔734項全套測試、type-check、lint 通過；另加入2項逐格住戶／物業整合測試，該檔15項全通過。Web build 與 Firebase Hosting 發布成功，線上選單圖片 SHA256 與本機一致。
- GCP release `/opt/mai-touch/releases/line-ui-20260910` 已啟用，server.js SHA256 與本機一致、服務 active；更新前快照驗證通過，更新後預約 #4 cancelled 仍保留，未重跑 init。
- scripts/validate-line-ui.ts 僅做官方格式驗證；scripts/publish-line-rich-menu.cjs --apply 需環境中的 LINE_CHANNEL_ACCESS_TOKEN，依內容 hash 重用選單，先保存舊 default 到忽略的 _local，再設定預設；不刪舊選單、不發用戶訊息。

## LINE 選單誤觸限流修正（2026-09-10）

- 使用者截圖顯示正常選單操作連續收到「訊息速度太快」。線上快照確認 runtime_config 為每分鐘10／每日200，00:28–00:29共12次 postback；舊 dispatcher 對所有事件共用文字額度且每次拒絕都回覆。
- makeRateLimiter 新增 interaction 獨立計數；正式入口將 postback、首頁／六格同名文字及固定服务流程文字歸入 interaction（每分鐘60／每日2000）。其他自由文字維持原可動態設定的10／200，選單不能耗用其額度。
- 同使用者限流提示每60秒至多一次，跨兩類額度共用提示冷卻；提示依實際分鐘／每日窗口計算等待時間，不再每日超額仍叫用戶稍候。保留所有入站稽核及事件去重。
- 先以回歸測試重現，再修正；108檔739項測試、型別、lint 通過。涵蓋連續20次導覽不被文字額度阻擋、選單仍有上限、自由文字保護、重複提示合併、每日等待與重設。
- 已部署 GCP release `/opt/mai-touch/releases/line-rate-fix-20260910`，server.js SHA256 與本機一致、服務 active、健康檢查 db=ok／line=ready、LINE 官方 webhook/test 200。部署後全庫快照驗證成功，28張表筆數未減少；未代發真實用戶訊息。

## UX全流程稽核與時段／導覽修正（2026-09-10）

- 使用者指出查空檔一直繞圈，接續要求整體UX／UI稽核，再提供Web內部分頁外洩截圖。範圍為LINE完整服務旅程與住戶／物業Web；稽核文件 docs/UX_UI_AUDIT_20260910.md，42個TSX頁面／layout靜態掃描與代表旅程瀏覽器實測，16類發現、3類已處理、13類待修／實機驗收。
- slotMessage改為帶設施／日期的Flex時段列，住戶點選後重新查名額→確認頁，queryOnly在明確選時段後才解除，不自動建立；物業只讀。分頁前後與回首頁保留於訊息內；舊卡日期／設施不匹配會提示重新查詢，已滿不進確認。
- 住戶底部分頁採index/services/activity/settings白名單，8個IoT元件從app/admin/iot-components移至components/admin/iot，更新引用。Demo角色切換器移至底列上方，分頁列高度76，避免遮擋與文字裁切。
- Playwright本輪可用，不再沿用之前Chrome工具故障當成阻塞。已實測公設服務入口404、管理工單ALL(9)但狀態0且點ALL崩潰、登出按鈕無動作。沒有做真實資料修改／刪除／LINE代發。
- Web React Native Alert.alert 實作為空，17個頁面檔共64處呼叫；稽核中的重大待修：工單API巢狀資料映射、缺失/amenities列表、登出無清憑證、通知錯誤被當成預約寫入失敗。不要把這些記為本次已修。
- Hosting曾預設HTML max-age=3600造成部署後瀏覽器仍載入舊bundle；新增HTML no-cache/must-revalidate、hash JS immutable、API與webhook no-store。已存在的舊HTML快取需強制重新整理一次。
- 本輪108檔743項測試、type-check、lint、Web build及11組LINE Flex官方驗證通過。GCP release line-slots-20260910已啟用且SHA256相符；健康檢查及LINE webhook/test200。所有更新保留DB，未重跑init，LINE真實手機點擊仍待使用者驗收。
- 最終瀏覽器驗收：390px四個分頁中心點均可點且未遮擋，逐一切到正確路由；admin/logistics沒有住戶分頁。Firebase最新bundle為5f201e3c3f55354c17ba266524e768dd；CLI release complete後有非零退出，但線上HTML／瀏覽器已驗證生效。

## UX修正接續（2026-09-10，本機未發布）

- 工作區已有AlertHost／共通Alert、登出、工單資料映射等未提交修正；本輪保留，移除工單映射留下的未使用型別。
- 補上src/app/amenities/index.tsx公設列表，串接真實API、停用過濾、詳情入口與載入／空／重試狀態。
- LINE預約／報修寫入成功後先結束會話，再分別處理住戶回覆與物業通知；通知失敗不復原成可重送狀態，不再提示寫入失敗。4項故障測試先失敗後通過；尚未加入持久通知重試佇列。
- 109檔748項測試、type-check、lint、Web build與SQLite隔離smoke通過。瀏覽器初始化setResponseMeta錯誤，Playwright另回browser already in use，本輪未完成點擊驗收。
- 本輪未deploy／push，線上仍是先前版本；詳見docs/UX_UI_AUDIT_20260910.md文末。本機開發後端啟動時套用既有0016 migration，未操作線上DB。

## UX修正發布完成（2026-09-10）

- 使用者明確要求部署、commit、push；程式commit e986b39已推送origin/main。
- Firebase Hosting發布成功（CLI exit 0）；正式入口https://mai-touch-history-20260908.web.app，線上HTML已驗證最新bundle entry-841238e6e207c36cc761a0b7c8bb8859.js與no-cache/must-revalidate。
- GCP current切換至/opt/mai-touch/releases/ux-e986b39；server.js SHA256 dc7c9a5c54fec1f2aeca8047c4a15d1a4ae7677889965fd92a79421c0e053de5與本機一致，服務active。沿用雜湊一致的package.json與既有Linux依賴，未重跑init或改動憑證。
- 公開health 200、db=ok／line=ready，LINE官方webhook/test success=true／200。未代發用戶訊息。
- 部署前HTTPS快照請求502，改由VM snapshot.js Online Backup成功；快照在/var/data/backups/pre-ux-e986b39/。部署後HTTPS全庫下載成功，SQLite完整性／外鍵檢查通過，本機忽略檔_local/gcp/ux-e986b39-after.db。
- 28張表逐表比較，27張筆數相同（含6筆預約、9筆工單）；line_sessions暫存會話由1變0，不能宣稱所有表完全不變。既有SessionStore有30分鐘TTL清理，但未單獨證明本筆刪除原因。
- 本輪發布前沿用109檔748項測試、型別、lint、隔離smoke通過結果，正式前端重新以--clear建置成功。瀏覽器點擊與真實LINE手機旅程仍未完成；簡報既有異動未提交。

## LINE工單快捷列錯配修正（2026-09-10）

- 使用者截圖指出工單／報修卡底下卻有查空時段與預約紀錄；原因是serviceActions共用固定公設快捷列，不是要求新增表單點選功能。
- homeQuickReply改明確情境：報修卡為服務首頁／工單進度／報修與服務；訪客卡為服務首頁／訪客與車號；預約完成保留公設入口；通用卡只顯示首頁，取消依原流程選擇快捷列。
- 回歸測試先重現後通過；109檔749項測試、type-check、lint通過，13組LINE訊息及rich menu官方格式驗證通過。
- 已發布GCP /opt/mai-touch/releases/context-menu-20260910；server.js SHA256 0ebd6293cb203f34d2fb1e287af1ce7539d145967ab2e9a352ed0daab2f8b2ed一致，公開health及LINE webhook/test成功200。切換前快照已驗證，未重跑init、未代發用戶訊息。前端無變更。
- 舊聊天卡片不會重寫，需重新開啟報修服務取得新卡；尚待使用者實機確認。
