import { expect } from '../fixtures';
import { test } from '../fixtures';
import { mockDashboardApis, mockKeywordOptions } from '../../../src/helpers/api-mock';

/**
 * Test fungsional toggle dark mode di navbar (sebelumnya 0 coverage).
 *
 * Catatan audit (2026-08-12): dark mode TERBUKTI bekerja — `globals.css`
 * meng-import `sip-dashboard.css` yang mendefinisikan blok `[data-theme='dark']`
 * (override lengkap var --color-*), sehingga var berubah saat atribut toggle
 * (--color-bg #f2f2f3 → #16181a). Body tidak berubah karena berada DI LUAR
 * wrapper `data-theme` di Layout — perilaku normal, bukan bug.
 */
test.describe('Dark Mode — Theme Toggle', () => {
  test('toggle dark mode harus mengubah tema visual aplikasi', async ({ dashboardPage }) => {
    await mockDashboardApis(dashboardPage.page);
    await mockKeywordOptions(dashboardPage.page);
    await dashboardPage.goto();

    const toggle = dashboardPage.page.getByRole('button', { name: 'Enable dark mode' });
    await expect(toggle).toBeVisible();

    // Tema diterapkan di wrapper div Layout (className bg-sip-bg, data-theme).
    // Catatan (2026-08): <html> JUGA punya atribut data-theme (background-nya
    // transparan) — ambil div-nya secara eksplisit.
    const wrapper = dashboardPage.page.locator('div[data-theme]').first();
    await expect(wrapper).toBeVisible();
    const bgBefore = await wrapper.evaluate((el) => getComputedStyle(el).backgroundColor);

    await toggle.click();

    // State toggle bekerja: atribut tema berubah & label tombol berganti.
    // Catatan (2026-08): app kini set data-theme="dark" di <html> DAN wrapper
    // div Layout — pakai html agar locator tidak ambigu (strict mode).
    await expect(dashboardPage.page.locator('html[data-theme="dark"]')).toBeVisible();
    await expect(
      dashboardPage.page.getByRole('button', { name: 'Enable light mode' })
    ).toBeVisible();

    // Warna latar wrapper (var(--color-bg)) benar-benar berubah → tema teraplikasi.
    const bgAfter = await wrapper.evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(bgAfter).not.toBe(bgBefore);
  });
});
