# Fitpick — Đặc tả yêu cầu (SPEC)

Web app quản lý tủ quần áo tên **Fitpick**, dạng PWA dùng trên điện thoại (iPhone và Android).
App được đưa lên GitHub Pages cho bạn bè dùng; mỗi người tự lưu tủ đồ trên máy mình (không có server, không đồng bộ).

Lộ trình:

| Giai đoạn | Nội dung | Trạng thái |
|---|---|---|
| 1 | Tủ đồ, thêm/sửa/xem/xóa món đồ, "Mặc hôm nay", Cài đặt (sao lưu, danh mục, thống kê, hướng dẫn cài), nhắc sao lưu | **Đã làm** |
| 2 | Tab Outfit (danh mục dạng album, tạo/sửa outfit, "Hôm nay mặc bộ này") | Chưa làm — tab hiện "Sắp ra mắt" |
| 3 | Tab Gợi ý phối đồ theo luật (không dùng AI) | Chưa làm — tab hiện "Sắp ra mắt" |

---

## 1. Yêu cầu kỹ thuật

- Tên app là **"Fitpick"**: dùng cho thẻ `<title>`, `name` và `short_name` trong `manifest.json`, và chữ trên icon app nếu có. Tên tab **"Tủ đồ"** ở thanh điều hướng giữ nguyên.
- HTML, CSS, JavaScript thuần. **Không** framework, **không** bước build, **không** thư viện ngoài, **không** gọi API ngoài.
- Mọi đường dẫn là **đường dẫn tương đối** (GitHub Pages chạy ở `username.github.io/fitpick/`).
- Dữ liệu lưu bằng **IndexedDB** trên máy người dùng, có quản lý version database để nâng cấp không mất dữ liệu. Id dùng `crypto.randomUUID()`.
- **PWA**:
  - `manifest.json`;
  - service worker để chạy offline;
  - icon 192px, 512px, apple-touch-icon — tự tạo bằng script Python dùng Pillow, phong cách khớp với thiết kế: nền xanh rêu, chữ hoặc biểu tượng màu kem;
  - thẻ meta để iPhone mở toàn màn hình khi thêm vào màn hình chính.
- Service worker có biến `CACHE_VERSION`; file HTML lấy theo kiểu **network-first** để khi cập nhật app, bạn bè nhận bản mới.
- Cấu trúc file:
  - `index.html`
  - `style.css`
  - `app.js` — giao diện
  - `db.js` — thao tác IndexedDB
  - `image.js` — xử lý ảnh
  - `backup.js` — sao lưu/khôi phục
  - `suggest.js` — gợi ý (giai đoạn 3)
  - `sw.js`
  - `manifest.json`
  - `icons/`
- Comment tiếng Việt giải thích từng hàm. Dùng `try/catch` ở chỗ đọc/ghi database và xử lý file, hiện thông báo lỗi dễ hiểu.
- `README.md` tiếng Việt: cách chạy thử trên Mac, cấu trúc dữ liệu, cách tăng `CACHE_VERSION` khi cập nhật.

## 2. Giao diện

- Làm theo thiết kế trong thư mục `design/` (màu sắc, font, bố cục, thanh điều hướng, các trạng thái). Chỉ lấy phần trình bày; cấu trúc file và cách lưu dữ liệu theo SPEC này.
- Mọi con số dùng kiểu số thẳng hàng (**lining figures**).
- Các màn có danh sách phải chừa khoảng trống cuối để không bị thanh điều hướng che.
- Nút tròn **"+"** chỉ hiện ở tab **Tủ đồ** (thêm món) và **Outfit** (tạo outfit).

Tóm tắt thiết kế (lấy từ `design/App tủ đồ.html`):

| Thành phần | Giá trị |
|---|---|
| Nền | `#F7F3EC` (kem) |
| Bề mặt thẻ | `#FFFDF9` |
| Nền phụ / chip | `#EFE8DB` |
| Viền | `#DDD5C7`, `#E6DFD3`, `#CFC6B6` |
| Chữ chính / phụ | `#1F1D1A` / `#6B655C` |
| Màu nhấn (xanh rêu) | `#4E5B3A` |
| Màu nguy hiểm (xóa) | `#93362C` |
| Font chữ thường | Be Vietnam Pro 400/500/600 |
| Font tiêu đề | Cormorant Garamond 500/600 |
| Thanh điều hướng | Tủ đồ · Outfit · (+) · Gợi ý · Cài đặt |

Bảng màu món đồ (10 màu): Trắng, Đen, Be, Nâu, Xám, Xanh navy, Xanh rêu, Hồng, Đỏ đô, Vàng.
Màu trung tính (dùng cho gợi ý): Trắng, Đen, Xám, Be, Xanh navy.

