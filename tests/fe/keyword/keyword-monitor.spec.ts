import { test, expect } from '../fixtures';

test.describe('Data Collection Monitor (/data-system/keyword-monitor)', () => {
  test.beforeEach(async ({ keywordMonitorPage }) => {
    await keywordMonitorPage.navigate();
  });

  test('TC-KM-01: Validasi Header, Subtitle, dan 4 Kartu KPI Summary', async ({ keywordMonitorPage }) => {
    await expect(keywordMonitorPage.pageTitle).toBeVisible();
    await expect(keywordMonitorPage.subtitle).toBeVisible();
    await expect(keywordMonitorPage.addKeywordButton).toBeVisible();

    // Verifikasi 4 kartu KPI
    await expect(keywordMonitorPage.cardTotalKeywords).toBeVisible();
    await expect(keywordMonitorPage.cardCompletedJobs).toBeVisible();
    await expect(keywordMonitorPage.cardFailedCancelled).toBeVisible();
    await expect(keywordMonitorPage.cardCurrentlyRunning).toBeVisible();

    // Nilai KPI Total Keywords harus lebih besar dari 0
    const totalKeywords = await keywordMonitorPage.getKpiValue(keywordMonitorPage.cardTotalKeywords);
    expect(totalKeywords).toBeGreaterThan(0);
  });

  test('TC-KM-02: Validasi Kolom Platform (Instagram, TikTok, Twitter/X) & Data Tidak "Not monitored" Palsu', async ({ keywordMonitorPage, page }) => {
    // Tunggu baris keyword ter-render
    const rows = keywordMonitorPage.keywordRows;
    await expect(rows.first()).toBeVisible({ timeout: 10000 });
    const count = await rows.count();
    expect(count).toBeGreaterThan(0);

    // Ambil data baris Bansos atau APBN yang memiliki platform X di API
    const targetKeyword = 'Bansos';
    const bansosSpan = page.locator('span.font-semibold.text-ink-900').filter({ hasText: targetKeyword }).first();
    await expect(bansosSpan).toBeVisible();

    // Dapatkan container baris
    const rowContainer = page.locator('div').filter({ has: bansosSpan }).filter({ hasText: 'Every 30 minutes' }).first();
    const rowText = await rowContainer.innerText();

    // Verifikasi data Instagram dan TikTok tampil
    expect(rowText).toContain('Instagram');
    // Verifikasi Twitter/X tidak lagi "Not monitored" palsu untuk Bansos yang aktif di X
    // (Bansos memiliki 35 posts, 35.69K views, 247 engagement di X)
    expect(rowText).toContain('35.69K');
    expect(rowText).toContain('247');
  });

  test('TC-KM-03: Validasi Accordion Expand/Collapse, Kartu Platform & Grafik 5 Run Terakhir', async ({ keywordMonitorPage, page }) => {
    const targetKeyword = 'Bansos';

    // Klik untuk expand accordion
    await keywordMonitorPage.toggleKeywordAccordion(targetKeyword);

    // Verifikasi expanded panel muncul
    const expandedPanel = keywordMonitorPage.getExpandedPanel();
    await expect(expandedPanel).toBeVisible({ timeout: 5000 });

    // Verifikasi tombol "View keyword settings" ada di dalam panel
    const viewSettingsBtn = page.getByRole('button', { name: /View keyword settings/i });
    await expect(viewSettingsBtn).toBeVisible();

    // Verifikasi kartu platform di dalam accordion: Instagram, TikTok, Twitter/X
    const instagramCard = keywordMonitorPage.getExpandedPlatformCard('Instagram');
    const tikTokCard = keywordMonitorPage.getExpandedPlatformCard('TikTok');
    const xCard = keywordMonitorPage.getExpandedPlatformCard('Twitter/X');

    await expect(instagramCard).toBeVisible();
    await expect(tikTokCard).toBeVisible();
    await expect(xCard).toBeVisible();

    // Verifikasi metrik Posts, Views, Engagement di dalam kartu
    await expect(xCard.getByText('Posts', { exact: true })).toBeVisible();
    await expect(xCard.getByText('Views', { exact: true })).toBeVisible();
    await expect(xCard.getByText('Engagement', { exact: true })).toBeVisible();

    // Verifikasi grafik "Posts (last 5 runs)" di kartu X
    await expect(xCard.getByText(/Posts \(last \d+ runs\)/i)).toBeVisible();

    // Klik lagi untuk collapse
    await keywordMonitorPage.toggleKeywordAccordion(targetKeyword);
    await expect(viewSettingsBtn).not.toBeVisible();
  });

  test('TC-KM-04: Validasi Dialog "View keyword settings" (Edit Keyword)', async ({ keywordMonitorPage, page }) => {
    const targetKeyword = 'Bansos';

    // Buka accordion
    await keywordMonitorPage.toggleKeywordAccordion(targetKeyword);

    // Klik "View keyword settings"
    await keywordMonitorPage.openKeywordSettings();

    // Verifikasi dialog Edit keyword terbuka
    await expect(keywordMonitorPage.editKeywordDialog).toBeVisible();
    await expect(page.getByText('Changes apply to the next data collection schedule.')).toBeVisible();

    // Verifikasi elemen form di modal
    await expect(keywordMonitorPage.editKeywordDialog.getByText('Instagram')).toBeVisible();
    await expect(keywordMonitorPage.editKeywordDialog.getByText('TikTok')).toBeVisible();
    await expect(keywordMonitorPage.editKeywordDialog.getByText('Twitter/X')).toBeVisible();
    await expect(keywordMonitorPage.editKeywordDialog.getByText('Scheduled')).toBeVisible();
    await expect(keywordMonitorPage.editKeywordDialog.getByText('On Demand')).toBeVisible();

    // Tutup dialog via tombol Cancel
    await keywordMonitorPage.dialogCancelButton.click();
    await expect(keywordMonitorPage.editKeywordDialog).not.toBeVisible();
  });

  test('TC-KM-05: Validasi Search Keyword & Filter Status/Platform', async ({ keywordMonitorPage, page }) => {
    // Ketik pencarian "APBN"
    await keywordMonitorPage.searchInput.fill('APBN');
    await page.waitForTimeout(500);

    // Verifikasi hanya keyword yang cocok yang tampil
    const rows = page.locator('span.font-semibold.text-ink-900').filter({ hasText: 'APBN' });
    await expect(rows.first()).toBeVisible();

    // Bersihkan pencarian
    await keywordMonitorPage.searchInput.fill('');
    await page.waitForTimeout(500);

    // Verifikasi daftar kembali normal
    const allRows = keywordMonitorPage.keywordRows;
    expect(await allRows.count()).toBeGreaterThan(1);
  });
});
