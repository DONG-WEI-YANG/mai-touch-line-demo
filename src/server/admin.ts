/**
 * Admin Dashboard Routes
 * 預留給未來真實主機的管理後台 UI
 */
import { Router } from "express";
import crypto from "crypto";
import * as db from "./db";
import { getAuditLog } from "./audit-log";
import type { User } from "./schema";

export const adminRouter = Router();

// Audit finding A (CRITICAL): these legacy /admin/* routes (user list, audit CSV
// with PII, stats) were mounted with NO authentication — publicly readable on the
// backend URL. Gate the whole router behind ADMIN_DASHBOARD_TOKEN, same as the
// LINE ops dashboard. Fail-closed: 503 if the token isn't configured.
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
}

adminRouter.use((req, res, next) => {
  const expected = process.env.ADMIN_DASHBOARD_TOKEN;
  if (!expected) {
    return res.status(503).send("Admin dashboard disabled: ADMIN_DASHBOARD_TOKEN is not set.");
  }
  const authHeader = String(req.headers["authorization"] ?? "");
  const bearer = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
  const got = bearer || String((req.query.token as string) ?? (req.body?.token as string) ?? "");
  if (!got || !safeEqual(got, expected)) {
    return res.status(401).send("Unauthorized");
  }
  next();
});

const DATE_ONLY_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const displayDateFormatter = new Intl.DateTimeFormat("zh-TW", {
  dateStyle: "medium",
  timeStyle: "medium",
});

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll("\"", "&quot;")
    .replaceAll("'", "&#39;");
}

function formatDateTime(value: string | number | Date | null | undefined): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return displayDateFormatter.format(date);
}

function parseDateOnly(value: unknown, mode: "start" | "end"): number | undefined {
  if (typeof value !== "string" || !DATE_ONLY_REGEX.test(value)) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return undefined;
  return mode === "start"
    ? date.setHours(0, 0, 0, 0)
    : date.setHours(23, 59, 59, 999);
}

function sanitizeFilenamePart(value: unknown, fallback: string): string {
  if (typeof value !== "string" || !DATE_ONLY_REGEX.test(value)) return fallback;
  return value;
}

/**
 * Admin Dashboard Home
 * TODO: 實現完整的管理後台 UI
 */
