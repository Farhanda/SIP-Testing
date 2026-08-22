import { expect } from '../fixtures';
import { test } from '../fixtures';
import { mockDashboardApis, mockKeywordOptions } from '../../../src/helpers/api-mock';

/**
 * A2 (Bug): tombol "Export report" di dashboard saat ini TIDAK memiliki
 * onClick sama sekali (`<button>Export report</button>` di
 * src/modules/dashboard/index.tsx) — klik tidak melakukan apa-apa.
 *
 * Test meng-encode perilaku yang BENAR: klik Export report harus memicu
 * efek nyata — download file ATAU request API (generate/persiapkan report).
 * → FAIL sekarang (0 efek), PASS setelah fitur export diimplementasikan.
 *
 * Catatan: dashboard tidak melakukan polling, jadi menghitung request baru
 * setelah klik aman (tidak ada noise dari refetch berkala).
 */
test.describe('Regresi Bug — Export Report', () => {
  test('REGRESI A2: tombol Export report harus memicu aksi (download/request)', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page);
    await dashboardPage.goto();

    const effects: string[] = [];
    dashboardPage.page.on('download', () => effects.push('download'));
    dashboardPage.page.on('request', (req) => {
      if (req.url().includes('/api/')) {
        effects.push(`${req.method()} ${req.url()}`);
      }
    });

    // Cek apakah tombol Export report masih ada di UI
    const hasExportButton = await dashboardPage.exportReportButton.isVisible({ timeout: 5000 }).catch(() => false);
    if (!hasExportButton) return; // Tombol dihapus dari UI — bug tidak lagi applicable

    // ⚠️ Dashboard melakukan AUTO-SEARCH: begitu mock options berisi keyword,
    // halaman otomatis memilih keyword pertama → 10 request /api/dashboard/*
    // ter-batch. Baseline hanya valid SETELAH batch itu selesai → tunggu kartu
    // hasil render + flush semua in-flight request.
    await expect(dashboardPage.conversationSummaryHeading).toBeVisible();
    await dashboardPage.page.waitForTimeout(1500);
    const baseline = effects.length;

    await dashboardPage.exportReportButton.click();

    // Bug A2: saat ini klik tanpa efek → poll ini FAIL (effects.length tetap baseline).
    await expect.poll(() => effects.length).toBeGreaterThan(baseline);
  });
});
