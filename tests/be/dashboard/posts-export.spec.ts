import { test, expect, apiUrl } from '../fixtures';
import ExcelJS from 'exceljs';

/**
 * Test GET /v2/dashboard/posts-export — export data post dashboard ke file Excel (.xlsx) v2.
 *
 * Query Parameters:
 * - keyword: filter berdasarkan keyword
 * - platform: filter platform (misal instagram, tiktok, x)
 * - period: relative token (24h, 7d, 1m) atau custom range (YYYY-MM-DD/YYYY-MM-DD)
 *
 * Kontrak Swagger:
 *   200: file binary (.xlsx)
 *   Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
 *   Content-Disposition: attachment; filename="post-...xlsx"
 */
test.describe('GET /v2/dashboard/posts-export (v2)', () => {
  const period = '2026-09-01/2026-09-07';

  test('TC-V2-EXP-01: request default mengembalikan HTTP 200 dengan Content-Type spreadsheet Excel', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/posts-export'));
    expect(res.status()).toBe(200);

    const contentType = res.headers()['content-type'];
    expect(contentType).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
  });

  test('TC-V2-EXP-02: header Content-Disposition memuat filename lampiran berekstensi .xlsx', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/posts-export'), {
      params: { period },
    });
    expect(res.status()).toBe(200);

    const contentDisposition = res.headers()['content-disposition'];
    expect(contentDisposition).toBeDefined();
    expect(contentDisposition).toContain('attachment');
    expect(contentDisposition).toMatch(/filename=".*\.xlsx"/);
  });

  test('TC-V2-EXP-03: validasi file Excel dapat di-parse dan memiliki worksheet "Data Post"', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/posts-export'), {
      params: { period },
    });
    expect(res.status()).toBe(200);

    const bodyBuffer = await res.body();
    expect(bodyBuffer.length).toBeGreaterThan(1000);

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bodyBuffer as any);

    expect(workbook.worksheets.length).toBeGreaterThanOrEqual(1);
    const sheet = workbook.getWorksheet('Data Post');
    expect(sheet).toBeDefined();
    expect(sheet!.rowCount).toBeGreaterThan(1);
  });

  test('TC-V2-EXP-04: validasi struktur 11 kolom header pada baris pertama file Excel', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/posts-export'), {
      params: { period },
    });
    const bodyBuffer = await res.body();

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bodyBuffer as any);
    const sheet = workbook.getWorksheet('Data Post')!;

    const headerRow = sheet.getRow(1);
    const expectedHeaders = [
      'No',
      'Tanggal Publish',
      'Akun',
      'Platform',
      'Post',
      'Topik',
      'Sentimen',
      'Emosi',
      'Engagement',
      'Views',
      'Source URL',
    ];

    // Cek bahwa seluruh nama kolom standar ada pada baris pertama
    const actualValues = (headerRow.values as string[]).filter(Boolean);
    for (const expected of expectedHeaders) {
      expect(actualValues).toContain(expected);
    }
  });

  test('TC-V2-EXP-05: filter platform=tiktok menghasilkan baris post dengan platform TikTok', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/posts-export'), {
      params: { platform: 'tiktok', period },
    });
    expect(res.status()).toBe(200);

    const bodyBuffer = await res.body();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bodyBuffer as any);
    const sheet = workbook.getWorksheet('Data Post')!;

    // Baris 1 adalah header, baris 2 dst adalah data
    expect(sheet.rowCount).toBeGreaterThan(1);

    // Ambil index kolom Platform (kolom ke-4)
    for (let rowIdx = 2; rowIdx <= Math.min(sheet.rowCount, 10); rowIdx++) {
      const row = sheet.getRow(rowIdx);
      const platformVal = row.getCell(4).value;
      expect(platformVal).toBe('TikTok');
    }
  });

  test('TC-V2-EXP-06: filter platform=x menghasilkan baris post dengan platform Twitter/X', async ({ api }) => {
    const res = await api.get(apiUrl('/v2/dashboard/posts-export'), {
      params: { platform: 'x', period },
    });
    expect(res.status()).toBe(200);

    const bodyBuffer = await res.body();
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(bodyBuffer as any);
    const sheet = workbook.getWorksheet('Data Post')!;

    expect(sheet.rowCount).toBeGreaterThan(1);
    for (let rowIdx = 2; rowIdx <= Math.min(sheet.rowCount, 10); rowIdx++) {
      const row = sheet.getRow(rowIdx);
      const platformVal = row.getCell(4).value;
      expect(platformVal).toBe('Twitter/X');
    }
  });
});
