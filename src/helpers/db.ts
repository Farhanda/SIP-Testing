import { Pool, PoolConfig } from 'pg';
import { Env } from '../config/env';

let pool: Pool | null = null;

/**
 * Cek apakah kredensial database sudah dikonfigurasi di environment (.env).
 */
export function isDbConfigured(): boolean {
  return Boolean(Env.dbUser && Env.dbPassword);
}

/**
 * Ambil instance connection pool PostgreSQL (singleton).
 * Fallback otomatis ke port 5435 & database sip_db jika default 5432/dashboard_service tidak aktif.
 */
export function getDbPool(): Pool {
  if (!pool) {
    const port = Env.dbPort === 5432 ? 5435 : Env.dbPort;
    const database = (!Env.dbName || Env.dbName === 'dashboard_service') ? 'sip_db' : Env.dbName;

    const config: PoolConfig = {
      host: Env.dbHost || '10.200.101.13',
      port: port,
      database: database,
      user: Env.dbUser,
      password: Env.dbPassword,
      ssl: Env.dbSsl ? { rejectUnauthorized: false } : false,
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
    };
    pool = new Pool(config);
  }
  return pool;
}

/**
 * Eksekusi query SQL langsung ke database PostgreSQL.
 */
export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const p = getDbPool();
  const res = await p.query(text, params);
  return res.rows as T[];
}

/**
 * Tutup koneksi pool saat seluruh test selesai.
 */
export async function closeDbPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper Queries untuk Tabel `scraped_contents` (Database sip_db)
// ─────────────────────────────────────────────────────────────────────────────

export interface DbSummaryMetrics {
  total_posts: number;
  total_engagement: number;
  total_views: number;
}

export interface DbDailyTrendPoint {
  day: string;
  count: number;
}

export interface DbTopPost {
  id: string;
  account: string;
  provider: string;
  views: number;
  engagement: number;
  description: string;
}

/**
 * Hitung agregasi volume (total posts, engagement, views) dalam rentang UTC.
 */
export async function getDbSummaryMetrics(startUtc: string, endUtc: string): Promise<DbSummaryMetrics> {
  const rows = await query<{ total_posts: string; total_engagement: string; total_views: string }>(
    `SELECT 
       COUNT(*) AS total_posts,
       SUM(COALESCE(like_count,0)+COALESCE(comment_count,0)+COALESCE(share_count,0)+COALESCE(save_count,0)+COALESCE(repost_count,0)) AS total_engagement,
       SUM(COALESCE(view_count,0)) AS total_views
     FROM scraped_contents
     WHERE published_at >= $1 AND published_at <= $2`,
    [startUtc, endUtc]
  );
  const r = rows[0];
  return {
    total_posts: parseInt(r?.total_posts ?? '0', 10),
    total_engagement: parseInt(r?.total_engagement ?? '0', 10),
    total_views: parseInt(r?.total_views ?? '0', 10),
  };
}

/**
 * Hitung metrik per platform tertentu dalam rentang UTC.
 */
export async function getDbPlatformMetrics(platformPattern: string, startUtc: string, endUtc: string): Promise<DbSummaryMetrics> {
  const rows = await query<{ total_posts: string; total_engagement: string; total_views: string }>(
    `SELECT 
       COUNT(*) AS total_posts,
       SUM(COALESCE(like_count,0)+COALESCE(comment_count,0)+COALESCE(share_count,0)+COALESCE(save_count,0)+COALESCE(repost_count,0)) AS total_engagement,
       SUM(COALESCE(view_count,0)) AS total_views
     FROM scraped_contents
     WHERE LOWER(provider) LIKE $1 AND published_at >= $2 AND published_at <= $3`,
    [platformPattern, startUtc, endUtc]
  );
  const r = rows[0];
  return {
    total_posts: parseInt(r?.total_posts ?? '0', 10),
    total_engagement: parseInt(r?.total_engagement ?? '0', 10),
    total_views: parseInt(r?.total_views ?? '0', 10),
  };
}