## 3. Database (IndexedDB)

| Store | Trường |
|---|---|
| `categories` | `id`, `name`, `order` |
| `items` | `id`, `name`, `type`, `color`, `categoryIds`, `imageBlob`, `wearCount`, `lastWornAt`, `previousLastWornAt`, `createdAt` |
| `outfits` | `id`, `name`, `itemIds`, `categoryIds`, `categoryAddedAt`, `wearCount`, `lastWornAt`, `previousLastWornAt`, `lastWearItemIds`, `createdAt` |
| `meta` | `lastBackupAt`, `itemsAddedSinceBackup` |

- **categories**: mặc định *Đi làm, Đi chơi, Thể thao, Dự tiệc, Ở nhà*. Người dùng thêm, đổi tên, sắp xếp, xóa được. Xóa danh mục chỉ gỡ id khỏi món đồ và outfit, **không** xóa chúng.
- **items.type**: một trong *Áo, Quần, Váy/Đầm, Giày, Túi, Phụ kiện, Áo khoác*.
- **items.categoryIds**: mảng id danh mục (chọn nhiều).
- **items.wearCount**: mặc định 0.
- **outfits.categoryAddedAt**: object `id danh mục → thời điểm thêm vào`.
- Món đồ và outfit lưu **id danh mục, không lưu tên**.

## 4. Giai đoạn 1 (đã làm)

1. **Tủ đồ**: lưới ảnh, hàng chip lọc theo loại đồ, tiêu đề phụ "X MÓN · Y OUTFIT".
2. **Thêm/Sửa món đồ**: chọn ảnh (chụp hoặc thư viện), ảnh tự thu nhỏ cạnh dài tối đa 800px, nén JPEG khoảng 0.8. Nhập tên, chọn loại, màu, danh mục (chọn nhiều, có chip "+ Thêm" để tạo danh mục mới). Màn Sửa có ô chỉnh tay `wearCount` bằng nút − và + (không nhỏ hơn 0).
3. **Chi tiết món đồ**: ảnh, thông tin, thống kê (số lần mặc, mặc gần nhất, số outfit), danh sách outfit chứa món này, nút Sửa, Xóa.
4. **"Mặc hôm nay"**:
   - Mỗi món chỉ ghi 1 lần mỗi ngày. Khi ghi: lưu `lastWornAt` cũ vào `previousLastWornAt`, `wearCount` +1, `lastWornAt` = hôm nay. Hiện thông báo "Đã ghi lần mặc thứ N · Hoàn tác" trong 5 giây.
   - Nút đổi thành "Đã mặc hôm nay ✓", vẫn bấm được. Bấm thì hiện hộp xác nhận "Bỏ đánh dấu mặc hôm nay?". Đồng ý thì `wearCount` −1, khôi phục `lastWornAt` từ `previousLastWornAt`. Chỉ cho bỏ đánh dấu trong cùng ngày.
5. **Xóa món đồ**: hỏi xác nhận; nếu món nằm trong outfit thì báo số outfit bị ảnh hưởng; sau khi xóa, gỡ món khỏi các outfit, outfit nào rỗng thì xóa luôn.
6. **Cài đặt**:
   - *Xuất bản sao lưu*: file JSON (tên dạng `fitpick-backup-YYYY-MM-DD.json`) chứa categories, items, outfits, meta, ảnh chuyển base64, kèm số version định dạng. Trên điện thoại ưu tiên `navigator.share` với file; không hỗ trợ thì tải xuống. Cập nhật `lastBackupAt`, reset `itemsAddedSinceBackup`.
   - *Nhập bản sao lưu*: hỏi "Gộp thêm" hay "Thay thế toàn bộ". Gộp thì bỏ qua bản ghi trùng id. Kiểm tra file hợp lệ trước khi nhập.
   - *Quản lý danh mục*: danh sách kèm số món và số outfit, kéo để sắp xếp, đổi tên, xóa, thêm mới.
   - *Thống kê nhanh*: tổng số món theo loại, món mặc nhiều nhất, danh sách món chưa mặc lần nào.
   - *Hướng dẫn cài app* cho iPhone và Android; dòng "Fitpick · phiên bản 1.0".
7. **Nhắc sao lưu**: banner ở màn Tủ đồ khi đã thêm từ 10 món mới hoặc quá 14 ngày chưa sao lưu (chỉ khi tủ có ít nhất 1 món). Có nút "Sao lưu ngay" và nút đóng.
8. Tab **Outfit** và **Gợi ý** giữ đúng giao diện (tiêu đề, thanh điều hướng) nhưng hiện dòng **"Sắp ra mắt"**.

