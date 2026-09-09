# UX／UI 稽核 — 2026-09-10

本次發現16類問題；時段流程、底部分頁及Hosting HTML快取已上線。後續本機修正與驗證見文末；其餘項目仍須修復或實機驗證，沒有宣稱全系統UX已修完。

## 範圍與方法

- 全面靜態掃描目前42個 `src/app/**/*.tsx` 頁面／layout，以及LINE dispatcher、住戶／物業handler、Flex與紀錄查詢；檢查入口、返回、完成、錯誤／空狀態、角色與文案。
- 瀏覽器實測：角色切換、住戶服務入口、404、設定登出、管理工單篩選／崩潰，以及390px導覽。沒有對真實工單或預約執行寫入／刪除，也沒有代發LINE訊息。
- LINE 以使用者截圖、回歸測試及官方訊息驗證核對；尚未完成Android／iOS／LINE桌面逐步點擊。
- 靜態掃描不是逐頁互動通過證明；下方特別標出程式確認與實測。P1會阻擋主要任務或誤導重送；P2影響理解、可發現性或操作效率。

## 發現與驗收條件

### UX-01 P1 — LINE 查空檔無下一步

- 現象／原因：查詢模式移除時間選項，僅剩更多時段／更換日期。
- 狀態：已修正上線：訊息內時段按鈕，住戶可接確認頁，物業僅查詢，含前後頁與首頁。
- 依據：`src/server/line/record-query.ts:17`
- 驗收：住戶查詢→選時段→確認；物業不能建立；過期卡與已滿時段不得確認。

### UX-02 P1 — 住戶底部洩漏內部路由

- 現象／原因：瀏覽器及使用者截圖顯示15個分頁，包含admin與IoT元件。
- 狀態：已修正上線：四分頁白名單；8個IoT檔移出app路由目錄；Demo切換器移至分頁上方，底列增高避免文字裁切。390px實測4分頁，頁宽390無溢出。
- 依據：`src/app/_layout.tsx:160`
- 驗收：桌面／390px都只有4個可見分頁；未來新檔不能自動出現在底欄。

### UX-03 P1 — Web Alert 無提示／確認

- 現象／原因：已安裝 react-native-web 的 Alert.alert 是空方法；17個TSX檔合計64次呼叫，包括刪除確認與錯誤提示。
- 狀態：待修。是共通問題，不是64個獨立已實測故障。
- 依據：`node_modules/react-native-web/dist/exports/Alert/index.js:11`
- 驗收：改頁內 notice／確認對話框；刪除需能取消及確定，成功／失敗都可見。

### UX-04 P1 — 物業工單空白與崩潰

- 現象／原因：實測ALL (9)，各狀態0筆；按ALL後拋出 undefined.toUpperCase。API回{workOrder,userName}，頁面卻當扁平工單。
- 狀態：待修；已由瀏覽器與API實作雙重確認。
- 依據：`src/app/admin/work-orders.tsx:48`
- 驗收：正確展平API結果；狀態合計等於總數，切換ALL不得崩潰。

### UX-05 P1 — 公設服務入口不存在

- 現象／原因：實測服務頁 Dynamic Lifestyle Curation 點入 /amenities，顯示 Unmatched Route；只有 /amenities/[id]，沒有列表頁。
- 狀態：已補本機 `/amenities` 列表，讀取實際公設、排除停用項目，提供載入／空清單／失敗重試與詳情入口；尚未部署或完成瀏覽器點擊驗收。
- 依據：`src/app/services.tsx:73`
- 驗收：提供真實公設列表，或改成確實存在且符合標籤的入口。

### UX-06 P1 — 設定頁登出沒有登出

- 現象／原因：實測點Logout，仍在settings且無對話框；程式只呼叫Alert，沒有logout或清憑證動作。
- 狀態：待修。即使原生Alert可見也未接真正登出。
- 依據：`src/app/settings.tsx:141`
- 驗收：確認後清憑證與使用者快取、到登入頁，取消則保持登入。

