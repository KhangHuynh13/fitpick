# Fitpick

Web app quản lý tủ quần áo, dạng PWA dùng trên điện thoại (iPhone và Android).
Mỗi người tự lưu tủ đồ **trên máy mình** (IndexedDB) — không có server, không có tài khoản.

Yêu cầu đầy đủ và lộ trình 3 giai đoạn: xem [SPEC.md](SPEC.md). Đã làm xong **cả 3 giai đoạn** (phiên bản 1.2, `CACHE_VERSION = 'v4'`).

---

## 1. Chạy thử trên Mac

> ⚠️ **Cổng 8000 đang dùng cho app khác (quản lý tài sản) — không dùng và không tắt nó.**
> Fitpick chạy ở cổng **8200**. Bản xem thiết kế (thư mục `design/`) chạy ở cổng **8100**.

### Bước 1 — Kiểm tra cổng còn trống

```bash
lsof -nP -iTCP:8200 -sTCP:LISTEN
```

Không in ra gì nghĩa là cổng trống. Nếu có dòng hiện ra, cổng đang bị dùng — đừng tắt chương trình đó, hãy kiểm tra lại xem có phải bạn đã chạy Fitpick từ trước không.

### Bước 2 — Chạy server tĩnh

```bash
cd ~/Documents/Quanlytudo_App && python3 -m http.server 8200 --bind 127.0.0.1
```

Mở **http://localhost:8200** bằng Chrome hoặc Safari. Dừng server bằng `Ctrl + C`.