### Quyết định triển khai bổ sung (giai đoạn 1)

- Font Be Vietnam Pro và Cormorant Garamond được lấy từ file thiết kế và lưu cục bộ trong `fonts/` (không tải từ Google Fonts), để app chạy offline và không gọi dịch vụ ngoài.
- Điều hướng bằng hash (`#/tu-do`, `#/mon/<id>`, `#/them`, `#/sua/<id>`, `#/outfit`, `#/goi-y`, `#/cai-dat`) để chạy được trên GitHub Pages không cần cấu hình server.
- Thời điểm (`createdAt`, `lastWornAt`, …) lưu dạng chuỗi ISO. "Hôm nay" tính theo ngày giờ địa phương của máy.
- Ảnh là tùy chọn; món chưa có ảnh hiển thị hình minh họa theo loại, tô theo màu đã chọn. Bỏ trống tên thì tự đặt "Loại + màu" (ví dụ "Áo trắng").
- Khi **gộp** bản sao lưu: danh mục khác id nhưng **trùng tên** (không phân biệt hoa thường) được coi là cùng một danh mục, để tránh trùng "Đi làm" khi gộp từ máy khác.
- Khi **thay thế toàn bộ**: xóa sạch dữ liệu hiện tại rồi ghi dữ liệu từ file (kể cả meta).
- Nếu trình duyệt chặn `navigator.share` vì xử lý quá lâu sau khi bấm nút, app hiện hộp "Bản sao lưu đã sẵn sàng" để người dùng bấm chia sẻ lại.
- Đóng banner nhắc sao lưu: ẩn đến hết ngày hôm đó (lưu trong localStorage của trình duyệt).
- Nút tìm kiếm ở màn Tủ đồ (có trong thiết kế): lọc nhanh theo tên món.
- Định dạng file sao lưu: xem `README.md`.

## 5. Giai đoạn 2 (chưa làm)

- Tab Outfit có 2 chế độ **"Danh mục | Tất cả"**, mặc định Danh mục.
- Danh mục dạng lưới album: ảnh bìa ghép 2x2 lấy từ outfit được thêm vào danh mục gần nhất (dựa vào `categoryAddedAt`), thiếu thì lấy thêm từ outfit kế tiếp, ô thiếu để trống. Có ô **"Chưa phân loại"** tự lọc outfit có `categoryIds` rỗng (không lưu thành danh mục thật). Ô cuối **"+ Tạo danh mục"**.
- Màn chi tiết danh mục: danh sách outfit, nút "Thêm outfit vào danh mục", menu Đổi tên/Xóa.
- Tạo/Sửa outfit: chọn món theo loại, xem trước, đặt tên, chọn danh mục (nhiều).
- **"Hôm nay mặc bộ này"**: outfit +1 và từng món trong bộ +1 theo quy tắc "Mặc hôm nay"; món nào đã ghi hôm nay thì bỏ qua. Lưu các món thực sự được cộng vào `lastWearItemIds`. Hoàn tác (thông báo 5 giây hoặc bấm lại nút rồi xác nhận, chỉ trong cùng ngày) thì trừ lại outfit và đúng các món trong `lastWearItemIds`.

## 6. Giai đoạn 3 (chưa làm)

Gợi ý phối đồ theo luật, **không dùng AI** (code trong `suggest.js`):

- Hàng chip dịp luôn hiển thị (sticky): **Tất cả** + các danh mục. Bấm chip chỉ đổi bộ gợi ý, không chuyển màn.
- Lọc món theo danh mục đang chọn (Tất cả thì lấy hết).
- Một bộ gồm 1 áo + 1 quần **hoặc** 1 váy/đầm, cộng 1 giày, thêm túi/phụ kiện nếu có, áo khoác tùy chọn.
- Ưu tiên món có `lastWornAt` lâu nhất hoặc chưa mặc; **không** chọn món đã mặc hôm nay hoặc hôm qua.
- Màu: tối đa 1 món màu nổi, còn lại màu trung tính (trắng, đen, xám, be, xanh navy).
- Không trùng outfit đã lưu hoặc bộ vừa gợi ý.
- Chip lý do sinh từ các luật trên (ví dụ "Cùng phong cách Đi làm", "Màu trung tính dễ phối", "1 món lâu chưa mặc").
- Nút **"Đổi bộ khác"**, **"Lưu thành outfit"** (hộp đặt tên điền sẵn và chọn sẵn danh mục đang lọc), **"Mặc bộ này hôm nay"** (áp quy tắc Mặc hôm nay cho từng món).
- Không đủ món thì hiện trạng thái trống **"Chưa đủ đồ để phối cho [dịp]"** với nút **"Thêm món đồ"**.