adminRouter.get("/", async (_req, res) => {
  try {
    const stats = await db.getDashboardStats();
    
    // 返回簡單的 HTML 頁面（預留給未來的完整 UI）
    res.send(`
      <!DOCTYPE html>
      <html lang="zh-TW">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>m'AI Touch - Admin Dashboard</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #1A1A1A;
            color: #F0EDE8;
            padding: 2rem;
          }
          .container { max-width: 1200px; margin: 0 auto; }
          h1 { color: #C4A882; margin-bottom: 2rem; }
          .stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
          }
          .stat-card {
            background: #242424;
            border: 1px solid #3A3530;
            border-radius: 12px;
            padding: 1.5rem;
          }
          .stat-label {
            color: #9B9590;
            font-size: 0.875rem;
            margin-bottom: 0.5rem;
          }
          .stat-value {
            color: #C4A882;
            font-size: 2rem;
            font-weight: 700;
          }
          .nav {
            display: flex;
            gap: 1rem;
            margin-bottom: 2rem;
          }
          .nav a {
            color: #C4A882;
            text-decoration: none;
            padding: 0.5rem 1rem;
            background: #242424;
            border-radius: 8px;
            border: 1px solid #3A3530;
          }
          .nav a:hover {
            background: #2C2C2C;
          }
          .notice {
            background: #2C2C2C;
            border-left: 4px solid #C4A882;
            padding: 1rem;
            margin-top: 2rem;
            border-radius: 4px;
          }
          .notice h3 {
            color: #C4A882;
            margin-bottom: 0.5rem;
          }
          .notice p {
            color: #9B9590;
            line-height: 1.6;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>🏢 m'AI Touch Admin Dashboard</h1>
          
          <div class="nav">
            <a href="/admin">Dashboard</a>
            <a href="/admin/users">Users</a>
            <a href="/admin/bookings">Bookings</a>
            <a href="/admin/work-orders">Work Orders</a>
            <a href="/admin/nlp">NLP & Audit</a>
            <a href="/api/health">API Health</a>
          </div>
          
          <div class="stats-grid">
            <div class="stat-card">
              <div class="stat-label">Total Users</div>
              <div class="stat-value">${stats.totalUsers}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total Bookings</div>
              <div class="stat-value">${stats.totalBookings}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Active Bookings</div>
              <div class="stat-value">${stats.activeBookings}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total Work Orders</div>
              <div class="stat-value">${stats.totalWorkOrders}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Open Work Orders</div>
              <div class="stat-value">${stats.openWorkOrders}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Total Messages</div>
              <div class="stat-value">${stats.totalMessages}</div>
            </div>
          </div>
          
          <div class="notice">
            <h3>📝 開發中</h3>
            <p>
              這是管理後台的預留介面。完整的管理後台 UI 將在未來版本中實現，包括：
            </p>
            <ul style="margin-top: 0.5rem; padding-left: 1.5rem; color: #9B9590;">
              <li>用戶管理和權限控制</li>
              <li>預約和工作訂單管理</li>
              <li>數據分析和報表</li>
              <li>系統配置和監控</li>
              <li>NLP 服務狀態監控</li>
            </ul>
            <p style="margin-top: 1rem;">
              目前可以通過 tRPC API 端點訪問所有管理功能。
            </p>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch {
    res.status(500).send("Error loading dashboard");
  }
});

/**
 * Users Management
 * TODO: 實現用戶管理 UI
 */
adminRouter.get("/users", async (_req, res) => {
  try {
    const users: User[] = await db.getAllUsers();
    const userRows = users
      .map((user: User) => {
        const role = user.role === "admin" ? "admin" : "user";
        return `
                <tr>
                  <td>${escapeHtml(String(user.id))}</td>
                  <td>${escapeHtml(user.name || "-")}</td>
                  <td>${escapeHtml(user.email || "-")}</td>
                  <td>
                    <span class="badge badge-${role}">
                      ${escapeHtml(role)}
                    </span>
                  </td>
                  <td>${escapeHtml(user.loginMethod || "-")}</td>
                  <td>${formatDateTime(user.lastSignedIn)}</td>
                </tr>
              `;
      })
      .join("");
    
    res.send(`
      <!DOCTYPE html>
      <html lang="zh-TW">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Users - Admin Dashboard</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: #1A1A1A;
            color: #F0EDE8;
            padding: 2rem;
          }
          .container { max-width: 1200px; margin: 0 auto; }
          h1 { color: #C4A882; margin-bottom: 2rem; }
          .nav {
            display: flex;
            gap: 1rem;
            margin-bottom: 2rem;
          }
          .nav a {
            color: #C4A882;
            text-decoration: none;
            padding: 0.5rem 1rem;
            background: #242424;
            border-radius: 8px;
            border: 1px solid #3A3530;
          }
          table {
            width: 100%;
            background: #242424;
            border-radius: 12px;
            overflow: hidden;
            border-collapse: collapse;
          }
          th, td {
            padding: 1rem;
            text-align: left;
            border-bottom: 1px solid #3A3530;
          }
          th {
            background: #2C2C2C;
            color: #C4A882;
            font-weight: 600;
          }
          tr:last-child td {
            border-bottom: none;
          }
          .badge {
            display: inline-block;
            padding: 0.25rem 0.75rem;
            border-radius: 12px;
            font-size: 0.75rem;
            font-weight: 600;
          }
          .badge-admin {
            background: #C4A882;
            color: #1A1A1A;
          }
          .badge-user {
            background: #3A3530;
            color: #9B9590;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>👥 Users Management</h1>
          
          <div class="nav">
            <a href="/admin">← Back to Dashboard</a>
          </div>
          
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Name</th>
                <th>Email</th>
                <th>Role</th>
                <th>Login Method</th>
                <th>Last Signed In</th>
              </tr>
            </thead>
            <tbody>
              ${userRows}
            </tbody>
          </table>
        </div>
      </body>
      </html>
    `);
  } catch {
    res.status(500).send("Error loading users");
  }
});

/**
 * Bookings Management
 * TODO: 實現預約管理 UI
 */
adminRouter.get("/bookings", async (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
      <meta charset="UTF-8">
      <title>Bookings - Admin Dashboard</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #1A1A1A;
          color: #F0EDE8;
          padding: 2rem;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { color: #C4A882; }
        .notice {
          background: #2C2C2C;
          border-left: 4px solid #C4A882;
          padding: 1rem;
          margin-top: 2rem;
          border-radius: 4px;
        }
        a {
          color: #C4A882;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>📅 Bookings Management</h1>
        <div class="notice">
          <p><a href="/admin">← Back to Dashboard</a></p>
          <p style="margin-top: 1rem;">預約管理 UI 開發中...</p>
          <p>請使用 tRPC API 端點訪問預約數據。</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

/**
 * Work Orders Management
 * TODO: 實現工作訂單管理 UI
 */
adminRouter.get("/work-orders", async (_req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
      <meta charset="UTF-8">
      <title>Work Orders - Admin Dashboard</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #1A1A1A;
          color: #F0EDE8;
          padding: 2rem;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { color: #C4A882; }
        .notice {
          background: #2C2C2C;
          border-left: 4px solid #C4A882;
          padding: 1rem;
          margin-top: 2rem;
          border-radius: 4px;
        }
        a {
          color: #C4A882;
          text-decoration: none;
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🔧 Work Orders Management</h1>
        <div class="notice">
          <p><a href="/admin">← Back to Dashboard</a></p>
          <p style="margin-top: 1rem;">工作訂單管理 UI 開發中...</p>
          <p>請使用 tRPC API 端點訪問工作訂單數據。</p>
        </div>
      </div>
    </body>
    </html>
  `);
});

/**
 * NLP Monitor & Audit Log
 * 包含審計日誌匯出與監控面板
 */
adminRouter.get("/nlp", (_req, res) => {
  const auditLog = getAuditLog();
  const stats = auditLog.getStats();
  
  // Calculate date range for default values (last 30 days)
  const today = new Date().toISOString().split('T')[0];
  const lastMonth = new Date();
  lastMonth.setDate(lastMonth.getDate() - 30);
  const lastMonthStr = lastMonth.toISOString().split('T')[0];

  res.send(`
    <!DOCTYPE html>
    <html lang="zh-TW">
    <head>
      <meta charset="UTF-8">
      <title>NLP Monitor & Audit - Admin Dashboard</title>
      <style>
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: #1A1A1A;
          color: #F0EDE8;
          padding: 2rem;
        }
        .container { max-width: 1200px; margin: 0 auto; }
        h1 { color: #C4A882; margin-bottom: 2rem; }
        .nav {
          display: flex;
          gap: 1rem;
          margin-bottom: 2rem;
        }
        .nav a {
          color: #C4A882;
          text-decoration: none;
          padding: 0.5rem 1rem;
          background: #242424;
          border-radius: 8px;
          border: 1px solid #3A3530;
        }
        .card {
          background: #242424;
          border: 1px solid #3A3530;
          border-radius: 12px;
          padding: 1.5rem;
          margin-bottom: 1.5rem;
        }
        .card h2 {
          color: #C4A882;
          margin-bottom: 1rem;
          font-size: 1.25rem;
        }
        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 1rem;
          margin-bottom: 1rem;
        }
        .stat-item {
          background: #2C2C2C;
          padding: 1rem;
          border-radius: 8px;
        }
        .stat-label { color: #9B9590; font-size: 0.875rem; margin-bottom: 0.25rem; }
        .stat-value { color: #F0EDE8; font-size: 1.5rem; font-weight: 700; }
        
        .form-group { margin-bottom: 1rem; }
        label { display: block; margin-bottom: 0.5rem; color: #9B9590; }
        input[type="date"] {
          background: #2C2C2C;
          border: 1px solid #3A3530;
          color: #F0EDE8;
          padding: 0.5rem;
          border-radius: 4px;
          width: 100%;
          max-width: 300px;
        }
        button {
          background: #C4A882;
          color: #1A1A1A;
          border: none;
          padding: 0.75rem 1.5rem;
          border-radius: 4px;
          font-weight: 600;
          cursor: pointer;
          font-size: 1rem;
        }
        button:hover { background: #D4B892; }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🧠 NLP Monitor & Audit Log</h1>
        
        <div class="nav">
          <a href="/admin">← Back to Dashboard</a>
        </div>

        <div class="card">
          <h2>📊 System Status</h2>
          <div class="stats-grid">
            <div class="stat-item">
              <div class="stat-label">Total Requests</div>
              <div class="stat-value">${stats.totalEntries}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">PII Detected</div>
              <div class="stat-value">${stats.piiDetectedCount}</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Avg Latency</div>
              <div class="stat-value">${stats.avgProcessingTimeMs.toFixed(0)}ms</div>
            </div>
            <div class="stat-item">
              <div class="stat-label">Local Processing</div>
              <div class="stat-value">${stats.localProcessed}</div>
            </div>
          </div>
        </div>

        <div class="card">
          <h2>📥 Export Audit Report</h2>
          <form action="/admin/audit/export/csv" method="GET">
            <div class="form-group">
              <label>Start Date</label>
              <input type="date" name="start" value="${lastMonthStr}" required>
            </div>
            <div class="form-group">
              <label>End Date</label>
              <input type="date" name="end" value="${today}" required>
            </div>
            <button type="submit">Download CSV Report</button>
          </form>
          <p style="margin-top: 1rem; color: #9B9590; font-size: 0.875rem;">
            * Includes all NLP processing logs, privacy decisions, and PII detection results.
          </p>
        </div>
      </div>
    </body>
    </html>
  `);
});

/**
 * Audit Log CSV Export
 */
adminRouter.get("/audit/export/csv", (req, res) => {
  try {
    const { start, end } = req.query;
    
    // Parse dates (start of day to end of day)
    const startDate = parseDateOnly(start, "start");
    const endDate = parseDateOnly(end, "end");
    
    const csv = getAuditLog().exportToCSV(startDate, endDate);
    
    const filename = `audit-log-${sanitizeFilenamePart(start, "all")}-to-${sanitizeFilenamePart(end, "now")}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  } catch (error) {
    console.error("Export error:", error);
    res.status(500).send("Error generating CSV report");
  }
});

console.log("[Admin] Dashboard routes registered (placeholder UI)");
console.log("[Admin] TODO: Implement full admin UI for production");
