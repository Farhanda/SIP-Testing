import fs from 'fs';
import path from 'path';
import { parse } from 'csv-parse/sync';

const dataDir = path.join(process.cwd(), 'test-data');

function resolvePath(file: string, ext: 'json' | 'csv'): string {
  const withExt = file.endsWith(`.${ext}`) ? file : `${file}.${ext}`;
  return path.isAbsolute(withExt) ? withExt : path.join(dataDir, withExt);
}

/**
 * Load test data dari file JSON di folder test-data/.
 * Contoh: loadJsonData<{ keyword: string }[]>('dashboard-keywords.json')
 */
export function loadJsonData<T = unknown>(file: string): T {
  const content = fs.readFileSync(resolvePath(file, 'json'), 'utf-8');
  return JSON.parse(content) as T;
}

/**
 * Load test data dari file CSV di folder test-data/.
 * Baris pertama CSV = nama kolom.
 */
export function loadCsvData<T = Record<string, string>>(file: string): T[] {
  const content = fs.readFileSync(resolvePath(file, 'csv'), 'utf-8');
  return parse(content, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  }) as T[];
}
