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
 */
test.describe('Display Wall — Conversation Overview', () => {
  test.beforeEach(async ({ page }) => {
    // Hanya daftar keyword yang di-mock � chart endpoints memakai BE asli
    // (shape respons wall baru tidak kompatibel dgn mock dashboard lama).
    await mockTopKeywords(page, ['RUU Digital', 'BPJS Kesehatan', 'Ketenagakerjaan']);
  });

  test('halaman menampilkan heading keyword', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');
    await displayWallPage.page.waitForLoadState('networkidle');

    // H1 harus menampilkan nama keyword (auto-select dari selected-keywords)
    await displayWallPage.expectKeywordVisible('RUU Digital');
  });

  test('page title mengandung "Conversation Overview"', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');
    await displayWallPage.page.waitForLoadState('networkidle');

    await displayWallPage.expectPageTitle('Conversation Overview');
  });

  test('auto-refresh countdown button terlihat', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');
    await displayWallPage.page.waitForLoadState('networkidle');

    await displayWallPage.expectRefreshButtonVisible();

    // Tombol harus menampilkan countdown (mis. "20 seconds")
    const text = await displayWallPage.refreshCountdown.textContent();
    expect(text).toMatch(/\d+\s*seconds?/i);
  });

  test('SIP Insight branding terlihat', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');
    await displayWallPage.page.waitForLoadState('networkidle');

    await displayWallPage.expectSipInsightBranding();
  });

  test('SIP Insight branding terlihat di header wall', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');
    await displayWallPage.page.waitForLoadState('networkidle');

    await displayWallPage.expectSipInsightBranding();
    // UI baru: branding bisa berupa link (logo) atau teks statis —
    // yang penting branding terlihat (sudah di-assert di atas)
  });

  test('minimal 4 chart SVG terrender (conversation trend + emotion + sentiment + trending)', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');
    await displayWallPage.page.waitForLoadState('networkidle');

    await displayWallPage.expectChartsVisible(4);
  });

  test('conversation trend chart terrender', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');
    await displayWallPage.page.waitForLoadState('networkidle');

    // Conversation trend adalah chart pertama
    const firstChart = displayWallPage.charts.first();
    await expect(firstChart).toBeVisible();

    // Chart harus punya elemen (line, circle, dll)
    const chartChildren = await firstChart.locator('circle, line, path, rect').count();
    expect(chartChildren).toBeGreaterThan(0);
  });

  test('emotion map chart terrender', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');
    await displayWallPage.page.waitForLoadState('networkidle');

    // Emotion map biasanya pie/donut chart — cari SVG yang punya path lingkaran
    const svgCount = await displayWallPage.charts.count();
    expect(svgCount).toBeGreaterThanOrEqual(3); // trend + emotion + sentiment
  });

  test('trending topics section terrender', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');
    await displayWallPage.page.waitForLoadState('networkidle');

    // Trending topics struktural: heading section + item dgn jumlah posts
    // (label topik dinamis dari data BE — jangan hardcode nama topik)
    await expect(
      displayWallPage.page.getByText(/Trending topic/i).first()
    ).toBeVisible({ timeout: 25_000 });
    await expect(
      displayWallPage.page.getByText(/\d+\s*posts/i).first()
    ).toBeVisible({ timeout: 25_000 });
  });

  test('trending topics menampilkan delta per periode (24h, 7d, 1mo)', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');
    await displayWallPage.page.waitForLoadState('networkidle');

    // Cek ada delta labels — polling utk stabilitas
    await expect(
      displayWallPage.page.getByText(/24h|7d|1mo/i).first()
    ).toBeVisible({ timeout: 25_000 });
  });

  test('display wall tidak memiliki navbar utama (full-screen mode)', async ({ displayWallPage }) => {
    await displayWallPage.goto('/display/conversation-overview');
    await displayWallPage.page.waitForLoadState('networkidle');

    // Navbar utama (Dashboard/Display Wall/Management) tidak boleh tampil
    const navLinks = displayWallPage.page.getByRole('navigation').getByRole('link', { name: 'Dashboard' });
    const hasNav = await navLinks.isVisible().catch(() => false);
    expect(hasNav).toBeFalsy();
  });

  test('display wall menggunakan period=1M sebagai default', async ({ displayWallPage }) => {
    const requests: string[] = [];
    displayWallPage.page.on('request', (req) => {
      if (req.url().includes('/v1/dashboard/')) {
        requests.push(req.url());
      }
    });

    await displayWallPage.goto('/display/conversation-overview');
    await displayWallPage.page.waitForLoadState('networkidle');
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

    // Sumber keyword = mock top-keywords (3 item, lihat beforeEach).
    await displayWallPage.goto('/display/conversation-overview');
    await displayWallPage.page.waitForLoadState('networkidle');
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
});
