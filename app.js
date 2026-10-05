/* =========================================================================
   app.js — Giao diện Fitpick (giai đoạn 1 + 2)
   Ứng dụng một trang, điều hướng bằng hash: #/tu-do, #/mon/<id>, #/them,
   #/sua/<id>, #/outfit, #/danh-muc/<id|none>, #/tao-outfit[/<idDanhMục>],
   #/sua-outfit/<id>, #/goi-y, #/cai-dat
   ========================================================================= */
'use strict';

/* ============================ Hằng số ============================ */

const APP_VERSION = '1.1.1';

// Nhóm loại đồ ở màn Tạo/Sửa outfit (theo thiết kế: Áo · Quần/Váy · Giày · Phụ kiện)
const OUTFIT_GROUPS = [
  { key: 'ao', label: 'Áo', hint: 'Chọn áo', types: ['Áo', 'Áo khoác'] },
  { key: 'duoi', label: 'Quần/Váy', hint: 'Chọn quần/váy', types: ['Quần', 'Váy/Đầm'] },
  { key: 'giay', label: 'Giày', hint: 'Chọn giày', types: ['Giày'] },
  { key: 'pk', label: 'Phụ kiện', hint: 'Chọn phụ kiện', types: ['Túi', 'Phụ kiện'] }
];
// Id giả cho album "Chưa phân loại" (không lưu thành danh mục thật)
const UNCATEGORIZED = 'none';

// Bảng màu món đồ (theo thiết kế)
const COLORS = [
  { name: 'Trắng', hex: '#FBF9F4' }, { name: 'Đen', hex: '#2B2926' }, { name: 'Be', hex: '#D9C8A9' },
  { name: 'Nâu', hex: '#8B5F45' }, { name: 'Xám', hex: '#8E8B85' }, { name: 'Xanh navy', hex: '#2F3E5C' },
  { name: 'Xanh rêu', hex: '#6E7953' }, { name: 'Hồng', hex: '#D9A3A0' }, { name: 'Đỏ đô', hex: '#7E2E2E' },
  { name: 'Vàng', hex: '#D8B45A' }
];
const LIGHT_COLORS = ['Trắng', 'Be', 'Vàng', 'Hồng'];

// Hình minh họa theo loại đồ (dùng khi món chưa có ảnh) — lấy từ thiết kế
const GLYPHS = {
  'Áo': { p: 'M36 16 L44 13 L50 22 L56 13 L64 16 L84 30 L77 44 L68 39 L68 88 L32 88 L32 39 L23 44 L16 30 Z', d: 'M50 22 L50 88 M44 13 L50 26 L56 13' },
  'Quần': { p: 'M31 12 L69 12 L74 90 L56 90 L50 38 L44 90 L26 90 Z', d: 'M31 20 L69 20 M50 20 L50 38' },
  'Váy/Đầm': { p: 'M42 10 L58 10 L57 30 L60 34 L78 90 L22 90 L40 34 L43 30 Z', d: 'M40 34 L60 34' },
  'Giày': { p: 'M12 66 L13 46 Q22 43 30 48 L46 55 Q66 57 82 61 Q89 63 89 70 L89 74 L12 74 Z', d: 'M12 68 L89 68 M34 50 L38 56 M40 52 L44 58' },
  'Túi': { p: 'M20 40 L80 40 L75 88 L25 88 Z M37 40 Q37 18 50 18 Q63 18 63 40 L58 40 Q58 24 50 24 Q42 24 42 40 Z', d: 'M21 48 L79 48' },
  'Phụ kiện': { p: 'M12 62 Q14 54 33 52 Q33 30 50 30 Q67 30 67 52 Q86 54 88 62 Q50 74 12 62 Z', d: 'M33 50 Q50 56 67 50' },
  'Áo khoác': { p: 'M36 14 L50 24 L64 14 L84 28 L80 90 L20 90 L16 28 Z', d: 'M50 24 L50 90 M36 14 L44 40 L50 24 M64 14 L56 40 L50 24' }
};

