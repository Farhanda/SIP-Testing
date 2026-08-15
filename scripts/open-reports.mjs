// scripts/open-reports.mjs
// ---------------------------------------------------------------------------
// Membuka SEMUA report HTML platform (FE + BE + AI) di browser default.
// Dipanggil lewat `npm run report`.
//
//   npm run report:fe  → buka report FE saja (playwright show-report)
//   npm run report:be  → buka report BE saja
//   npm run report:ai  → buka report AI saja
//   npm run report     → buka SEMUA report (FE + BE + AI + gabungan) di browser
// ---------------------------------------------------------------------------
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

// Folder report per platform — sinkron dengan playwright*.config.ts.
// Folder polos `playwright-report` = gabungan (npm test); yang ber-suffix
// (fe/be/ai) = spesifik per platform.
const REPORTS = [
  { platform: 'Gabungan', dir: 'playwright-report' },
  { platform: 'FE', dir: 'playwright-report-fe' },
  { platform: 'BE', dir: 'playwright-report-be' },
  { platform: 'AI', dir: 'playwright-report-ai' },
];

const missing = [];

for (const r of REPORTS) {
  const indexPath = path.join(ROOT, r.dir, 'index.html');
  if (!existsSync(indexPath)) {
    missing.push(r.platform);
    continue;
  }

  // Buka index.html di browser default (pakai file:// agar path ber-spasi aman).
  const fileUrl = `file:///${indexPath.replace(/\\/g, '/')}`;
  if (process.platform === 'win32') {
    execSync(`cmd /c start "" "${indexPath}"`);
  } else if (process.platform === 'darwin') {
    execSync(`open "${fileUrl}"`);
  } else {
    execSync(`xdg-open "${fileUrl}"`);
  }
  console.log(`✔ Buka report ${r.platform}: ${r.dir}/index.html`);
}

if (missing.length > 0) {
  console.warn(      `\n⚠️  Report belum ada untuk platform: ${missing.join(', ')} — ` +
      `jalankan test-nya dulu (npm test untuk gabungan; test:fe / test:be / test:ai untuk per platform).`,
  );
}
