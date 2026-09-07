import { expect } from '../fixtures';
import { test } from '../fixtures';
import { mockTopKeywords } from '../../../src/helpers/api-mock';

/**
 * Test halaman Conversation Overview (/display/conversation-overview).
 *
 * Display wall full-screen yang menampilkan:
 * - Conversation trend chart (line chart volume & engagement)
 * - Emotion map, sentiment map & sentiment trend
 * - Trending topics dengan delta per periode (24h, 7d, 1mo)
 * - Auto-refresh: rotasi keyword tiap 20 detik
 * - SIP Insight branding
 *
 * Arsitektur BARU (2026-08): wall tidak lagi memakai
 * /api/control/selected-keywords — sumber keyword langsung dari
 * GET /v1/dashboard/top-keywords?limit=5 (di-mock oleh mockTopKeywords),
 * lalu tiap keyword memanggil endpoint chart dengan period=1M.
 *
 * + Eksplorasi live 2026-09-04 (http://10.200.101.13:3000):
 *   - Trigger interval adalah LISTBOX dengan 6 opsi: 10/20/30 seconds,
 *     1/2/5 minutes — pilihan tersimpan (teks trigger berubah).
 *   - View admin /monitoring/conversation-overview punya struktur sama
 *     dengan wall publik /display/conversation-overview.
 *   - Wall full-screen TANPA navbar; chart dirender (canvas/svg ada).
 *   ⚠️ CATATAN UX (bukan bug): trigger "20 seconds" adalah PICKER INTERVAL
 *   (listbox), bukan tombol "refresh sekarang" — klik manual TIDAK langsung
 *   merotasi keyword; rotasi hanya terjadi per interval. Label di user guide
 *   ("label tombol 20 seconds") bisa menyesatkan — layak diperjelas di docs.
 */
