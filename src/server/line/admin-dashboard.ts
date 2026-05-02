/**
 * Server-rendered admin dashboard for LINE demo operations.
 *
 * Why HTML, not Expo web? Expo web bundle is too heavy for Render Free
 * (Metro OOMs at 1.5GB+) and useAuth is currently stubbed (auth flow broken).
 * This module provides a lightweight operator UI rendered directly in Express,
 * authenticated via a shared bearer-style token in the URL query param.
 *
 * URL pattern: https://<host>/admin/line/<page>?token=<ADMIN_DASHBOARD_TOKEN>
 *
 * Pages:
 *   /admin/line/                   index/nav
 *   /admin/line/logs               LINE message log table
 *   /admin/line/config             runtime config edit
 *   /admin/line/scripts            demo script enable/disable
 *   /admin/line/users              line_user list + role change
 *   /admin/line/health             today's metrics
 *   /admin/line/push               manual push form
 */
import type { Express, Request, Response, NextFunction } from 'express';
import { getLineAdminContext } from '../_core/context';

const STYLE = `
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif;
         background: #1a1a1a; color: #eee; margin: 0; padding: 24px; line-height: 1.5; }
  .wrap { max-width: 980px; margin: 0 auto; }
  h1 { color: #C9A96E; font-size: 22px; margin: 0 0 4px; }
  .sub { color: #999; font-size: 13px; margin-bottom: 20px; }
  nav { background: #252525; padding: 8px 12px; border-radius: 6px; margin-bottom: 20px;
        display: flex; gap: 8px; flex-wrap: wrap; font-size: 13px; }
  nav a { color: #C9A96E; text-decoration: none; padding: 4px 10px; border-radius: 4px; }
  nav a:hover, nav a.active { background: #C9A96E; color: #1a1a1a; }
  .card { background: #252525; border-radius: 6px; padding: 16px; margin-bottom: 12px; }
  .card h2 { color: #C9A96E; font-size: 14px; margin: 0 0 12px;
             text-transform: uppercase; letter-spacing: 0.05em; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { text-align: left; padding: 8px 6px; border-bottom: 1px solid #333; vertical-align: top; }
  th { color: #888; font-weight: 600; font-size: 11px; text-transform: uppercase; }
  td.mono { font-family: ui-monospace, "SF Mono", monospace; font-size: 11px; color: #aaa; word-break: break-all; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 3px;
           font-size: 11px; font-weight: 600; }
  .ok { background: #0a5d0a; color: #fff; } .warn { background: #C9A96E; color: #1a1a1a; }
  .err { background: #5d0a0a; color: #fff; } .dim { background: #555; color: #ddd; }
  input, select, textarea { background: #111; color: #eee; border: 1px solid #444;
                             border-radius: 4px; padding: 6px 8px; font-size: 13px;
                             font-family: inherit; }
  button { background: #C9A96E; color: #1a1a1a; border: 0; padding: 6px 14px;
           border-radius: 4px; font-weight: 600; cursor: pointer; font-size: 13px; }
  button.danger { background: #5d0a0a; color: #fff; }
  button:hover { opacity: 0.85; }
  form { display: inline; }
  code { background: #111; padding: 1px 5px; border-radius: 3px; color: #C9A96E;
         font-size: 12px; }
  .meta { color: #666; font-size: 11px; margin-top: 4px; }
  .filter { display: flex; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
  .filter input { width: 180px; }
  .empty { color: #888; font-style: italic; padding: 20px; text-align: center; }
  textarea { width: 100%; min-height: 80px; font-family: ui-monospace, monospace; }
</style>
`;

const NAV_ITEMS = [
  { href: 'logs',    label: 'Logs' },
  { href: 'config',  label: 'Config' },
  { href: 'scripts', label: 'Scripts' },
  { href: 'users',   label: 'Users' },
  { href: 'health',  label: 'Health' },
  { href: 'push',    label: 'Push' },
];

function nav(active: string, token: string): string {
  return `<nav>
    ${NAV_ITEMS.map(n => `<a href="/admin/line/${n.href}?token=${encodeURIComponent(token)}"${n.href === active ? ' class="active"' : ''}>${n.label}</a>`).join('')}
  </nav>`;
}

function page(title: string, active: string, token: string, body: string): string {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(title)} — LINE Admin</title>${STYLE}</head>
<body><div class="wrap">
  <h1>LINE Demo Admin — ${escapeHtml(title)}</h1>
  <div class="sub">Operator-only dashboard for the m'AI Touch LINE bot demo.</div>
  ${nav(active, token)}
  ${body}
