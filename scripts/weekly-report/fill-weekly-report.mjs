#!/usr/bin/env node
// scripts/weekly-report/fill-weekly-report.mjs
// ---------------------------------------------------------------------------
// Mengisi template `SIP_Weekly_Developer_Report.xlsx` (sheet "Weekly Report")
// dari file data JSON — JANGAN edit script ini tiap minggu; cukup buat JSON baru.
//
//   Cara pakai:
//     npm run report:weekly                    # pakai data/current.json
//     node scripts/weekly-report/fill-weekly-report.mjs data/w35.json
//     node scripts/weekly-report/fill-weekly-report.mjs ./laporan-mingguan.json
//
//   Format data (lihat data/current.json — isian Week 35 sebagai contoh):
//     {
//       "week": "Week 35",                     → D3
//       "period": "29 Aug - 04 Sep 2026",      → D4
//       "name": "Alfath",                      → B4
//       "role": "QA / Automation Engineer",    → B5
//       "roleSummary": "...",                  → B6  (ringkasan peran/hasil)
//       "executiveSummary": "...",             → B7  (ringkasan mingguan)
//       "status": "On Track",                  → D5
//       "duration": "7 days",                  → D6
//       "approver": "Pa Anang",                → D7
//       "highlights": ["• ...", "• ..."],      → I4  (1 string per baris, join \n)
//       "tasks": [{                            → baris mulai TASK_START_ROW (13)
//         "no": 1, "task": "...", "cat": "Testing", "priority": "High",
//         "target": "...", "status": "Done", "progress": "95%",
//         "actual": "...", "blocker": "...", "next": "...", "evidence": "..."
//       }],
//       "achievements": ["1. ...", ...],       → A36 (join \n)
//       "planNextWeek": ["1. ...", ...]        → G36 (join \n)
//     }
//
// Catatan:
//   - Baris task 13-32 (maks 20 task) dibersihkan dulu tiap run, jadi mengisi
//     ulang dengan data lebih sedikit aman (baris lama tidak tertinggal).
//   - Formula KPI (G4-G8) ditulis ulang tanpa cached result agar Excel
//     menghitung ulang saat file dibuka.
// ---------------------------------------------------------------------------

import ExcelJS from 'exceljs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const DEFAULT_XLSX = fs.existsSync(path.join(ROOT, 'SIP_Weekly_Developer_Report_Farhan.xlsx'))
  ? path.join(ROOT, 'SIP_Weekly_Developer_Report_Farhan.xlsx')
  : path.join(ROOT, 'SIP_Weekly_Developer_Report.xlsx');
const XLSX_PATH = process.env.REPORT_XLSX
  ? path.resolve(process.env.REPORT_XLSX)
  : (process.argv[3]
      ? (path.isAbsolute(process.argv[3]) ? process.argv[3] : path.join(ROOT, process.argv[3]))
      : DEFAULT_XLSX);

// ===== Layout template (jaga sinkron dengan template Excel) =====
const SHEET_NAME = 'Weekly Report';
const TASK_START_ROW = 13;
const TASK_END_ROW = 32; // maks 20 task (layout template: rows 13-32)
const TASK_COLS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K'];
const CELL = {
  week: 'D3',
  period: 'D4',
  name: 'B4',
  role: 'B5',
  roleSummary: 'B6',
  executiveSummary: 'B7',
  status: 'D5',
  duration: 'D6',
  approver: 'D7',
  highlights: 'I4',
  achievements: 'A36',
  planNextWeek: 'G36',
};
const KPI_FORMULAS = {
  G4: 'COUNTA(F13:F32)',
  G5: 'COUNTIF(F13:F32,"Done")',
  G6: 'COUNTIF(F13:F32,"In Progress")',
  G7: 'COUNTIF(F13:F32,"Blocked")',
  G8: 'IF(G4=0,0,G5/G4)',
};

// ===== CLI =====
// Arg opsional: path file data JSON (relatif ke root project atau absolut).
// Tanpa arg → pakai data/current.json (data minggu berjalan).
const argPath = process.argv[2];
const dataPath = path.isAbsolute(argPath ?? '')
  ? (argPath ?? '')
  : path.join(ROOT, argPath ?? path.join('scripts', 'weekly-report', 'data', 'current.json'));

