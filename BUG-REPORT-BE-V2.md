# Laporan Temuan Pengujian & Bug: Backend Dashboard Service v2

- **Target Service**: Dashboard Service API (`http://10.200.101.13:8091`)
- **Dokumentasi API**: [Swagger UI v2](http://10.200.101.13:8091/swagger/index.html) (`/swagger/doc.json`)
- **Tanggal Pengujian**: 17 September 2026
- **Lingkup Pengujian**: Seluruh endpoint `GET /v2/dashboard/*` (Summary, Conversation Trend, Sentiment, Protocol Status, Top Accounts, Top Posts, Top Topics)
- **Metode Pengujian**: Automation Testing (Playwright APIRequestContext), Boundary Testing, SQL/Payload Injection Probing, Fuzzing, dan Cross-Endpoint Consistency Verification.

---

## 1. Ringkasan Temuan

| ID | Severity | Judul Temuan | Endpoint Terdampak | Dampak |
|---|:---:|---|---|---|
| **BUG-BE-01** | **HIGH** | Server Crash `HTTP 500` saat parameter query memuat Null Byte (`%00`) | Hampir seluruh endpoint v2 (`search`, `keyword`, `platform`, `topic`) | Unhandled database error, berpotensi denial of service / crash log spam. |
| **BUG-BE-02** | **MEDIUM** | SQL Wildcard Injection pada fitur `search` (Karakter `%` dan `_` tidak di-escape) | `GET /v2/dashboard/top-posts?search=...` | Logika pencarian bocor, `%` mengembalikan seluruh 100% database post. |
| **BUG-BE-03** | **MEDIUM** | Parameter `limit` tidak memiliki batas atas (*Unbounded Limit*) | `GET /v2/dashboard/top-posts`<br>`GET /v2/dashboard/top-accounts` | Risiko kehabisan memori server (*Out of Memory* / DoS) jika client meminta limit jutaan. |
| **BUG-BE-04** | **LOW** | Method HTTP non-GET merespons `404 Not Found` bukan `405 Method Not Allowed` | Seluruh endpoint `GET /v2/dashboard/*` | Tidak memenuhi standar kepatuhan RFC 9110 (RESTful specification). |

---

## 2. Rincian Temuan Bug & Rekomendasi

### BUG-BE-01: [HIGH] Server Crash `HTTP 500` saat Query Mengandung Null Byte (`%00`)

#### Deskripsi
Ketika request HTTP memuat karakter *null byte* (`%00` atau byte `0x00`) pada query parameter (misalnya `search`, `keyword`, `platform`, atau `topic`), server backend mengalami kegagalan internal (*unhandled error*) dan mengembalikan status **`HTTP 500 Internal Server Error`**.

#### Endpoint & Contoh Request Terdampak
```http
GET /v2/dashboard/top-posts?search=%00 HTTP/1.1
Host: 10.200.101.13:8091

GET /v2/dashboard/top-posts?keyword=%00 HTTP/1.1
Host: 10.200.101.13:8091

GET /v2/dashboard/top-posts?topic=%00 HTTP/1.1
Host: 10.200.101.13:8091

GET /v2/dashboard/top-posts?platform=%00 HTTP/1.1
Host: 10.200.101.13:8091

GET /v2/dashboard/top-accounts?keyword=%00 HTTP/1.1
Host: 10.200.101.13:8091

GET /v2/dashboard/summary?keyword=%00 HTTP/1.1
Host: 10.200.101.13:8091

GET /v2/dashboard/sentiment?keyword=%00 HTTP/1.1
Host: 10.200.101.13:8091

GET /v2/dashboard/protocol-status?keyword=%00 HTTP/1.1
Host: 10.200.101.13:8091

GET /v2/dashboard/conversation-trend?keyword=%00 HTTP/1.1
Host: 10.200.101.13:8091
```

#### Respons Aktual
```http
HTTP/1.1 500 Internal Server Error
Content-Type: application/json

{
  "error": {
    "code": "internal_error",
    "message": "internal server error"
  }
}
```

#### Analisis Teknis (Root Cause)
Tipe data teks di PostgreSQL (`TEXT` / `VARCHAR`) tidak mengizinkan byte `0x00` di dalam encoding UTF-8 (`ERROR: invalid byte sequence for encoding "UTF8": 0x00` atau `null character cannot be in string`). Parameter query dari HTTP diteruskan langsung ke driver database (`pq` atau `pgx`) tanpa sanitasi string. Driver database melempar error yang tidak ditangani sebagai validasi input, sehingga runtime Go menganggapnya sebagai error sistem fatal dan menghasilkan HTTP 500.

Sebagai perbandingan: `GET /v2/dashboard/top-topics?search=%00` merespons **`HTTP 200`** secara aman karena filter pencarian di endpoint tersebut dieksekusi di memori Go (`strings.Contains`), bukan di query PostgreSQL.

#### Rekomendasi Solusi
1. Lakukan sanitasi awal di layer middleware HTTP handler:
   ```go
   // Bersihkan karakter null byte dari semua parameter query
   cleanQuery := strings.ReplaceAll(rawQuery, "\x00", "")
   ```
2. Atau lakukan validasi: jika string input mengandung `\x00`, kembalikan respons validasi yang semantik: **`HTTP 400 Bad Request`** (`{"error": {"code": "validation_failed", "message": "query contains invalid null characters"}}`).

---

### BUG-BE-02: [MEDIUM] SQL Wildcard Injection pada Pencarian `top-posts` (`%` dan `_` Tidak Di-Escape)

#### Deskripsi
Pada endpoint `GET /v2/dashboard/top-posts`, parameter `search` digunakan untuk memfilter konten teks post. Namun, karakter wildcard SQL seperti `%` (*match zero or more characters*) dan `_` (*match any single character*) tidak di-escape saat menyusun query SQL `LIKE` / `ILIKE`. Akibatnya, karakter tersebut dievaluasi sebagai operator wildcard SQL, bukan sebagai karakter harfiah (*literal character*).

#### Bukti Pengujian
1. **Pencarian `%`**:
   - Request: `GET /v2/dashboard/top-posts?search=%`
   - Respons Aktual: `meta.total: 6793` (mengembalikan **seluruh 100% data** post di database).
   - Ekspektasi: Hanya mengembalikan post yang secara harfiah memuat simbol persen (misal: `"diskon 50%"` atau `"bunga 10%"`).
2. **Pencarian `_`**:
   - Request: `GET /v2/dashboard/top-posts?search=_`
   - Respons Aktual: `meta.total: 6776` (hampir semua post cocok karena `_` mencocokkan karakter apa pun).
   - Ekspektasi: Hanya mengembalikan post yang memuat karakter garis bawah (*underscore*), misalnya username atau hashtag `metro_tv`.
3. **Pencarian Pola Wildcard `a%b`**:
   - Request: `GET /v2/dashboard/top-posts?search=a%b`
   - Respons Aktual: `meta.total: 5836` (mencocokkan post apa pun yang memiliki huruf 'a' dan kemudian huruf 'b' di posisi mana pun).

#### Analisis Teknis (Root Cause)
Di dalam query SQL, kemungkinan query ditulis seperti ini:
```sql
-- Tidak aman terhadap wildcard:
WHERE post ILIKE '%' || $1 || '%'
```
Jika parameter `$1` bernilai `"%"`, ekspresi menjadi `ILIKE '%%%'`, yang akan mencocokkan semua baris data tanpa terkecuali.

#### Rekomendasi Solusi
Lakukan *escape* karakter khusus `LIKE` (`\`, `%`, `_`) pada string `search` sebelum digabungkan ke query SQL:
```go
func escapeLikePattern(s string) string {
    s = strings.ReplaceAll(s, "\\", "\\\\")
    s = strings.ReplaceAll(s, "%", "\\%")
    s = strings.ReplaceAll(s, "_", "\\_")
    return s
}
```
Dan pastikan di query SQL menggunakan klausa escape standar:
```sql
WHERE post ILIKE '%' || $1 || '%' ESCAPE '\'
```

---

### BUG-BE-03: [MEDIUM] Parameter `limit` Tidak Memiliki Batas Maksimum (*Unbounded Limit*)

#### Deskripsi
Endpoint `top-posts` dan `top-accounts` mengizinkan client meminta jumlah data yang tidak terbatas melalui parameter `limit`. Server tidak membatasi batas atas (*maximum limit clamp*), sehingga client dapat meminta ribuan data sekaligus dalam satu request.

#### Bukti Pengujian
- Request: `GET /v2/dashboard/top-posts?limit=10000`
  - Respons: Server mengembalikan seluruh **6.793 post** dalam satu payload JSON HTTP berukuran megabyte.
- Request: `GET /v2/dashboard/top-accounts?limit=10000`
  - Respons: Server mengembalikan seluruh **4.836 akun** sekaligus.

#### Analisis Dampak & Risiko
1. **Risiko Denial of Service (DoS) / Out of Memory (OOM)**: Satu request jahat atau loop error dari frontend dengan `limit=1000000` akan memaksa database melakukan *full scan*, mengalokasikan ratusan megabyte memori untuk serialisasi JSON di Go runtime, dan membebani throughput jaringan.
2. **Degradasi Performa**: Mengakibatkan latensi API melonjak drastis untuk pengguna lain saat query besar ini sedang dieksekusi.

#### Rekomendasi Solusi
Terapkan *clamping* batas atas yang wajar di handler, misalnya:
```go
const MaxLimit = 100 // atau batas wajar sesuai UI
if limit > MaxLimit {
    limit = MaxLimit
}
```

---

### BUG-BE-04: [LOW] Method HTTP non-GET Mengembalikan `404 Not Found`

#### Deskripsi
Seluruh endpoint v2 yang hanya mendukung method `GET` (seperti `/v2/dashboard/summary`) merespons dengan **`404 page not found`** saat dipanggil dengan method lain (`POST`, `PUT`, `DELETE`, `PATCH`).

#### Bukti Pengujian
```http
POST /v2/dashboard/summary HTTP/1.1 -> 404 page not found
PUT /v2/dashboard/summary HTTP/1.1  -> 404 page not found
```

#### Rekomendasi Solusi
Sesuai standar spesifikasi HTTP (RFC 9110 Section 15.5.6):
- Jika rute URL terdaftar namun method HTTP yang dikirim tidak didukung, server seharusnya merespons **`HTTP 405 Method Not Allowed`** dan menyertakan header `Allow: GET`.

---

## 3. Catatan Aspek yang Sudah Berfungsi Sangat Baik

Di luar temuan di atas, arsitektur data pada Backend Dashboard Service v2 menunjukkan kualitas yang sangat baik pada aspek-aspek berikut:

1. **Integritas Data Lintas Endpoint Sangat Konsisten**:
   - `summary.total_conversation` (6.793) = `sentiment.total` (6.793) = `protocol-status.overall.total` (6.793) = `top-posts.meta.total` (6.793) = akumulasi titik pada `conversation-trend` (6.793).
   - Pada filter periode `period=24h`, seluruh 5 endpoint di atas juga sinkron persis di angka **770 percakapan**.
2. **Kebal terhadap SQL Injection Klasik**:
   - Payload SQL injection seperti `' OR 1=1 --`, `UNION SELECT NULL--`, `"; DROP TABLE...` tertangani dengan aman karena query telah menggunakan *parameterized queries* / *prepared statements*.
3. **Paginasi di Luar Batas Di-clamp dengan Benar**:
   - Pengiriman `page=999999999` otomatis di-clamp ke halaman maksimum (`total_pages: 1359`) dan mengembalikan sisa data terakhir secara rapi tanpa error.
4. **Fallback Rentang Tanggal Terbalik / Salah Format**:
   - Pengiriman rentang tanggal terbalik (`period=2026-09-07/2026-09-01`) atau format tidak dikenal secara cerdas jatuh ke fallback default 1 bulan tanpa memicu error 500.
5. **Dukungan Ejaan Sentimen Bahasa Indonesia**:
   - Parameter `sentiment=positif`, `sentiment=netral`, dan `sentiment=negatif` berhasil dikenali dan di-mapping dengan benar sesuai dokumentasi Swagger.
