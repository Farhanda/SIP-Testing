import { readFileSync } from 'node:fs';
import path from 'node:path';
import { test, expect, beApiUrl, AI_OUTPUT_DIR } from './fixtures';
import {
  buildDashboardReport,
  buildBeExecutionReport,
  summarizeBeResults,
  timestampForFilename,
  writeReport,
  type DashboardSummaryData,
} from './report';

/**
 * Contoh test platform AI — MENGHASILKAN hasil dari data BE.
 *
 * 1. `generate laporan insight dari data live BE` — ambil data dashboard
 *    dari BE API, ubah jadi laporan markdown, tulis ke `test-results/ai/`.
 * 2. `generate laporan eksekusi test BE` — baca hasil `npm run test:be`
 *    (`test-results/results-be.json`), rangkum status, tulis laporannya.
 *
 * Hasil generate ada di `test-results/ai/` (gitignored).
 * Nanti, lapisan AI sesungguhnya (mis. LLM) bisa dicolok di `report.ts`.
 */

const RESULTS_BE_FILE = path.join(process.cwd(), 'test-results', 'results-be.json');

test.describe('AI — generate hasil dari data BE', () => {
  test('generate laporan insight dari data live BE (dashboard summary)', async ({ api, outputDir }) => {
    // 1. Ambil data BE.
    const res = await api.get(beApiUrl('/v1/dashboard/summary'));
    expect(res.status()).toBe(200);
    const body = (await res.json()) as DashboardSummaryData;

    // 2. Generate laporan dari data BE.
    const content = buildDashboardReport(body);
    const filePath = writeReport(outputDir, `dashboard-summary-${timestampForFilename()}.md`, content);

    // 3. Verifikasi hasil generate: file ada, tidak kosong, memuat data BE.
    const written = readFileSync(filePath, 'utf-8');
    expect(written.length).toBeGreaterThan(0);
    expect(written).toContain('# Laporan Otomatis — Ringkasan Dashboard');
    expect(written).toContain(body.data.total_post.label);
    expect(written).toContain(body.data.views.label);
    expect(written).toContain(body.meta.generated_at);
    expect(written).toContain(`Active Platforms | ${body.data.active_platforms.active}/${body.data.active_platforms.total} | — |`);
  });

  test('generate laporan eksekusi test BE dari results-be.json', ({ outputDir }) => {
    const summary = summarizeBeResults(RESULTS_BE_FILE);

    // Butuh hasil `npm run test:be` dulu — kalau belum ada, test di-skip.
    test.skip(!summary, 'results-be.json belum ada — jalankan `npm run test:be` terlebih dahulu');

    const content = buildBeExecutionReport(summary!, RESULTS_BE_FILE);
    const filePath = writeReport(outputDir, `be-execution-${timestampForFilename()}.md`, content);

    const written = readFileSync(filePath, 'utf-8');
    expect(written).toContain('# Laporan Eksekusi Test BE');
    expect(written).toContain(`Total: **${summary!.total}**`);
    expect(written).toContain(`Passed: **${summary!.passed}**`);
  });

  test('laporan insight memuat header tabel metrik yang konsisten', async ({ api, outputDir }) => {
    const res = await api.get(beApiUrl('/v1/dashboard/summary'));
    expect(res.status()).toBe(200);
    const body = (await res.json()) as DashboardSummaryData;

    const content = buildDashboardReport(body);
    const filePath = writeReport(outputDir, `dashboard-summary-${timestampForFilename()}.md`, content);
    const written = readFileSync(filePath, 'utf-8');

    // Header tabel selalu ada & jumlah baris metrik konsisten.
    expect(written).toContain('| Metrik | Nilai | Delta |');
    const metricRows = written.split('\n').filter((l) => l.startsWith('| ')).length;
    expect(metricRows).toBe(7); // 1 header + 1 separator + 4 metrik + 1 active platforms
    expect(AI_OUTPUT_DIR).toBe(outputDir);
  });
});