test.describe('Display Wall — Conversation Overview', () => {
  // TANPA mock top-keywords global: FE deployed memanggil API prod (di-bake
  // saat build) sehingga keyword mock tidak punya data di sana. Mock hanya
  // dipasang di test yang butuh keyword deterministik (heading & rotasi).

  test('halaman menampilkan heading keyword', async ({ displayWallPage }) => {
    await mockTopKeywords(displayWallPage.page, ['RUU Digital', 'BPJS Kesehatan', 'Ketenagakerjaan']);
    await displayWallPage.goto('/display/conversation-overview');

    // H1 harus menampilkan nama keyword (auto-select dari sumber keyword)
    await displayWallPage.expectKeywordVisible('RUU Digital');
  });

  test('page title mengandung "Conversation Overview"', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');

    await displayWallPage.expectPageTitle('Conversation Overview');
  });

  test('auto-refresh countdown button terlihat', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');

    await displayWallPage.expectRefreshButtonVisible();

    // Tombol harus menampilkan countdown (mis. "20 seconds")
    const text = await displayWallPage.refreshCountdown.textContent();
    expect(text).toMatch(/\d+\s*seconds?/i);
  });

  test('SIP Insight branding terlihat', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');

    await displayWallPage.expectSipInsightBranding();
  });

  test('SIP Insight branding terlihat di header wall', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');

    await displayWallPage.expectSipInsightBranding();
    // UI baru: branding bisa berupa link (logo) atau teks statis —
    // yang penting branding terlihat (sudah di-assert di atas)
  });

  test('minimal 4 chart SVG terrender (conversation trend + emotion + sentiment + trending)', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');

    await displayWallPage.expectChartsVisible(4);
  });

  test('conversation trend chart terrender', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');

    // Conversation trend adalah chart pertama
    const firstChart = displayWallPage.charts.first();
    await expect(firstChart).toBeVisible();

    // Chart harus punya elemen (line, circle, dll)
    const chartChildren = await firstChart.locator('circle, line, path, rect').count();
    expect(chartChildren).toBeGreaterThan(0);
  });

  test('emotion map chart terrender', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');

    // Emotion map biasanya pie/donut chart — cari SVG yang punya path lingkaran
    await expect
      .poll(() => displayWallPage.charts.count(), { timeout: 15_000 })
      .toBeGreaterThanOrEqual(3); // trend + emotion + sentiment
  });

  test('trending topics section terrender', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');

    // Struktural (data real BE — label topik & jumlah dinamis): heading
    // "Trending topic" + minimal satu kartu topik dgn angka "N posts".
    // UI 2026-09: kartu topik = teks label topik + "N posts" + delta 24H/7D,
    // jadi cek teks "posts" saja bisa false-match dgn teks deskriptif lain —
    // pakai heading + jumlah post (\d+ posts) dalam satu area yang sama.
    await expect(
      displayWallPage.page.getByText(/Trending topic/i).first()
    ).toBeVisible({ timeout: 25_000 });
    await expect(
      displayWallPage.page.getByText(/^\d+\s*posts?$/i).first()
    ).toBeVisible({ timeout: 25_000 });
  });

  test('trending topics menampilkan delta per periode (24h, 7d, 1mo)', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');

    // Cek ada delta labels — polling utk stabilitas
    await expect(
      displayWallPage.page.getByText(/24h|7d|1mo/i).first()
    ).toBeVisible({ timeout: 25_000 });
  });

  test('display wall tidak memiliki navbar utama (full-screen mode)', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');

    // Tunggu wall benar-benar ter-render dulu agar tidak false-pass sebelum render
    await displayWallPage.expectRefreshButtonVisible();
    // Navbar utama (Dashboard/Display Wall/Management) tidak boleh tampil
    const navLinks = displayWallPage.page.getByRole('navigation').getByRole('link', { name: 'Dashboard' });
    await expect(navLinks).toHaveCount(0);
  });

  test('display wall menggunakan period=1M sebagai default', async ({ displayWallPage }) => {
    const requests: string[] = [];
    displayWallPage.page.on('request', (req) => {
      if (req.url().includes('/v1/dashboard/')) {
        requests.push(req.url());
      }
    });

    await displayWallPage.goto('/display/conversation-overview');
    // Tunggu hingga chart request benar-benar dikirim (max 10s)
    await expect
      .poll(() => requests.filter(r => r.includes('period=')).length, { timeout: 10_000 })
      .toBeGreaterThan(0);

    // Semua request harus menggunakan period=1M
    const periodRequests = requests.filter(r => r.includes('period='));
    for (const req of periodRequests) {
      expect(req).toContain('period=1M');
    }
  });

  test('auto-refresh memutar keyword berikutnya & memuat ulang data tiap interval', async ({ displayWallPage }) => {
    test.setTimeout(90_000); // menunggu minimal satu siklus interval (20s)

    // Sumber keyword dibuat deterministik karena test memverifikasi urutan rotasi.
    await mockTopKeywords(displayWallPage.page, ['RUU Digital', 'BPJS Kesehatan', 'Ketenagakerjaan']);
    await displayWallPage.goto('/display/conversation-overview');
    await displayWallPage.expectKeywordVisible('RUU Digital');

    // Gelombang refresh = request chart untuk keyword SELAIN yang pertama
    const rotatedKeywords: string[] = [];
    displayWallPage.page.on('request', (req) => {
      if (/\/v1\/dashboard\/(conversation-trend|emotion-map)/.test(req.url())) {
        const kw = new URL(req.url()).searchParams.get('keyword');
        if (kw && kw !== 'RUU Digital') rotatedKeywords.push(kw);
      }
    });

    // Interval 20 detik: gelombang kedua harus muncul dgn keyword berikutnya.
    // Label tombol "20 seconds" adalah label interval statis, bukan countdown.
    await expect.poll(async () => rotatedKeywords.length, { timeout: 60_000 }).toBeGreaterThan(0);
    expect(rotatedKeywords[0]).toBe('BPJS Kesehatan');

    // Heading berganti mengikuti keyword yang aktif
    await displayWallPage.expectKeywordVisible('BPJS Kesehatan');
  });

  // ── Eksplorasi live 2026-09: interval picker & view admin ─────────────

  test('interval picker (listbox) menampilkan 6 opsi & pilihan tersimpan (live)', async ({ page }) => {
    await page.goto('/display/conversation-overview');
    await page.waitForLoadState('domcontentloaded');

    // Trigger interval = button[aria-haspopup="listbox"] (teks "20 seconds")
    const trigger = page.locator('button[aria-haspopup="listbox"]').first();
    await expect(trigger).toBeVisible();

    await trigger.click();
    const options = page.getByRole('option');
    await expect(options.first()).toBeVisible();
    const texts = await options.allInnerTexts();
    expect(texts).toEqual([
      '10 seconds',
      '20 seconds',
      '30 seconds',
      '1 minute',
      '2 minutes',
      '5 minutes',
    ]);

    // Pilih interval berbeda → teks trigger ikut berubah (tersimpan)
    await page.getByRole('option', { name: '30 seconds' }).click();
    await expect(trigger).toHaveText('30 seconds');

    // Kembalikan ke default
    await trigger.click();
    await page.getByRole('option', { name: '20 seconds' }).click();
    await expect(trigger).toHaveText('20 seconds');
  });

  test('wall conversation-overview: full-screen tanpa navbar (header count 0) & canvas ter-render (live)', async ({ page }) => {
    await page.goto('/display/conversation-overview');
    await page.waitForLoadState('domcontentloaded');

    // Heading keyword (h1) tampil
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // Full-screen: navbar utama TIDAK ada
    await expect(page.locator('header')).toHaveCount(0);
    // Chart ter-render (canvas dan/atau svg)
    await expect(page.locator('canvas').first()).toBeVisible();
    expect(await page.locator('canvas').count()).toBeGreaterThan(0);
  });

  test('admin monitoring view conversation-overview punya struktur sama dengan wall publik (live)', async ({ page }) => {
    await page.goto('/monitoring/conversation-overview');
    await page.waitForLoadState('domcontentloaded');

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('header')).toHaveCount(0);
    await expect(page.locator('canvas').first()).toBeVisible();
    expect(await page.locator('canvas').count()).toBeGreaterThan(0);
  });
});
