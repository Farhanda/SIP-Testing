import ExcelJS from 'exceljs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

async function main() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(path.join(ROOT, 'SIP_Weekly_Developer_Report.xlsx'));
  const sheet = wb.getWorksheet('Weekly Report');

  // ===== HEADER INFO (Row 3-7) =====
  sheet.getCell('D3').value = 'Week 34';
  sheet.getCell('D4').value = '22 Aug - 29 Aug 2026';
  sheet.getCell('B4').value = 'Alfath';
  sheet.getCell('B5').value = 'QA / Automation Engineer';
  sheet.getCell('B6').value = 'Automation Testing — FE & BE Coverage';
  sheet.getCell('B7').value = 'Fokus pada penambahan test coverage, refactoring, & bug fixing';
  sheet.getCell('D7').value = '—';

  // KPI
  sheet.getCell('H4').value = 10;
  sheet.getCell('H5').value = 8;
  sheet.getCell('H6').value = 1;
  sheet.getCell('H7').value = 1;
  sheet.getCell('H8').value = '80%';

  // Weekly Highlights
  sheet.getCell('I4').value =
    '• FE test coverage meningkat dari ~30 ke 70+ test cases\n' +
    '• 7 test files baru untuk BE API (top-keywords, trending, scrape service)\n' +
    '• Page Objects untuk semua halaman utama selesai\n' +
    '• Mock architecture (api-mock.ts) di-refactor & lebih reusable\n' +
    '• Async patterns diperbaiki — tidak ada lagi waitForTimeout\n' +
    '• Login/Auth setup diperbaiki untuk test environment\n' +
    '• Bug: Login/auth flow perlu penyesuaian dengan BE terbaru';

  // ===== TASK / ACTIVITY DETAIL (Rows 13-32) =====
  const tasks = [
    {
      no: 1, task: 'Update platform options & keyword handling',
      cat: 'Feature', priority: 'High', target: 'Platform options sesuai konfigurasi terbaru',
      status: 'Done', progress: '100%', actual: 'Platform options di Dashboard & Keyword pages berhasil diupdate',
      blocker: '—', next: '—', evidence: 'commit e9b3984'
    },
    {
      no: 2, task: 'Tambah FE tests — Posts, Topic Detail, Display Wall',
      cat: 'Testing', priority: 'High', target: '3 halaman baru di-cover test cases',
      status: 'Done', progress: '100%', actual: 'Posts (116 baris), Topic Detail (122 baris), Display Wall (308 baris) selesai',
      blocker: '—', next: '—', evidence: 'commit 0b6c4ee'
    },
    {
      no: 3, task: 'Provider Management tests & cover UI gaps',
      cat: 'Testing', priority: 'High', target: 'Halaman Administration ter-test lengkap',
      status: 'Done', progress: '100%', actual: 'Provider spec (198 baris), User spec (134 baris) selesai',
      blocker: '—', next: '—', evidence: 'commit 6778158'
    },
    {
      no: 4, task: 'Adapt keyword module ke BE API baru',
      cat: 'Testing', priority: 'High', target: 'Keyword tests sesuai BE API terbaru',
      status: 'Done', progress: '100%', actual: 'Keyword actions, modals, regression bugs diadaptasi',
      blocker: '—', next: '—', evidence: 'commit 6778158'
    },
    {
      no: 5, task: 'Close minor FE coverage gaps',
      cat: 'Testing', priority: 'Medium', target: 'Semua halaman FE ter-cover',
      status: 'Done', progress: '100%', actual: 'Navigation, dashboard features, posts, topic detail ditambah',
      blocker: '—', next: '—', evidence: 'commit 1c0c1b9'
    },
    {
      no: 6, task: 'Verify display wall auto-refresh',
      cat: 'Testing', priority: 'Medium', target: 'Auto-refresh rotate keywords & reload data',
      status: 'Done', progress: '100%', actual: 'Auto-refresh conversation overview verified',
      blocker: '—', next: '—', evidence: 'commit d062d90'
    },
    {
      no: 7, task: 'BE coverage — top-keywords, trending, scrape service',
      cat: 'Testing', priority: 'High', target: '7 BE test files baru',
      status: 'Done', progress: '100%', actual: 'top-keywords, trending multi-period, scrape (credential/health/keyword/on-demand/platform) selesai',
      blocker: '—', next: '—', evidence: 'commit 65e0e1c'
    },
    {
      no: 8, task: 'Sync FE suite & cover Keyword Intelligence',
      cat: 'Testing', priority: 'High', target: 'Halaman Keyword Intelligence di-cover',
      status: 'Done', progress: '100%', actual: 'keyword-intelligence.spec.ts baru (69 baris), dashboard.spec.ts diupdate',
      blocker: '—', next: '—', evidence: 'commit 9bdab43'
    },
    {
      no: 9, task: 'Update README & documentation',
      cat: 'Documentation', priority: 'Medium', target: 'README sesuai arsitektur terkini',
      status: 'Done', progress: '100%', actual: 'README diupdate 50 baris — architecture & coverage terbaru',
      blocker: '—', next: '—', evidence: 'commit a841782'
    },
    {
      no: 10, task: 'Adapt FE suite ke redeploy (Export report, topic filter, dynamic platform)',
      cat: 'Testing', priority: 'High', target: 'Test cases sesuai deploy terbaru',
      status: 'Done', progress: '100%', actual: 'Export report, topic filter, dynamic platform list diadaptasi',
      blocker: '—', next: '—', evidence: 'commit 0b412cf'
    },
    {
      no: 11, task: 'Refactor — deduplicate mock helpers & async patterns',
      cat: 'Refactor', priority: 'Medium', target: 'api-mock.ts lebih reusable, tidak ada waitForTimeout',
      status: 'Done', progress: '100%', actual: 'Mock helpers dideduplicate, waitForTimeout diganti proper async',
      blocker: '—', next: '—', evidence: 'commit d36550a'
    },
    {
      no: 12, task: 'Fix — clean up probe scripts, update login/auth setup',
      cat: 'Bug Fix', priority: 'High', target: 'Login/auth flow untuk test berjalan benar',
      status: 'Done', progress: '100%', actual: '27 file diubah, auth helper baru, test cases disederhanakan',
      blocker: '—', next: '—', evidence: 'commit 29046fa'
    },
    {
      no: 13, task: 'Perbaiki bug Sentiment/Emotion Map — data belum tampil',
      cat: 'Bug Fix', priority: 'Critical', target: 'Sentiment & Emotion Map menampilkan data',
      status: 'In Progress', progress: '30%', actual: 'Identifikasi masalah — menunggu fix dari BE',
      blocker: 'Bug report #5, #6, #14 — data dari API tidak dikirim',
      next: 'Verifikasi setelah BE fix', evidence: 'Bug Report Weekly'
    },
    {
      no: 14, task: 'Keyword Intelligence — detail card belum benar',
      cat: 'Bug Fix', priority: 'High', target: 'Detail card menampilkan data dengan benar',
      status: 'Blocked', progress: '10%', actual: 'Bug sudah di-identifikasi, menunggu fix dari tim FE/BE',
      blocker: 'Bug report #1 — click detail card tidak menampilkan data',
      next: 'Tunggu fix, lalu re-test', evidence: 'Bug Report Weekly'
    },
  ];

  tasks.forEach((t, i) => {
    const row = 13 + i;
    sheet.getCell('A' + row).value = t.no;
    sheet.getCell('B' + row).value = t.task;
    sheet.getCell('C' + row).value = t.cat;
    sheet.getCell('D' + row).value = t.priority;
    sheet.getCell('E' + row).value = t.target;
    sheet.getCell('F' + row).value = t.status;
    sheet.getCell('G' + row).value = t.progress;
    sheet.getCell('H' + row).value = t.actual;
    sheet.getCell('I' + row).value = t.blocker;
    sheet.getCell('J' + row).value = t.next;
    sheet.getCell('K' + row).value = t.evidence;
  });

  // ===== ACHIEVEMENT / LEARNING (merged A36:E40) =====
  sheet.getCell('A36').value =
    '1. FE test coverage meningkat signifikan (~30 → 70+ test cases)\n' +
    '2. BE test coverage ditambah dengan 7 test files baru\n' +
    '3. Semua halaman utama sudah memiliki Page Object yang proper\n' +
    '4. api-mock.ts di-refactor menjadi lebih reusable & tidak duplikatif\n' +
    '5. Async patterns diperbaiki — tidak ada lagi waitForTimeout\n' +
    '6. Keyword Intelligence & Provider Management halaman baru di-cover\n' +
    '7. Login/Auth setup diperbaiki untuk test environment\n' +
    '8. Test cases diadaptasi ke BE API terbaru';

  // ===== PLAN NEXT WEEK (merged G36:K40) =====
  sheet.getCell('G36').value =
    '1. Perbaiki bug Sentiment/Emotion Map yang belum tampil\n' +
    '2. Selesaikan bug Keyword Intelligence — detail card belum benar\n' +
    '3. Implementasi filter & sort di Topic Intelligence\n' +
    '4. Tambah kolom data akun di tabel All Post\n' +
    '5. Perbaiki space kosong di pengaturan waktu Display Wall\n' +
    '6. Review & cleanup test cases yang sudah tidak relevan';

  await wb.xlsx.writeFile(path.join(ROOT, 'SIP_Weekly_Developer_Report.xlsx'));
  console.log('✅ SIP_Weekly_Developer_Report.xlsx updated successfully!');
}

main().catch(console.error);
