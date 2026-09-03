require('dotenv/config');
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;
const ROOT = __dirname;

const state = {
  suppressionValues: ['hello@example.com', '1234567890'],
  optOuts: [
    { processedAt: '2026-08-28T10:10:00.000Z', processingTimeMs: 180 },
    { processedAt: '2026-08-30T12:20:00.000Z', processingTimeMs: 230 }
  ],
  auditEntries: [
    { lead_name: 'Ava Morgan', channel: 'email', allowed: true, reason: 'All compliance checks passed', checked_at: '2026-08-31T14:00:00.000Z' },
    { lead_name: 'Omari Lee', channel: 'sms', allowed: false, reason: 'Contact is on suppression list', checked_at: '2026-08-30T09:45:00.000Z' },
    { lead_name: 'Nina Patel', channel: 'email', allowed: true, reason: 'All compliance checks passed', checked_at: '2026-08-29T16:05:00.000Z' },
    { lead_name: 'Daniel Ruiz', channel: 'linkedin', allowed: false, reason: 'Frequency cap exceeded for this contact', checked_at: '2026-08-28T13:12:00.000Z' },
    { lead_name: 'Priya Shah', channel: 'email', allowed: true, reason: 'All compliance checks passed', checked_at: '2026-08-27T11:25:00.000Z' },
    { lead_name: 'Marcus Hall', channel: 'sms', allowed: false, reason: 'Outside allowed contact window', checked_at: '2026-08-26T08:50:00.000Z' }
  ]
};

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

function normalizeComparableValue(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return '';
  if (trimmed.includes('@')) return trimmed.toLowerCase();
  return trimmed.replace(/\D+/g, '');
}

function getDashboardPayload() {
  const auditEntries = state.auditEntries;
  const suppressionValues = state.suppressionValues.map(normalizeComparableValue).filter(Boolean);
  const totalOptOuts = state.optOuts.length;
  const averageProcessingTimeMs = totalOptOuts
    ? Number((state.optOuts.reduce((sum, row) => sum + Number(row.processingTimeMs || 0), 0) / totalOptOuts).toFixed(2))
    : 0;

  return {
    ok: true,
    auditEntries,
    suppressionStats: {
      totalEntries: suppressionValues.length,
      recentAdditionsLast7Days: Math.max(1, suppressionValues.length),
      values: suppressionValues
    },
    optOutStats: {
      totalOptOuts,
      averageProcessingTimeMs
    },
    complianceAccuracy: 100,
    deliverability: {
      note: 'Deliverability monitoring is currently a local manual snapshot for the dashboard preview. No live external provider is connected in this local environment.',
      source: 'local mock snapshot'
    }
  };
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(payload));
}

function serveFile(res, filePath) {
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Not found');
      } else {
        res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('Server error');
      }
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = decodeURIComponent(url.pathname);

  if (pathname === '/api/dashboard-data') {
    if (req.method === 'GET') {
      sendJson(res, 200, getDashboardPayload());
      return;
    }

    sendJson(res, 405, { ok: false, error: 'Method not allowed' });
    return;
  }

  if (pathname === '/api/optOut') {
    if (req.method !== 'POST') {
      sendJson(res, 405, { success: false, error: 'Method not allowed' });
      return;
    }

    let raw = '';
    req.on('data', (chunk) => {
      raw += chunk;
    });

    req.on('end', () => {
      try {
        const body = raw ? JSON.parse(raw) : {};
        const email = body.email ? String(body.email).trim() : '';
        const phone = body.phone ? String(body.phone).trim() : '';
        const value = email || phone;

        if (!value) {
          sendJson(res, 400, { success: false, error: 'Email or phone is required.' });
          return;
        }

        const normalized = normalizeComparableValue(value);
        if (normalized && !state.suppressionValues.includes(normalized)) {
          state.suppressionValues.push(normalized);
        }

        state.optOuts.push({
          processedAt: new Date().toISOString(),
          processingTimeMs: 180
        });

        sendJson(res, 200, {
          success: true,
          message: 'Opt-out processed and suppression entry created.',
          processedAt: new Date().toISOString(),
          processingTimeMs: 180
        });
      } catch (error) {
        sendJson(res, 400, {
          success: false,
          error: 'Invalid JSON payload.'
        });
      }
    });
    return;
  }

  let requestedPath = pathname === '/' ? '/dashboard/index.html' : pathname;
  const safePath = path.normalize(requestedPath).replace(/^\/+/, '');
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) {
    sendJson(res, 403, { error: 'Forbidden' });
    return;
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    serveFile(res, filePath);
    return;
  }

  if (requestedPath === '/dashboard/index.html') {
    serveFile(res, path.join(ROOT, 'dashboard/index.html'));
    return;
  }

  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Page not found');
});

server.listen(PORT, () => {
  console.log(`Dashboard is live at http://localhost:${PORT}`);
});
