# 語音預約／派單(Voice Booking & Work-Order Dispatch)設計

- 日期:2026-07-12
- 狀態:已核准,實作中
- 相關記憶:`service-template`(5 件式服務樣板)、既有 LINE NLP pipeline

## 1. 背景與硬體決策

需求:住戶／物業「口說」即可**預約公設**與**建立派單分類給物業**,架構走**本地 hub + 雲端 API**。

**硬體決策(已查證):Google 音箱不能當語音預約的收音設備。**
Google 於 2023-06-13 關閉 Conversational Actions,第三方無法取得 Nest 麥克風的原始語音,也沒有自訂對話 fulfillment 的 hook。唯一還活著的路是 Cloud-to-Cloud + 固定語音指令觸發 webhook,但它**只能送固定、無參數的指令**(收不到逐字稿、沒有 slot),因此只適合「語音控制裝置(開燈/開冷氣)」,永遠做不了「有參數的語音預約」。

角色分工:
- 🎙️ **語音預約/派單** → 自建收音設備(住戶手機 App / 物業櫃台平板),接自有 STT→NLP pipeline。
- 💡 **語音控制公設裝置** → Google 音箱(Cloud-to-Cloud 固定指令),**選配、獨立軌、不在本 MVP**。

## 2. 核心原則

**語音只負責「聽懂並提案」,絕不直接寫入。** STT + NLP 必有誤聽,而預約/派單有後果,因此一律「提案 → 使用者確認 → 才落地」。

## 3. 範圍(MVP)

前端(薄殼,共用同一雲端端點):
- 住戶手機 App「押住說話」(身份 = 已登入住戶)。
- 物業櫃台平板(物業先選「代哪一戶」,再收音)。

**明確排除**:公用機語音、Google 音箱裝置控制、喚醒詞/always-listening(先用押住說話,省隱私與成本)。

## 4. 架構

```
[手機押住說話] ┐
               ├─→ voice.command ── transcribe()  → classify(getAi) → buildVoiceProposal
[物業平板]     ┘                                                          │ 回「提案」(不寫入)
                                          使用者在畫面確認/修正 ─→ voice.commit ── commitVoiceProposal
                                                                          ├─ facility.book → db.createBooking
                                                                          └─ repair/visitor/... → db.createWorkOrder
```

## 5. 元件

| 元件 | 新/舊 | 說明 |
|---|---|---|
| `_core/voiceCommand.ts`(`buildVoiceProposal` / `commitVoiceProposal`) | 🆕 純函式核心 | 注入 classifier + db 寫入,四種前端共用;可單測 |
| `voice.command` / `voice.commit`(`routers/voice.ts`) | 🆕 薄 procedure | `residentProcedure`(住戶)/ 物業版帶目標 unitId |
| STT `transcribeAudio` | ♻️ 舊 | 已存在;`voice.transcribe` 已用它 |
| 意圖分類 `getAi()` | ♻️ 舊 | 與 LINE 同一個 `IntentClassifier` |
| `db.createBooking` / `db.createWorkOrder` | ♻️ 舊 | 落地寫入 |
| 手機押住說話按鈕 / 物業平板頁 | 🆕 前端 | expo-av 錄音 → base64 上傳 |

## 6. 資料結構

`VoiceProposal`:
```ts
{
  transcript: string;
  intent: IntentName;            // facility.book / repair.report / ...
  kind: 'booking' | 'work_order' | 'query' | 'unclear';
  slots: Slot;                   // facility/date/time/issue/location/urgency...
  missing: string[];             // 還缺的必填 slot
  confidence: number;
  language: Lang;
}
```
`voice.commit` 收「使用者確認/補齊後的 intent + slots」,回 `{ ref: 'BK-<id>' | 'WO-<id>' }`。

## 7. 身份綁定(每前端不同)

- **手機**:身份 = `ctx.user.id`(`residentProcedure`)。
- **物業平板**:`staffProcedure` + 輸入 `targetUserId`;commit 以該住戶身份寫入。

## 8. 錯誤處理(語音特有)

- STT 失敗/空字串 → 回「沒聽清楚,請重說或改打字」,不進 NLP。
- `confidence < 0.6` 或 `intent = unknown` → `kind: 'unclear'`,前端降級為手動選公設/時段。
- slots 不齊 → `missing` 標出;前端要求補齊才可按「確認」。
- `voice.commit` 落地前**再驗一次**可訂性(容量/時段),避免確認前被搶。
- commit 冪等:同一提案重複送不重複建立(前端送出後鎖定 + 後端容量檢查)。

## 9. 測試(vitest)

- `voiceCommand.test.ts`:餵固定逐字稿字串 + mock classifier(`mkAi` 手法),驗證各意圖的 proposal(intent/kind/missing/confidence 門檻)。
- commit:mock db 寫入,驗證 facility.book → createBooking 參數正確、repair → createWorkOrder 分類正確。
- STT/NLP 一律 mock,不打真 API。

## 10. 實作順序(增量)

1. **後端核心 + 端點**(本次):`voiceCommand.ts` + `voice.command`/`voice.commit` + 測試綠。← 共用地基,四前端都靠它。
2. 住戶手機押住說話 UI。
3. 物業櫃台平板頁。
4. (獨立軌)Google 音箱 Cloud-to-Cloud 裝置控制。