### UX-07 P1 — 通知失敗被當成預約／工單失敗

- 現象／原因：bookFn/reportFn成功後，回覆與pushHousekeepers仍在同一try。推播失敗會走失敗提示；預約回CONFIRMING，可能誘導重送。
- 狀態：本機已分離通知錯誤，成功寫入後先保存 IDLE，再獨立嘗試住戶回覆與物業通知；失敗記錄單號，不回到確認或提示寫入失敗。尚未加入持久通知重試佇列、未部署。
- 依據：`src/server/line/handlers/resident.ts:123`
- 驗收：寫入成功應明確保留成功狀態；通知另外重試，不能引導再建立一次。

### UX-08 P2 — 關聯紀錄反覆回相同卡片

- 現象／原因：related()包含起始單據，recordResult每張卡仍產生查詢自身ref的「查看關聯紀錄」；無關聯時沒有終點提示。
- 狀態：程式確認，待修。
- 依據：`src/server/line/flex/serviceHome.ts:58`
- 驗收：區分清單與詳情；無關聯顯示尚無關聯，提供回清單／首頁。

### UX-09 P2 — LINE 轉派按鈕無功能

- 現象／原因：工單卡有轉派，但handler只回reassign — coming in v2。
- 狀態：程式確認，待修。
- 依據：`src/server/line/handlers/housekeeper.ts:35`
- 驗收：移除未完成按鈕或接真實後台指派入口，不能偽裝可完成。

### UX-10 P2 — 日期／訪客時間仍依赖暫時快捷列

- 現象／原因：dateTimePicker是純文字＋quickReply。被下一則訊息取代後需回找或手輸；其他日期按鈕只標「其他」。
- 狀態：程式確認；手機／桌面原生picker支援差異仍需實機驗收。
- 依據：`src/server/line/flex/dateTimePicker.ts:4`
- 驗收：日期時間有保留於訊息內的入口、返回與取消；填寫進度可見。

### UX-11 P2 — LINE取消說明導向錯誤紀錄

- 現象／原因：取消說明叫使用者輸入查詢工單找預約編號，但makeRecordQuery對查詢工單只列WO。
- 狀態：程式確認，待修。
- 依據：`src/server/line/flex/i18n.ts:66`
- 驗收：直接開本人預約或可取消的Web連結，不要繞回不含BK的工單列表。

### UX-12 P2 — 活動卡看似可點卻無動作

- 現象／原因：activity以TouchableOpacity呈現工單卡，activeOpacity=0.7，但沒有onPress。
- 狀態：程式確認，待修。
- 依據：`src/app/activity.tsx:84`
- 驗收：接詳情／進度，或改非互動容器，不能有按壓回饋卻無下一步。

### UX-13 P2 — Web預約返回造成重新走流程

- 現象／原因：確認或時段步驟返回都setStep(details)，再進時段handleProceedToSlots重設為第一天。
- 狀態：程式確認，待修；不是資料庫預約遺失。
- 依據：`src/app/amenities/[id].tsx:73`
- 驗收：確認返回時段並保留日期／人數／備註；已完成頁不回可重送狀態。

### UX-14 P2 — 查詢錯誤可能被呈現為空清單

- 現象／原因：部分列表只解構data/isLoading，未顯示query error；activity固定isLoading=false，API讀取失敗可能呈現沒有紀錄。
- 狀態：靜態確認錯誤出口缺失；線上斷網／500故障尚未全面注入。
- 依據：`src/app/activity.tsx:55`
- 驗收：區分讀取中、查無資料、讀取失敗，提供保留篩選條件的重試。

### UX-15 P2 — LINE與Web語言／角色標籤不一致

- 現象／原因：LINE中文，但Web預設Brain/Concierge/Timeline/System及英文登入。單一預設rich menu對物業仍寫我的預約／訪客登記，實際進管理查詢。
- 狀態：程式與瀏覽器確認，待改善文案／角色選單；不代表授權越權。
- 依據：`src/components/demo-role-switcher.tsx:25`
- 驗收：依使用者語言及角色顯示名稱，同一任務的入口用詞一致。

