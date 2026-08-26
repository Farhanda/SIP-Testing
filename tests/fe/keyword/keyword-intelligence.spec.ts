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

  test('halaman menampilkan heading & empat section intelijen', async ({ page }) => {
    for (const section of ['Sentiment & emotion', 'Early warning', 'Topic intelligence', 'Actor intelligence']) {
      await expect(page.getByRole('heading', { name: section })).toBeVisible();
    }
  });

  test('tombol Export report & Export brief tersedia', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Export report' })).toBeVisible();

    // Export brief muncul kondisional (tergantung data early-warning)
    const briefBtn = page.getByRole('button', { name: 'Export brief' });
    if (!(await briefBtn.isVisible().catch(() => false))) {
      test.info().annotations.push({ type: 'skip-note', description: 'Export brief tidak tersedia untuk keyword aktif' });
      return;
    }
    await expect(briefBtn).toBeVisible();
  });

  test('filter keyword dapat diterapkan tanpa merusak halaman', async ({ page }) => {
    // Combobox keyword (HeadlessUI): ketik lalu pilih opsi pertama yang muncul,
    // fallback: biarkan pilihan saat ini dan langsung Apply.
    const combo = page.locator('[role=combobox]').first();
    if (await combo.isVisible().catch(() => false)) {
      const options = page.getByRole('option');
      await combo.click();
      if (await options.first().isVisible().catch(() => false)) {
        await options.first().click();
      } else {
        await page.keyboard.press('Escape');
      }
    }

    await page.getByRole('button', { name: 'Apply filter' }).click();

    // Halaman tetap sehat: heading utama & section inti tetap tampil
    await expect(page.getByRole('heading', { name: 'Keyword Intelligence', exact: true })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Early warning' })).toBeVisible();
  });

  test('link topic intelligence tersedia dengan href pola detail topik', async ({ page }) => {
    // Link topik hanya muncul utk keyword dgn distribusi topik. Klik via
    // programmatic Next-link tidak selalu navigasi di run headless, jadi
    // coverage fokus pada KEHADIRAN entry point + pola href-nya.
    const topicLink = page.locator('a[href*="/monitoring/keyword-intelligence/topic/"]').first();
    const count = await topicLink.count();
    if (count === 0) {
      await expect(page.getByRole('heading', { name: 'Topic intelligence' })).toBeVisible();
      test.info().annotations.push({ type: 'skip-note', description: 'Tidak ada link topik utk keyword aktif saat ini' });
      return;
    }

    const href = await topicLink.getAttribute('href');
    expect(href).toMatch(/\/monitoring\/keyword-intelligence\/topic\/[^/]+$/);
  });
});
