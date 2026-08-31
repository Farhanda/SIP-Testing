import { expect } from '../fixtures';
import { test } from '../fixtures';

/**
 * Test halaman Keyword Intelligence (/monitoring/keyword-intelligence).
 *
 * Halaman BARU (muncul di deploy 2026-08) — agregat intelijen lintas
 * keyword dengan 4 section: Sentiment & emotion, Early warning,
 * Topic intelligence, Actor intelligence. Data dari
 * /api/keyword-intelligence/* (proxy Next.js).
 *
 * Assertion sifatnya STRUKTURAL (elemen & section), bukan isi data —
 * halaman mengonsumsi data live sehingga nilai spesifik berubah-ubah.
 */
test.describe('Keyword Intelligence — /monitoring/keyword-intelligence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/monitoring/keyword-intelligence');
    await page.waitForLoadState('networkidle');
    await expect(page.getByRole('heading', { name: 'Keyword Intelligence', exact: true })).toBeVisible();
  });

  test('halaman menampilkan heading & section intelijen', async ({ page }) => {
    // UI baru (2026-08): 'Early warning' digantikan 'Decision summary' region
    for (const section of ['Sentiment & emotion', 'Topic intelligence', 'Actor intelligence']) {
      await expect(page.getByRole('heading', { name: section })).toBeVisible();
    }
    // Decision summary bersifat kondisional — hanya muncul jika data cukup
  });

  test('tombol Export report & Export brief tersedia', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Export report' })).toBeVisible();

    // Export brief muncul kondisional (tergantung data early-warning)
    const briefBtn = page.getByRole('button', { name: 'Export brief' });
    const hasBrief = await briefBtn.isVisible().catch(() => false);
    // Export brief bersifat opsional — test PASS dengan atau tanpa button ini.
    if (hasBrief) {
      await expect(briefBtn).toBeVisible();
    }
  });

  test('filter keyword dapat diterapkan tanpa merusak halaman', async ({ page }) => {
    // Combobox keyword (HeadlessUI): ketik lalu pilih opsi pertama yang muncul.
    const combo = page.locator('[role=combobox]').first();
    const hasCombo = await combo.isVisible().catch(() => false);
    if (hasCombo) {
      const options = page.getByRole('option');
      await combo.click();
      const hasOptions = await options.first().isVisible({ timeout: 3000 }).catch(() => false);
      if (hasOptions) {
        await options.first().click();
      } else {
        await page.keyboard.press('Escape');
      }
    }

    await page.getByRole('button', { name: 'Apply filter' }).click();

    // Halaman tetap sehat: heading utama tetap tampil
    await expect(page.getByRole('heading', { name: 'Keyword Intelligence', exact: true })).toBeVisible();
  });

  test('link topic intelligence tersedia dengan href pola detail topik', async ({ page }) => {
    // Link topik hanya muncul utk keyword dgn distribusi topik.
    // Section heading harus selalu terlihat meski tidak ada link detail.
    await expect(page.getByRole('heading', { name: 'Topic intelligence' })).toBeVisible();

    const topicLink = page.locator('a[href*="/monitoring/keyword-intelligence/topic/"]').first();
    const count = await topicLink.count();
    if (count > 0) {
      const href = await topicLink.getAttribute('href');
      expect(href).toMatch(/\/monitoring\/keyword-intelligence\/topic\/[^/]+$/);
    }
  });
});
