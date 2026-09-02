import { test, expect, intelApiUrl } from '../fixtures';

/**
 * Test Intelligence AI Service — GET /health (BASE_URL_AI_INTELLIGENCE,
 * default :8000). Health TANPA auth (bukan endpoint bisnis).
 *
 * Struktur respons (diverifikasi live 2026-09-02):
 *   { "status": "ok", "calls_today": 540, "circuit_open": true,
 *     "circuit_resets_at": "2026-09-02T07:00:00+00:00" }
 */
test.describe('Intelligence AI Service — GET /health', () => {
  test('→ 200 dengan status ok & medan health lengkap (tanpa token)', async ({ api }) => {
    const res = await api.get(intelApiUrl('/health'));
    expect(res.status()).toBe(200);

    const body = await res.json();
    expect(body.status).toBe('ok');
    expect(typeof body.calls_today).toBe('number');
    expect(typeof body.circuit_open).toBe('boolean');
  });
});