# Laporan Temuan Pengujian & Bug: Backend Dashboard Service v2

- **Target Service**: Dashboard Service API (`http://10.200.101.13:8092`)
- **Dokumentasi API**: [Swagger UI v2](http://10.200.101.13:8092/swagger/index.html) (`/swagger/doc.json`)
- **Tanggal Pengujian**: 18 September 2026
- **Lingkup Pengujian**: Seluruh 9 endpoint `GET /v2/dashboard/*` (Summary, Conversation Trend, Sentiment, Protocol Status, Top Accounts, Top Posts, Top Topics, Latest Keywords, Posts Export)
- **Metode Pengujian**: Automation Testing (Playwright APIRequestContext), Boundary Testing, SQL/Payload Injection Probing, Fuzzing, Memory/Size Probing, dan Cross-Endpoint Database Verification.

---

## 1. Ringkasan Status Bug (Verifikasi Port 8092)

| ID | Severity | Judul Temuan | Status di Port 8092 | Dampak |
|---|:---:|---|:---:|---|
| **BUG-BE-01** | **HIGH** | Server Crash `HTTP 500` saat Query Memuat Null Byte (`%00`) | **TERBUKTI PADA ENDPOINT BARU**<br>• Fixed di 7 endpoint lama (HTTP 400)<br>• **CRASH di `latest-keywords` & `posts-export`** | Unhandled exception di Go/Database driver, memicu HTTP 500 internal error. |
| **BUG-BE-02** | **HIGH** | Uncontrolled Excel Generation / Risiko DoS pada `posts-export` | **BARU DITEMUKAN** | `period` invalid tidak di-reject HTTP 400, melainkan men-generate file Excel 2.2 MB di RAM. |
| **BUG-BE-03** | **MEDIUM** | SQL Wildcard Injection pada Query `search` dan `status` (`%` dan `_` tidak di-escape) | **MASIH TERJADI** | Karakter `%` membocorkan seluruh data database tanpa filtering. |
| **BUG-BE-04** | **MEDIUM** | Logika Rentang Tanggal Terbalik (*Reversed Date*) Diam-diam Jatuh ke Fallback 32 Hari | **MASIH TERJADI** | `period=2026-09-07/2026-09-01` tidak melempar 400, melainkan memberi data 32 hari. |
| **BUG-BE-05** | **LOW** | Method HTTP non-GET merespons `404 Not Found` bukan `405 Method Not Allowed` | **MASIH TERJADI** | Tidak memenuhi standar kepatuhan RFC 9110 (RESTful specification). |

---

## 2. Rincian Temuan Bug

### BUG-BE-01: [HIGH] Server Crash `HTTP 500` pada Endpoint Baru (`latest-keywords` & `posts-export`)

#### Deskripsi
Tim backend telah menambahkan sanitasi input Null Byte (`%00`) pada endpoint lama (`summary`, `top-posts`, `top-topics`, `sentiment`, `top-accounts`, `protocol-status`) sehingga sekarang merespons aman dengan **`HTTP 400 Bad Request`**.

**Namun, sanitasi ini lupa dipasang pada 2 endpoint baru di v2 (`latest-keywords` dan `posts-export`)**. Akibatnya, saat parameter dikirim karakter null byte `%00`, server mengalami crash internal dan mengembalikan **`HTTP 500 Internal Server Error`**.

#### Bukti Request & Respons Aktual
```http
GET /v2/dashboard/latest-keywords?status=%00 HTTP/1.1
Host: 10.200.101.13:8092

HTTP/1.1 500 Internal Server Error
Content-Type: application/json
{
  "error": {
    "code": "internal_error",
    "message": "internal server error"
  }
}
```

```http
GET /v2/dashboard/posts-export?keyword=%00 HTTP/1.1
Host: 10.200.101.13:8092

HTTP/1.1 500 Internal Server Error
Content-Type: application/json
{
  "error": {
    "code": "internal_error",
    "message": "internal server error"
  }
}
```

```http
GET /v2/dashboard/posts-export?platform=%00 HTTP/1.1
Host: 10.200.101.13:8092

HTTP/1.1 500 Internal Server Error
Content-Type: application/json
{
  "error": {
    "code": "internal_error",
    "message": "internal server error"
  }
}
```

#### Rekomendasi Solusi
Terapkan middleware/fungsi sanitasi null byte yang sama ke handler `latest-keywords` dan `posts-export`:
```go
if strings.Contains(param, "\x00") {
    return c.JSON(http.StatusBadRequest, ErrorResponse{Code: "invalid_param", Message: "parameter contains invalid null byte"})
}
```

---

### BUG-BE-02: [HIGH] Uncontrolled Memory Allocation / Risiko DoS pada `posts-export`

#### Deskripsi
Ketika parameter `period` dikirim dengan nilai yang tidak valid (misal `period=invalid-string`), endpoint `posts-export` **tidak menolak request dengan HTTP 400 Bad Request**.

Sebaliknya, backend secara diam-diam jatuh ke *default fallback 1 bulan penuh*, lalu men-generate file Excel raksasa sebesar **2,2 Megabytes (2.217.253 bytes)** berisi ribuan baris data langsung di dalam memori RAM!

#### Bukti Request & Respons Aktual
```http
GET /v2/dashboard/posts-export?period=invalid-period-string HTTP/1.1
Host: 10.200.101.13:8092

HTTP/1.1 200 OK
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
Content-Disposition: attachment; filename="post-1m-20260918.xlsx"
Content-Length: 2217253
```

#### Dampak
Jika pengguna atau script otomatis mengirim beberapa request paralel dengan period invalid, server harus me-load dan men-generate ratusan Megabytes file Excel secara simultan di memori, yang berpotensi langsung memicu **Out-of-Memory (OOM) Crash** dan melumpuhkan layanan backend (*Denial of Service*).

#### Rekomendasi Solusi
Jika nilai `period` tidak sesuai token standar (`24h`, `7d`, dsb.) atau format tanggal `YYYY-MM-DD`, segera return **`HTTP 400 Bad Request`**:
```json
{
  "error": {
    "code": "invalid_period",
    "message": "format periode tidak valid, gunakan format 24h, 7d, YYYY-MM-DD, atau YYYY-MM-DD/YYYY-MM-DD"
  }
}
```

---

### BUG-BE-03: [MEDIUM] SQL Wildcard LIKE Injection pada `search` dan `status`

#### Deskripsi
Karakter `%` dan `_` pada query pencarian tidak di-escape. Ketika user mencari `search=%`, backend mengeksekusi SQL `ILIKE '%'` yang mencocokkan **100% seluruh post di database** alih-alih mencari teks tanda persen literal `"%"`.

Hal yang sama terjadi pada `GET /v2/dashboard/latest-keywords?status=%`, yang mengembalikan seluruh status baik `ACTIVE` maupun `INACTIVE`.

#### Rekomendasi Solusi
Lakukan *escaping* karakter khusus SQL LIKE sebelum dimasukkan ke query:
```go
func EscapeLike(s string) string {
    s = strings.ReplaceAll(s, "\\", "\\\\")
    s = strings.ReplaceAll(s, "%", "\\%")
    s = strings.ReplaceAll(s, "_", "\\_")
    return s
}
```

---

### BUG-BE-04: [MEDIUM] Logika Rentang Tanggal Terbalik (*Reversed Date*) Memberikan Data Salah

#### Deskripsi
Pada request `GET /v2/dashboard/conversation-trend?period=2026-09-07/2026-09-01` (tanggal awal lebih baru dari tanggal akhir):
* Backend tidak menolak dengan `HTTP 400 Bad Request`.
* Backend malah mengembalikan data 32 hari (18 Agustus s/d 18 September).

#### Dampak
Pengguna yang memilih tanggal secara tidak sengaja terbalik akan melihat grafik yang sangat panjang (32 hari) tanpa tahu bahwa ada kesalahan input, sehingga menimbulkan salah interpretasi analisis tren.

#### Rekomendasi Solusi
Validasi `startDate <= endDate`. Jika `startDate > endDate`, kembalikan `HTTP 400 Bad Request`.

---

### BUG-BE-05: [LOW] Method HTTP Non-GET Merespons `404 Not Found` Bukan `405 Method Not Allowed`

Endpoint `POST /v2/dashboard/summary` atau `DELETE /v2/dashboard/latest-keywords` merespons `404 Not Found`. Sesuai standar RFC 9110, endpoint yang ada tetapi dipanggil dengan method yang tidak diizinkan harus merespons `405 Method Not Allowed` dengan header `Allow: GET`.
