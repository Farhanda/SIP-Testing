import { expect, type Page } from '@playwright/test';

/**
 * Assertion helpers khusus UI — kumpulan ekspektasi siap pakai supaya
 * test spec tetap ringkas dan konsisten (pola "ui-assert" di PRD §8).
 */

/** Memastikan judul halaman (tab title) memuat bagian tertentu. */
export async function expectPageTitle(page: Page, titlePart: string) {
  await expect(page).toHaveTitle(new RegExp(titlePart, 'i'));
}

/** Memastikan URL halaman saat ini sama persis dengan `path` (tanpa origin). */
export async function expectUrlPath(page: Page, path: string) {
  await expect
    .poll(() => new URL(page.url()).pathname, {
      message: `URL seharusnya ${path}, sekarang ${page.url()}`,
    })
    .toBe(path);
}