// Biểu tượng SVG dùng lại nhiều nơi
const ICON = {
  back: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  search: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/></svg>',
  close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  closeSmall: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  cloud: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 18a4.5 4.5 0 0 1-.6-9A6 6 0 0 1 18 9.5a4 4 0 0 1-.5 8.5"/><path d="M12 12v8M9 15l3-3 3 3"/></svg>',
  camera: (s = 28) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M4 8.5h3l1.6-2.5h6.8L17 8.5h3V19H4z"/><circle cx="12" cy="13.2" r="3.4"/></svg>`,
  image: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="5" width="17" height="14" rx="2"/><circle cx="9" cy="10" r="1.6"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/></svg>',
  check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  edit: (s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>`,
  trash: (s = 18) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 7h14M10 7V4.5h4V7M7 7l1 13h8l1-13"/></svg>`,
  plus: (s = 16) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>`,
  minus: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14"/></svg>',
  download: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M5 19h14"/></svg>',
  upload: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 19h14"/></svg>',
  grip: '<svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="9" cy="6" r="1.6"/><circle cx="15" cy="6" r="1.6"/><circle cx="9" cy="12" r="1.6"/><circle cx="15" cy="12" r="1.6"/><circle cx="9" cy="18" r="1.6"/><circle cx="15" cy="18" r="1.6"/></svg>',
  chevron: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#6B655C" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
  phone: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linejoin="round" aria-hidden="true"><rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M10.5 18.5h3" stroke-linecap="round"/></svg>',
  share: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1"/></svg>',
  dots: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="12" cy="5" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="12" cy="19" r="2"/></svg>',
  dotsH: '<svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5.5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="18.5" cy="12" r="1.6"/></svg>',
  checkSmall: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  hanger: (s = 28) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 6a2 2 0 1 1 2.6 1.9c-.4.1-.6.5-.6.9V10"/><path d="M12 10l-8.6 6.4c-.7.5-.3 1.6.6 1.6h16c.9 0 1.3-1.1.6-1.6L12 10z"/></svg>`,
  shirt: (s = 28) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M8.5 3.5L4 6l-1.5 4.5 3 1V20h13v-8.5l3-1L20 6l-4.5-2.5c-.6 1.5-2 2.4-3.5 2.4s-2.9-.9-3.5-2.4z"/></svg>`,
  sparkle: (s = 28) => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" aria-hidden="true"><path d="M11 3l1.8 4.7 4.7 1.8-4.7 1.8L11 16l-1.8-4.7L4.5 9.5l4.7-1.8z"/><path d="M18.5 14.5l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/></svg>`
};

/* ============================ Trạng thái ============================ */

const S = {
  items: [],
  categories: [],
  outfits: [],
  meta: { lastBackupAt: null, itemsAddedSinceBackup: 0 },
  filter: 'Tất cả',     // chip loại đồ đang chọn ở màn Tủ đồ
  search: '',
  searchOpen: false,
  form: null,           // dữ liệu đang nhập ở màn Thêm/Sửa món đồ
  oform: null,          // dữ liệu đang nhập ở màn Tạo/Sửa outfit
  outfitMode: 'cat',    // chế độ tab Outfit: 'cat' (Danh mục) | 'all' (Tất cả)
  focusSearch: false,   // cần đặt con trỏ vào ô tìm kiếm sau lần vẽ tới
  routeKey: null,
  suggestChip: 'all'    // chip dịp đang chọn ở tab Gợi ý (giai đoạn 3)
};

const $app = document.getElementById('app');
const $tabbar = document.getElementById('tabbar');
const $fab = document.getElementById('fab');
const $toastRoot = document.getElementById('toast-root');
const $modalRoot = document.getElementById('modal-root');

/* ============================ Tiện ích ============================ */

/** Chống chèn HTML: thoát các ký tự đặc biệt trong chữ người dùng nhập. */
function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Thêm số 0 phía trước cho đủ 2 chữ số. */
const pad2 = (n) => String(n).padStart(2, '0');

/** Ngày dạng dd/mm (thêm /yy nếu khác năm nay). */
function fmtShort(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  const base = `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}`;
  return d.getFullYear() === new Date().getFullYear() ? base : `${base}/${String(d.getFullYear()).slice(2)}`;
}

/** Ngày dạng dd/mm/yyyy. */
function fmtDate(iso) {
  const d = new Date(iso);
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Giờ dạng HH:MM. */
function fmtTime(iso) {
  const d = new Date(iso);
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/** Số ngày (theo lịch) từ một thời điểm đến hôm nay. */
function daysSince(iso) {
  const a = new Date(DB.dayKey(iso) + 'T00:00:00');
  const b = new Date(DB.dayKey() + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

/** Bỏ dấu tiếng Việt và viết thường, để tìm kiếm không phân biệt dấu. */
function fold(text) {
  return String(text || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
}

/** Mã màu của tên màu. */
function colorHex(name) {
  const c = COLORS.find((x) => x.name === name);
  return c ? c.hex : '#CDB796';
}

/** Tên danh mục theo id (bỏ qua id không còn tồn tại). */
function categoryNames(ids) {
  return (ids || []).map((id) => S.categories.find((c) => c.id === id)).filter(Boolean).map((c) => c.name);
}

/** Dòng phụ dưới tên món: "Chưa mặc lần nào" hoặc "Đã mặc N lần". */
function wearLabel(item) {
  return item.wearCount > 0 ? `Đã mặc ${item.wearCount} lần` : 'Chưa mặc lần nào';
}

/**
 * HTML ảnh món đồ. Nếu chưa có ảnh thì vẽ hình minh họa theo loại, tô theo màu.
 */
function thumbHTML(item, { blob, url } = {}) {
  const fromCache = !url && blob === undefined;
  const src = url || (fromCache ? ImageTools.itemImageURL(item) : null);
  if (src) {
    // data-item-id: để onImageError() biết ảnh của món nào khi ảnh không tải được
    const idAttr = item.id ? ` data-item-id="${esc(item.id)}"` : '';
    return `<div class="thumb"><img src="${esc(src)}" alt=""${idAttr} loading="lazy" decoding="async"></div>`;
  }
  return glyphHTML(item);
}

/** Hình minh họa theo loại đồ, tô theo màu (khi món chưa có ảnh hoặc ảnh lỗi). */
function glyphHTML(item) {
  const g = GLYPHS[item.type] || GLYPHS['Áo'];
  const bg = LIGHT_COLORS.includes(item.color) ? '#DED7CA' : '#E7E1D7';
  return `<div class="thumb" style="background:${bg}"><svg viewBox="0 0 100 100" aria-hidden="true">` +
    `<path d="${g.p}" fill="${colorHex(item.color)}" stroke="rgba(31,29,26,0.22)" stroke-width="1.2" stroke-linejoin="round"/>` +
    `<path d="${g.d}" fill="none" stroke="rgba(31,29,26,0.25)" stroke-width="1.1" stroke-linecap="round"/></svg></div>`;
}

/**
 * Ảnh món đồ không tải được (ví dụ URL trỏ tới file ảnh cũ Safari đã thay):
 * lần 1 — đọc lại món từ database và tạo URL mới; lần 2 vẫn lỗi — hiện hình minh họa,
 * không bao giờ để lại dấu "?".
 */
async function onImageError(img) {
  const id = img.dataset.itemId;
  const showGlyph = () => {
    const item = S.items.find((i) => i.id === id);
    const box = img.closest('.thumb');
    if (item && box && box.isConnected) box.outerHTML = glyphHTML(item);
    else img.remove();
  };
  if (img.dataset.retried) {
    console.warn('[Fitpick] Ảnh vẫn lỗi sau khi tạo lại URL, hiện hình minh họa', id);
    showGlyph();
    return;
  }
  img.dataset.retried = '1';
  img.style.visibility = 'hidden'; // không để trình duyệt vẽ dấu "?" trong lúc thử lại
  try {
    const fresh = await DB.getItem(id);
    if (!fresh || !fresh.imageBlob || !img.isConnected) { showGlyph(); return; }
    const local = S.items.find((i) => i.id === id);
    if (local) local.imageBlob = fresh.imageBlob;
    console.warn('[Fitpick] Ảnh không tải được, tạo lại URL từ dữ liệu mới', id);
    img.src = ImageTools.renewItemImage(id, fresh.imageBlob);
    img.style.visibility = '';
  } catch (err) {
    console.error('[Fitpick] Không đọc lại được ảnh', id, err);
    showGlyph();
  }
}

/** Hiện lỗi dễ hiểu. Lỗi kỹ thuật lạ thì dùng câu dự phòng. */
function showError(err, fallback = 'Có lỗi xảy ra. Hãy thử lại.') {
  console.error(err);
  const friendly = err && (err.name === 'DBError' || err.constructor === Error) && err.message;
  toast(friendly || fallback, { error: true, duration: 5000 });
}

/** Đặt trạng thái "đang xử lý" cho một nút. */
function setBusy(btn, busy, label) {
  if (!btn) return;
  if (busy) {
    btn.dataset.label = btn.innerHTML;
    btn.classList.add('is-busy');
    btn.setAttribute('aria-busy', 'true');
    if (label) btn.textContent = label;
  } else {
    btn.classList.remove('is-busy');
    btn.removeAttribute('aria-busy');
    if (btn.dataset.label) btn.innerHTML = btn.dataset.label;
  }
}

/* ============================ Dữ liệu ============================ */

/** Đọc lại toàn bộ dữ liệu từ IndexedDB vào bộ nhớ. */
async function reload() {
  const [items, categories, outfits, meta] = await Promise.all([
    DB.getItems(), DB.getCategories(), DB.getOutfits(), DB.getMeta()
  ]);
  Object.assign(S, { items, categories, outfits, meta });
}

/** Đọc lại dữ liệu rồi vẽ lại màn hiện tại; báo lỗi nếu đọc thất bại. */
async function reloadAndRender() {
  try {
    await reload();
  } catch (err) {
    showError(err, 'Không đọc được dữ liệu tủ đồ.');
  }
  render();
}

/* ============================ Điều hướng ============================ */

/** Đọc route hiện tại từ hash. */
function parseRoute() {
  const parts = location.hash.replace(/^#\/?/, '').split('/');
  const name = parts[0] || 'tu-do';
  const id = parts[1] ? decodeURIComponent(parts[1]) : null;
  const known = ['tu-do', 'them', 'mon', 'sua', 'outfit', 'danh-muc', 'tao-outfit', 'sua-outfit', 'goi-y', 'cai-dat'];
  return known.includes(name) ? { name, id } : { name: 'tu-do', id: null };
}

/** Độ sâu lịch sử trong app (để biết nút Quay lại có quay về màn trước được không). */
function depth() {
  return (history.state && history.state.depth) || 0;
}

/** Mở một màn mới (có thể quay lại). */
function navigate(path) {
  history.pushState({ depth: depth() + 1 }, '', '#/' + path);
  render();
}

/** Chuyển tab ở thanh điều hướng (không chồng lịch sử). */
function switchTab(path) {
  history.replaceState({ depth: 0 }, '', '#/' + path);
  render();
}

/** Quay lại màn trước; nếu mở thẳng từ link thì về màn dự phòng. */
function goBack(fallback) {
  if (depth() > 0) {
    history.back();
  } else {
    history.replaceState({ depth: 0 }, '', '#/' + fallback);
    render();
  }
}

/** Chuẩn bị dữ liệu khi vào một màn (ví dụ: tạo form trống). */
function enterRoute(route) {
  if (S.form && S.form.previewURL) URL.revokeObjectURL(S.form.previewURL);
  S.form = null;
  S.oform = null;
  if (route.name === 'tao-outfit') {
    const preset = S.categories.some((c) => c.id === route.id) ? [route.id] : [];
    S.oform = { mode: 'add', name: '', itemIds: [], categoryIds: preset, tab: 'ao' };
  } else if (route.name === 'sua-outfit') {
    const o = S.outfits.find((x) => x.id === route.id);
    if (o) {
      S.oform = {
        mode: 'edit', id: o.id, name: o.name,
        itemIds: (o.itemIds || []).filter((id) => S.items.some((i) => i.id === id)),
        categoryIds: (o.categoryIds || []).filter((id) => S.categories.some((c) => c.id === id)),
        tab: 'ao'
      };
    }
  }
  if (route.name === 'them') {
    S.form = {
      mode: 'add', name: '', type: DB.ITEM_TYPES.includes(S.filter) ? S.filter : 'Áo', color: null,
      categoryIds: [], imageBlob: null, previewURL: null, imageChanged: false, wearCount: 0
    };
  } else if (route.name === 'sua') {
    const item = S.items.find((i) => i.id === route.id);
    if (item) {
      S.form = {
        mode: 'edit', id: item.id, name: item.name, type: item.type, color: item.color,
        categoryIds: [...(item.categoryIds || [])], imageBlob: item.imageBlob || null,
        previewURL: null, imageChanged: false, wearCount: item.wearCount || 0
      };
    }
  }
  if (route.name !== 'tu-do') { S.searchOpen = false; S.search = ''; }
}

/**
 * Vẽ màn hình theo route hiện tại.
 * Nếu vẫn ở cùng màn (chỉ vẽ lại) thì giữ nguyên vị trí cuộn.
 */
function render() {
  const route = parseRoute();
  const key = route.name + '/' + (route.id || '');
  const changed = key !== S.routeKey;
  if (changed) {
    closeModal();
    enterRoute(route);
    S.routeKey = key;
  }
  const y = window.scrollY;
  let html;
  switch (route.name) {
    case 'them':
    case 'sua': html = viewItemForm(); break;
    case 'mon': html = viewItemDetail(route.id); break;
    case 'outfit': html = viewOutfits(); break;
    case 'danh-muc': html = viewCategoryDetail(route.id); break;
    case 'tao-outfit':
    case 'sua-outfit': html = viewOutfitForm(); break;
    case 'goi-y': html = viewSuggest(); break;
    case 'cai-dat': html = viewSettings(); break;
    default: html = viewWardrobe();
  }
  $app.innerHTML = html;
  updateChrome(route);
  window.scrollTo(0, changed ? 0 : y);
  if (route.name === 'cai-dat') bindCategoryDrag();
  if (S.focusSearch) {
    S.focusSearch = false;
    const input = document.getElementById('search-input');
    if (input) input.focus();
  }
}

/** Cập nhật thanh điều hướng, nút "+" và khoảng trống phía dưới theo màn. */
function updateChrome(route) {
  // Màn chi tiết danh mục nằm trong tab Outfit nên vẫn có thanh điều hướng
  const activeTab = route.name === 'danh-muc' ? 'outfit' : route.name;
  const isTab = ['tu-do', 'outfit', 'goi-y', 'cai-dat'].includes(activeTab);
  $tabbar.hidden = !isTab;
  document.body.classList.toggle('has-actionbar', !isTab);
  $tabbar.querySelectorAll('.tab').forEach((t) => {
    if (t.dataset.tab === activeTab) t.setAttribute('aria-current', 'page');
    else t.removeAttribute('aria-current');
  });
  // Nút tròn "+" chỉ ở tab Tủ đồ (thêm món) và Outfit (tạo outfit)
  const showFab = activeTab === 'tu-do' || activeTab === 'outfit';
  $fab.hidden = !showFab;
  $tabbar.classList.toggle('no-fab', !showFab);
  $fab.setAttribute('aria-label', activeTab === 'outfit' ? 'Tạo outfit mới' : 'Thêm món đồ mới');
  const titles = {
    'tu-do': 'Tủ đồ', them: 'Thêm món đồ', mon: 'Chi tiết món đồ', sua: 'Sửa món đồ', outfit: 'Outfit',
    'danh-muc': 'Danh mục', 'tao-outfit': 'Tạo outfit', 'sua-outfit': 'Sửa outfit', 'goi-y': 'Gợi ý', 'cai-dat': 'Cài đặt'
  };
  document.title = route.name === 'tu-do' ? 'Fitpick' : `${titles[route.name]} · Fitpick`;
}

/* ============================ Màn Tủ đồ ============================ */

/** Thông tin banner nhắc sao lưu, hoặc null nếu không cần nhắc. */
function backupReminder() {
  if (S.items.length === 0) return null;
  try {
    if (localStorage.getItem('fitpick.bannerHiddenOn') === DB.dayKey()) return null;
  } catch (_) { /* localStorage có thể bị chặn */ }
  const added = S.meta.itemsAddedSinceBackup || 0;
  if (added >= 10) return `Bạn đã thêm ${added} món mới từ lần sao lưu trước.`;
  const oldest = S.items.reduce((m, i) => (!m || i.createdAt < m ? i.createdAt : m), null);
  const ref = S.meta.lastBackupAt || oldest;
  const days = ref ? daysSince(ref) : 0;
  if (days > 14) {
    return S.meta.lastBackupAt ? `Đã ${days} ngày bạn chưa sao lưu tủ đồ.` : `Bạn chưa sao lưu tủ đồ lần nào (đã ${days} ngày).`;
  }
  return null;
}

/** Danh sách món sau khi lọc theo chip loại và ô tìm kiếm. */
function filteredItems() {
  const q = fold(S.search.trim());
  return S.items.filter((i) =>
    (S.filter === 'Tất cả' || i.type === S.filter) && (!q || fold(i.name).includes(q))
  );
}

/** HTML lưới món đồ (hoặc trạng thái trống). */
function wardrobeGridHTML() {
  if (S.items.length === 0) {
    return `<div class="empty">
      <span class="empty__icon">${ICON.hanger(28)}</span>
      <h2 class="title-md">Tủ đồ còn trống</h2>
      <p>Chụp ảnh món đồ đầu tiên để bắt đầu xây tủ đồ của bạn.</p>
      <button type="button" class="btn btn--primary" data-action="go" data-to="them">${ICON.plus(18)} Thêm món đồ</button>
    </div>`;
  }
  const list = filteredItems();
  if (list.length === 0) {
    const why = S.search.trim()
      ? `Không tìm thấy món nào khớp “${esc(S.search.trim())}”.`
      : `Chưa có món nào thuộc loại “${esc(S.filter)}”.`;
    return `<div class="empty"><p>${why}</p></div>`;
  }
  return `<div class="grid">${list.map((i) => `
    <a class="card" href="#/mon/${encodeURIComponent(i.id)}" data-action="go" data-to="mon/${encodeURIComponent(i.id)}">
      <div class="card__img">${thumbHTML(i)}</div>
      <div class="card__text">
        <span class="card__name">${esc(i.name)}</span>
        <span class="card__meta ${i.wearCount > 0 ? '' : 'card__meta--new'}">${wearLabel(i)}</span>
      </div>
    </a>`).join('')}</div>`;
}

/** Màn Tủ đồ: tiêu đề, banner sao lưu, chip lọc, lưới ảnh. */
function viewWardrobe() {
  const reminder = backupReminder();
  const chips = ['Tất cả', ...DB.ITEM_TYPES].map((c) => `
    <button type="button" class="chip chip--filled" aria-pressed="${c === S.filter}" data-action="filter" data-value="${esc(c)}">${esc(c)}</button>`).join('');
  return `<div class="screen">
    <header class="page-head">
      <div class="page-head__text">
        <span class="eyebrow">${S.items.length} món · ${S.outfits.length} outfit</span>
        <h1 class="title-xl">Tủ đồ</h1>
      </div>
      <button type="button" class="icon-btn" aria-label="Tìm kiếm" aria-expanded="${S.searchOpen}" data-action="toggle-search">${S.searchOpen ? ICON.close : ICON.search}</button>
    </header>
    ${S.searchOpen ? `<div class="search">
      <label for="search-input" class="sr-only">Tìm theo tên món</label>
      <input id="search-input" type="search" placeholder="Tìm theo tên món…" value="${esc(S.search)}" autocomplete="off" enterkeyhint="search">
    </div>` : ''}
    ${reminder ? `<div class="banner" role="status">
      <span class="banner__icon">${ICON.cloud}</span>
      <div class="banner__body">
        <span>${esc(reminder)}</span>
        <button type="button" class="link-btn" data-action="export">Sao lưu ngay</button>
      </div>
      <button type="button" class="icon-btn icon-btn--plain" aria-label="Đóng thông báo" data-action="banner-close">${ICON.closeSmall}</button>
    </div>` : ''}
    ${S.items.length ? `<div class="chip-row hs" role="group" aria-label="Lọc theo loại">${chips}</div>` : ''}
    <div id="wardrobe-grid">${wardrobeGridHTML()}</div>
  </div>`;
}

/* ============================ Màn Thêm / Sửa ============================ */

/** Màn Thêm/Sửa món đồ. */
function viewItemForm() {
  const f = S.form;
  if (!f) return viewNotFound();
  const isEdit = f.mode === 'edit';
  const hasImage = !!(f.previewURL || f.imageBlob);

  let photo;
  if (f.photoBusy) {
    photo = `<div class="photo-preview"><div class="photo-busy">Đang xử lý ảnh…</div></div>`;
  } else if (!hasImage && !isEdit) {
    photo = `<div class="photo-drop">
      <span class="photo-drop__icon">${ICON.camera(28)}</span>
      <div style="display:flex;flex-direction:column;gap:4px">
        <span class="photo-drop__title">Ảnh món đồ</span>
        <span class="hint" style="line-height:1.45">Chụp trên nền trơn để tủ đồ trông gọn gàng hơn</span>
      </div>
      <div class="photo-drop__actions">
        <button type="button" class="btn btn--primary" data-action="photo-camera">Chụp ảnh</button>
        <button type="button" class="btn" data-action="photo-library">Chọn từ thư viện</button>
      </div>
    </div>`;
  } else {
    const url = f.previewURL || (f.imageBlob && !f.imageChanged ? ImageTools.itemImageURL({ id: f.id, imageBlob: f.imageBlob }) : null);
    photo = `<div class="photo-preview">
      ${thumbHTML({ type: f.type, color: f.color }, { url, blob: null })}
      <button type="button" class="photo-preview__btn" data-action="photo-change">${ICON.camera(16)} ${hasImage ? 'Đổi ảnh' : 'Thêm ảnh'}</button>
    </div>`;
  }

  const types = DB.ITEM_TYPES.map((t) => `
    <button type="button" class="chip" aria-pressed="${t === f.type}" data-action="pick-type" data-value="${esc(t)}">${esc(t)}</button>`).join('');
  const colors = COLORS.map((c) => `
    <button type="button" class="swatch" aria-label="${c.name}" aria-pressed="${c.name === f.color}" data-action="pick-color" data-value="${c.name}"><span style="background:${c.hex}"></span></button>`).join('');
  const cats = S.categories.map((c) => `
    <button type="button" class="chip" aria-pressed="${f.categoryIds.includes(c.id)}" data-action="toggle-cat" data-value="${esc(c.id)}">${esc(c.name)}</button>`).join('');

  const stepper = isEdit ? `
    <div class="field" style="gap:8px">
      <span id="solan" class="label">Số lần đã mặc</span>
      <div class="stepper" role="group" aria-labelledby="solan">
        <button type="button" class="stepper__btn" aria-label="Giảm 1 lần" data-action="wear-dec" ${f.wearCount <= 0 ? 'disabled' : ''}>${ICON.minus}</button>
        <div class="stepper__value" aria-live="polite"><span class="stepper__num tnum">${f.wearCount}</span><span class="hint">lần</span></div>
        <button type="button" class="stepper__btn stepper__btn--plus" aria-label="Tăng 1 lần" data-action="wear-inc">${ICON.plus(18)}</button>
      </div>
      <span class="hint hint--small">Chỉnh tay nếu bạn quên ghi lần mặc trước đó.</span>
    </div>` : '';

  return `<div class="screen screen--form">
    <header class="form-head">
      <button type="button" class="icon-btn" aria-label="Quay lại" data-action="back" data-fallback="${isEdit ? 'mon/' + encodeURIComponent(f.id) : 'tu-do'}">${ICON.back}</button>
      <h1 class="title-lg">${isEdit ? 'Sửa món đồ' : 'Thêm món đồ'}</h1>
      <span class="spacer-44"></span>
    </header>
    ${photo}
    <div class="field" style="gap:8px">
      <label for="item-name" class="label">Tên món đồ</label>
      <input id="item-name" class="input" type="text" maxlength="60" placeholder="Ví dụ: Áo sơ mi trắng" value="${esc(f.name)}" autocomplete="off" enterkeyhint="done">
    </div>
    ${stepper}
    <div class="field">
      <span class="label">Loại</span>
      <div class="chip-wrap" role="group" aria-label="Loại">${types}</div>
    </div>
    <div class="field">
      <div class="field__head">
        <span class="label">Màu sắc</span>
        ${f.colorError && !f.color ? '<span class="error-text" style="font-size:13px">Hãy chọn một màu</span>' : `<span class="hint">${f.color ? 'Đã chọn: ' + esc(f.color) : 'Chưa chọn'}</span>`}
      </div>
      <div class="swatches" role="group" aria-label="Màu sắc">${colors}</div>
    </div>
    <div class="field">
      <div class="field__head">
        <span class="label">Danh mục</span>
        <span class="hint">Chọn được nhiều</span>
      </div>
      <div class="chip-wrap" role="group" aria-label="Danh mục">
        ${cats}
        <button type="button" class="chip chip--add" data-action="add-cat">${ICON.plus(14)}Thêm</button>
      </div>
    </div>
  </div>
  <div class="actionbar">
    <button type="button" class="btn btn--primary btn--lg" data-action="save-item" ${f.photoBusy || f.saving ? 'disabled' : ''}>${isEdit ? 'Lưu thay đổi' : 'Lưu món đồ'}</button>
  </div>`;
}

/** Gắn ảnh mới (đã nén) vào form. */
function setFormImage(blob) {
  const f = S.form;
  if (f.previewURL) URL.revokeObjectURL(f.previewURL);
  f.imageBlob = blob;
  f.previewURL = blob ? URL.createObjectURL(blob) : null;
  f.imageChanged = true;
}

/** Xử lý file ảnh người dùng vừa chọn/chụp: thu nhỏ, nén rồi hiện xem trước. */
async function handlePhotoFile(file) {
  const f = S.form;
  if (!file || !f) return;
  f.photoBusy = true;
  render();
  try {
    const blob = await ImageTools.processPhoto(file);
    if (S.form === f) setFormImage(blob);
  } catch (err) {
    showError(err, 'Không xử lý được ảnh này.');
  } finally {
    f.photoBusy = false;
    if (S.form === f) render();
  }
}

/** Mở bảng chọn: chụp lại, chọn từ thư viện, xóa ảnh. */
function openPhotoMenu() {
  const f = S.form;
  const hasImage = !!(f.previewURL || f.imageBlob);
  const sheet = openModal(`<div class="sheet sheet--menu" role="dialog" aria-label="Ảnh món đồ">
    <span class="sheet__grip"></span>
    <button type="button" class="menu-item" data-m="camera">${ICON.camera(20)} Chụp ảnh</button>
    <button type="button" class="menu-item" data-m="library">${ICON.image} Chọn từ thư viện</button>
    ${hasImage ? `<span class="menu-sep"></span><button type="button" class="menu-item menu-item--danger" data-m="remove">${ICON.trash(20)} Xóa ảnh</button>` : ''}
    <button type="button" class="btn" data-m="cancel">Hủy</button>
  </div>`);
  sheet.addEventListener('click', (e) => {
    const b = e.target.closest('[data-m]');
    if (!b) return;
    closeModal();
    if (b.dataset.m === 'camera') document.getElementById('input-camera').click();
    if (b.dataset.m === 'library') document.getElementById('input-library').click();
    if (b.dataset.m === 'remove') { setFormImage(null); render(); }
  });
}

/** Lưu món đồ (thêm mới hoặc cập nhật). */
async function saveItem(btn) {
  const f = S.form;
  if (!f || f.saving) return;
  const nameInput = document.getElementById('item-name');
  if (nameInput) f.name = nameInput.value;
  if (!f.color) {
    f.colorError = true;
    render();
    toast('Hãy chọn màu cho món đồ.', { error: true });
    return;
  }
  const name = f.name.trim() || `${f.type} ${f.color.toLowerCase()}`;
  f.saving = true;
  setBusy(btn, true, 'Đang lưu…');
  try {
    if (f.mode === 'add') {
      await DB.addItem({ name, type: f.type, color: f.color, categoryIds: f.categoryIds, imageBlob: f.imageBlob });
      await reload();
      toast(`Đã thêm “${name}” vào tủ`);
      goBack('tu-do');
    } else {
      const changes = { name, type: f.type, color: f.color, categoryIds: f.categoryIds, wearCount: Math.max(0, f.wearCount) };
      if (f.imageChanged) changes.imageBlob = f.imageBlob;
      await DB.updateItem(f.id, changes);
      if (f.imageChanged) ImageTools.forgetItemImage(f.id);
      await reload();
      toast('Đã lưu thay đổi');
      goBack('mon/' + encodeURIComponent(f.id));
    }
  } catch (err) {
    f.saving = false;
    setBusy(btn, false);
    showError(err, 'Không lưu được món đồ.');
  }
}

/* ============================ Màn Chi tiết ============================ */

/** Màn báo không tìm thấy (món đã bị xóa hoặc link sai). */
function viewNotFound() {
  return `<div class="screen screen--form">
    <header class="form-head">
      <button type="button" class="icon-btn" aria-label="Quay lại" data-action="back" data-fallback="tu-do">${ICON.back}</button>
      <span></span><span class="spacer-44"></span>
    </header>
    <div class="empty" style="margin:0"><h2 class="title-md">Không tìm thấy món đồ</h2><p>Món này có thể đã bị xóa.</p></div>
  </div>`;
}

/** Các outfit có chứa món đồ. */
function outfitsWith(itemId) {
  return S.outfits.filter((o) => (o.itemIds || []).includes(itemId));
}

/** Màn Chi tiết món đồ. */
function viewItemDetail(id) {
  const item = S.items.find((i) => i.id === id);
  if (!item) return viewNotFound();
  const worn = DB.isToday(item.lastWornAt);
  const outfits = outfitsWith(id);
  const tags = categoryNames(item.categoryIds).map((n) => `<span class="tag">${esc(n)}</span>`).join('');
  const sub = item.color ? `${esc(item.type)} · Màu ${esc(item.color.toLowerCase())}` : esc(item.type);

  const outfitCards = outfits.map((o) => {
    const tiles = o.itemIds.slice(0, 3).map((iid) => S.items.find((x) => x.id === iid)).filter(Boolean);
    return `<a class="outfit-card" href="#/sua-outfit/${encodeURIComponent(o.id)}" data-action="go" data-to="sua-outfit/${encodeURIComponent(o.id)}">
      <div class="outfit-card__tiles">${tiles.map((t) => thumbHTML(t)).join('')}</div>
      <div class="outfit-card__text">
        <span style="font-size:14px;font-weight:500">${esc(o.name)}</span>
        <span class="hint hint--small">${outfitWearLabel(o)}</span>
      </div>
    </a>`;
  }).join('');

  return `<div>
    <div class="detail-hero">
      ${thumbHTML(item)}
      <button type="button" class="icon-btn" aria-label="Quay lại" data-action="back" data-fallback="tu-do">${ICON.back}</button>
    </div>
    <div class="detail-body">
      <div style="display:flex;flex-direction:column;gap:8px">
        <span class="eyebrow">${sub}</span>
        <h1 class="detail-title">${esc(item.name)}</h1>
        ${tags ? `<div class="detail-tags">${tags}</div>` : ''}
      </div>
      <div class="stats">
        <div class="stat"><span class="stat__num stat__num--accent tnum">${item.wearCount || 0}</span><span class="stat__label">lần đã mặc</span></div>
        <div class="stat"><span class="stat__num tnum">${fmtShort(item.lastWornAt)}</span><span class="stat__label">mặc gần nhất</span></div>
        <div class="stat"><span class="stat__num tnum">${outfits.length}</span><span class="stat__label">outfit</span></div>
      </div>
      <button type="button" class="wear-btn" aria-pressed="${worn}" data-action="wear-toggle">
        ${worn ? `Đã mặc hôm nay ${ICON.check}` : `${ICON.check} Mặc hôm nay`}
      </button>
      <section style="display:flex;flex-direction:column;gap:12px">
        <h2 class="title-md" style="font-size:24px">${outfits.length ? `Có trong ${outfits.length} outfit` : 'Chưa có trong outfit nào'}</h2>
        ${outfits.length ? `<div class="outfit-grid">${outfitCards}</div>` : '<p class="hint">Phối món này với các món khác ở tab Outfit.</p>'}
      </section>
    </div>
  </div>
  <div class="actionbar">
    <button type="button" class="btn btn--primary btn--lg" data-action="go" data-to="sua/${encodeURIComponent(item.id)}">${ICON.edit(18)} Sửa</button>
    <button type="button" class="btn btn--lg btn--danger-outline" data-action="delete-item">${ICON.trash(18)} Xóa</button>
  </div>`;
}

/** Bấm nút "Mặc hôm nay" / "Đã mặc hôm nay ✓". */
function toggleWear(id) {
  const key = 'item:' + id;
  return exclusive(key, async () => {
    const item = S.items.find((i) => i.id === id);
    if (!item) return;
    if (DB.isToday(item.lastWornAt)) {
      // Bỏ đánh dấu bằng nút → đóng thanh Hoàn tác của món này để hai đường không chồng nhau
      hideToastFor(key);
      const back = item.previousLastWornAt ? `ngày mặc gần nhất trở về ${fmtShort(item.previousLastWornAt)}` : 'món sẽ trở lại “chưa mặc lần nào”';
      const ok = await confirmDialog({
        title: 'Bỏ đánh dấu mặc hôm nay?',
        text: `Số lần mặc sẽ trở về ${Math.max(0, item.wearCount - 1)}, ${back}.`,
        ok: 'Bỏ đánh dấu', cancel: 'Giữ nguyên', center: true
      });
      if (ok) await doUnmarkWear(id);
      return;
    }
    try {
      const updated = await DB.markWornToday(id);
      await reload();
      render();
      if (updated) {
        toast(`Đã ghi lần mặc thứ ${updated.wearCount}`, {
          actionLabel: 'Hoàn tác', onAction: () => unmarkWear(id), duration: 5000, owner: key
        });
      }
    } catch (err) {
      showError(err, 'Không ghi được lần mặc.');
      await reloadAndRender();
    }
  });
}

/** Bấm Hoàn tác trên thanh thông báo của món đồ. */
function unmarkWear(id) {
  return exclusive('item:' + id, () => doUnmarkWear(id));
}

/** Bỏ đánh dấu mặc hôm nay của món (gọi bên trong khóa của món). */
async function doUnmarkWear(id) {
  try {
    const res = await DB.unmarkWornToday(id);
    await reload();
    render();
    toast(res ? 'Đã bỏ đánh dấu' : 'Món này đã được bỏ đánh dấu rồi');
  } catch (err) {
    showError(err, 'Không bỏ đánh dấu được.');
    await reloadAndRender();
  }
}

/** Hỏi xác nhận rồi xóa món đồ. */
async function deleteItemFlow(id) {
  const item = S.items.find((i) => i.id === id);
  if (!item) return;
  const outfits = outfitsWith(id);
  const emptied = outfits.filter((o) => o.itemIds.length === 1).length;
  let text = 'Không thể hoàn tác.';
  if (outfits.length) {
    text = `Món này cũng sẽ bị gỡ khỏi ${outfits.length} outfit.` +
      (emptied ? ` ${emptied} outfit chỉ có món này sẽ bị xóa luôn.` : '') + ' Không thể hoàn tác.';
  }
  const ok = await confirmDialog({ title: `Xóa ${item.name}?`, text, ok: 'Xóa món đồ', cancel: 'Giữ lại', danger: true });
  if (!ok) return;
  try {
    await DB.deleteItem(id);
    ImageTools.forgetItemImage(id);
    await reload();
    toast(`Đã xóa “${item.name}”`);
    goBack('tu-do');
  } catch (err) {
    showError(err, 'Không xóa được món đồ.');
  }
}

/* ============================ Tab Outfit ============================ */

/** Dòng phụ số lần mặc của outfit. */
function outfitWearLabel(o) {
  return o.wearCount > 0 ? `Đã mặc ${o.wearCount} lần` : 'Chưa mặc lần nào';
}

/** Các món còn tồn tại trong outfit (theo thứ tự trong bộ). */
function outfitItems(o) {
  return (o.itemIds || []).map((id) => S.items.find((i) => i.id === id)).filter(Boolean);
}

/** Id danh mục còn tồn tại của outfit. */
function liveCategoryIds(o) {
  return (o.categoryIds || []).filter((id) => S.categories.some((c) => c.id === id));
}

/**
 * Outfit thuộc một danh mục, outfit được thêm vào danh mục gần nhất đứng trước
 * (dựa vào categoryAddedAt). Với "Chưa phân loại": outfit không có danh mục nào.
 */
function categoryMembers(catId) {
  if (catId === UNCATEGORIZED) {
    return S.outfits.filter((o) => liveCategoryIds(o).length === 0);
  }
  const addedAt = (o) => (o.categoryAddedAt && o.categoryAddedAt[catId]) || o.createdAt || '';
  return S.outfits
    .filter((o) => (o.categoryIds || []).includes(catId))
    .sort((a, b) => addedAt(b).localeCompare(addedAt(a)));
}

/**
 * Ảnh bìa 2x2 của album: lấy món từ outfit thêm vào danh mục gần nhất,
 * thiếu thì lấy thêm từ outfit kế tiếp; ô thiếu để trống.
 */
function albumCoverHTML(catId) {
  const picked = [];
  for (const o of categoryMembers(catId)) {
    for (const item of outfitItems(o)) {
      if (picked.length < 4 && !picked.includes(item)) picked.push(item);
    }
    if (picked.length >= 4) break;
  }
  const cells = picked.map((i) => thumbHTML(i));
  while (cells.length < 4) cells.push('<span class="album__blank"></span>');
  return `<span class="album__cover">${cells.join('')}</span>`;
}

/** Thẻ outfit lớn (dùng ở chế độ Tất cả và chi tiết danh mục). */
function outfitCardHTML(o) {
  const items = outfitItems(o);
  const tags = categoryNames(o.categoryIds);
  const worn = DB.isToday(o.lastWornAt);
  const link = `sua-outfit/${encodeURIComponent(o.id)}`;
  return `<article class="ocard">
    <a class="ocard__tiles" href="#/${link}" data-action="go" data-to="${link}" aria-label="Sửa outfit ${esc(o.name)}">
      ${items.slice(0, 4).map((i) => thumbHTML(i)).join('')}
    </a>
    <div class="ocard__body">
      <div class="ocard__head">
        <h2 class="ocard__name"><a href="#/${link}" data-action="go" data-to="${link}">${esc(o.name)}</a></h2>
        <span class="hint hint--small" style="white-space:nowrap">${outfitWearLabel(o)}</span>
      </div>
      <div class="detail-tags" style="padding:0">
        ${tags.length ? tags.map((n) => `<span class="tag">${esc(n)}</span>`).join('') : '<span class="tag tag--none">Chưa phân loại</span>'}
      </div>
    </div>
    <button type="button" class="ocard__wear" aria-pressed="${worn}" data-action="outfit-wear" data-value="${esc(o.id)}">
      ${worn ? `${ICON.check} Đã mặc hôm nay` : 'Hôm nay mặc bộ này'}
    </button>
  </article>`;
}

/** Trạng thái trống khi chưa có outfit nào. */
function noOutfitsHTML() {
  if (S.items.length === 0) {
    return `<div class="empty">
      <span class="empty__icon">${ICON.shirt(28)}</span>
      <h2 class="title-md">Chưa có outfit nào</h2>
      <p>Thêm vài món vào tủ đồ trước, rồi phối chúng thành outfit.</p>
      <button type="button" class="btn btn--primary" data-action="go" data-to="them">${ICON.plus(18)} Thêm món đồ</button>
    </div>`;
  }
  return `<div class="empty">
    <span class="empty__icon">${ICON.shirt(28)}</span>
    <h2 class="title-md">Chưa có outfit nào</h2>
    <p>Phối các món trong tủ thành một bộ để mặc nhanh mỗi sáng.</p>
    <button type="button" class="btn btn--primary" data-action="go" data-to="tao-outfit">${ICON.plus(18)} Tạo outfit</button>
  </div>`;
}

/** Tab Outfit: chế độ Danh mục (lưới album) hoặc Tất cả (danh sách thẻ). */
function viewOutfits() {
  const mode = S.outfitMode;
  const modes = [['cat', 'Danh mục'], ['all', 'Tất cả']].map(([k, label]) =>
    `<button type="button" role="tab" aria-selected="${mode === k}" data-action="outfit-mode" data-value="${k}">${label}</button>`).join('');

  let body;
  if (mode === 'all') {
    body = S.outfits.length
      ? `<div class="ocard-list">${S.outfits.map(outfitCardHTML).join('')}</div>`
      : noOutfitsHTML();
  } else {
    const albums = S.categories.map((c) => ({ id: c.id, name: c.name }));
    if (categoryMembers(UNCATEGORIZED).length) albums.push({ id: UNCATEGORIZED, name: 'Chưa phân loại' });
    body = `<div class="album-grid">
      ${albums.map((a) => `
        <a class="album" href="#/danh-muc/${encodeURIComponent(a.id)}" data-action="go" data-to="danh-muc/${encodeURIComponent(a.id)}">
          ${albumCoverHTML(a.id)}
          <span class="album__text">
            <span class="album__name">${esc(a.name)}</span>
            <span class="hint hint--small">${categoryMembers(a.id).length} bộ</span>
          </span>
        </a>`).join('')}
      <button type="button" class="album album--new" data-action="outfit-cat-create">
        <span class="empty__icon" style="width:48px;height:48px">${ICON.plus(22)}</span>
        <span style="font-size:14px;font-weight:600">Tạo danh mục</span>
      </button>
    </div>`;
  }

  return `<div class="screen screen--outfit">
    <div class="head-stack">
      <header class="page-head__text">
        <span class="eyebrow">${S.outfits.length} bộ · ${S.categories.length} danh mục</span>
        <h1 class="title-xl">Outfit</h1>
      </header>
      <div class="segmented" role="tablist" aria-label="Chế độ xem">${modes}</div>
    </div>
    ${body}
  </div>`;
}

/** Màn chi tiết một danh mục (hoặc "Chưa phân loại"). */
function viewCategoryDetail(id) {
  const isNone = id === UNCATEGORIZED;
  const cat = S.categories.find((c) => c.id === id);
  if (!isNone && !cat) {
    return `<div class="screen screen--outfit">
      <div class="head-stack"><div><button type="button" class="icon-btn" aria-label="Quay lại" data-action="back" data-fallback="outfit">${ICON.back}</button></div></div>
      <div class="empty"><h2 class="title-md">Không tìm thấy danh mục</h2><p>Danh mục này có thể đã bị xóa.</p></div>
    </div>`;
  }
  const members = categoryMembers(id);
  const empty = isNone
    ? '<div class="empty-dashed"><h2 class="title-md">Không còn outfit nào</h2><p>Mọi outfit đều đã có danh mục.</p></div>'
    : '<div class="empty-dashed"><h2 class="title-md">Danh mục còn trống</h2><p>Bấm “Thêm outfit vào danh mục” để chọn từ các bộ đã lưu.</p></div>';

  return `<div class="screen screen--outfit">
    <div class="head-stack" style="padding-top:0">
      <div style="display:flex;justify-content:space-between;align-items:center">
        <button type="button" class="icon-btn" aria-label="Quay lại danh mục" data-action="back" data-fallback="outfit">${ICON.back}</button>
        ${isNone ? '' : `<button type="button" class="icon-btn" aria-label="Tùy chọn danh mục" data-action="outfit-cat-menu" data-value="${esc(id)}">${ICON.dotsH}</button>`}
      </div>
      <header class="page-head__text" style="gap:4px">
        <span class="eyebrow">Danh mục</span>
        <h1 class="title-xl">${esc(isNone ? 'Chưa phân loại' : cat.name)}</h1>
        <span class="hint" style="font-size:14px">${members.length} bộ</span>
      </header>
      ${isNone ? '' : `<button type="button" class="btn btn--outline-accent" data-action="outfit-picker" data-value="${esc(id)}">${ICON.plus(16)} Thêm outfit vào danh mục</button>`}
    </div>
    ${members.length ? `<div class="ocard-list">${members.map(outfitCardHTML).join('')}</div>` : empty}
  </div>`;
}

/** Bấm "Hôm nay mặc bộ này" / "Đã mặc hôm nay". */
function toggleOutfitWear(id) {
  const key = 'outfit:' + id;
  return exclusive(key, async () => {
    const o = S.outfits.find((x) => x.id === id);
    if (!o) return;
    if (DB.isToday(o.lastWornAt)) {
      // Bỏ đánh dấu bằng nút → đóng thanh Hoàn tác của outfit này để hai đường không chồng nhau
      hideToastFor(key);
      const k = (o.lastWearItemIds || []).length;
      const ok = await confirmDialog({
        title: 'Bỏ đánh dấu mặc hôm nay?',
        text: `Outfit trở về ${Math.max(0, o.wearCount - 1)} lần mặc` + (k ? `, ${k} món trong bộ cũng được trừ lại 1 lần.` : '.'),
        ok: 'Bỏ đánh dấu', cancel: 'Giữ nguyên', center: true
      });
      if (ok) await doUnmarkOutfitWear(id);
      return;
    }
    try {
      const res = await DB.markOutfitWornToday(id);
      await reload();
      render();
      if (!res) return;
      const total = outfitItems(res.outfit).length;
      const skipped = total - res.addedItems;
      toast(`Đã ghi lần mặc thứ ${res.outfit.wearCount}` + (skipped > 0 ? ` · ${skipped} món đã ghi hôm nay` : ''),
        { actionLabel: 'Hoàn tác', onAction: () => unmarkOutfitWear(id), duration: 5000, owner: key });
    } catch (err) {
      showError(err, 'Không ghi được lần mặc.');
      await reloadAndRender();
    }
  });
}

/** Bấm Hoàn tác trên thanh thông báo của outfit. */
function unmarkOutfitWear(id) {
  return exclusive('outfit:' + id, () => doUnmarkOutfitWear(id));
}

/** Hoàn tác lần mặc hôm nay của outfit (gọi bên trong khóa của outfit). */
async function doUnmarkOutfitWear(id) {
  try {
    const res = await DB.unmarkOutfitWornToday(id);
    await reload();
    render();
    toast(res ? 'Đã bỏ đánh dấu' : 'Outfit này đã được bỏ đánh dấu rồi');
  } catch (err) {
    showError(err, 'Không bỏ đánh dấu được.');
    await reloadAndRender();
  }
}

/** Bảng "Thêm vào “Danh mục”": tích chọn các outfit đã lưu. */
function openOutfitPicker(catId) {
  const cat = S.categories.find((c) => c.id === catId);
  if (!cat) return;
  const selected = new Set(categoryMembers(catId).map((o) => o.id));
  const rows = S.outfits.map((o) => {
    const names = categoryNames(o.categoryIds);
    return `<button type="button" class="pick-row" aria-pressed="${selected.has(o.id)}" data-pick="${esc(o.id)}">
      <span class="pick-row__tiles">${outfitItems(o).slice(0, 3).map((i) => thumbHTML(i)).join('')}</span>
      <span class="pick-row__text"><span style="font-size:15px;font-weight:500">${esc(o.name)}</span><span class="hint hint--small">${esc(names.length ? names.join(' · ') : 'Chưa phân loại')}</span></span>
      <span class="checkbox" aria-hidden="true">${ICON.checkSmall}</span>
    </button>`;
  }).join('');
  const sheet = openModal(`<div class="sheet sheet--picker" role="dialog" aria-labelledby="pk-title">
    <span class="sheet__grip"></span>
    <div class="sheet__head" style="align-items:flex-start;padding:0 24px">
      <div style="display:flex;flex-direction:column;gap:2px">
        <h2 id="pk-title" class="title-md" style="font-size:28px;line-height:1.1">Thêm vào “${esc(cat.name)}”</h2>
        <span class="hint">Tích chọn các outfit đã lưu</span>
      </div>
      <button type="button" class="icon-btn icon-btn--plain" aria-label="Đóng" data-m="close">${ICON.close}</button>
    </div>
    ${S.outfits.length
      ? `<div class="pick-list">${rows}</div>
         <div style="padding:4px 24px 0"><button type="button" class="btn btn--primary btn--lg btn--block" data-m="save">Lưu · ${selected.size} bộ</button></div>`
      : `<div style="padding:0 24px;display:flex;flex-direction:column;gap:12px">
           <p class="sheet__text">Bạn chưa lưu outfit nào.</p>
           <button type="button" class="btn btn--primary btn--lg" data-m="create">${ICON.plus(18)} Tạo outfit</button>
         </div>`}
  </div>`);
  sheet.addEventListener('click', async (e) => {
    const row = e.target.closest('[data-pick]');
    if (row) {
      const id = row.dataset.pick;
      if (selected.has(id)) selected.delete(id); else selected.add(id);
      row.setAttribute('aria-pressed', selected.has(id));
      sheet.querySelector('[data-m="save"]').textContent = `Lưu · ${selected.size} bộ`;
      return;
    }
    const b = e.target.closest('[data-m]');
    if (!b) return;
    if (b.dataset.m === 'close') closeModal();
    if (b.dataset.m === 'create') { closeModal(); navigate('tao-outfit/' + encodeURIComponent(catId)); }
    if (b.dataset.m === 'save') {
      setBusy(b, true, 'Đang lưu…');
      try {
        await DB.setCategoryOutfits(catId, [...selected]);
        closeModal();
        await reload();
        render();
        toast('Đã cập nhật danh mục');
      } catch (err) {
        setBusy(b, false);
        showError(err, 'Không cập nhật được danh mục.');
      }
    }
  });
}

/* ---------------------------- Tạo / Sửa outfit ---------------------------- */

/** Màn Tạo/Sửa outfit: xem trước, chọn món theo nhóm, tên, danh mục. */
function viewOutfitForm() {
  const f = S.oform;
  if (!f) {
    return `<div class="screen screen--form">
      <header class="form-head"><button type="button" class="icon-btn" aria-label="Quay lại" data-action="back" data-fallback="outfit">${ICON.back}</button><span></span><span class="spacer-44"></span></header>
      <div class="empty" style="margin:0"><h2 class="title-md">Không tìm thấy outfit</h2><p>Outfit này có thể đã bị xóa.</p></div>
    </div>`;
  }
  const isEdit = f.mode === 'edit';
  const chosen = f.itemIds.map((id) => S.items.find((i) => i.id === id)).filter(Boolean);

  // Ô xem trước: món đã chọn theo từng nhóm; nhóm chưa chọn thì hiện ô trống
  const slots = OUTFIT_GROUPS.map((g) => {
    const inGroup = chosen.filter((i) => g.types.includes(i.type));
    if (!inGroup.length) {
      return `<button type="button" class="slot slot--empty" data-action="oform-tab" data-value="${g.key}">${ICON.plus(20)}<span>${g.hint}</span></button>`;
    }
    return inGroup.map((i) => `<div class="slot">${thumbHTML(i)}</div>`).join('');
  }).join('');

  const tabs = OUTFIT_GROUPS.map((g) => {
    const done = chosen.some((i) => g.types.includes(i.type));
    return `<button type="button" role="tab" aria-selected="${f.tab === g.key}" data-action="oform-tab" data-value="${g.key}">${g.label}${done ? '<span class="dot"></span>' : ''}</button>`;
  }).join('');

  const group = OUTFIT_GROUPS.find((g) => g.key === f.tab);
  const options = S.items.filter((i) => group.types.includes(i.type));
  const optionsHTML = options.length
    ? `<div class="option-row hs">${options.map((i) => `
        <button type="button" class="option" aria-pressed="${f.itemIds.includes(i.id)}" data-action="oform-item" data-value="${esc(i.id)}">
          <span class="option__img">${thumbHTML(i)}<span class="option__check">${ICON.checkSmall}</span></span>
          <span class="option__name">${esc(i.name)}</span>
        </button>`).join('')}</div>`
    : `<div class="option-empty">
        <span class="hint">Tủ chưa có ${group.types.map((t) => t.toLowerCase()).join(' hoặc ')}.</span>
        <button type="button" class="link-btn" data-action="go" data-to="them">Thêm món đồ</button>
      </div>`;

  const cats = S.categories.map((c) => `
    <button type="button" class="chip" aria-pressed="${f.categoryIds.includes(c.id)}" data-action="oform-cat" data-value="${esc(c.id)}">${esc(c.name)}</button>`).join('');

  const count = chosen.length;
  return `<div class="screen screen--oform">
    <header class="form-head" style="padding:0 24px">
      <button type="button" class="icon-btn" aria-label="Quay lại" data-action="back" data-fallback="outfit">${ICON.back}</button>
      <h1 class="title-lg">${isEdit ? 'Sửa outfit' : 'Tạo outfit'}</h1>
      <span class="spacer-44"></span>
    </header>
    <section class="preview" aria-label="Xem trước">${slots}</section>
    <div class="segmented segmented--4" role="tablist" aria-label="Chọn theo loại">${tabs}</div>
    ${optionsHTML}
    <div class="field" style="gap:8px;padding:0 24px">
      <label for="outfit-name" class="label">Tên outfit</label>
      <input id="outfit-name" class="input" type="text" maxlength="60" placeholder="Ví dụ: Thứ Hai đi làm" value="${esc(f.name)}" autocomplete="off" enterkeyhint="done">
    </div>
    <div class="field" style="padding:0 24px">
      <div class="field__head"><span class="label">Danh mục</span><span class="hint">Chọn được nhiều</span></div>
      <div class="chip-wrap" role="group" aria-label="Danh mục">
        ${cats}
        <button type="button" class="chip chip--add" data-action="oform-add-cat">${ICON.plus(14)}Thêm</button>
      </div>
    </div>
  </div>
  <div class="actionbar">
    <button type="button" class="btn btn--primary btn--lg" data-action="oform-save" ${count && !f.saving ? '' : 'disabled'}>${isEdit ? 'Lưu thay đổi' : 'Lưu outfit'} · ${count} món</button>
    ${isEdit ? `<button type="button" class="btn btn--lg btn--danger-outline" data-action="oform-delete">${ICON.trash(18)} Xóa</button>` : ''}
  </div>`;
}

/** Giữ lại tên outfit đang gõ trước khi vẽ lại form. */
function keepOutfitName() {
  const input = document.getElementById('outfit-name');
  if (input && S.oform) S.oform.name = input.value;
}

/** Lưu outfit (tạo mới hoặc cập nhật). */
async function saveOutfit(btn) {
  const f = S.oform;
  if (!f || f.saving) return;
  keepOutfitName();
  const itemIds = f.itemIds.filter((id) => S.items.some((i) => i.id === id));
  if (!itemIds.length) {
    toast('Hãy chọn ít nhất 1 món cho outfit.', { error: true });
    return;
  }
  const name = f.name.trim() || `Outfit ${fmtShort(DB.nowISO())}`;
  f.saving = true;
  setBusy(btn, true, 'Đang lưu…');
  try {
    if (f.mode === 'add') {
      await DB.addOutfit({ name, itemIds, categoryIds: f.categoryIds });
      toast(`Đã lưu outfit “${name}”`);
    } else {
      await DB.updateOutfit(f.id, { name, itemIds, categoryIds: f.categoryIds });
      toast('Đã lưu thay đổi');
    }
    await reload();
    goBack('outfit');
  } catch (err) {
    f.saving = false;
    setBusy(btn, false);
    showError(err, 'Không lưu được outfit.');
  }
}

/** Hỏi xác nhận rồi xóa outfit (các món đồ không bị xóa). */
async function deleteOutfitFlow() {
  const f = S.oform;
  const o = f && S.outfits.find((x) => x.id === f.id);
  if (!o) return;
  const ok = await confirmDialog({
    title: `Xóa ${o.name}?`,
    text: 'Các món đồ trong outfit vẫn giữ nguyên trong tủ. Không thể hoàn tác.',
    ok: 'Xóa outfit', cancel: 'Giữ lại', danger: true
  });
  if (!ok) return;
  try {
    await DB.deleteOutfit(o.id);
    await reload();
    toast(`Đã xóa outfit “${o.name}”`);
    goBack('outfit');
  } catch (err) {
    showError(err, 'Không xóa được outfit.');
  }
}

/* ============================ Tab Gợi ý (giai đoạn 3) ============================ */

/** Tab Gợi ý — chưa làm (giai đoạn 3), chỉ hiện "Sắp ra mắt". */
function viewSuggest() {
  const chips = [{ id: 'all', name: 'Tất cả' }, ...S.categories].map((c) => `
    <button type="button" class="chip" aria-pressed="${S.suggestChip === c.id}" data-action="suggest-chip" data-value="${esc(c.id)}">${esc(c.name)}</button>`).join('');
  return `<div class="screen">
    <header class="page-head">
      <div class="page-head__text">
        <span class="eyebrow">Phối từ ${S.items.length} món bạn có</span>
        <h1 class="title-xl">Gợi ý</h1>
      </div>
    </header>
    <div class="chip-row hs" role="group" aria-label="Chọn dịp">${chips}</div>
    <div class="empty">
      <span class="empty__icon">${ICON.sparkle(28)}</span>
      <span class="soon-pill">Sắp ra mắt</span>
      <p>Fitpick sẽ gợi ý bộ đồ theo dịp từ chính tủ đồ của bạn, ưu tiên món lâu chưa mặc.</p>
    </div>
  </div>`;
}

/* ============================ Màn Cài đặt ============================ */

/** Số món và số outfit thuộc một danh mục. */
function categoryCounts(id) {
  return {
    items: S.items.filter((i) => (i.categoryIds || []).includes(id)).length,
    outfits: S.outfits.filter((o) => (o.categoryIds || []).includes(id)).length
  };
}

/** Màn Cài đặt: sao lưu, danh mục, thống kê, hướng dẫn cài app. */
function viewSettings() {
  const m = S.meta;
  let backupNote = m.lastBackupAt
    ? `Lần sao lưu gần nhất: ${fmtDate(m.lastBackupAt)} lúc ${fmtTime(m.lastBackupAt)}`
    : 'Chưa sao lưu lần nào';
  if (m.itemsAddedSinceBackup > 0 && m.lastBackupAt) backupNote += ` · ${m.itemsAddedSinceBackup} món mới chưa sao lưu`;

  const cats = S.categories.map((c) => {
    const n = categoryCounts(c.id);
    return `<li class="cat-row" data-id="${esc(c.id)}">
      <button type="button" class="cat-row__handle" aria-label="Kéo để sắp xếp ${esc(c.name)}" data-drag="${esc(c.id)}">${ICON.grip}</button>
      <button type="button" class="cat-row__main" data-action="cat-menu" data-value="${esc(c.id)}">
        <span class="cat-row__text"><span class="cat-row__name">${esc(c.name)}</span><span class="cat-row__meta">${n.items} món · ${n.outfits} outfit</span></span>
        ${ICON.chevron}
      </button>
    </li>`;
  }).join('');

  // Thống kê nhanh
  const byType = DB.ITEM_TYPES.map((t) => [t, S.items.filter((i) => i.type === t).length]).filter(([, n]) => n > 0);
  const breakdown = byType.map(([t, n]) => `${n} ${t.toLowerCase()}`).join(' · ');
  const top = S.items.reduce((best, i) => ((i.wearCount || 0) > ((best && best.wearCount) || 0) ? i : best), null);
  const unworn = S.items.filter((i) => !i.wearCount).sort((a, b) => (a.createdAt || '').localeCompare(b.createdAt || ''));

  const stats = S.items.length === 0
    ? '<div class="panel"><p>Thêm món đồ để xem thống kê tủ đồ của bạn.</p></div>'
    : `<div class="stat-total">
        <span class="stat-total__num tnum">${S.items.length}</span>
        <div class="stat-total__text"><span style="font-size:15px;font-weight:600">món trong tủ</span><span class="hint hint--small" style="line-height:1.45">${esc(breakdown)}</span></div>
      </div>
      ${top ? `<a class="stat-row" href="#/mon/${encodeURIComponent(top.id)}" data-action="go" data-to="mon/${encodeURIComponent(top.id)}">
        <div class="stat-row__img">${thumbHTML(top)}</div>
        <div style="flex:1;display:flex;flex-direction:column;gap:2px;min-width:0"><span class="kicker">Mặc nhiều nhất</span><span style="font-size:15px;font-weight:600">${esc(top.name)}</span></div>
        <span class="stat-row__num tnum">${top.wearCount}<small> lần</small></span>
      </a>` : `<div class="stat-row"><div style="display:flex;flex-direction:column;gap:2px"><span class="kicker">Mặc nhiều nhất</span><span class="hint">Chưa ghi lần mặc nào. Bấm “Mặc hôm nay” ở chi tiết món đồ.</span></div></div>`}
      ${unworn.length ? `<div class="list-panel">
        <span class="kicker" style="padding:4px 4px 0">Chưa mặc lần nào · ${unworn.length} món</span>
        ${unworn.map((u) => `<a class="list-row" href="#/mon/${encodeURIComponent(u.id)}" data-action="go" data-to="mon/${encodeURIComponent(u.id)}">
          <div class="list-row__img">${thumbHTML(u)}</div>
          <div class="list-row__text"><span style="font-size:15px;font-weight:500">${esc(u.name)}</span><span class="hint hint--small">Thêm vào tủ ${fmtDate(u.createdAt)}</span></div>
          ${ICON.chevron}
        </a>`).join('')}
      </div>` : ''}`;

  const step = (n, html) => `<li><span>${n}</span><span>${html}</span></li>`;

  return `<div class="screen screen--settings">
    <header style="padding:0 8px"><h1 class="title-xl">Cài đặt</h1></header>

    <section class="panel">
      <h2 class="title-md">Sao lưu dữ liệu</h2>
      <p style="margin-bottom:4px">Tủ đồ chỉ lưu trên điện thoại này. Xuất bản sao lưu định kỳ để không mất ảnh và outfit.</p>
      <button type="button" class="btn btn--primary" data-action="export">${ICON.download} Xuất bản sao lưu</button>
      <button type="button" class="btn" data-action="import">${ICON.upload} Nhập bản sao lưu</button>
      <span class="backup-note">${esc(backupNote)}</span>
    </section>

    <section class="section">
      <div class="section__head">
        <h2 class="title-md">Danh mục</h2>
        <span class="hint hint--small">Giữ biểu tượng ⠿ để kéo</span>
      </div>
      <div class="cat-list-wrap">
        <ul class="cat-list" aria-label="Danh sách danh mục">${cats}</ul>
        <button type="button" class="btn btn--dashed" data-action="cat-add">${ICON.plus(16)} Thêm danh mục</button>
      </div>
    </section>

    <section class="section">
      <h2 class="title-md" style="padding:0 8px">Thống kê nhanh</h2>
      ${stats}
    </section>

    <section class="section">
      <h2 class="title-md" style="padding:0 8px">Cài app lên điện thoại</h2>
      <div class="guide">
        <div class="guide__head"><span class="guide__icon">${ICON.phone}</span><span style="display:flex;flex-direction:column;gap:1px"><span style="font-size:15px;font-weight:600">iPhone</span><span class="hint hint--small">Dùng trình duyệt Safari</span></span></div>
        <ol>
          ${step(1, 'Mở trang Fitpick bằng <b>Safari</b>')}
          ${step(2, `Bấm nút <b>Chia sẻ</b> ${ICON.share}`)}
          ${step(3, 'Chọn <b>Thêm vào MH chính</b>')}
        </ol>
      </div>
      <div class="guide">
        <div class="guide__head"><span class="guide__icon">${ICON.phone}</span><span style="display:flex;flex-direction:column;gap:1px"><span style="font-size:15px;font-weight:600">Android</span><span class="hint hint--small">Dùng trình duyệt Chrome</span></span></div>
        <ol>
          ${step(1, 'Mở trang Fitpick bằng <b>Chrome</b>')}
          ${step(2, `Bấm menu ${ICON.dots} ở góc trên`)}
          ${step(3, 'Chọn <b>Thêm vào màn hình chính</b>')}
        </ol>
      </div>
    </section>

    <p class="version">Fitpick · phiên bản ${APP_VERSION}</p>
  </div>`;
}

/** Bảng thao tác khi bấm vào một danh mục: Đổi tên / Xóa. */
function openCategoryMenu(id, { fromOutfitTab = false } = {}) {
  const cat = S.categories.find((c) => c.id === id);
  if (!cat) return;
  const n = categoryCounts(id);
  // Ở tab Outfit chỉ nói về outfit (theo thiết kế 4c); ở Cài đặt nói cả món và outfit
  const meta = fromOutfitTab ? `${n.outfits} bộ` : `${n.items} món · ${n.outfits} outfit`;
  const keepNote = fromOutfitTab ? 'Các outfit sẽ không bị xóa' : 'Các món và outfit sẽ không bị xóa';
  const sheet = openModal(`<div class="sheet sheet--menu" role="dialog" aria-labelledby="cm-title">
    <span class="sheet__grip"></span>
    <div class="menu-head">
      <span class="eyebrow">Danh mục · ${meta}</span>
      <h2 id="cm-title" class="title-md" style="font-size:28px">${esc(cat.name)}</h2>
    </div>
    <button type="button" class="menu-item" data-m="rename">${ICON.edit(20)} Đổi tên</button>
    <span class="menu-sep"></span>
    <button type="button" class="menu-item menu-item--danger" data-m="delete">${ICON.trash(20)}
      <span><span style="display:block">Xóa danh mục</span><span class="menu-item__sub">${keepNote}</span></span>
    </button>
    <button type="button" class="btn" data-m="cancel">Hủy</button>
  </div>`);
  sheet.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-m]');
    if (!b) return;
    closeModal();
    if (b.dataset.m === 'rename') {
      openNameSheet({
        title: 'Đổi tên danh mục', initial: cat.name, excludeId: id,
        onSave: async (name) => {
          await DB.renameCategory(id, name);
          toast(`Đã đổi tên thành “${name}”`);
        }
      });
    }
    if (b.dataset.m === 'delete') {
      try {
        await DB.deleteCategory(id);
        await reload();
        toast(`Đã xóa danh mục “${cat.name}”`);
        // Đang ở màn chi tiết của danh mục vừa xóa thì quay về lưới album
        if (parseRoute().name === 'danh-muc') goBack('outfit'); else render();
      } catch (err) {
        showError(err, 'Không xóa được danh mục.');
      }
    }
  });
}

/**
 * Bảng nhập tên danh mục (dùng cho Thêm và Đổi tên).
 * onSave(name) được gọi khi bấm Lưu; lỗi trong onSave sẽ hiện ngay trong bảng.
 */
function openNameSheet({ title, initial = '', excludeId = null, note = '', onSave }) {
  const sheet = openModal(`<div class="sheet" role="dialog" aria-labelledby="ns-title">
    <span class="sheet__grip"></span>
    <div class="sheet__head">
      <h2 id="ns-title" class="title-md" style="font-size:28px">${esc(title)}</h2>
      <button type="button" class="icon-btn icon-btn--plain" aria-label="Đóng" data-m="close">${ICON.close}</button>
    </div>
    <div class="field" style="gap:8px">
      <label for="ns-name" class="label">Tên danh mục</label>
      <input id="ns-name" class="input" style="background:var(--bg)" type="text" maxlength="24" placeholder="Ví dụ: Đi biển" value="${esc(initial)}" autocomplete="off" enterkeyhint="done">
      <span class="error-text" id="ns-error" hidden>Đã có danh mục tên này.</span>
      ${note ? `<span class="hint hint--small">${esc(note)}</span>` : ''}
    </div>
    <button type="button" class="btn btn--primary btn--lg" data-m="save">Lưu</button>
  </div>`);
  const input = sheet.querySelector('#ns-name');
  const error = sheet.querySelector('#ns-error');
  const save = sheet.querySelector('[data-m="save"]');

  // Kiểm tra trùng tên ngay khi gõ
  const validate = () => {
    const name = input.value.trim();
    const dup = !!name && S.categories.some((c) => c.id !== excludeId && c.name.toLowerCase() === name.toLowerCase());
    error.textContent = 'Đã có danh mục tên này.';
    error.hidden = !dup;
    input.classList.toggle('is-invalid', dup);
    save.disabled = !name || dup || name === initial.trim();
    return !save.disabled;
  };
  const submit = async () => {
    if (!validate()) return;
    setBusy(save, true, 'Đang lưu…');
    try {
      await onSave(input.value.trim());
      closeModal();
      await reloadAndRender();
    } catch (err) {
      setBusy(save, false);
      error.textContent = err && err.name === 'DBError' ? err.message : 'Không lưu được danh mục.';
      error.hidden = false;
      console.error(err);
    }
  };
  input.addEventListener('input', validate);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); submit(); } });
  sheet.addEventListener('click', (e) => {
    const b = e.target.closest('[data-m]');
    if (!b) return;
    if (b.dataset.m === 'close') closeModal();
    if (b.dataset.m === 'save') submit();
  });
  validate();
  setTimeout(() => input.focus(), 50);
}

/**
 * Kéo để sắp xếp danh mục: giữ biểu tượng ⠿ rồi kéo lên/xuống.
 * Bàn phím: chọn biểu tượng ⠿ rồi bấm mũi tên lên/xuống.
 */
function bindCategoryDrag() {
  const list = $app.querySelector('.cat-list');
  if (!list) return;
  let drag = null;

  const rows = () => [...list.querySelectorAll('.cat-row')];

  const finish = async (from, to) => {
    if (to === from) return;
    const ids = S.categories.map((c) => c.id);
    const [moved] = ids.splice(from, 1);
    ids.splice(to, 0, moved);
    S.categories = ids.map((id) => S.categories.find((c) => c.id === id));
    render();
    try {
      await DB.reorderCategories(ids);
      toast('Đã sắp xếp lại danh mục');
    } catch (err) {
      showError(err, 'Không lưu được thứ tự danh mục.');
      await reloadAndRender();
    }
  };

  list.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('[data-drag]');
    if (!handle || drag) return;
    const all = rows();
    const row = handle.closest('.cat-row');
    const from = all.indexOf(row);
    const h = row.getBoundingClientRect().height;
    drag = { row, all, from, to: from, h, y0: e.clientY, id: e.pointerId };
    try { handle.setPointerCapture(e.pointerId); } catch (_) { /* bỏ qua */ }
    row.classList.add('is-dragging');
    all.forEach((r) => { if (r !== row) r.classList.add('is-shifting'); });
    e.preventDefault();
  });

  list.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { row, all, from, h } = drag;
    const dy = Math.max(-from * h, Math.min((all.length - 1 - from) * h, e.clientY - drag.y0));
    row.style.transform = `translateY(${dy}px)`;
    const to = Math.max(0, Math.min(all.length - 1, from + Math.round(dy / h)));
    drag.to = to;
    all.forEach((r, i) => {
      if (r === row) return;
      let shift = 0;
      if (from < to && i > from && i <= to) shift = -h;
      if (from > to && i < from && i >= to) shift = h;
      r.style.transform = shift ? `translateY(${shift}px)` : '';
    });
  });

  const end = (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const { from, to, all } = drag;
    drag = null;
    all.forEach((r) => { r.style.transform = ''; r.classList.remove('is-dragging', 'is-shifting'); });
    finish(from, to);
  };
  list.addEventListener('pointerup', end);
  list.addEventListener('pointercancel', end);

  list.addEventListener('keydown', (e) => {
    const handle = e.target.closest('[data-drag]');
    if (!handle || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const from = S.categories.findIndex((c) => c.id === handle.dataset.drag);
    const to = from + (e.key === 'ArrowUp' ? -1 : 1);
    if (to < 0 || to >= S.categories.length) return;
    finish(from, to).then(() => {
      const again = $app.querySelector(`[data-drag="${CSS.escape(handle.dataset.drag)}"]`);
      if (again) again.focus();
    });
  });
}

/* ============================ Sao lưu ============================ */

/** Bấm "Xuất bản sao lưu" / "Sao lưu ngay". */
async function exportFlow(btn) {
  if (btn && btn.classList.contains('is-busy')) return;
  setBusy(btn, true, 'Đang tạo bản sao lưu…');
  try {
    const file = await Backup.build();
    await deliverBackup(file);
  } catch (err) {
    showError(err, 'Không tạo được bản sao lưu.');
  } finally {
    setBusy(btn, false);
  }
}

/** Gửi file sao lưu cho người dùng rồi ghi nhận đã sao lưu. */
async function deliverBackup(file) {
  let result;
  try {
    result = await Backup.deliver(file);
  } catch (err) {
    if (err && err.name === 'NotAllowedError') {
      // Trình duyệt chặn vì tạo file quá lâu sau khi bấm — cho bấm lại để chia sẻ.
      openReadySheet(file);
      return;
    }
    throw err;
  }
  if (result === 'cancelled') {
    toast('Đã hủy sao lưu');
    return;
  }
  await Backup.markDone();
  await reload();
  render();
  toast(result === 'shared' ? 'Đã sao lưu xong' : `Đã tải xuống ${file.name}`);
}

/** Hộp "Bản sao lưu đã sẵn sàng" — bấm để chia sẻ/lưu file. */
function openReadySheet(file) {
  const sheet = openModal(`<div class="sheet" role="dialog" aria-labelledby="rs-title">
    <span class="sheet__grip"></span>
    <h2 id="rs-title" class="title-md" style="font-size:28px">Bản sao lưu đã sẵn sàng</h2>
    <p class="sheet__text">Bấm nút dưới để lưu file <b>${esc(file.name)}</b> vào Tệp, Google Drive hoặc gửi cho chính bạn.</p>
    <div class="sheet__actions">
      <button type="button" class="btn btn--primary btn--lg" data-m="share">${ICON.download} Lưu / chia sẻ file</button>
      <button type="button" class="btn btn--lg" data-m="cancel">Để sau</button>
    </div>
  </div>`);
  sheet.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-m]');
    if (!b) return;
    closeModal();
    if (b.dataset.m === 'share') {
      try {
        await deliverBackup(file);
      } catch (err) {
        showError(err, 'Không lưu được file sao lưu.');
      }
    }
  });
}

/** Người dùng chọn file sao lưu: kiểm tra, hỏi Gộp/Thay thế rồi nhập. */
async function importFlow(file) {
  let data;
  try {
    data = await Backup.parse(file);
  } catch (err) {
    showError(err, 'File sao lưu không hợp lệ.');
    return;
  }
  const when = data.exportedAt ? ` (tạo ngày ${fmtDate(data.exportedAt)})` : '';
  const sheet = openModal(`<div class="sheet" role="dialog" aria-labelledby="im-title">
    <span class="sheet__grip"></span>
    <h2 id="im-title" class="title-md" style="font-size:28px">Nhập bản sao lưu</h2>
    <p class="sheet__text">File có <b>${data.items.length} món</b>, <b>${data.outfits.length} outfit</b> và <b>${data.categories.length} danh mục</b>${when}. Bạn muốn nhập thế nào?</p>
    <div class="sheet__actions">
      <button type="button" class="btn btn--primary btn--lg" data-m="merge">Gộp thêm</button>
      <span class="hint hint--small" style="text-align:center;margin-top:-4px">Giữ dữ liệu hiện có, chỉ thêm những gì chưa có.</span>
      <button type="button" class="btn btn--lg btn--danger-outline" data-m="replace">Thay thế toàn bộ</button>
      <button type="button" class="btn btn--lg" data-m="cancel">Hủy</button>
    </div>
  </div>`);
  sheet.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-m]');
    if (!b) return;
    closeModal();
    const mode = b.dataset.m;
    if (mode === 'cancel') return;
    if (mode === 'replace' && S.items.length + S.outfits.length > 0) {
      const ok = await confirmDialog({
        title: 'Thay thế toàn bộ?',
        text: `${S.items.length} món và ${S.outfits.length} outfit hiện có trên máy sẽ bị xóa và thay bằng dữ liệu trong file. Không thể hoàn tác.`,
        ok: 'Thay thế', cancel: 'Hủy', danger: true
      });
      if (!ok) return;
    }
    try {
      const added = await Backup.restore(data, mode);
      await reload();
      render();
      toast(mode === 'replace'
        ? `Đã khôi phục ${added.items} món, ${added.outfits} outfit`
        : `Đã gộp thêm ${added.items} món, ${added.outfits} outfit, ${added.categories} danh mục`);
    } catch (err) {
      showError(err, 'Không nhập được bản sao lưu.');
    }
  });
}

/* ============================ Toast & hộp thoại ============================ */

let toastTimer = null;
let toastOwner = null; // thao tác sở hữu thanh thông báo hiện tại (ví dụ 'item:<id>')

/**
 * Hiện thông báo nhỏ phía dưới. Có thể kèm nút (ví dụ "Hoàn tác").
 * Tự ẩn sau `duration` mili giây.
 */
function toast(message, { actionLabel, onAction, duration = 3000, error = false, owner = null } = {}) {
  clearTimeout(toastTimer);
  toastOwner = owner;
  $toastRoot.innerHTML = `<div class="toast ${error ? 'toast--error' : ''}" role="${error ? 'alert' : 'status'}">
    <span class="toast__msg">${esc(message)}</span>
    ${actionLabel ? `<button type="button" class="toast__action">${esc(actionLabel)}</button>` : ''}
  </div>`;
  const btn = $toastRoot.querySelector('.toast__action');
  if (btn) {
    btn.addEventListener('click', () => {
      hideToast();
      onAction && onAction();
    }, { once: true });
  }
  toastTimer = setTimeout(hideToast, duration);
}

/** Ẩn thông báo nhỏ. */
function hideToast() {
  clearTimeout(toastTimer);
  toastOwner = null;
  $toastRoot.innerHTML = '';
}

/** Ẩn thanh thông báo nếu nó thuộc về đúng thao tác `owner` (ví dụ thanh Hoàn tác của món này). */
function hideToastFor(owner) {
  if (owner && toastOwner === owner) hideToast();
}

/* Khóa theo từng món/outfit: mỗi lúc chỉ một thao tác ghi/bỏ lần mặc được chạy. */
const runningKeys = new Set();

/**
 * Chạy fn() nếu chưa có thao tác nào cùng `key` đang chạy; nếu đang chạy thì bỏ qua lần bấm này.
 * Nhờ vậy nút Hoàn tác, nút bấm lại và bấm đúp không thể chồng lên nhau.
 */
async function exclusive(key, fn) {
  if (runningKeys.has(key)) {
    console.info('[Fitpick] Bỏ qua thao tác trùng khi đang xử lý', key);
    return;
  }
  runningKeys.add(key);
  try {
    return await fn();
  } finally {
    runningKeys.delete(key);
  }
}

let modalCleanup = null;

/**
 * Mở hộp thoại/bảng trượt. Bấm ra ngoài hoặc phím Esc để đóng.
 * Trả về phần tử nội dung để gắn sự kiện.
 */
function openModal(innerHTML, { center = false, onClose } = {}) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'overlay' + (center ? ' overlay--center' : '');
  overlay.innerHTML = innerHTML;
  $modalRoot.appendChild(overlay);
  document.body.classList.add('modal-open');
  const lastFocus = document.activeElement;
  const onKey = (e) => { if (e.key === 'Escape') closeModal(); };
  overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });
  document.addEventListener('keydown', onKey);
  modalCleanup = () => {
    document.removeEventListener('keydown', onKey);
    overlay.remove();
    document.body.classList.remove('modal-open');
    if (lastFocus && lastFocus.focus && document.contains(lastFocus)) lastFocus.focus();
    onClose && onClose();
  };
  const first = overlay.querySelector('button, input');
  if (first && !first.matches('input')) setTimeout(() => first.focus({ preventScroll: true }), 30);
  return overlay.firstElementChild;
}

/** Đóng hộp thoại đang mở (nếu có). */
function closeModal() {
  if (modalCleanup) {
    const fn = modalCleanup;
    modalCleanup = null;
    fn();
  }
}

/**
 * Hộp xác nhận. center = true: hộp giữa màn hình; false: bảng trượt từ dưới.
 * Trả về Promise<boolean>.
 */
function confirmDialog({ title, text, ok = 'Đồng ý', cancel = 'Hủy', danger = false, center = false }) {
  return new Promise((resolve) => {
    let answered = false;
    const answer = (v) => { if (!answered) { answered = true; resolve(v); } };
    const body = center
      ? `<div class="dialog" role="alertdialog" aria-labelledby="cd-title" aria-describedby="cd-text">
          <h2 id="cd-title" class="title-md">${esc(title)}</h2>
          <p id="cd-text">${esc(text)}</p>
          <div class="dialog__actions">
            <button type="button" class="btn" data-m="no">${esc(cancel)}</button>
            <button type="button" class="btn ${danger ? 'btn--danger' : 'btn--primary'}" data-m="yes">${esc(ok)}</button>
          </div>
        </div>`
      : `<div class="sheet" role="alertdialog" aria-labelledby="cd-title" aria-describedby="cd-text" style="padding-top:28px;gap:10px">
          <h2 id="cd-title" class="title-md" style="font-size:28px">${esc(title)}</h2>
          <p id="cd-text" class="sheet__text" style="margin-bottom:12px">${esc(text)}</p>
          <button type="button" class="btn btn--lg ${danger ? 'btn--danger' : 'btn--primary'}" data-m="yes">${esc(ok)}</button>
          <button type="button" class="btn btn--lg" data-m="no">${esc(cancel)}</button>
        </div>`;
    const el = openModal(body, { center, onClose: () => answer(false) });
    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-m]');
      if (!b) return;
      answer(b.dataset.m === 'yes');
      closeModal();
    });
  });
}

/* ============================ Sự kiện ============================ */

/** Các hành động gắn với thuộc tính data-action trên nút. */
const ACTIONS = {
  go: (el, e) => { e.preventDefault(); navigate(el.dataset.to); },
  back: (el) => goBack(el.dataset.fallback || 'tu-do'),
  filter: (el) => {
    S.filter = el.dataset.value;
    render();
  },
  'toggle-search': () => {
    S.searchOpen = !S.searchOpen;
    if (!S.searchOpen) S.search = '';
    S.focusSearch = S.searchOpen;
    render();
  },
  'banner-close': () => {
    try { localStorage.setItem('fitpick.bannerHiddenOn', DB.dayKey()); } catch (_) { /* bỏ qua */ }
    render();
  },
  export: (el) => exportFlow(el),
  import: () => document.getElementById('input-backup').click(),
  'photo-camera': () => document.getElementById('input-camera').click(),
  'photo-library': () => document.getElementById('input-library').click(),
  'photo-change': () => openPhotoMenu(),
  'pick-type': (el) => { keepName(); S.form.type = el.dataset.value; render(); },
  'pick-color': (el) => { keepName(); S.form.color = el.dataset.value; render(); },
  'toggle-cat': (el) => {
    keepName();
    const ids = S.form.categoryIds;
    const id = el.dataset.value;
    S.form.categoryIds = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    render();
  },
  'add-cat': () => {
    keepName();
    const form = S.form;
    openNameSheet({
      title: 'Thêm danh mục',
      onSave: async (name) => {
        const cat = await DB.addCategory(name);
        if (S.form === form) form.categoryIds.push(cat.id);
        toast(`Đã thêm danh mục “${name}”`);
      }
    });
  },
  'wear-dec': () => { keepName(); S.form.wearCount = Math.max(0, S.form.wearCount - 1); render(); },
  'wear-inc': () => { keepName(); S.form.wearCount += 1; render(); },
  'save-item': (el) => saveItem(el),
  'wear-toggle': () => toggleWear(parseRoute().id),
  'delete-item': () => deleteItemFlow(parseRoute().id),
  'cat-menu': (el) => openCategoryMenu(el.dataset.value),
  'cat-add': () => openNameSheet({
    title: 'Thêm danh mục',
    onSave: async (name) => {
      await DB.addCategory(name);
      toast(`Đã thêm danh mục “${name}”`);
    }
  }),
  'suggest-chip': (el) => { S.suggestChip = el.dataset.value; render(); },

  // --- Tab Outfit ---
  'outfit-mode': (el) => { S.outfitMode = el.dataset.value; render(); },
  'outfit-wear': (el) => toggleOutfitWear(el.dataset.value),
  'outfit-cat-create': () => openNameSheet({
    title: 'Tạo danh mục mới',
    onSave: async (name) => {
      await DB.addCategory(name);
      toast(`Đã tạo danh mục “${name}”`);
    }
  }),
  'outfit-cat-menu': (el) => openCategoryMenu(el.dataset.value, { fromOutfitTab: true }),
  'outfit-picker': (el) => openOutfitPicker(el.dataset.value),

  // --- Màn Tạo/Sửa outfit ---
  'oform-tab': (el) => { keepOutfitName(); S.oform.tab = el.dataset.value; render(); },
  'oform-item': (el) => {
    keepOutfitName();
    const ids = S.oform.itemIds;
    const id = el.dataset.value;
    S.oform.itemIds = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    render();
  },
  'oform-cat': (el) => {
    keepOutfitName();
    const ids = S.oform.categoryIds;
    const id = el.dataset.value;
    S.oform.categoryIds = ids.includes(id) ? ids.filter((x) => x !== id) : [...ids, id];
    render();
  },
  'oform-add-cat': () => {
    keepOutfitName();
    const form = S.oform;
    openNameSheet({
      title: 'Tạo danh mục mới',
      note: 'Danh mục mới sẽ được chọn sẵn cho outfit này.',
      onSave: async (name) => {
        const cat = await DB.addCategory(name);
        if (S.oform === form) form.categoryIds.push(cat.id);
        toast(`Đã tạo danh mục “${name}”`);
      }
    });
  },
  'oform-save': (el) => saveOutfit(el),
  'oform-delete': () => deleteOutfitFlow()
};

/** Giữ lại tên đang gõ trước khi vẽ lại form. */
function keepName() {
  const input = document.getElementById('item-name');
  if (input && S.form) S.form.name = input.value;
}

/** Gắn các sự kiện dùng chung cho toàn app (chỉ chạy một lần). */
function bindGlobalEvents() {
  $app.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el || !$app.contains(el)) return;
    const fn = ACTIONS[el.dataset.action];
    if (fn) fn(el, e);
  });

  $app.addEventListener('input', (e) => {
    if (e.target.id === 'search-input') {
      S.search = e.target.value;
      document.getElementById('wardrobe-grid').innerHTML = wardrobeGridHTML();
    }
    if (e.target.id === 'item-name' && S.form) S.form.name = e.target.value;
    if (e.target.id === 'outfit-name' && S.oform) S.oform.name = e.target.value;
  });

  $app.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && ['item-name', 'outfit-name', 'search-input'].includes(e.target.id)) {
      e.preventDefault();
      e.target.blur();
    }
  });

  $tabbar.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (tab) switchTab(tab.dataset.tab);
  });

  $fab.addEventListener('click', () => {
    const route = parseRoute();
    if (route.name === 'outfit') navigate('tao-outfit');
    // Đang xem một danh mục thì outfit mới được chọn sẵn danh mục đó
    else if (route.name === 'danh-muc') navigate('tao-outfit' + (route.id !== UNCATEGORIZED ? '/' + encodeURIComponent(route.id) : ''));
    else navigate('them');
  });

  const onPhoto = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (file) handlePhotoFile(file);
  };
  document.getElementById('input-camera').addEventListener('change', onPhoto);
  document.getElementById('input-library').addEventListener('change', onPhoto);
  document.getElementById('input-backup').addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (file) importFlow(file);
  });

  window.addEventListener('popstate', () => render());

  // Ảnh món đồ không tải được → thử tạo lại URL, rồi mới dùng hình minh họa (sự kiện error không nổi bọt nên bắt ở pha capture)
  document.addEventListener('error', (e) => {
    const img = e.target;
    if (img && img.tagName === 'IMG' && img.dataset.itemId) onImageError(img);
  }, true);

  // Món nào vừa được ghi lại thì lần vẽ tới tạo URL ảnh mới (xem image.js)
  DB.onItemsWritten((ids) => ImageTools.markStale(ids));

  // Quay lại app sau một thời gian (có thể đã sang ngày mới): vẽ lại trạng thái "Mặc hôm nay".
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && !modalCleanup && !S.form && !S.oform) render();
  });
}

/** Đăng ký service worker để chạy offline và nhận bản cập nhật. */
function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js').catch((err) => console.warn('Không đăng ký được service worker', err));
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    // Lần đầu cài thì không cần báo; chỉ báo khi thay bản cũ bằng bản mới.
    if (!hadController) return;
    toast('Đã có bản Fitpick mới', { actionLabel: 'Tải lại', onAction: () => location.reload(), duration: 15000 });
  });
}

/** Khởi động app: mở database, đọc dữ liệu, vẽ màn đầu tiên. */
async function init() {
  bindGlobalEvents();
  try {
    await DB.open();
    await reload();
  } catch (err) {
    console.error(err);
    const msg = err && err.name === 'DBError' ? err.message : 'Không mở được dữ liệu tủ đồ.';
    $app.innerHTML = `<div class="screen"><div class="empty">
      <h2 class="title-md">Không mở được tủ đồ</h2>
      <p>${esc(msg)}</p>
      <button type="button" class="btn btn--primary" onclick="location.reload()">Thử lại</button>
    </div></div>`;
    return;
  }
  if (!history.state) history.replaceState({ depth: 0 }, '', location.hash || '#/tu-do');
  render();
  registerServiceWorker();
  // Xin trình duyệt giữ dữ liệu lâu dài (giảm nguy cơ bị tự xóa khi máy đầy bộ nhớ).
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
}

init();