</div></body></html>`;
}

function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function requireToken(req: Request, res: Response, next: NextFunction): void {
  const expected = process.env.ADMIN_DASHBOARD_TOKEN;
  if (!expected) {
    res.status(503).type('text').send('admin dashboard disabled (ADMIN_DASHBOARD_TOKEN env not set)');
    return;
  }
  const got = String(req.query.token ?? req.body?.token ?? '');
  if (got !== expected) {
    res.status(401).type('text').send('forbidden: provide ?token=<ADMIN_DASHBOARD_TOKEN> in URL');
    return;
  }
  next();
}

function requireCtx(_req: Request, res: Response, next: NextFunction): void {
  const ctx = getLineAdminContext();
  if (!ctx) {
    res.status(503).type('text').send('LINE admin context not configured (LINE_CHANNEL_* env not set)');
    return;
  }
  next();
}

export function mountAdminDashboard(app: Express): void {
  if (!process.env.ADMIN_DASHBOARD_TOKEN) {
    console.log('[Admin/LINE] dashboard not mounted (ADMIN_DASHBOARD_TOKEN not set)');
    return;
  }

  // Body parser for POST forms (small — Express's express.json/urlencoded already mounted globally)
  // Mount middleware once for all dashboard routes
  app.use('/admin/line', requireToken, requireCtx);

  // ─── INDEX ─────────────────────────────────────────────────────────────
  app.get('/admin/line', (req, res) => {
    const token = String(req.query.token);
    res.type('html').send(page('Overview', '', token, `
      <div class="card">
        <h2>Pages</h2>
        <table>
          <tr><th>Page</th><th>Purpose</th></tr>
          ${NAV_ITEMS.map(n => `
            <tr>
              <td><a href="/admin/line/${n.href}?token=${encodeURIComponent(token)}" style="color:#C9A96E">${n.label}</a></td>
              <td style="color:#aaa">${({
                logs: 'Live LINE message log (filterable)',
                config: 'Edit rate limits, AI model, banner — applies live without redeploy',
                scripts: 'Enable/disable demo walkthroughs',
                users: 'Line_user table + role change',
                health: 'Today\'s message count + uptime',
                push: 'Manually push a text to a LINE userId (debug)',
              } as Record<string, string>)[n.href]}</td>
            </tr>`).join('')}
        </table>
      </div>
    `));
  });

  // ─── LOGS ──────────────────────────────────────────────────────────────
  app.get('/admin/line/logs', (req, res) => {
    const token = String(req.query.token);
    const ctx = getLineAdminContext()!;
    const filter = {
      direction: String(req.query.direction ?? ''),
      intent: String(req.query.intent ?? ''),
      lineUserId: String(req.query.user ?? ''),
    };
    const where: string[] = [];
    const params: unknown[] = [];
    if (filter.direction) { where.push('direction = ?'); params.push(filter.direction); }
    if (filter.intent)    { where.push('intent = ?');    params.push(filter.intent); }
    if (filter.lineUserId){ where.push('line_user_id = ?'); params.push(filter.lineUserId); }
    const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';
    const rows = ctx.db.prepare(
      `SELECT id, line_user_id, direction, message_type, content, intent, created_at
       FROM line_message_log ${whereSql} ORDER BY id DESC LIMIT 100`
    ).all(...params) as Array<Record<string, unknown>>;

    const body = `
      <div class="card">
        <h2>Filters</h2>
        <form method="get" class="filter">
          <input type="hidden" name="token" value="${escapeHtml(token)}">
          <input name="direction" placeholder="direction (inbound/outbound)" value="${escapeHtml(filter.direction)}">
          <input name="intent" placeholder="intent" value="${escapeHtml(filter.intent)}">
          <input name="user" placeholder="lineUserId (full U + 32 hex)" value="${escapeHtml(filter.lineUserId)}">
          <button type="submit">Apply</button>
          <a href="/admin/line/logs?token=${encodeURIComponent(token)}" style="color:#888;align-self:center">Clear</a>
        </form>
        <div class="meta">Auto-refresh disabled. Reload page (Ctrl+R) for live data. Showing latest 100 rows.</div>
      </div>
      <div class="card">
        <h2>Messages (${rows.length})</h2>
        ${rows.length === 0 ? '<div class="empty">No messages match filters.</div>' : `<table>
          <tr><th>ID</th><th>Time</th><th>Dir</th><th>Type</th><th>Intent</th><th>User</th><th>Content</th></tr>
          ${rows.map(r => `<tr>
            <td class="mono">${escapeHtml(r.id)}</td>
            <td class="mono">${escapeHtml(String(r.created_at).slice(0,19))}</td>
            <td><span class="badge ${r.direction === 'inbound' ? 'dim' : r.direction === 'outbound:debug' ? 'warn' : 'ok'}">${escapeHtml(r.direction)}</span></td>
            <td>${escapeHtml(r.message_type)}</td>
            <td>${r.intent ? `<code>${escapeHtml(r.intent)}</code>` : '<span style="color:#555">-</span>'}</td>
            <td class="mono">${escapeHtml(String(r.line_user_id).slice(0,12))}…</td>
            <td style="max-width:380px;color:#ccc;font-size:12px">${escapeHtml(String(r.content ?? '').slice(0, 220))}</td>
          </tr>`).join('')}
        </table>`}
      </div>
    `;
    res.type('html').send(page('Logs', 'logs', token, body));
  });

  // ─── CONFIG ────────────────────────────────────────────────────────────
  app.get('/admin/line/config', (req, res) => {
    const token = String(req.query.token);
    const ctx = getLineAdminContext()!;
    const rows = ctx.db.prepare(
      `SELECT key, value, type, description, updated_at, updated_by FROM runtime_config ORDER BY key`
    ).all() as Array<Record<string, unknown>>;
    const flash = req.query.msg ? `<div class="card" style="border-left:3px solid #C9A96E">${escapeHtml(req.query.msg)}</div>` : '';
    const body = flash + rows.map(r => `
      <div class="card">
        <h2>${escapeHtml(r.key)}</h2>
        <div style="color:#999;font-size:12px;margin-bottom:8px">${escapeHtml(r.description ?? '')}</div>
        <form method="post" action="/admin/line/config?token=${encodeURIComponent(token)}">
          <input type="hidden" name="key" value="${escapeHtml(r.key)}">
          <input name="value" value="${escapeHtml(r.value)}" style="width:60%;font-family:ui-monospace,monospace">
          <button type="submit">Save</button>
          <span class="meta">type=${escapeHtml(r.type)} | updated ${escapeHtml(String(r.updated_at).slice(0,19))} ${r.updated_by ? `by ${escapeHtml(r.updated_by)}` : ''}</span>
        </form>
      </div>`).join('');
    res.type('html').send(page('Runtime Config', 'config', token, body));
  });

  app.post('/admin/line/config', (req, res) => {
    const token = String(req.query.token);
    const ctx = getLineAdminContext()!;
    const key = String(req.body?.key ?? '');
    const valueRaw = String(req.body?.value ?? '');
    let parsed: unknown;
    try { parsed = JSON.parse(valueRaw); } catch { parsed = valueRaw; }
    try {
      ctx.runtimeConfig.set(key, parsed, 'dashboard').then(() => {
        res.redirect(`/admin/line/config?token=${encodeURIComponent(token)}&msg=${encodeURIComponent('Saved: ' + key + ' = ' + valueRaw)}`);
      }).catch(err => {
        res.redirect(`/admin/line/config?token=${encodeURIComponent(token)}&msg=${encodeURIComponent('Error: ' + (err as Error).message)}`);
      });
    } catch (err) {
      res.redirect(`/admin/line/config?token=${encodeURIComponent(token)}&msg=${encodeURIComponent('Error: ' + (err as Error).message)}`);
    }
  });

  // ─── SCRIPTS ───────────────────────────────────────────────────────────
  app.get('/admin/line/scripts', (req, res) => {
    const token = String(req.query.token);
    const ctx = getLineAdminContext()!;
    const rows = ctx.db.prepare(`SELECT id, enabled, updated_at FROM demo_script_config ORDER BY id`).all() as Array<Record<string, unknown>>;
    const body = `
      <div class="card">
        <h2>Demo Scripts</h2>
        <table>
          <tr><th>ID</th><th>Enabled</th><th>Updated</th><th>Action</th></tr>
          ${rows.map(r => `<tr>
            <td><code>/demo ${escapeHtml(r.id)}</code></td>
            <td><span class="badge ${r.enabled ? 'ok' : 'err'}">${r.enabled ? 'enabled' : 'disabled'}</span></td>
            <td class="mono">${escapeHtml(String(r.updated_at).slice(0,19))}</td>
            <td>
              <form method="post" action="/admin/line/scripts/toggle?token=${encodeURIComponent(token)}">
                <input type="hidden" name="id" value="${escapeHtml(r.id)}">
                <input type="hidden" name="enabled" value="${r.enabled ? '0' : '1'}">
                <button type="submit">${r.enabled ? 'Disable' : 'Enable'}</button>
              </form>
            </td>
          </tr>`).join('')}
        </table>
        <div class="meta">Note: even if a script is enabled here, the bot's command parser also needs <code>/demo &lt;id&gt;</code> to match the registry. Disabling here only blocks future starts; in-progress demos finish.</div>
      </div>`;
    res.type('html').send(page('Scripts', 'scripts', token, body));
  });

  app.post('/admin/line/scripts/toggle', (req, res) => {
    const token = String(req.query.token);
    const ctx = getLineAdminContext()!;
    const id = String(req.body?.id ?? '');
    const enabled = String(req.body?.enabled) === '1' ? 1 : 0;
    ctx.db.prepare(`UPDATE demo_script_config SET enabled = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`).run(enabled, id);
    res.redirect(`/admin/line/scripts?token=${encodeURIComponent(token)}`);
  });

  // ─── USERS ─────────────────────────────────────────────────────────────
  app.get('/admin/line/users', (req, res) => {
    const token = String(req.query.token);
    const ctx = getLineAdminContext()!;
    const roleFilter = String(req.query.role ?? '');
    const where = roleFilter ? 'WHERE role = ?' : '';
    const params = roleFilter ? [roleFilter] : [];
    const rows = ctx.db.prepare(
      `SELECT id, line_user_id, role, display_name, language, is_demo, created_at
       FROM line_user ${where} ORDER BY id DESC LIMIT 200`
    ).all(...params) as Array<Record<string, unknown>>;

    const flash = req.query.msg ? `<div class="card" style="border-left:3px solid #C9A96E">${escapeHtml(req.query.msg)}</div>` : '';
    const body = flash + `
      <div class="card">
        <h2>Filter</h2>
        <div class="filter">
          ${['', 'resident', 'housekeeper', 'admin'].map(r => `
            <a href="/admin/line/users?token=${encodeURIComponent(token)}${r ? '&role=' + r : ''}"
               style="color:${roleFilter === r ? '#1a1a1a' : '#fff'};background:${roleFilter === r ? '#C9A96E' : '#444'};padding:4px 10px;border-radius:4px;text-decoration:none;font-size:12px">${r || 'all'}</a>
          `).join('')}
        </div>
      </div>
      <div class="card">
        <h2>Line Users (${rows.length})</h2>
        ${rows.length === 0 ? '<div class="empty">No users.</div>' : `<table>
          <tr><th>ID</th><th>Name</th><th>Role</th><th>Lang</th><th>Demo</th><th>UserID</th><th>Created</th><th>Change role</th></tr>
          ${rows.map(r => `<tr>
            <td class="mono">${escapeHtml(r.id)}</td>
            <td>${escapeHtml(r.display_name ?? '<no name>')}${r.is_demo ? ' <span style="color:#C9A96E">[demo]</span>' : ''}</td>
            <td><span class="badge ${r.role === 'admin' ? 'warn' : r.role === 'housekeeper' ? 'ok' : 'dim'}">${escapeHtml(r.role)}</span></td>
            <td>${escapeHtml(r.language)}</td>
            <td>${r.is_demo ? '✓' : ''}</td>
            <td class="mono">${escapeHtml(String(r.line_user_id).slice(0,16))}…</td>
            <td class="mono">${escapeHtml(String(r.created_at).slice(0,19))}</td>
            <td>
              <form method="post" action="/admin/line/users/role?token=${encodeURIComponent(token)}">
                <input type="hidden" name="lineUserId" value="${escapeHtml(r.line_user_id)}">
                <select name="role">
                  ${['resident','housekeeper','admin'].map(rl => `<option value="${rl}"${rl === r.role ? ' selected' : ''}>${rl}</option>`).join('')}
                </select>
                <button type="submit">Set</button>
              </form>
            </td>
          </tr>`).join('')}
        </table>`}
      </div>`;
    res.type('html').send(page('Users', 'users', token, body));
  });

  app.post('/admin/line/users/role', (req, res) => {
    const token = String(req.query.token);
    const ctx = getLineAdminContext()!;
    const lineUserId = String(req.body?.lineUserId ?? '');
    const role = String(req.body?.role ?? '');
    if (!['resident','housekeeper','admin'].includes(role)) {
      return res.redirect(`/admin/line/users?token=${encodeURIComponent(token)}&msg=${encodeURIComponent('invalid role')}`);
    }
    ctx.lineUserRepo.setRole(ctx.channelId, lineUserId, role as 'resident'|'housekeeper'|'admin');
    res.redirect(`/admin/line/users?token=${encodeURIComponent(token)}&msg=${encodeURIComponent('role set')}`);
  });

  // ─── HEALTH ────────────────────────────────────────────────────────────
  app.get('/admin/line/health', (req, res) => {
    const token = String(req.query.token);
    const ctx = getLineAdminContext()!;
    const today = new Date().toISOString().slice(0, 10);
    const todayCount = (ctx.db.prepare(`SELECT COUNT(*) AS n FROM line_message_log WHERE created_at >= ?`).get(today) as { n: number }).n;
    const totalCount = (ctx.db.prepare(`SELECT COUNT(*) AS n FROM line_message_log`).get() as { n: number }).n;
    const userCount = (ctx.db.prepare(`SELECT COUNT(*) AS n FROM line_user`).get() as { n: number }).n;
    const housekeeperCount = (ctx.db.prepare(`SELECT COUNT(*) AS n FROM line_user WHERE role='housekeeper'`).get() as { n: number }).n;
    const adminCount = (ctx.db.prepare(`SELECT COUNT(*) AS n FROM line_user WHERE role='admin'`).get() as { n: number }).n;
    const uptimeS = Math.floor(process.uptime());
    const fmt = (s: number) =>
      s < 60 ? `${s}s` :
      s < 3600 ? `${Math.floor(s/60)}m ${s%60}s` :
      `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`;

    const body = `
      <div class="card">
        <h2>Today (UTC ${today})</h2>
        <table>
          <tr><th>Metric</th><th>Value</th></tr>
          <tr><td>Messages today</td><td><strong>${todayCount}</strong></td></tr>
          <tr><td>Messages all-time</td><td>${totalCount}</td></tr>
          <tr><td>LINE users registered</td><td>${userCount}</td></tr>
          <tr><td>&nbsp;&nbsp;of which housekeeper</td><td>${housekeeperCount}</td></tr>
          <tr><td>&nbsp;&nbsp;of which admin</td><td>${adminCount}</td></tr>
          <tr><td>Server uptime</td><td>${fmt(uptimeS)}</td></tr>
          <tr><td>OpenAI tokens / latency</td><td><span style="color:#666">— not yet instrumented</span></td></tr>
        </table>
      </div>`;
    res.type('html').send(page('Health', 'health', token, body));
  });

  // ─── PUSH (debug) ──────────────────────────────────────────────────────
  app.get('/admin/line/push', (req, res) => {
    const token = String(req.query.token);
    const flash = req.query.msg ? `<div class="card" style="border-left:3px solid #C9A96E">${escapeHtml(req.query.msg)}</div>` : '';
    const body = flash + `
      <div class="card">
        <h2>Manual push (debug)</h2>
        <form method="post" action="/admin/line/push?token=${encodeURIComponent(token)}">
          <div style="margin-bottom:8px">
            <div style="color:#999;font-size:12px;margin-bottom:4px">LINE userId (U + 32 hex)</div>
            <input name="lineUserId" placeholder="U0123456789abcdef..." style="width:100%;font-family:ui-monospace,monospace">
          </div>
          <div style="margin-bottom:8px">
            <div style="color:#999;font-size:12px;margin-bottom:4px">Message text (max 500)</div>
            <textarea name="text" maxlength="500" placeholder="Hello from admin..."></textarea>
          </div>
          <button type="submit">Push</button>
          <span class="meta">Will be logged with direction=outbound:debug. Recipient must have already added the bot as friend.</span>
        </form>
      </div>`;
    res.type('html').send(page('Push', 'push', token, body));
  });

  app.post('/admin/line/push', (req, res) => {
    const token = String(req.query.token);
    const ctx = getLineAdminContext()!;
    const lineUserId = String(req.body?.lineUserId ?? '').trim();
    const text = String(req.body?.text ?? '').trim();
    if (!/^U[0-9a-fA-F]{32}$/.test(lineUserId)) {
      return res.redirect(`/admin/line/push?token=${encodeURIComponent(token)}&msg=${encodeURIComponent('invalid lineUserId format (expected U + 32 hex)')}`);
    }
    if (!text || text.length > 500) {
      return res.redirect(`/admin/line/push?token=${encodeURIComponent(token)}&msg=${encodeURIComponent('text required, max 500 chars')}`);
    }
    ctx.lineClient.push(lineUserId, { type: 'text', text }).then(() => {
      ctx.messageLog.write({ lineUserId, direction: 'outbound:debug', messageType: 'text', content: text });
      res.redirect(`/admin/line/push?token=${encodeURIComponent(token)}&msg=${encodeURIComponent('pushed OK and logged')}`);
    }).catch(err => {
      res.redirect(`/admin/line/push?token=${encodeURIComponent(token)}&msg=${encodeURIComponent('push failed: ' + (err as Error).message)}`);
    });
  });

  console.log('[Admin/LINE] dashboard mounted at /admin/line/* (token-protected)');
}