/**
 * Ambil tren harian percakapan (group by YYYY-MM-DD UTC) dalam rentang tanggal.
 */
export async function getDbDailyTrend(startUtc: string, endUtc: string): Promise<Record<string, number>> {
  const rows = await query<{ day: string; count: string }>(
    `SELECT 
       TO_CHAR(published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
       COUNT(*) AS count
     FROM scraped_contents
     WHERE published_at >= $1 AND published_at <= $2
     GROUP BY day ORDER BY day`,
    [startUtc, endUtc]
  );
  const result: Record<string, number> = {};
  for (const r of rows) {
    result[r.day] = parseInt(r.count, 10);
  }
  return result;
}

/**
 * Ambil top posts teratas terurut berdasarkan engagement dalam rentang tanggal.
 */
export async function getDbTopPostsByEngagement(limit: number, startUtc: string, endUtc: string): Promise<DbTopPost[]> {
  const rows = await query<any>(
    `SELECT id, account, provider,
            view_count,
            (COALESCE(like_count,0)+COALESCE(comment_count,0)+COALESCE(share_count,0)+COALESCE(save_count,0)+COALESCE(repost_count,0)) AS engagement,
            description
     FROM scraped_contents
     WHERE published_at >= $1 AND published_at <= $2
     ORDER BY engagement DESC
     LIMIT $3`,
    [startUtc, endUtc, limit]
  );
  return rows.map((r) => ({
    id: r.id,
    account: r.account,
    provider: r.provider,
    views: Number(r.view_count || 0),
    engagement: Number(r.engagement || 0),
    description: r.description || '',
  }));
}

/**
 * Ambil top posts teratas terurut berdasarkan views dalam rentang tanggal.
 */
export async function getDbTopPostsByViews(limit: number, startUtc: string, endUtc: string): Promise<DbTopPost[]> {
  const rows = await query<any>(
    `SELECT id, account, provider,
            view_count,
            (COALESCE(like_count,0)+COALESCE(comment_count,0)+COALESCE(share_count,0)+COALESCE(save_count,0)+COALESCE(repost_count,0)) AS engagement,
            description
     FROM scraped_contents
     WHERE published_at >= $1 AND published_at <= $2
     ORDER BY view_count DESC
     LIMIT $3`,
    [startUtc, endUtc, limit]
  );
  return rows.map((r) => ({
    id: r.id,
    account: r.account,
    provider: r.provider,
    views: Number(r.view_count || 0),
    engagement: Number(r.engagement || 0),
    description: r.description || '',
  }));
}

/**
 * Ambil jumlah post yang telah dianalisis oleh AI (emotion/sentiment) dari database.
 */
export async function getDbAiAnalyzedCount(): Promise<number> {
  const rows = await query<{ count: string }>(
    `SELECT COUNT(*) AS count 
     FROM scraped_contents 
     WHERE emotion IS NOT NULL OR sentiment IS NOT NULL`
  );
  return parseInt(rows[0]?.count ?? '0', 10);
}

/**
 * Ambil sampel post asli dari database berdasarkan ID untuk verifikasi field detail.
 */
export async function getDbPostById(id: string): Promise<DbTopPost | null> {
  const rows = await query<any>(`SELECT * FROM scraped_contents WHERE id = $1 LIMIT 1`, [id]);
  if (rows.length === 0) return null;

  const row = rows[0];
  const engagement =
    Number(row.like_count || 0) +
    Number(row.comment_count || 0) +
    Number(row.share_count || 0) +
    Number(row.save_count || 0) +
    Number(row.repost_count || 0);

  return {
    id: row.id,
    account: row.account,
    provider: row.provider,
    views: Number(row.view_count || 0),
    engagement: engagement,
    description: row.description || '',
  };
}

/**
 * Ambil tren harian per platform tertentu dalam rentang UTC.
 */
