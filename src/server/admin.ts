/**
 * Admin Dashboard Routes
 * Authenticated read-only operations dashboard for the backend host.
 */
import { Router } from "express";
import crypto from "crypto";
import * as db from "./db";
import { getAuditLog } from "./audit-log";
import { logError } from "./_core/logError";
import { ErrorIds } from "./constants/errorIds";
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
  // Require the token via the Authorization: Bearer header only — NOT a
  // ?token= query param (which leaks into access logs / history / Referer;
  // audit finding M2). These routes had no auth before, so there's no existing
  // query-string workflow to preserve. For browser access, add an HttpOnly
  // cookie login later.
  const authHeader = String(req.headers["authorization"] ?? "");
  const got = authHeader.startsWith("Bearer ") ? authHeader.slice("Bearer ".length).trim() : "";
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

function renderDataTablePage(title: string, headers: string[], rows: string[][]): string {
  const head = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("");
  const body = rows.length > 0
    ? rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")
    : `<tr><td colspan="${headers.length}">No records</td></tr>`;
  return `<!DOCTYPE html>
  <html lang="zh-TW"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${escapeHtml(title)} - m'AI Touch</title><style>
  *{box-sizing:border-box}body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#1A1A1A;color:#F0EDE8;padding:2rem;margin:0}
  .container{max-width:1200px;margin:0 auto}h1,a{color:#C4A882}a{text-decoration:none}table{width:100%;margin-top:1.5rem;background:#242424;border:1px solid #3A3530;border-collapse:collapse}
  th,td{padding:.85rem;text-align:left;border-bottom:1px solid #3A3530}th{color:#C4A882;background:#2C2C2C}td{font-size:.9rem}tr:last-child td{border-bottom:0}
  </style></head><body><div class="container"><p><a href="/admin">← Dashboard</a></p><h1>${escapeHtml(title)}</h1>
  <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div></body></html>`;
}

/**
 * Admin Dashboard Home
 * Summary of persisted operational records.
 */
adminRouter.get("/", async (_req, res) => {
  try {
    const stats = await db.getDashboardStats();
    
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
            <h3>Operations snapshot</h3>
            <p>All figures above come from the active database. Use the linked pages for current users, bookings, work orders, and NLP audit data.</p>
          </div>
        </div>
      </body>
      </html>
    `);
  } catch (error) {
    logError(ErrorIds.ADMIN_RENDER_FAILED, "dashboard render failed", { cause: error });
    res.status(500).send("Error loading dashboard");
  }
});

/**
 * Users Management
 * Users Management
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
  } catch (error) {
    logError(ErrorIds.ADMIN_RENDER_FAILED, "users render failed", { cause: error });
    res.status(500).send("Error loading users");
  }
});

/**
 * Bookings Management
 */
adminRouter.get("/bookings", async (_req, res) => {
  try {
    const records = await db.getBookingsWithDetails();
    const rows = records.map(({ booking, userName, amenityName }) => [
      `BK-${booking.id}`,
      amenityName ?? `Amenity #${booking.amenityId}`,
      userName ?? `User #${booking.userId}`,
      booking.date,
      `${booking.startTime}–${booking.endTime}`,
      String(booking.guestCount),
      booking.status,
    ]);
    res.send(renderDataTablePage("Bookings", ["ID", "Amenity", "Resident", "Date", "Time", "Guests", "Status"], rows));
  } catch (error) {
    logError(ErrorIds.ADMIN_RENDER_FAILED, "bookings render failed", { cause: error });
    res.status(500).send("Error loading bookings");
  }
});

/**
 * Work Orders Management
 */
adminRouter.get("/work-orders", async (_req, res) => {
  try {
    const records = await db.getWorkOrdersWithDetails();
    const rows = records.map(({ workOrder, userName }) => [
      `WO-${workOrder.id}`,
      workOrder.title,
      userName ?? `User #${workOrder.userId}`,
      workOrder.category,
      workOrder.priority,
      workOrder.status,
      formatDateTime(workOrder.updatedAt),
    ]);
    res.send(renderDataTablePage("Work Orders", ["ID", "Title", "Resident", "Category", "Priority", "Status", "Updated"], rows));
  } catch (error) {
    logError(ErrorIds.ADMIN_RENDER_FAILED, "work orders render failed", { cause: error });
    res.status(500).send("Error loading work orders");
  }
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

console.log("[Admin] Authenticated operations dashboard routes registered");
