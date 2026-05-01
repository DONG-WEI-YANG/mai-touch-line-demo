# m'AI Touch - API 文檔

## 🔌 API 端點

基礎 URL: `http://localhost:3000/api/trpc`

## 身份驗證 (auth)

### GET auth.me
獲取當前登錄用戶信息

**響應:**
```typescript
{
  id: number;
  openId: string;
  name: string;
  email: string;
  loginMethod: string;
  role: "resident" | "admin" | "logistics";
  lastSignedIn: Date;
}
```

### POST auth.logout
登出當前用戶

**響應:**
```typescript
{ success: true }
```

## 語音處理 (voice)

### POST voice.transcribe
將語音轉換為文字

**請求:**
```typescript
{
  audioBase64: string;      // Base64 編碼的音頻
  mimeType: string;         // 音頻格式 (audio/webm, audio/wav, etc.)
  language?: string;        // 語言代碼 (en, zh, etc.)
}
```

**響應:**
```typescript
{
  text: string;             // 轉錄文本
  language: string;         // 檢測到的語言
  languageLabel: string;    // 語言顯示名稱
  confidence: number;       // 置信度 (0-1)
}
```

## AI 聊天 (chat)

### POST chat.send
發送消息給 AI

**請求:**
```typescript
{
  message: string;          // 用戶消息
  language?: string;        // 語言偏好
}
```

**響應:**
```typescript
{
  text: string;             // AI 回復
}
```

### GET chat.history
獲取聊天歷史

**請求:**
```typescript
{
  limit?: number;           // 最多返回條數 (1-100, 默認 50)
}
```

**響應:**
```typescript
Array<{
  id: number;
  userId: number;
  role: "user" | "assistant";
  content: string;
  language?: string;
  createdAt: Date;
}>
```

## 設施管理 (amenities)

### GET amenities.list
獲取所有設施列表

**響應:**
```typescript
Array<{
  id: number;
  name: string;
  description: string;
  icon: string;
  category: string;
  capacity: number;
  location: string;
  rules: string;
  isActive: boolean;
  openTime: string;
  closeTime: string;
  slotDurationMinutes: number;
}>
```

### GET amenities.getById
獲取設施詳情

**請求:**
```typescript
{
  id: number;
}
```

### GET amenities.getSlots
獲取設施可用時間段

**請求:**
```typescript
{
  amenityId: number;
  date: string;             // YYYY-MM-DD 格式
}
```

**響應:**
```typescript
Array<{
  startTime: string;        // HH:MM
  endTime: string;          // HH:MM
  available: boolean;
}>
```

### POST amenities.create (管理員)
創建新設施

**請求:**
```typescript
{
  name: string;
  description?: string;
  icon?: string;
  category?: "recreation" | "wellness" | "entertainment" | "business" | "dining" | "outdoor";
  capacity?: number;
  location?: string;
  rules?: string;
  openTime?: string;
  closeTime?: string;
  slotDurationMinutes?: number;
}
```

## 預約管理 (bookings)

### GET bookings.myBookings
獲取我的預約列表

**響應:**
```typescript
Array<{
  id: number;
  userId: number;
  amenityId: number;
  date: string;
  startTime: string;
  endTime: string;
  guestCount: number;
  notes?: string;
  status: "confirmed" | "pending" | "cancelled" | "completed";
  createdAt: Date;
}>
```

### POST bookings.create
創建預約

**請求:**
```typescript
{
  amenityId: number;
  date: string;             // YYYY-MM-DD
  startTime: string;        // HH:MM
  endTime: string;          // HH:MM
  guestCount?: number;
  notes?: string;
}
```

### POST bookings.cancel
取消預約

**請求:**
```typescript
{
  id: number;
}
```

## 工作訂單 (workOrders)

### GET workOrders.myOrders
獲取我的工作訂單

**響應:**
```typescript
Array<{
  id: number;
  userId: number;
  title: string;
  description?: string;
  category: "maintenance" | "security" | "concierge" | "housekeeping" | "other";
  priority: "low" | "medium" | "high" | "urgent";
  status: "open" | "in_progress" | "resolved" | "closed";
  assignedTo?: string;
  resolvedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}>
```

### POST workOrders.create
創建工作訂單

**請求:**
```typescript
{
  title: string;
  description?: string;
  category?: "maintenance" | "security" | "concierge" | "housekeeping" | "other";
  priority?: "low" | "medium" | "high" | "urgent";
}
```

## 管理員 (admin)

### GET admin.stats
獲取儀表板統計

**響應:**
```typescript
{
  totalUsers: number;
  totalAmenities: number;
  totalBookings: number;
  totalWorkOrders: number;
  activeBookings: number;
  pendingWorkOrders: number;
}
```

### GET admin.users
獲取所有用戶列表

**響應:**
```typescript
Array<User>
```

## 錯誤處理

所有 API 錯誤遵循以下格式：

```typescript
{
  error: {
    message: string;
    code: string;
    data?: any;
  }
}
```

常見錯誤代碼：
- `UNAUTHORIZED` - 未授權
- `FORBIDDEN` - 禁止訪問
- `NOT_FOUND` - 資源不存在
- `BAD_REQUEST` - 請求參數錯誤
- `INTERNAL_SERVER_ERROR` - 服務器錯誤