(Muốn xem lại thiết kế gốc: `cd ~/Documents/Quanlytudo_App/design && python3 -m http.server 8100 --bind 127.0.0.1` rồi mở http://localhost:8100.)

> Phải chạy qua `http://localhost`, **không** mở file `index.html` trực tiếp (`file://`) — service worker và một số tính năng chỉ chạy trên localhost hoặc https.

### Bước 3 — Giả lập màn hình điện thoại

**Chrome**
1. Mở http://localhost:8200, bấm `Cmd + Option + I` để mở DevTools.
2. Bấm `Cmd + Shift + M` (biểu tượng điện thoại/máy tính bảng) để bật chế độ thiết bị.
3. Chọn máy ở thanh trên cùng, ví dụ **iPhone 12 Pro** (390×844) hoặc **iPhone SE** (375×667, để thử màn nhỏ).
4. Bấm tải lại trang (`Cmd + R`) sau khi đổi máy.

**Safari**
1. Safari → Cài đặt → Nâng cao → bật **Hiển thị tính năng cho nhà phát triển web**.
2. Menu **Phát triển → Vào chế độ thiết kế đáp ứng** (`Cmd + Ctrl + R`) và chọn iPhone.

**Trên điện thoại thật** (cùng mạng Wi-Fi với Mac): chạy server với `--bind 0.0.0.0` thay cho `--bind 127.0.0.1`, rồi mở `http://<IP-của-Mac>:8200`. Lưu ý: qua địa chỉ IP (không phải https) thì không cài được PWA/offline — muốn thử đầy đủ thì đưa lên GitHub Pages.

### Xóa dữ liệu thử

Chrome DevTools → tab **Application** → **Storage** → **Clear site data**. (Chỉ xóa dữ liệu của localhost:8200, không ảnh hưởng app khác.)

---

## 2. Đưa lên GitHub Pages

1. Tạo repo tên `fitpick`, đẩy thư mục này lên. File `.gitignore` đã loại sẵn `design/`, `.claude/`, `.DS_Store` và file tạm.
2. Repo → **Settings → Pages** → Source: *Deploy from a branch*, chọn nhánh `main`, thư mục `/ (root)`.
3. Sau vài phút app chạy ở `https://<username>.github.io/fitpick/`.

Mọi đường dẫn trong app đều là đường dẫn tương đối nên chạy được trong thư mục con `/fitpick/`.

---

## 3. Khi cập nhật app: tăng `CACHE_VERSION`

Service worker (`sw.js`) lưu sẵn file của app để chạy offline. Mỗi lần sửa **bất kỳ file nào** (JS, CSS, icon, font…):

1. Mở `sw.js`, tăng số phiên bản:
   ```js
   const CACHE_VERSION = 'v5';   // trước đó là 'v4'
   ```
2. Nếu thêm file mới, thêm đường dẫn vào mảng `APP_FILES` trong `sw.js`.
3. Đẩy lên GitHub.

Điều gì xảy ra với bạn bè:
- File HTML luôn lấy từ mạng trước (network-first) nên trình duyệt thấy ngay `sw.js` mới.
- Service worker mới tải toàn bộ file vào cache `fitpick-v5`, xóa cache cũ `fitpick-v4`.
- App hiện thông báo **"Đã có bản Fitpick mới · Tải lại"**. Bấm là dùng bản mới. Dữ liệu tủ đồ không bị ảnh hưởng.

Quên tăng `CACHE_VERSION` thì bạn bè vẫn dùng CSS/JS cũ đã lưu trong máy.

Nếu đổi version hiển thị trong Cài đặt, sửa `APP_VERSION` trong `app.js`.

### Dữ liệu của người dùng khi cập nhật

- Tủ đồ nằm trong **IndexedDB**, tách biệt hoàn toàn với cache của service worker. Tăng `CACHE_VERSION` chỉ thay file của app, **không** đụng tới dữ liệu.
- Chỉ khi đổi cấu trúc database mới cần tăng `DB_VERSION` trong `db.js` (xem mục "Nâng cấp database" bên dưới). Các bản 1.1, 1.1.1 và 1.2 không đổi cấu trúc, vẫn `DB_VERSION = 1`.
- Không bao giờ đổi tên database (`fitpick`) hay xóa store — làm vậy là mất dữ liệu của bạn bè.

Lịch sử phiên bản:

| App | `CACHE_VERSION` | `DB_VERSION` | Nội dung |
|---|---|---|---|
| 1.0 | v1 | 1 | Giai đoạn 1: Tủ đồ, món đồ, Mặc hôm nay, Cài đặt, sao lưu |
| 1.1 | v2 | 1 | Giai đoạn 2: tab Outfit; ảnh trong suốt có nền kem |
| 1.1.1 | v3 | 1 | Sửa 2 lỗi trên iPhone (Safari) — xem bên dưới |
| 1.2 | v4 | 1 | Giai đoạn 3: tab Gợi ý phối đồ theo luật (chip dịp, chip lý do, Đổi bộ khác, Lưu thành outfit, Mặc bộ này hôm nay, trạng thái trống). Ghi dữ liệu dùng lại cơ chế an toàn của 1.1.1 |

#### Bản 1.1.1 — hai lỗi trên iPhone và cách sửa

> Hai lỗi này chỉ xảy ra trên Safari/iPhone (WebKit). Nguyên nhân dưới đây được suy ra từ code và ảnh chụp màn hình, **chưa tái hiện được trên Safari** (Safari trên Mac chưa cho điều khiển tự động). Bản sửa đã được kiểm tra trên Chrome bằng cách giả lập đúng hai tình huống lỗi.

**Lỗi 1 — Ảnh món đồ thành dấu "?" sau khi bấm "Hôm nay mặc bộ này".**
- *Nguyên nhân:* trên Safari, ảnh (Blob) đọc từ IndexedDB trỏ tới một file trên đĩa. Khi món đồ được ghi lại (đổi số lần mặc), Safari thay file đó; URL ảnh tạo từ Blob cũ — được giữ trong bộ nhớ đệm theo id — không còn đọc được. Mở lại app thì URL được tạo mới nên ảnh hiện lại; dữ liệu không hỏng.
- *Cách sửa (`image.js`, `app.js`, `db.js`):* vẫn giữ Blob và cache URL theo id món. Sau mỗi lần ghi một món, cache đánh dấu "cần làm mới" để lần vẽ tới tạo URL mới. URL cũ không bị revoke khi có thể đang hiển thị, chỉ revoke khi xóa món hoặc đổi ảnh. Thêm dự phòng: ảnh nào lỗi tải thì đọc lại món từ database và tạo URL mới một lần; vẫn lỗi thì hiện hình minh họa theo loại đồ, không bao giờ hiện "?".

**Lỗi 2 — Bấm "Hôm nay mặc bộ này" rồi bấm ngay "Đã mặc hôm nay" thì báo "Không bỏ đánh dấu được".**
- *Nguyên nhân:* bỏ đánh dấu phải ghi lại các món đồ cùng ảnh của chúng. Ngay sau lần ghi trước, Safari có thể chưa ghi xong file ảnh mới, nên lần ghi thứ hai lỗi (`UnknownError`); đợi vài giây thì được. Ngoài ra thanh Hoàn tác và nút bấm lại là hai đường hoàn tác có thể chạy chồng lên nhau, và thông báo lỗi chỉ ghi chung chung.
- *Cách sửa:*
  - `db.js`: trước khi ghi lại món đồ, đọc ảnh vào bộ nhớ thành Blob mới rồi mới ghi (giống lúc thêm món mới); gặp lỗi tạm thời thì tự thử lại 1 lần sau 400 ms. Áp dụng cho: Mặc hôm nay / bỏ đánh dấu (món và outfit), sửa món, xóa danh mục.
  - `app.js`: mỗi món/outfit có khóa riêng — Hoàn tác, nút bấm lại và bấm đúp không thể chạy cùng lúc. Bấm "Đã mặc hôm nay" khi thanh Hoàn tác còn hiện thì thanh đó đóng lại rồi mới hỏi xác nhận. Bỏ đánh dấu khi đã bỏ rồi thì không báo lỗi.
  - Thông báo lỗi ghi lý do cụ thể (chi tiết kỹ thuật ở console), hiện ở phía trên màn hình và không chặn bấm vào các nút bên dưới.

---

## 4. Cấu trúc file

| File | Vai trò |
|---|---|
| `index.html` | Khung trang, thẻ meta PWA/iPhone, thanh điều hướng |
| `style.css` | Giao diện (màu, font, bố cục theo `design/`) |
| `app.js` | Giao diện & điều hướng (`#/tu-do`, `#/mon/<id>`, `#/them`, `#/sua/<id>`, `#/outfit`, `#/danh-muc/<id>`, `#/tao-outfit`, `#/sua-outfit/<id>`, `#/goi-y`, `#/cai-dat`; `#/them/<idDanhMục>` chọn sẵn danh mục) |
| `db.js` | Thao tác IndexedDB, nâng cấp version database |
| `image.js` | Thu nhỏ ảnh (cạnh dài ≤ 800px), tô nền kem, nén JPEG 0.8, chuyển base64 |
| `backup.js` | Xuất / kiểm tra / nhập bản sao lưu |
| `suggest.js` | Luật gợi ý phối đồ (hàm thuần, không đọc/ghi database) |
| `sw.js` | Service worker (offline, cập nhật) |
| `manifest.json` | Thông tin PWA (tên Fitpick, icon, màu) |
| `icons/` | Icon app + `make_icons.py` (tạo lại icon bằng Pillow) |
| `fonts/` | Font Be Vietnam Pro & Cormorant Garamond (lưu cục bộ, không tải từ Internet) |
| `design/` | Thiết kế gốc (chỉ để tham khảo) |

Tạo lại icon:

```bash
python3 -m pip install pillow
```

```bash
cd ~/Documents/Quanlytudo_App && python3 icons/make_icons.py
```

---

## 5. Cấu trúc dữ liệu

Database IndexedDB tên `fitpick`, version hiện tại `1` (hằng `DB_VERSION` trong `db.js`). Thời điểm lưu dạng chuỗi ISO (`2026-10-05T08:19:23.162Z`).

### `categories` — danh mục (khóa: `id`)
| Trường | Kiểu | Ghi chú |
|---|---|---|
| `id` | string | `crypto.randomUUID()` |
| `name` | string | Tên hiển thị, không trùng (không phân biệt hoa thường) |
| `order` | number | Thứ tự sắp xếp, 0 là đầu tiên |

Mặc định: Đi làm, Đi chơi, Thể thao, Dự tiệc, Ở nhà.

### `items` — món đồ (khóa: `id`)
| Trường | Kiểu | Ghi chú |
|---|---|---|
| `id` | string | UUID |
| `name` | string | |
| `type` | string | Áo, Quần, Váy/Đầm, Giày, Túi, Phụ kiện, Áo khoác |
| `color` | string | Trắng, Đen, Be, Nâu, Xám, Xanh navy, Xanh rêu, Hồng, Đỏ đô, Vàng |
| `categoryIds` | string[] | Id danh mục (không lưu tên) |
| `imageBlob` | Blob \| null | Ảnh JPEG đã nén |
| `wearCount` | number | Mặc định 0, không âm |
| `lastWornAt` | string \| null | Lần mặc gần nhất |
| `previousLastWornAt` | string \| null | Giá trị `lastWornAt` trước lần "Mặc hôm nay" gần nhất (để hoàn tác) |
| `createdAt` | string | |

### `outfits` — outfit (khóa: `id`)
| Trường | Kiểu | Ghi chú |
|---|---|---|
| `id` | string | UUID |
| `name` | string | |
| `itemIds` | string[] | Món trong bộ (ít nhất 1) |
| `categoryIds` | string[] | Id danh mục; rỗng = "Chưa phân loại" |
| `categoryAddedAt` | object | `{ idDanhMục: thờiĐiểmThêmVào }` — dùng để chọn ảnh bìa album |
| `wearCount` | number | Số lần mặc cả bộ |
| `lastWornAt` / `previousLastWornAt` | string \| null | Như ở món đồ |
| `lastWearItemIds` | string[] | Các món thực sự được +1 ở lần "Hôm nay mặc bộ này" gần nhất (hoàn tác chỉ trừ đúng các món này) |
| `createdAt` | string | |

### `meta` — thông tin phụ (khóa: `key`)
| key | value |
|---|---|
| `lastBackupAt` | Thời điểm sao lưu gần nhất, hoặc `null` |
| `itemsAddedSinceBackup` | Số món đã thêm từ lần sao lưu trước |

### Nâng cấp database

Trong `db.js`: tăng `DB_VERSION`, rồi thêm một nhánh `case` mới trong hàm `upgrade()` (ví dụ `case 1:` để nâng từ 1 lên 2). Chỉ **thêm** store/index/trường, không xóa store cũ — các nhánh chạy nối tiếp nhau nên người dùng ở version cũ nào cũng được nâng đủ bước mà không mất dữ liệu.

### Định dạng file sao lưu (`fitpick-backup-YYYY-MM-DD.json`)

```json
{
  "app": "fitpick",
  "formatVersion": 1,
  "dbVersion": 1,
  "exportedAt": "2026-10-05T08:19:23.162Z",
  "categories": [ { "id": "…", "name": "Đi làm", "order": 0 } ],
  "items": [ { "id": "…", "name": "…", "type": "Áo", "color": "Trắng", "categoryIds": ["…"],
               "image": "data:image/jpeg;base64,…", "wearCount": 0, "lastWornAt": null,
               "previousLastWornAt": null, "createdAt": "…" } ],
  "outfits": [ … ],
  "meta": { "lastBackupAt": null, "itemsAddedSinceBackup": 3 }
}
```

- `image` thay cho `imageBlob` (ảnh chuyển sang base64).
- Khi nhập, app kiểm tra `app`, `formatVersion` và từng bản ghi trước khi ghi. File từ bản mới hơn (`formatVersion` lớn hơn) bị từ chối.
- **Gộp thêm**: bỏ qua bản ghi trùng `id`; danh mục khác id nhưng trùng tên được gộp làm một.
- **Thay thế toàn bộ**: xóa sạch dữ liệu hiện có rồi ghi dữ liệu trong file.
