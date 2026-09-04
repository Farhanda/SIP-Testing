import { expect } from '../fixtures';
import { test } from '../fixtures';
import {
  mockCreateProvider,
  mockProviderList,
  mockToggleProvider,
} from '../../../src/helpers/api-mock';

/**
 * Test Provider Management (/administration/provider) — halaman yang
 * mengonsumsi BE langsung (GET /v1/scrape/credential):
 * daftar provider, filter keyword/platform/enabled, reset filter,
 * modal "+ Add provider" (validasi + submit), dan toggle enable/disable.
 *
 * + Eksplorasi live 2026-09-04 (http://10.200.101.13:3000):
 *   - Modal "Edit provider" TERISI data baris; field SECRET berlabel
 *     "SECRET (OPTIONAL)" dan TIDAK menampilkan secret lama (kosong —
 *     keamanan: hanya dikirim bila diganti).
 *   - Tabel menampilkan status secret sebagai "Configured" (nilai asli
 *     tidak pernah dirender ke DOM).
 */
test.describe('Provider Management', () => {
  test('halaman provider management menampilkan daftar provider dari API BE', async ({ providerPage }) => {
    await mockProviderList(providerPage.page);
    await providerPage.goto();

    await providerPage.expectHeading('Provider Management');
    await expect(providerPage.addButton).toBeVisible();

    // Kolom tabel
    for (const header of ['Name', 'Platform', 'Secret', 'Enabled', 'Priority']) {
      await providerPage.expectColumnHeader(header);
    }

    // Data mock ter-render
    await providerPage.expectProviderVisible('Instagram Live - Primary', true);
    await providerPage.expectProviderVisible('TikTok Live - Primary', true);
    await providerPage.expectProviderVisible('TwitterX Live - Primary', true);

    // Secret configured dirender sebagai teks "Configured"
    await expect(providerPage.rowOf('Instagram Live - Primary').getByText('Configured')).toBeVisible();

    // Info pagination (meta dari respons API)
    await expect(providerPage.showingText).toBeVisible();
  });

  test('filter platform menampilkan provider sesuai platform', async ({ providerPage }) => {
    await mockProviderList(providerPage.page);
    await providerPage.goto();

    await providerPage.selectPlatform('tiktok');

    await providerPage.expectProviderVisible('TikTok Live - Primary', true);
    await providerPage.expectProviderVisible('Instagram Live - Primary', false);
  });

  test('filter enabled=false hanya menampilkan provider disabled', async ({ providerPage }) => {
    await mockProviderList(providerPage.page);
    await providerPage.goto();

    await providerPage.selectEnabled('false');

    // Hanya TikTok yang disabled di data mock
    await providerPage.expectProviderVisible('TikTok Live - Primary', true);
    await providerPage.expectProviderVisible('Instagram Live - Primary', false);
    await providerPage.expectProviderVisible('TwitterX Live - Primary', false);
  });

  test('pencarian nama memfilter daftar provider', async ({ providerPage }) => {
    await mockProviderList(providerPage.page);
    await providerPage.goto();

    await providerPage.searchProviders('twitter');

    await providerPage.expectProviderVisible('TwitterX Live - Primary', true);
    await providerPage.expectProviderVisible('Instagram Live - Primary', false);
  });

  test('reset filter mengembalikan daftar lengkap & nilai default', async ({ providerPage }) => {
    await mockProviderList(providerPage.page);
    await providerPage.goto();

    await providerPage.selectPlatform('tiktok');
    await providerPage.expectProviderVisible('Instagram Live - Primary', false);

    await providerPage.resetFilters();

    // Nilai select kembali ke default "all" & daftar penuh dimuat ulang
    await expect(providerPage.platformSelect).toHaveValue('all');
    await providerPage.expectProviderVisible('Instagram Live - Primary', true);
    await providerPage.expectProviderVisible('TwitterX Live - Primary', true);
  });

  test('modal Add provider terbuka dengan field lengkap', async ({ providerPage }) => {
    await mockProviderList(providerPage.page);
    await providerPage.goto();
    await providerPage.openCreateModal();

    await expect(providerPage.modalNameInput).toBeVisible();
    await expect(providerPage.modalPlatformInput).toBeVisible();
    await expect(providerPage.modalSecretInput).toBeVisible();
    await expect(providerPage.modalPriorityInput).toBeVisible();
    await expect(providerPage.modalReqPerSecondInput).toBeVisible();
    await expect(providerPage.modalReqPerMonthInput).toBeVisible();
  });

  test('modal Edit provider terbuka dengan data baris ter-prefill', async ({ providerPage }) => {
    await mockProviderList(providerPage.page);
    await providerPage.goto();

    // Nama diambil dinamis dari mock agar tidak kaku terhadap urutan data
    const firstName = 'Instagram Live - Primary';
    await providerPage.editButton(firstName).click();

    await expect(providerPage.editModal).toBeVisible();
    await expect(providerPage.editModal).toContainText('Edit provider');
    await expect(providerPage.editNameInput).toHaveValue(firstName);
    await expect(providerPage.editModal.getByRole('button', { name: 'Save' })).toBeVisible();

    // Tutup tanpa menyimpan
    await providerPage.editModal.getByRole('button', { name: 'Cancel' }).click();
    await expect(providerPage.editModal).toHaveCount(0);
  });

  test('validasi form Add provider kosong menampilkan pesan error tanpa mengirim request', async ({ providerPage }) => {
    const page = providerPage.page;
    await mockProviderList(page);
    await providerPage.goto();

    const posts: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/v1/scrape/credential')) posts.push(req.url());
    });

    await providerPage.openCreateModal();
    await providerPage.submitCreate();

    // Pesan validasi zod tampil, modal tetap terbuka, tidak ada POST keluar
    await expect(page.getByText('Name must be at least 2 characters')).toBeVisible();
    await expect(page.getByText('Platform is required')).toBeVisible();
    await expect(page.getByText('Secret is required')).toBeVisible();
    await providerPage.expectModalOpen(true);
    await expect.poll(() => posts.length).toBe(0);
  });

  test('submit valid mengirim POST ke BE & menampilkan toast sukses', async ({ providerPage }) => {
    const page = providerPage.page;
    await mockProviderList(page);
    await mockCreateProvider(page, { succeed: true });
    await providerPage.goto();

    const postBodies: Record<string, unknown>[] = [];
    page.on('request', (req) => {
      if (req.method() === 'POST' && req.url().includes('/v1/scrape/credential')) {
        try {
          postBodies.push(JSON.parse(req.postData() ?? '{}'));
        } catch {
          postBodies.push({});
        }
      }
    });

    await providerPage.openCreateModal();
    await providerPage.modalNameInput.fill('QA Automation Provider');
    await providerPage.choosePlatform('TikTok');
    await providerPage.modalSecretInput.fill('qa-automation-secret');
    await providerPage.modalPriorityInput.fill('7');
    await providerPage.modalReqPerSecondInput.fill('3');
    await providerPage.modalReqPerMonthInput.fill('900');
    await providerPage.submitCreate();

    // Request POST terkirim dengan body sesuai form
    await expect.poll(() => postBodies.length).toBeGreaterThan(0);
    expect(postBodies[0].name).toBe('QA Automation Provider');
    expect(postBodies[0].platform).toBe('tiktok');

    await providerPage.expectToast('Provider "QA Automation Provider" was added successfully.', true);
    await providerPage.expectModalOpen(false);
  });

  test('gagal dari server saat simpan: modal tetap terbuka tanpa toast sukses', async ({ providerPage }) => {
    const page = providerPage.page;
    await mockProviderList(page);
    await mockCreateProvider(page, { succeed: false });
    await providerPage.goto();

    await providerPage.openCreateModal();
    await providerPage.modalNameInput.fill('Gagal Simpan Provider');
    await providerPage.choosePlatform('Instagram');
    await providerPage.modalSecretInput.fill('secret-gagal');
    await providerPage.modalPriorityInput.fill('5');
    await providerPage.modalReqPerSecondInput.fill('1');
    await providerPage.modalReqPerMonthInput.fill('100');
    await providerPage.submitCreate();

    await providerPage.expectModalOpen(true);
    await providerPage.expectToast('Provider "Gagal Simpan Provider" was added successfully.', false);
  });

  test('toggle enable/disable mengirim PATCH ke BE dan mengubah state baris', async ({ providerPage }) => {
    const page = providerPage.page;
    // items default MOCK_PROVIDER_ITEMS dibagi antara mock list & toggle —
    // refetch setelah PATCH mengembalikan state baru seperti API asli.
    await mockToggleProvider(page);
    await mockProviderList(page);
    await providerPage.goto();

    const patches: string[] = [];
    page.on('request', (req) => {
      if (req.method() === 'PATCH' && req.url().includes('/v1/scrape/credential/')) patches.push(req.url());
    });

    const tiktokToggle = providerPage.toggleOf('TikTok Live - Primary');
    await expect(tiktokToggle).toHaveAttribute('aria-checked', 'false');

    await tiktokToggle.click();

    // TikTok disabled → PATCH /enable; switch berubah jadi enabled
    await expect.poll(() => patches.length).toBeGreaterThan(0);
    expect(patches[patches.length - 1]).toContain('/prv-002/enable');
    await expect(tiktokToggle).toHaveAttribute('aria-checked', 'true');
  });

  // ── Eksplorasi live 2026-09: secret tidak bocor di modal Edit ─────────

  test('modal Edit provider terisi data baris & secret tidak bocor (live, keamanan)', async ({ providerPage }) => {
    await mockProviderList(providerPage.page);
    await providerPage.goto();

    const editBtn = providerPage.page
      .locator('button[aria-label^="Edit provider"], button[title^="Edit provider"]')
      .first();
    await expect(editBtn).toBeVisible();
    await editBtn.click();

    const dialog = providerPage.page.getByRole('dialog', { name: 'Edit provider' });
    await expect(dialog).toBeVisible();

    // Form terisi data baris: name & platform & priority
    await expect(providerPage.page.locator('#name')).not.toHaveValue('');
    await expect(providerPage.page.locator('#priority')).not.toHaveValue('');

    // 🔐 Keamanan: field secret TIDAK berisi secret lama (opsional, kosong)
    const secretLabel = dialog.getByText(/SECRET/i).first();
    await expect(secretLabel).toContainText(/OPTIONAL/i);
    await expect(providerPage.page.locator('#secret')).toHaveValue('');

    await dialog.locator('button[aria-label="Close"]').click();
    await expect(providerPage.page.getByRole('dialog')).toHaveCount(0);
  });
});
