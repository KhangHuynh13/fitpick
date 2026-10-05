/* =========================================================================
   backup.js — Sao lưu và khôi phục tủ đồ
   File sao lưu là JSON, ảnh được chuyển sang base64 (data URL).
   ========================================================================= */
'use strict';

const Backup = (() => {
  // Tăng số này khi đổi định dạng file sao lưu; parse() phải đọc được cả bản cũ.
  const FORMAT_VERSION = 1;
  const APP_ID = 'fitpick';

  /** Tên file dạng fitpick-backup-YYYY-MM-DD.json (theo ngày trên máy). */
  function fileName() {
    return `fitpick-backup-${DB.dayKey()}.json`;
  }

  /**
   * Tạo file sao lưu từ toàn bộ dữ liệu trong máy.
   * Trả về một đối tượng File (application/json).
   */
  async function build() {
    const data = await DB.exportAll();
    const items = [];
    for (const it of data.items) {
      const copy = Object.assign({}, it);
      delete copy.imageBlob;
      copy.image = it.imageBlob ? await ImageTools.blobToDataURL(it.imageBlob) : null;
      items.push(copy);
    }
    const payload = {
      app: APP_ID,
      formatVersion: FORMAT_VERSION,
      dbVersion: DB.DB_VERSION,
      exportedAt: DB.nowISO(),
      categories: data.categories,
      items,
      outfits: data.outfits,
      meta: data.meta
    };
    const json = JSON.stringify(payload);
    return new File([json], fileName(), { type: 'application/json' });
  }

  /** Thiết bị cảm ứng (điện thoại/máy tính bảng) — ưu tiên chia sẻ file. */
  function isMobile() {
    return (window.matchMedia && matchMedia('(pointer: coarse)').matches) ||
      /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  }

  /** Có thể chia sẻ file này qua navigator.share không. */
  function canShareFile(file) {
    try {
      return isMobile() && !!navigator.canShare && navigator.canShare({ files: [file] });
    } catch (_) {
      return false;
    }
  }

  /** Tải file xuống bằng thẻ <a download>. */
  function download(file) {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = file.name;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 30000);
  }

  /**
   * Gửi file sao lưu cho người dùng: chia sẻ (điện thoại) hoặc tải xuống.
   * Trả về 'shared' | 'downloaded' | 'cancelled'.
   * Ném lỗi có name = 'NotAllowedError' nếu trình duyệt đòi phải bấm lại nút.
   */
  async function deliver(file) {
    if (canShareFile(file)) {
      try {
        await navigator.share({ files: [file], title: 'Sao lưu Fitpick' });
        return 'shared';
      } catch (err) {
        if (err && err.name === 'AbortError') return 'cancelled';
        if (err && err.name === 'NotAllowedError') throw err;
        console.warn('Chia sẻ lỗi, chuyển sang tải xuống', err);
      }
    }
    download(file);
    return 'downloaded';
  }

  /** Ghi nhận đã sao lưu: cập nhật lastBackupAt, đưa bộ đếm món mới về 0. */
  function markDone() {
    return DB.setMeta({ lastBackupAt: DB.nowISO(), itemsAddedSinceBackup: 0 });
  }

  /** Đọc nội dung chữ của file người dùng chọn. */
  function readText(file) {
    return new Promise((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(r.result);
      r.onerror = () => reject(new Error('Không đọc được file.'));
      r.readAsText(file);
    });
  }

  const isStr = (v) => typeof v === 'string' && v.length > 0;
  const strOrNull = (v) => (typeof v === 'string' && v ? v : null);
  const strArr = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  const count = (v) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);

  /**
   * Đọc và kiểm tra file sao lưu. Báo lỗi dễ hiểu nếu file không hợp lệ.
   * Trả về dữ liệu đã chuẩn hóa (ảnh đã chuyển lại thành Blob), sẵn sàng để ghi.
   */
  async function parse(file) {
    if (!file) throw new Error('Chưa chọn file.');
    let raw;
    try {
      raw = JSON.parse(await readText(file));
    } catch (_) {
      throw new Error('File này không phải bản sao lưu Fitpick (không đọc được JSON).');
    }
    if (!raw || typeof raw !== 'object' || raw.app !== APP_ID) {
      throw new Error('File này không phải bản sao lưu Fitpick.');
    }
    if (!Number.isInteger(raw.formatVersion) || raw.formatVersion < 1) {
      throw new Error('File sao lưu thiếu số phiên bản định dạng.');
    }
    if (raw.formatVersion > FORMAT_VERSION) {
      throw new Error('File sao lưu được tạo từ bản Fitpick mới hơn. Hãy tải lại app rồi thử lại.');
    }
    if (!Array.isArray(raw.categories) || !Array.isArray(raw.items) || !Array.isArray(raw.outfits)) {
      throw new Error('File sao lưu bị thiếu dữ liệu.');
    }

    const categories = raw.categories.map((c, i) => {
      if (!c || !isStr(c.id) || !isStr(c.name)) throw new Error(`Danh mục thứ ${i + 1} trong file bị lỗi.`);
      return { id: c.id, name: c.name.trim(), order: Number.isFinite(c.order) ? c.order : i };
    });

    const items = raw.items.map((it, i) => {
      if (!it || !isStr(it.id) || typeof it.name !== 'string') throw new Error(`Món đồ thứ ${i + 1} trong file bị lỗi.`);
      let imageBlob = null;
      if (it.image) {
        try {
          imageBlob = ImageTools.dataURLToBlob(it.image);
        } catch (_) {
          throw new Error(`Ảnh của món "${it.name}" trong file bị lỗi.`);
        }
      }
      return {
        id: it.id,
        name: it.name,
        type: DB.ITEM_TYPES.includes(it.type) ? it.type : 'Phụ kiện',
        color: strOrNull(it.color),
        categoryIds: strArr(it.categoryIds),
        imageBlob,
        wearCount: count(it.wearCount),
        lastWornAt: strOrNull(it.lastWornAt),
        previousLastWornAt: strOrNull(it.previousLastWornAt),
        createdAt: strOrNull(it.createdAt) || DB.nowISO()
      };
    });

    const outfits = raw.outfits.map((o, i) => {
      if (!o || !isStr(o.id) || !Array.isArray(o.itemIds)) throw new Error(`Outfit thứ ${i + 1} trong file bị lỗi.`);
      const addedAt = {};
      if (o.categoryAddedAt && typeof o.categoryAddedAt === 'object') {
        Object.entries(o.categoryAddedAt).forEach(([k, v]) => { if (typeof v === 'string') addedAt[k] = v; });
      }
      return {
        id: o.id,
        name: typeof o.name === 'string' ? o.name : 'Outfit',
        itemIds: strArr(o.itemIds),
        categoryIds: strArr(o.categoryIds),
        categoryAddedAt: addedAt,
        wearCount: count(o.wearCount),
        lastWornAt: strOrNull(o.lastWornAt),
        previousLastWornAt: strOrNull(o.previousLastWornAt),
        lastWearItemIds: strArr(o.lastWearItemIds),
        createdAt: strOrNull(o.createdAt) || DB.nowISO()
      };
    });

    const m = raw.meta && typeof raw.meta === 'object' ? raw.meta : {};
    const meta = {
      lastBackupAt: strOrNull(m.lastBackupAt),
      itemsAddedSinceBackup: count(m.itemsAddedSinceBackup)
    };

    return { categories, items, outfits, meta, exportedAt: strOrNull(raw.exportedAt) };
  }

  /** Ghi dữ liệu đã kiểm tra vào máy. mode: 'merge' (gộp thêm) | 'replace' (thay thế). */
  async function restore(data, mode) {
    const added = await DB.importAll(data, mode);
    ImageTools.forgetAllImages();
    return added;
  }

  return { FORMAT_VERSION, build, deliver, download, markDone, parse, restore };
})();
