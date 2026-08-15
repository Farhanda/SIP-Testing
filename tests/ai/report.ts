import fs from 'node:fs';
import path from 'node:path';

/**
 * Helper platform AI — mengubah data BE menjadi laporan (generate hasil).
 *
 * Dua jenis generate yang dicontohkan:
 *  1. Laporan ringkasan INSIGHT dari data live BE (dashboard summary).
 *  2. Laporan ringkasan EKSEKUSI test BE dari `test-results/results-be.json`
 *     (data BE = hasil menjalankan platform BE).
 *
 * Nantinya lapisan "AI" yang sesungguhnya (mis. LLM untuk analisis naratif)
 * tinggal dicolok di sini: data BE sudah dibaca & dibentuk, tinggal
 * diteruskan ke provider AI lalu hasilnya ditulis lewat `writeReport`.
 */

export interface MetricCard {
  value: number;
  label: string;
  delta_pct: number;
  delta_direction: string;
}

export interface DashboardSummaryData {
  data: {
    total_post: MetricCard;
    total_engagement: MetricCard;
    views: MetricCard;
    engagement_rate: MetricCard;
    active_platforms: { active: number; total: number };
  };
  meta: { generated_at: string };
}

/** Format delta persen: "0%", "+1.5%", "-0.3%". */
export function formatDelta(pct: number): string {
  if (pct === 0) return '0%';
  return `${pct > 0 ? '+' : ''}${pct}%`;
}

/** Bangun laporan ringkasan insight dari data dashboard BE. */
export function buildDashboardReport(summary: DashboardSummaryData): string {
  const d = summary.data;
  const metrics: Array<[string, MetricCard]> = [
    ['Total Posts', d.total_post],
    ['Total Engagement', d.total_engagement],
    ['Views', d.views],
    ['Engagement Rate', d.engagement_rate],
  ];

  const lines: string[] = [];
  lines.push('# Laporan Otomatis — Ringkasan Dashboard');
  lines.push('');
  lines.push(`> Sumber data: \`GET /v1/dashboard/summary\` (BE) — generated_at: \`${summary.meta.generated_at}\``);
  lines.push('');
  lines.push('## Ringkasan');
  lines.push('');
  lines.push('| Metrik | Nilai | Delta |');
  lines.push('| --- | --- | --- |');
  for (const [name, card] of metrics) {
    lines.push(`| ${name} | ${card.label} | ${card.delta_direction} (${formatDelta(card.delta_pct)}) |`);
  }
  lines.push(`| Active Platforms | ${d.active_platforms.active}/${d.active_platforms.total} | — |`);
  lines.push('');
  lines.push('## Catatan');
  lines.push('');
  lines.push('- Delta `up`/`down`/`flat` = arah perubahan vs periode sebelumnya.');
  lines.push('- Laporan ini di-generate otomatis oleh platform AI dari data BE.');
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Ringkasan eksekusi test BE (dari test-results/results-be.json)
// ---------------------------------------------------------------------------

export interface ProjectCounts {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
}

export interface BeExecutionSummary {
  total: number;
  passed: number;
  failed: number;
  skipped: number;
  byProject: Record<string, ProjectCounts>;
}

/**
 * Baca report Playwright BE (results-be.json) dan rangkum status eksekusi.
 * Mengembalikan null bila file belum ada / tidak bisa dibaca / kosong.
 */
export function summarizeBeResults(reportPath: string): BeExecutionSummary | null {
  if (!fs.existsSync(reportPath)) return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const report: any = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
    const byProject: Record<string, ProjectCounts> = {};
    let total = 0;
    let passed = 0;
    let failed = 0;
    let skipped = 0;

    const add = (project: string, status: string) => {
      byProject[project] ??= { total: 0, passed: 0, failed: 0, skipped: 0 };
      byProject[project].total++;
      if (status === 'passed') {
        byProject[project].passed++;
        passed++;
      } else if (status === 'skipped') {
        byProject[project].skipped++;
        skipped++;
      } else {
        byProject[project].failed++;
        failed++;
      }
      total++;
    };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const walk = (suite: any) => {
      for (const child of suite.suites || []) walk(child);
      for (const spec of suite.specs || []) {
        for (const t of spec.tests || []) {
          const raw = t.results?.length ? t.results[t.results.length - 1].status : 'skipped';
          add(t.projectName || 'unknown', raw);
        }
      }
    };
    for (const suite of report.suites || []) walk(suite);

    if (total === 0) return null;
    return { total, passed, failed, skipped, byProject };
  } catch {
    return null;
  }
}

/** Bangun laporan ringkasan eksekusi test BE. */
export function buildBeExecutionReport(summary: BeExecutionSummary, source: string): string {
  const lines: string[] = [];
  lines.push('# Laporan Eksekusi Test BE');
  lines.push('');
  lines.push(`> Sumber: \`${source}\` — dibuat ${new Date().toISOString()}`);
  lines.push('');
  lines.push(`- Total: **${summary.total}**`);
  lines.push(`- Passed: **${summary.passed}**`);
  lines.push(`- Failed: **${summary.failed}**`);
  lines.push(`- Skipped: **${summary.skipped}**`);
  lines.push('');
  const projects = Object.keys(summary.byProject);
  if (projects.length > 1) {
    lines.push('## Per project');
    lines.push('');
    lines.push('| Project | Total | Passed | Failed | Skipped |');
    lines.push('| --- | --- | --- | --- | --- |');
    for (const proj of projects) {
      const c = summary.byProject[proj];
      lines.push(`| ${proj} | ${c.total} | ${c.passed} | ${c.failed} | ${c.skipped} |`);
    }
    lines.push('');
  }
  return lines.join('\n') + '\n';
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

/** Timestamp aman untuk nama file: "2026-08-13T02-42-07-183Z". */
export function timestampForFilename(date = new Date()): string {
  return date.toISOString().replace(/[:.]/g, '-');
}

/** Tulis konten laporan ke outputDir; kembalikan path absolut file. */
export function writeReport(outputDir: string, filename: string, content: string): string {
  const filePath = path.join(outputDir, filename);
  fs.mkdirSync(outputDir, { recursive: true });
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
}