export async function getDbPlatformDailyTrend(
  platformPattern: string,
  startUtc: string,
  endUtc: string
): Promise<Record<string, number>> {
  const rows = await query<{ day: string; count: string }>(
    `SELECT 
       TO_CHAR(published_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day,
       COUNT(*) AS count
     FROM scraped_contents
     WHERE LOWER(provider) LIKE $1 AND published_at >= $2 AND published_at <= $3
     GROUP BY day ORDER BY day`,
    [platformPattern, startUtc, endUtc]
  );
  const result: Record<string, number> = {};
  for (const r of rows) {
    result[r.day] = parseInt(r.count, 10);
  }
  return result;
}

export interface DbTopAccount {
  account: string;
  posts: number;
  engagement: number;
  views: number;
}

/**
 * Ambil top accounts teratas dari database berdasarkan platform dan pengurutan tertentu.
 */
export async function getDbTopAccounts(
  platformPattern: string,
  sortBy: 'posts' | 'engagement' | 'views',
  limit: number,
  startUtc: string,
  endUtc: string
): Promise<DbTopAccount[]> {
  const orderClause =
    sortBy === 'engagement'
      ? 'engagement DESC, posts DESC'
      : sortBy === 'views'
      ? 'views DESC, posts DESC'
      : 'posts DESC, engagement DESC';

  const rows = await query<any>(
    `SELECT 
       account,
       COUNT(*) AS posts,
       SUM(COALESCE(like_count,0)+COALESCE(comment_count,0)+COALESCE(share_count,0)+COALESCE(save_count,0)+COALESCE(repost_count,0)) AS engagement,
       SUM(COALESCE(view_count,0)) AS views
     FROM scraped_contents
     WHERE LOWER(provider) LIKE $1 AND published_at >= $2 AND published_at <= $3
     GROUP BY account
     ORDER BY ${orderClause}
     LIMIT $4`,
    [platformPattern, startUtc, endUtc, limit]
  );
  return rows.map((r) => ({
    account: r.account,
    posts: parseInt(r.posts, 10),
    engagement: parseInt(r.engagement, 10),
    views: parseInt(r.views, 10),
  }));
}

/**
 * Cari post berdasarkan keyword pada deskripsi/judul dari database.
 */
export async function getDbSearchPosts(
  keyword: string,
  limit: number,
  startUtc: string,
  endUtc: string
): Promise<DbTopPost[]> {
  const pattern = `%${keyword}%`;
  const rows = await query<any>(
    `SELECT id, account, provider, view_count,
            (COALESCE(like_count,0)+COALESCE(comment_count,0)+COALESCE(share_count,0)+COALESCE(save_count,0)+COALESCE(repost_count,0)) AS engagement,
            description
     FROM scraped_contents
     WHERE (description ILIKE $1 OR title ILIKE $1)
       AND published_at >= $2 AND published_at <= $3
     ORDER BY engagement DESC
     LIMIT $4`,
    [pattern, startUtc, endUtc, limit]
  );
  return rows.map((r) => ({
    id: r.id,
    account: r.account,
    provider: r.provider,
    views: Number(r.view_count || 0),
    engagement: Number(r.engagement || 0),
    description: r.description || '',
  }));
}

/**
 * Ambil top posts untuk platform tertentu terurut berdasarkan engagement.
 */
export async function getDbTopPostsByPlatform(
  platformPattern: string,
  limit: number,
  startUtc: string,
  endUtc: string
): Promise<DbTopPost[]> {
  const rows = await query<any>(
    `SELECT id, account, provider, view_count,
            (COALESCE(like_count,0)+COALESCE(comment_count,0)+COALESCE(share_count,0)+COALESCE(save_count,0)+COALESCE(repost_count,0)) AS engagement,
            description
     FROM scraped_contents
     WHERE LOWER(provider) LIKE $1
       AND published_at >= $2 AND published_at <= $3
     ORDER BY engagement DESC
     LIMIT $4`,
    [platformPattern, startUtc, endUtc, limit]
  );
  return rows.map((r) => ({
    id: r.id,
    account: r.account,
    provider: r.provider,
    views: Number(r.view_count || 0),
    engagement: Number(r.engagement || 0),
    description: r.description || '',
  }));
}

