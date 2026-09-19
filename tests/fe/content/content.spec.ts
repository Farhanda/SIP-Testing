import { test, expect } from '../fixtures';
import { Env } from '../../../src/config/env';
import { isDbConfigured, query } from '../../../src/helpers/db';

const GATEWAY_URL = Env.scrapeBaseUrl; // http://10.200.101.13:8080

test.describe('Content — Frontend v2 & Multi-Layer Alignment', () => {
  test.beforeEach(async ({ contentPage }) => {
    await contentPage.goto();
  });

  test('TC-FE-C01: Header, breadcrumb CONTENT INTELLIGENCE, heading, dan subtitle ter-render dengan benar', async ({
    contentPage,
    page,
  }) => {
    // 1. Validasi URL halaman
    await expect(page).toHaveURL(/.*\/content/);

    // 2. Validasi Breadcrumb / Badge
    await expect(contentPage.badge).toBeVisible();
    const badgeText = await contentPage.badge.innerText();
    expect(badgeText).toMatch(/CONTENT INTELLIGENCE/i);

    // 3. Validasi Heading utama dan Subtitle
    await expect(contentPage.heading).toBeVisible();
    await expect(contentPage.subtitle).toBeVisible();

    // 4. Validasi Top Controls (Keyword input, Period dropdown, Platform dropdown)
    await expect(contentPage.keywordInput).toBeVisible();
    await expect(contentPage.periodButton).toBeVisible();
    await expect(contentPage.platformButton).toBeVisible();

    // 5. Validasi Content Filter Bar (Search input, Topic select, Sentiment select, Sort by select)
    await expect(contentPage.searchInput).toBeVisible();
    await expect(contentPage.topicSelect).toBeVisible();
    await expect(contentPage.sentimentSelect).toBeVisible();
    await expect(contentPage.sortBySelect).toBeVisible();
  });

  test('TC-FE-C02: Tabel Top Content menampilkan 8 kolom (#, Content, Author, Topic, Sentiment, Engagement, Views, Aksi) dan selaras dengan API top-posts', async ({
    contentPage,
    page,
  }) => {
    // 1. Ambil data top-posts langsung dari API Backend v2
    const apiRes = await page.request.get(
      `${GATEWAY_URL}/v2/dashboard/top-posts?keyword=MBG&period=1M&sort_by=engagement&page=1&limit=10`,
    );
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();
    const apiPosts = apiBody.data || [];

    // 2. Verifikasi kartu dan tabel Top Content visible
    await expect(contentPage.card).toBeVisible();
    await expect(contentPage.table).toBeVisible();

    // 3. Verifikasi headers tabel
    const headers = await contentPage.tableHeaders.allInnerTexts();
    expect(headers).toContain('#');
    expect(headers).toContain('Content');
    expect(headers).toContain('Author');
    expect(headers).toContain('Topic');
    expect(headers).toContain('Sentiment');
    expect(headers).toContain('Engagement');
    expect(headers).toContain('Views');
    expect(headers).toContain('Aksi');

    // 4. Ambil baris tabel di UI
    const uiPosts = await contentPage.getContentList();
    expect(uiPosts.length).toBeGreaterThan(0);
    expect(uiPosts.length).toBe(Math.min(10, apiPosts.length));

    // 5. Validasi keselarasan baris pertama dengan API
    if (apiPosts.length > 0) {
      expect(uiPosts[0].rank).toBe('1');
      expect(uiPosts[0].hasDetailButton).toBe(true);
      // Snippet content teks di UI mencerminkan content/description API
      const apiSnippet = (apiPosts[0].content || apiPosts[0].description || '').slice(0, 30);
      if (apiSnippet) {
        expect(uiPosts[0].content).toContain(apiSnippet.trim());
      }
    }
  });

  test('TC-FE-C03: Dropdown Sort By (Engagement <-> Views) mengubah urutan postingan di UI dan memicu API top-posts dengan parameter sort_by yang sesuai', async ({
    contentPage,
    page,
  }) => {
    // 1. Ubah Sort By ke 'Sort by: Views'
    const viewsPromise = page.waitForResponse(
      (res) =>
        res.url().includes('/v2/dashboard/top-posts') &&
        (res.url().includes('sort_by=views') || res.url().includes('sort_by=view')),
    );
    await contentPage.selectSortBy('Sort by: Views');
    const viewsRes = await viewsPromise;
    expect(viewsRes.status()).toBe(200);

    const viewsBody = await viewsRes.json();
    const viewsPosts = viewsBody.data || [];
    expect(viewsPosts.length).toBeGreaterThan(0);

    // 2. Kembalikan Sort By ke 'Sort by: Engagement'
    await contentPage.selectSortBy('Sort by: Engagement');
    await expect(contentPage.sortBySelect).toHaveValue('engagement');

    const engPosts = await contentPage.getContentList();
    expect(engPosts.length).toBeGreaterThan(0);
  });

  test('TC-FE-C04: Filter Topic memfilter daftar postingan di UI dan selaras dengan parameter API topic', async ({
    contentPage,
    page,
  }) => {
    // 1. Pilih topik 'Kesehatan'
    const topicPromise = page.waitForResponse(
      (res) =>
        res.url().includes('/v2/dashboard/top-posts') &&
        res.url().includes('topic=Kesehatan'),
    );
    await contentPage.selectTopic('Kesehatan');
    const topicRes = await topicPromise;
    expect(topicRes.status()).toBe(200);

    // 2. Verifikasi postingan terfilter
    const posts = await contentPage.getContentList();
    if (posts.length > 0) {
      for (const p of posts) {
        if (p.topic && p.topic !== '—') {
          expect(p.topic.toLowerCase()).toContain('kesehatan');
        }
      }
    }

    // 3. Reset kembali ke 'All Topics'
    await contentPage.selectTopic('All Topics');
    const resetPosts = await contentPage.getContentList();
    expect(resetPosts.length).toBeGreaterThan(0);
  });

  test('TC-FE-C05: Filter Sentiment (Positive, Neutral, Negative) memfilter konten di UI dan memicu API dengan parameter sentiment yang sesuai', async ({
    contentPage,
    page,
  }) => {
    // 1. Pilih Sentiment 'Positive'
    const positivePromise = page.waitForResponse(
      (res) =>
        res.url().includes('/v2/dashboard/top-posts') &&
        res.url().toLowerCase().includes('sentiment=positive'),
    );
    await contentPage.selectSentiment('Positive');
    const posRes = await positivePromise;
    expect(posRes.status()).toBe(200);

    const posPosts = await contentPage.getContentList();
    if (posPosts.length > 0) {
      for (const p of posPosts) {
        if (p.sentiment && p.sentiment !== '—') {
          expect(p.sentiment.toLowerCase()).toContain('positive');
        }
      }
    }

    // 2. Reset kembali ke 'All Sentiment'
    await contentPage.selectSentiment('All Sentiment');
    const resetPosts = await contentPage.getContentList();
    expect(resetPosts.length).toBeGreaterThan(0);
  });

  test('TC-FE-C06: Search input memfilter konten berdasarkan keyword/hashtag dan memicu API dengan parameter search', async ({
    contentPage,
    page,
  }) => {
    // 1. Ketik kata kunci 'makan' pada search input
    const searchPromise = page.waitForResponse(
      (res) =>
        res.url().includes('/v2/dashboard/top-posts') &&
        res.url().includes('search=makan'),
    );
    await contentPage.searchContent('makan');
    const searchRes = await searchPromise;
    expect(searchRes.status()).toBe(200);

    // 2. Verifikasi hasil pencarian di UI
    const searchPosts = await contentPage.getContentList();
    expect(searchPosts.length).toBeGreaterThan(0);
    for (const p of searchPosts) {
      expect(p.content.toLowerCase()).toContain('makan');
    }

    // 3. Reset pencarian
    await contentPage.searchContent('');
    expect(await contentPage.searchInput.inputValue()).toBe('');
    const resetPosts = await contentPage.getContentList();
    expect(resetPosts.length).toBeGreaterThan(0);
  });

  test('TC-FE-C07: Paginasi tabel (Klik nomor halaman 2) memuat baris berikutnya dan memperbarui label Showing X–Y of Z contents', async ({
    contentPage,
    page,
  }) => {
    // 1. Verifikasi label awal halaman 1
    await expect(contentPage.paginationInfo).toBeVisible();
    const initialText = await contentPage.paginationInfo.innerText();
    expect(initialText).toMatch(/Showing 1–10 of \d+ contents/i);

    // 2. Pindah ke halaman 2
    const page2Promise = page.waitForResponse(
      (res) =>
        res.url().includes('/v2/dashboard/top-posts') &&
        res.url().includes('page=2'),
    );
    await contentPage.goToPage(2);
    const page2Res = await page2Promise;
    expect(page2Res.status()).toBe(200);

    // 3. Verifikasi label paginasi diperbarui ke 11–20
    const page2Text = await contentPage.paginationInfo.innerText();
    expect(page2Text).toMatch(/Showing 11–20 of \d+ contents/i);

    // 4. Kembalikan ke halaman 1
    await contentPage.goToPage(1);
    const resetText = await contentPage.paginationInfo.innerText();
    expect(resetText).toMatch(/Showing 1–10 of \d+ contents/i);
  });

  test('TC-FE-C08: Klik tombol Detail membuka panel Slide-Over Content Details dengan informasi author, platform, tanggal/jam publikasi, konten lengkap, dan performa metrik', async ({
    contentPage,
  }) => {
    // 1. Buka modal detail baris pertama
    await contentPage.openPostDetail(0);

    // 2. Verifikasi modal Content Details terlihat
    await expect(contentPage.detailModal).toBeVisible();

    // 3. Ambil dan validasi data modal
    const data = await contentPage.getPostDetailData();
    expect(data.author.length).toBeGreaterThan(0);
    expect(data.platform.length).toBeGreaterThan(0);
    expect(data.publishedAt.length).toBeGreaterThan(0);
    expect(data.updatedAt).toMatch(/Updated on .+, \d{2}:\d{2}/i);
    expect(data.content.length).toBeGreaterThan(0);
    expect(data.views.length).toBeGreaterThan(0);
    expect(data.engagement.length).toBeGreaterThan(0);
    expect(data.likes.length).toBeGreaterThan(0);
    expect(data.comments.length).toBeGreaterThan(0);
  });

  test('TC-FE-C09: Tombol Close pada modal Content Details menutup panel detail dan mengembalikan tampilan normal tabel', async ({
    contentPage,
  }) => {
    await contentPage.openPostDetail(0);
    await expect(contentPage.detailModal).toBeVisible();

    // Tutup modal
    await contentPage.closePostDetail();
    await expect(contentPage.detailModal).toBeHidden();
  });

  test('TC-FE-C10: Filter Global Periode (1 Month -> 7 Days -> 1 Month) memperbarui tabel Top Content dan total contents yang terdata', async ({
    contentPage,
    page,
  }) => {
    // 1. Catat jumlah postingan awal periode 1M
    const initialPosts = await contentPage.getContentList();
    expect(initialPosts.length).toBeGreaterThan(0);

    // 2. Beralih ke 7 Days
    const res7dPromise = page.waitForResponse(
      (res) =>
        res.url().includes('/v2/dashboard/top-posts') &&
        res.url().includes('period=7D'),
    );
    await contentPage.selectPeriod('7 Days');
    const res7d = await res7dPromise;
    expect(res7d.status()).toBe(200);
    const api7d = await res7d.json();
    const expected7dCount = (api7d.data || []).length;

    const posts7d = await contentPage.getContentList();
    expect(posts7d.length).toBe(expected7dCount);

    // 3. Kembalikan ke 1 Month
    await contentPage.selectPeriod('1 Month');
    await expect(contentPage.periodButton).toContainText(/1 Month/i);

    const posts1m = await contentPage.getContentList();
    expect(posts1m.length).toBe(initialPosts.length);
    expect(posts1m.length).toBeGreaterThan(0);
  });

  test('TC-FE-C11: Navigasi langsung via URL Query Parameters (/content?topic=Kesehatan&sortBy=view) mengaktifkan filter yang sesuai secara otomatis', async ({
    contentPage,
  }) => {
    // Navigasi dengan parameter URL yang valid
    await contentPage.goto('topic=Kesehatan&sortBy=view');

    // Verifikasi select terpilih sesuai parameter URL
    await expect(contentPage.topicSelect).toHaveValue('Kesehatan');
    await expect(contentPage.sortBySelect).toHaveValue('view');

    // Verifikasi baris tabel terisi
    const posts = await contentPage.getContentList();
    expect(posts.length).toBeGreaterThan(0);
    for (const p of posts) {
      if (p.topic && p.topic !== '—') {
        expect(p.topic.toLowerCase()).toContain('kesehatan');
      }
    }
  });

  test('TC-FE-C12: Validasi Silang Database PostgreSQL (sip_db) — Nilai interaksi (likes, comments, views) postingan teratas terbukti matematis identik dengan tabel scraped_contents', async ({
    contentPage,
    page,
  }) => {
    if (!isDbConfigured()) {
      test.skip(true, 'Database PostgreSQL tidak terkonfigurasi di environment');
      return;
    }

    // 1. Ambil respons top-posts API v2 untuk ranking 1 (by engagement)
    const apiRes = await page.request.get(
      `${GATEWAY_URL}/v2/dashboard/top-posts?keyword=MBG&period=1M&sort_by=engagement&page=1&limit=1`,
    );
    expect(apiRes.status()).toBe(200);
    const apiBody = await apiRes.json();
    const apiTopPost = apiBody.data?.[0];
    expect(apiTopPost).toBeDefined();

    // 2. Kueri langsung ke PostgreSQL sip_db untuk postingan tersebut berdasarkan ID
    const dbRows = await query<{
      id: string;
      description: string;
      like_count: string;
      comment_count: string;
      share_count: string;
      view_count: string;
    }>(
      `SELECT 
         sc.id, 
         sc.description, 
         sc.like_count, 
         sc.comment_count, 
         sc.share_count, 
         sc.view_count
       FROM scraped_contents sc
       WHERE sc.id = $1`,
      [apiTopPost.id],
    );

    expect(dbRows.length).toBe(1);
    const dbPost = dbRows[0];

    // 3. Verifikasi keselarasan data mentah DB dengan API
    expect(Number(dbPost.view_count)).toBe(apiTopPost.views);

    // 4. Buka modal postingan teratas di UI dan verifikasi keselarasan likes & comments langsung ke database
    await contentPage.openPostDetail(0);
    const modalData = await contentPage.getPostDetailData();
    const cleanLikes = Number(modalData.likes.replace(/,/g, ''));
    const cleanComments = Number(modalData.comments.replace(/,/g, ''));

    expect(cleanLikes).toBe(Number(dbPost.like_count));
    expect(cleanComments).toBe(Number(dbPost.comment_count));

    await contentPage.closePostDetail();
  });
});