// ===== Validasi data =====
function validate(data) {
  const errors = [];
  const req = (cond, msg) => {
    if (!cond) errors.push(msg);
  };

  for (const [field, cell] of Object.entries(CELL)) {
    const v = data[field];
    if (field === 'highlights' || field === 'achievements' || field === 'planNextWeek') {
      req(Array.isArray(v) && v.length > 0, `data.${field} wajib array berisi minimal 1 baris (cell ${cell})`);
    } else {
      req(typeof v === 'string' && v.trim() !== '', `data.${field} wajib string non-kosong (cell ${cell})`);
    }
  }

  req(Array.isArray(data.tasks) && data.tasks.length > 0, 'data.tasks wajib array berisi minimal 1 task');
  req(
    Array.isArray(data.tasks) && data.tasks.length <= TASK_END_ROW - TASK_START_ROW + 1,
    `data.tasks maksimal ${TASK_END_ROW - TASK_START_ROW + 1} task (layout template rows ${TASK_START_ROW}-${TASK_END_ROW})`,
  );
  if (Array.isArray(data.tasks)) {
    const taskFields = ['task', 'cat', 'priority', 'target', 'status', 'progress', 'actual', 'blocker', 'next', 'evidence'];
    data.tasks.forEach((t, i) => {
      for (const f of taskFields) {
        req(
          t && typeof t[f] === 'string' && t[f].trim() !== '',
          `data.tasks[${i}].${f} wajib string non-kosong`,
        );
      }
      req(t && Number.isInteger(t.no) && t.no > 0, `data.tasks[${i}].no wajib integer > 0`);
    });
    // no harus unik
    if (Array.isArray(data.tasks)) {
      const nos = data.tasks.map((t) => t.no);
      const dup = nos.filter((n, i) => nos.indexOf(n) !== i);
      req(dup.length === 0, `data.tasks[].no duplikat: ${[...new Set(dup)].join(', ')}`);
    }
  }

  if (errors.length > 0) {
    console.error(`❌ Data weekly report tidak valid (${errors.length}):`);
    for (const e of errors) console.error(`   - ${e}`);
    console.error(`\n   Perbaiki file: ${path.relative(ROOT, dataPath)}`);
    console.error('   Format lengkap: lihat komentar di bagian atas script ini.');
    process.exit(1);
  }
}

// ===== Fill workbook =====
async function main() {
  if (!fs.existsSync(dataPath)) {
    console.error(`❌ File data tidak ditemukan: ${dataPath}`);
    console.error('   Pakai: npm run report:weekly  (data/current.json)');
    console.error('   atau : node scripts/weekly-report/fill-weekly-report.mjs <path-data.json>');
    process.exit(1);
  }
  if (!fs.existsSync(XLSX_PATH)) {
    console.error(`❌ Template Excel tidak ditemukan: ${XLSX_PATH}`);
    process.exit(1);
  }

  const data = JSON.parse(fs.readFileSync(dataPath, 'utf-8'));
  validate(data);

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(XLSX_PATH);
  const sheet = wb.getWorksheet(SHEET_NAME);
  if (!sheet) {
    console.error(`❌ Sheet "${SHEET_NAME}" tidak ditemukan di template.`);
    process.exit(1);
  }

  const joinLines = (arr) => arr.join('\n');

  // Header info (rows 3-7)
  sheet.getCell(CELL.week).value = data.week;
  sheet.getCell(CELL.period).value = data.period;
  sheet.getCell(CELL.name).value = data.name;
  sheet.getCell(CELL.role).value = data.role;
  sheet.getCell(CELL.roleSummary).value = data.roleSummary;
  sheet.getCell(CELL.executiveSummary).value = data.executiveSummary;
  sheet.getCell(CELL.status).value = data.status;
  sheet.getCell(CELL.duration).value = data.duration;
  sheet.getCell(CELL.approver).value = data.approver;

  // Weekly highlights (merged I4:K8 — cukup set I4)
  sheet.getCell(CELL.highlights).value = joinLines(data.highlights);

  // Task / activity detail (rows 13-32) — bersihkan dulu supaya aman diisi ulang
  for (let r = TASK_START_ROW; r <= TASK_END_ROW; r++) {
    for (const col of TASK_COLS) sheet.getCell(col + r).value = null;
  }
  for (const t of data.tasks) {
    const row = TASK_START_ROW + data.tasks.indexOf(t);
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
  }

  // Achievement / learning (merged A36:E40) & plan next week (merged G36:K40)
  sheet.getCell(CELL.achievements).value = joinLines(data.achievements);
  sheet.getCell(CELL.planNextWeek).value = joinLines(data.planNextWeek);

  // KPI formulas — ditulis ulang tanpa cached result agar Excel kalkulasi ulang
  for (const [cell, formula] of Object.entries(KPI_FORMULAS)) {
    sheet.getCell(cell).value = { formula };
  }

  await wb.xlsx.writeFile(XLSX_PATH);
  console.log(`✅ ${path.basename(XLSX_PATH)} (${data.week}) updated!`);
  console.log(`   Sumber data : ${path.relative(ROOT, dataPath)}`);
  console.log(`   Task diisi  : ${data.tasks.length} baris (rows ${TASK_START_ROW}-${TASK_START_ROW + data.tasks.length - 1})`);
}

main().catch((err) => {
  console.error('❌ Gagal mengisi weekly report:', err.message);
  process.exit(1);
});