### UX-16 P1 — 部署後一小時仍可能看舊UI

- 現象／原因：瀏覽器載入舊20d3e bundle，query版本參數才換成新ec613 bundle；HTTP回Cache-Control:max-age=3600。
- 狀態：已調整Hosting快取：HTML每次重新驗證、hash資產長快取、API no-store；既有舊快取需強制重新整理一次。
- 依據：`firebase.gcp.json:43`
- 驗收：刷新後使用最新HTML；相同hash靜態檔可快取，API不可快取。

## 旅程覆蓋

| 旅程 | 結果 |
|---|---|
| LINE首頁／角色入口 | 六格與Flex格式已驗證；角色文案UX-15待改善 |
| LINE查空檔→預約→確認 | UX-01已修；新時段卡帶設施日期、防過期、防越權，寫入仍需確認 |
| LINE預約／工單完成與通知 | UX-07待修；通知故障不可覆寫成功結果 |
| LINE訪客／報修填寫 | 固定入口已有；日期時間UX-10、完成出口與錯誤保留需後續整合 |
| LINE查單／關聯／取消 | UX-08與UX-11待修 |
| LINE物業工單操作 | UX-09轉派待修；不得以未完成按鈕充當功能 |
| Web住戶主導覽 | UX-02已修，手機寬度實測只有4分頁 |
| Web公設列表／預約 | UX-05路由缺失、UX-13返回重填、UX-03錯誤提示待修 |
| Web我的預約／行事曆 | 已有頁內取消確認、離線待同步區分、關聯錯誤重試；仍需真實手機多步驗收 |
| Web物業工單 | UX-04已重現崩潰，優先修復API資料映射 |
| Web管理公告／帳單／包裹／停車／住戶 | UX-03共通Alert問題；沒有執行線上刪除驗收 |
| Web登入／登出／個資 | UX-06登出無動作已實測；成功／失敗提示受UX-03影響 |
| Web LINE管理／IoT | Alert呼叫與路由歸屬已掃描；未做真實推播或設備控制 |
| 更新／錯誤恢復 | UX-16快取已修；UX-14錯誤與空狀態待統一 |

## 修復順序

1. 先修管理工單資料映射、缺失公設路由、登出，解除可重現的任務中斷。
2. 統一Web頁內提示／確認元件，逐頁取代64處Alert呼叫；配合錯誤、空資料與重試處理。
3. 分離寫入成功與通知結果；LINE補齊詳情出口、取消入口、移除未完成轉派。
4. 最後統一角色文案／語言、日期輸入、返回保留與手機可點範圍。

## 42個頁面／layout靜態掃描清單

數字僅表示待檢查模式，不等於每次呼叫都是獨立故障。

