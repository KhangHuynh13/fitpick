/* =========================================================================
   image.js — Xử lý ảnh món đồ
   Thu nhỏ ảnh (cạnh dài tối đa 800px), nén JPEG ~0.8, chuyển đổi base64.
   ========================================================================= */
'use strict';

const ImageTools = (() => {
  const MAX_SIDE = 800;
  const JPEG_QUALITY = 0.8;
  // Màu kem nền app (thiết kế) — tô dưới ảnh để vùng trong suốt không bị đen khi nén JPEG
  const BACKGROUND = '#F7F3EC';

  /** Nạp một File/Blob ảnh thành thẻ <img> đã giải mã xong. */
  function loadImage(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Không đọc được ảnh này. Hãy thử ảnh JPEG hoặc PNG khác.'));
      };
      img.src = url;
    });
  }

  /** Chuyển canvas thành Blob JPEG. */
  function canvasToJpeg(canvas, quality) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Không nén được ảnh.'))), 'image/jpeg', quality);
    });
  }

  /**
   * Thu nhỏ ảnh người dùng chọn: cạnh dài tối đa 800px, nén JPEG chất lượng 0.8.
   * Trình duyệt hiện đại tự xoay ảnh theo EXIF khi vẽ lên canvas.
   * Nền màu kem được tô trước để ảnh PNG trong suốt không bị đen.
   */
  async function processPhoto(file) {
    if (!file) throw new Error('Chưa chọn ảnh.');
    if (file.type && !file.type.startsWith('image/')) {
      throw new Error('File này không phải ảnh.');
    }
    try {
      const img = await loadImage(file);
      const w = img.naturalWidth;
      const h = img.naturalHeight;
      if (!w || !h) throw new Error('Ảnh bị lỗi hoặc rỗng.');
      const scale = Math.min(1, MAX_SIDE / Math.max(w, h));
      const cw = Math.max(1, Math.round(w * scale));
      const ch = Math.max(1, Math.round(h * scale));
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = BACKGROUND;
      ctx.fillRect(0, 0, cw, ch);
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, cw, ch);
      return await canvasToJpeg(canvas, JPEG_QUALITY);
    } catch (err) {
      console.error(err);
      throw new Error(err && err.message ? err.message : 'Không xử lý được ảnh.');
    }
  }

  /** Blob → chuỗi data URL base64 (dùng khi xuất sao lưu). */
  function blobToDataURL(blob) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('Không đọc được ảnh để sao lưu.'));
      r.readAsDataURL(blob);
    });
  }

  /** Chuỗi data URL base64 → Blob (dùng khi nhập sao lưu). */
  function dataURLToBlob(dataURL) {
    const m = /^data:([^;,]+)?(;base64)?,(.*)$/s.exec(dataURL || '');
    if (!m || !m[2]) throw new Error('Ảnh trong file sao lưu không hợp lệ.');
    const bin = atob(m[3]);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: m[1] || 'image/jpeg' });
  }

  /*
   * Bộ nhớ đệm object URL cho ảnh món đồ, theo id món: id → { url, old: [url cũ] }.
   *
   * Vì sao cần "làm mới": trên Safari/iPhone, Blob đọc từ IndexedDB trỏ tới một file trên đĩa.
   * Khi bản ghi món đồ được ghi lại (ví dụ "Mặc hôm nay" đổi wearCount), Safari thay file đó,
   * nên URL tạo từ Blob cũ không còn đọc được → hiện dấu "?". Vì vậy sau mỗi lần ghi một món,
   * markStale() đánh dấu để lần vẽ tới tạo URL mới từ Blob vừa đọc lại.
   *
   * URL cũ KHÔNG bị revoke ngay (có thể ảnh vẫn đang hiển thị); chỉ revoke khi món bị xóa
   * hoặc đổi ảnh (forgetItemImage) hoặc khi nhập bản sao lưu (forgetAllImages).
   */
  const urlCache = new Map();
  const stale = new Set();

  /** Tạo URL mới cho món, giữ URL cũ lại để revoke sau. */
  function setURL(id, blob) {
    const entry = urlCache.get(id) || { url: null, old: [] };
    if (entry.url) entry.old.push(entry.url);
    entry.url = URL.createObjectURL(blob);
    urlCache.set(id, entry);
    stale.delete(id);
    return entry.url;
  }

  /** Lấy URL hiển thị cho ảnh của món đồ (dùng lại URL đã tạo nếu còn mới). */
  function itemImageURL(item) {
    if (!item || !item.imageBlob) return null;
    const entry = urlCache.get(item.id);
    if (entry && entry.url && !stale.has(item.id)) return entry.url;
    return setURL(item.id, item.imageBlob);
  }

  /** Đánh dấu các món vừa được ghi lại: lần vẽ tới sẽ tạo URL mới cho chúng. */
  function markStale(ids) {
    (ids || []).forEach((id) => { if (urlCache.has(id)) stale.add(id); });
  }

  /** Tạo lại URL từ Blob mới đọc (dùng khi ảnh báo lỗi tải). */
  function renewItemImage(id, blob) {
    return blob ? setURL(id, blob) : null;
  }

  /** Giải phóng mọi URL của món đồ đã xóa/đổi ảnh. */
  function forgetItemImage(id) {
    const entry = urlCache.get(id);
    if (entry) {
      [entry.url, ...entry.old].forEach((u) => u && URL.revokeObjectURL(u));
      urlCache.delete(id);
    }
    stale.delete(id);
  }

  /** Giải phóng toàn bộ URL (sau khi nhập bản sao lưu). */
  function forgetAllImages() {
    [...urlCache.keys()].forEach(forgetItemImage);
  }

  return {
    processPhoto, blobToDataURL, dataURLToBlob,
    itemImageURL, markStale, renewItemImage, forgetItemImage, forgetAllImages
  };
})();
