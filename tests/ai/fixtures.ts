import { test as base, expect, APIRequestContext, APIResponse } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { Env } from '../../src/config/env';

/**
 * Custom fixtures platform AI — menguji AI Service (SIP AI Service) dan
 * membaca data BE untuk generate hasil.
 *
 * - `api`       : APIRequestContext (baseURL = BASE_URL_BE). Untuk request
 *                 ke AI Service pakai helper `aiApiUrl` + header token
 *                 (`aiHeaders` / `aiAuth`).
 * - `outputDir` : folder tujuan hasil generate (`test-results/ai/`),
 *                 dibuat otomatis sebelum test berjalan.
 *
 * Cara pakai di spec:
 *   import { test, expect, beApiUrl, aiApiUrl, aiAuth, AI_OUTPUT_DIR } from './fixtures';
 *   test('...', async ({ api, outputDir }) => {
 *     const res = await api.get(beApiUrl('/v1/dashboard/summary'));
 *     const ai = await api.get(aiApiUrl('/v1/health'), aiAuth());
 *     ...
 *   });
 *
 * ⚠️ File ini sengaja TIDAK berakhiran .spec.ts supaya tidak ter-collect
 *    sebagai test file oleh testMatch di playwright.ai.config.ts.
 */

/** Folder hasil generate platform AI (gitignored via test-results/). */
export const AI_OUTPUT_DIR = path.join(process.cwd(), 'test-results', 'ai');

export const test = base.extend<{
  api: APIRequestContext;
  outputDir: string;
}>({
  api: async ({ request }, use) => use(request),
  outputDir: async ({}, use) => {
    fs.mkdirSync(AI_OUTPUT_DIR, { recursive: true });
    await use(AI_OUTPUT_DIR);
  },
});

/** Bangun URL absolut API backend: `${BASE_URL_BE}${path}` */
export function beApiUrl(apiPath: string): string {
  return `${Env.beBaseUrl}${apiPath}`;
}

/** Bangun URL absolut AI Service: `${BASE_URL_AI}${path}` */
export function aiApiUrl(apiPath: string): string {
  return `${Env.aiBaseUrl}${apiPath}`;
}

/** Bangun URL absolut Intelligence AI Service: `${BASE_URL_AI_INTELLIGENCE}${path}` */
export function intelApiUrl(apiPath: string): string {
  return `${Env.aiIntelligenceBaseUrl}${apiPath}`;
}

/**
 * Header auth Intelligence AI Service: `X-AI-Service-Token: <token>`
 * (BEDA dari SIP AI Service yang memakai X-Service-Token — lihat aiAuth).
 */
export function intelHeaders(): Record<string, string> {
  return { 'X-AI-Service-Token': Env.aiIntelligenceToken };
}

/** Opsi request siap pakai ke Intelligence AI Service (token + optional body). */
export function intelAuth(data?: unknown): { headers: Record<string, string>; data?: unknown } {
  const opts: { headers: Record<string, string>; data?: unknown } = {
    headers: intelHeaders(),
  };
  if (data !== undefined) {
    opts.data = data;
  }
  return opts;
}

/** Header auth untuk AI Service: `X-Service-Token: <token>` */
export function aiHeaders(): Record<string, string> {
  return { 'X-Service-Token': Env.aiServiceToken };
}

/**
 * Opsi request siap pakai ke AI Service: header token + JSON content type
 * (untuk endpoint yang menerima body).
 */
export function aiAuth(data?: unknown): { headers: Record<string, string>; data?: unknown } {
  const opts: { headers: Record<string, string>; data?: unknown } = {
    headers: aiHeaders(),
  };
  if (data !== undefined) {
    opts.data = data;
  }
  return opts;
}

/** Identitas unik per run (aman untuk test paralel & run ulang). */
export function uniqueKey(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export { expect };