| 檔案 | Alert呼叫 | router.back呼叫 |
|---|---:|---:|
| `src/app/_layout.tsx` | 0 | 0 |
| `src/app/activity.tsx` | 0 | 0 |
| `src/app/admin/amenities.tsx` | 0 | 0 |
| `src/app/admin/amenity-iot.tsx` | 1 | 0 |
| `src/app/admin/announcements.tsx` | 5 | 0 |
| `src/app/admin/billing.tsx` | 8 | 0 |
| `src/app/admin/bookings.tsx` | 0 | 0 |
| `src/app/admin/index.tsx` | 0 | 0 |
| `src/app/admin/line/_layout.tsx` | 0 | 0 |
| `src/app/admin/line/config.tsx` | 3 | 0 |
| `src/app/admin/line/health.tsx` | 0 | 0 |
| `src/app/admin/line/index.tsx` | 0 | 0 |
| `src/app/admin/line/logs.tsx` | 0 | 0 |
| `src/app/admin/line/push.tsx` | 4 | 0 |
| `src/app/admin/line/scripts.tsx` | 3 | 0 |
| `src/app/admin/line/users.tsx` | 4 | 0 |
| `src/app/admin/packages.tsx` | 7 | 0 |
| `src/app/admin/parking.tsx` | 8 | 0 |
| `src/app/admin/residents.tsx` | 5 | 0 |
| `src/app/admin/system-integrity.tsx` | 0 | 0 |
| `src/app/admin/voice-audit.tsx` | 0 | 0 |
| `src/app/admin/voice-desk.tsx` | 0 | 0 |
| `src/app/admin/work-orders.tsx` | 0 | 0 |
| `src/app/admin-dashboard.tsx` | 0 | 1 |
| `src/app/amenities/[id].tsx` | 1 | 1 |
| `src/app/announcements.tsx` | 0 | 1 |
| `src/app/bills.tsx` | 0 | 1 |
| `src/app/guest-pass.tsx` | 2 | 1 |
| `src/app/index.tsx` | 0 | 0 |
| `src/app/login.tsx` | 1 | 0 |
| `src/app/logistics-dashboard.tsx` | 2 | 0 |
| `src/app/my-bookings.tsx` | 0 | 1 |
| `src/app/packages.tsx` | 0 | 1 |
| `src/app/parking.tsx` | 5 | 1 |
| `src/app/profile-edit.tsx` | 3 | 2 |
| `src/app/services.tsx` | 0 | 0 |
| `src/app/settings.tsx` | 2 | 0 |
| `src/app/showcase.tsx` | 0 | 0 |
| `src/app/smart-home.tsx` | 0 | 1 |
| `src/app/social-mediation.tsx` | 0 | 1 |
| `src/app/voice-booking.tsx` | 0 | 0 |
| `src/app/wallet.tsx` | 0 | 1 |

## 本次修正驗證紀錄

- 108檔743項測試、type-check、lint及Web建置通過；LINE11組Flex與rich menu格式驗證通過。
- GCP已使用line-slots-20260910，server.js SHA256與本機相符，health與LINE webhook test為200。
- Firebase最新bundle為entry-5f201e3c3f55354c17ba266524e768dd.js；HTTP已回HTML重新驗證、hash JS長快取、API no-store。
- 390×844瀏覽器驗證四分頁皆可見、中心點未遭其他元素遮挡；分頁底緣834px，頁寬390px。修正截圖保存在忽略的 `_local/ux-audit-mobile-navigation.png`。
- Firebase CLI最後一次發布在release complete後仍以unexpected error退出；已由線上HTML與瀏覽器實際載入最新bundle確認發布生效，不把CLI退出碼誤記為0。
- 四個住戶分頁逐一點擊，均到正確路由；admin/logistics角色下可見住戶tab數為0，測試後恢復原logistics角色。

## 接續本機修正與驗證（2026-09-10）

- 工作區開始時已有 Web AlertHost／Alert adapter、工單展平、登出、預約返回及 LINE 填寫進度等未提交修改；本輪保留並納入本機檢查，尚不可視為各頁點擊驗收完成。
- 補上公設列表 `/amenities`，使用 amenities.list，顯示開放時間、時段長度、容量並連接既有詳情頁；區分讀取中、讀取失敗與無開放公設。
- UX-07 四項通知故障測試先失敗後通過，涵蓋預約／報修的住戶回覆與物業推播故障。資料成功寫入後立即結束會話，兩方通知分別處理；舊確認重送不再新增。通知失敗記錄單號，尚無持久化通知重試。
- 109檔／748項測試、type-check、lint、Web build、SQLite隔離smoke通過。型別及lint首次發現工單展平後未使用的WorkOrderRecord，移除後重跑通過。
- 瀏覽器驗證未完成：in-app browser初始化報 setResponseMeta 錯誤；Playwright回覆 browser already in use。沒有關閉其他工作階段，也沒有將smoke記為點擊驗收。
- 本輪未部署、未push；線上仍為先前版本。啟動本機開發後端時，本機SQLite自動套用既有0016 migration；未操作線上資料。
