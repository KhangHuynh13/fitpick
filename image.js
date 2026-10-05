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

  /* Bộ nhớ đệm object URL cho ảnh món đồ, tránh tạo lại mỗi lần vẽ màn hình. */
  const urlCache = new Map();

  /**
   * Lấy URL hiển thị cho ảnh của món đồ (tạo một lần, dùng lại).
   * Khi món đổi ảnh hoặc bị xóa, gọi forgetItemImage() để tạo lại.
   */
  function itemImageURL(item) {
    if (!item || !item.imageBlob) return null;
    let url = urlCache.get(item.id);
    if (!url) {
      url = URL.createObjectURL(item.imageBlob);
      urlCache.set(item.id, url);
    }
    return url;
  }

  /** Giải phóng URL của món đồ đã xóa/đổi ảnh. */
  function forgetItemImage(id) {
    const url = urlCache.get(id);
    if (url) { URL.revokeObjectURL(url); urlCache.delete(id); }
  }

  /** Giải phóng toàn bộ URL (sau khi nhập bản sao lưu). */
  function forgetAllImages() {
    urlCache.forEach((url) => URL.revokeObjectURL(url));
    urlCache.clear();
  }

  return { processPhoto, blobToDataURL, dataURLToBlob, itemImageURL, forgetItemImage, forgetAllImages };
})();
