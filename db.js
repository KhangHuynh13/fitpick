/* =========================================================================
   db.js — Thao tác IndexedDB của Fitpick
   Mọi dữ liệu nằm trên máy người dùng. Không gọi server nào cả.
   ========================================================================= */
'use strict';

const DB = (() => {
  const DB_NAME = 'fitpick';
  // Tăng số này khi đổi cấu trúc database, rồi thêm một nhánh "case" trong upgrade().
  const DB_VERSION = 1;

  const DEFAULT_CATEGORIES = ['Đi làm', 'Đi chơi', 'Thể thao', 'Dự tiệc', 'Ở nhà'];
  const ITEM_TYPES = ['Áo', 'Quần', 'Váy/Đầm', 'Giày', 'Túi', 'Phụ kiện', 'Áo khoác'];
  const STORES = ['categories', 'items', 'outfits', 'meta'];

  let dbPromise = null;

  /** Lỗi dễ hiểu cho người dùng, giữ lại lỗi gốc để xem trong console. */
  class DBError extends Error {
    constructor(message, cause) {
      super(message);
      this.name = 'DBError';
      this.cause = cause;
    }
  }

  /** Tạo id mới. Dự phòng cho trình duyệt cũ không có crypto.randomUUID. */
  function newId() {
    if (crypto.randomUUID) return crypto.randomUUID();
    const b = crypto.getRandomValues(new Uint8Array(16));
    b[6] = (b[6] & 0x0f) | 0x40;
    b[8] = (b[8] & 0x3f) | 0x80;
    const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
    return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
  }

  /** Thời điểm hiện tại dạng chuỗi ISO. */
  function nowISO() {
    return new Date().toISOString();
  }

  /** Khóa ngày theo giờ địa phương (YYYY-MM-DD) để so sánh "cùng ngày". */
  function dayKey(value) {
    const d = value ? new Date(value) : new Date();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${d.getFullYear()}-${m}-${day}`;
  }

  /** Thời điểm có rơi vào hôm nay (theo giờ máy) không. */
  function isToday(value) {
    return !!value && dayKey(value) === dayKey();
  }

  /**
   * Nâng cấp database theo từng version. Mỗi "case" chỉ chạy một lần khi người
   * dùng nâng từ version cũ hơn, nên dữ liệu cũ không bị mất.
   */
  function upgrade(db, tx, oldVersion) {
    switch (oldVersion) {
      case 0: {
        const cats = db.createObjectStore('categories', { keyPath: 'id' });
        cats.createIndex('order', 'order');
        const items = db.createObjectStore('items', { keyPath: 'id' });
        items.createIndex('createdAt', 'createdAt');
        const outfits = db.createObjectStore('outfits', { keyPath: 'id' });
        outfits.createIndex('createdAt', 'createdAt');
        db.createObjectStore('meta', { keyPath: 'key' });

        // Danh mục mặc định
        DEFAULT_CATEGORIES.forEach((name, i) => cats.add({ id: newId(), name, order: i }));
        const meta = tx.objectStore('meta');
        meta.add({ key: 'lastBackupAt', value: null });
        meta.add({ key: 'itemsAddedSinceBackup', value: 0 });
      }
      // falls through
      // case 1: ví dụ cho version 2 — thêm index/trường mới ở đây, KHÔNG xóa store cũ.
    }
  }

  /** Mở (hoặc tạo) database. Gọi nhiều lần vẫn chỉ mở một kết nối. */
  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) {
        reject(new DBError('Trình duyệt này không hỗ trợ lưu dữ liệu (IndexedDB).'));
        return;
      }
      let req;
      try {
        req = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (err) {
        reject(new DBError('Không mở được dữ liệu. Nếu đang dùng chế độ ẩn danh, hãy mở trình duyệt bình thường.', err));
        return;
      }
      req.onupgradeneeded = (e) => upgrade(req.result, req.transaction, e.oldVersion);
      req.onsuccess = () => {
        const db = req.result;
        // Khi có tab khác mở bản mới hơn, đóng kết nối cũ để nó nâng cấp được.
        db.onversionchange = () => {
          db.close();
          dbPromise = null;
        };
        resolve(db);
      };
      req.onerror = () => reject(new DBError('Không mở được dữ liệu tủ đồ.', req.error));
      req.onblocked = () => reject(new DBError('Hãy đóng các tab Fitpick khác rồi mở lại app.'));
    });
    dbPromise.catch(() => { dbPromise = null; });
    return dbPromise;
  }

  /** Bọc một IDBRequest thành Promise. */
  function reqP(req) {
    return new Promise((resolve, reject) => {
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }

  /**
   * Chạy một hàm trong transaction. Promise chỉ xong khi transaction đã ghi xong
   * (oncomplete), nên dữ liệu chắc chắn đã lưu.
   */
  async function tx(storeNames, mode, work, errorMessage) {
    const db = await open();
    const base = errorMessage || 'Không đọc/ghi được dữ liệu.';
    return new Promise((resolve, reject) => {
      let result;
      let t;
      let settled = false;
      const fail = (cause) => {
        if (settled) return;
        settled = true;
        reject(cause instanceof DBError ? cause : failure(base, cause));
      };
      try {
        t = db.transaction(storeNames, mode);
      } catch (err) {
        fail(err);
        return;
      }
      t.oncomplete = () => { settled = true; resolve(result); };
      // Lúc sự kiện error xảy ra, t.error có thể còn null → lấy lỗi từ request gây ra lỗi
      t.onerror = (e) => fail((e && e.target && e.target.error) || t.error);
      t.onabort = () => fail(t.error);
      Promise.resolve()
        .then(() => work(t))
        .then((r) => { result = r; })
        .catch((err) => {
          try { t.abort(); } catch (_) { /* đã kết thúc */ }
          fail(err);
        });
    });
  }

  /**
   * Tạo lỗi dễ hiểu kèm lý do cụ thể; chi tiết kỹ thuật ghi vào console để dò lỗi.
   */
  function failure(message, cause) {
    console.error('[Fitpick DB]', message, cause && cause.name, cause && cause.message, cause);
    return new DBError(`${message} ${reasonText(cause)}`.trim(), cause);
  }

  /** Lý do cụ thể (tiếng Việt) theo loại lỗi của trình duyệt. */
  function reasonText(cause) {
    const name = cause && cause.name;
    const msg = String((cause && cause.message) || '');
    if (name === 'QuotaExceededError') return 'Bộ nhớ trình duyệt đã đầy — hãy xóa bớt món đồ hoặc giải phóng dung lượng máy.';
    if (name === 'UnknownError' || /blob|file/i.test(msg)) return 'Trình duyệt chưa ghi xong ảnh của món đồ — hãy thử lại sau vài giây.';
    if (name === 'InvalidStateError') return 'Kết nối dữ liệu đã bị đóng — hãy đóng hẳn app rồi mở lại.';
    if (name === 'TransactionInactiveError') return 'Thao tác bị gián đoạn — hãy thử lại.';
    if (name === 'VersionError') return 'Dữ liệu được tạo bởi bản Fitpick mới hơn — hãy tải lại app.';
    if (name) return `(Mã lỗi: ${name})`;
    return '';
  }

  /** Lỗi tạm thời của trình duyệt (nên thử lại), không phải lỗi logic của app. */
  function isTransient(err) {
    const name = err && err.cause && err.cause.name;
    return name === 'UnknownError' || name === 'TransactionInactiveError' || name === 'AbortError';
  }

  /**
   * Chạy một thao tác ghi; nếu gặp lỗi tạm thời của trình duyệt thì đợi một chút rồi thử lại 1 lần.
   * Transaction lỗi không ghi gì cả nên thử lại là an toàn.
   */
  async function withRetry(fn) {
    try {
      return await fn();
    } catch (err) {
      if (!isTransient(err)) throw err;
      console.warn('[Fitpick DB] Lỗi tạm thời, thử lại sau 400ms', err.cause);
      await new Promise((r) => setTimeout(r, 400));
      return fn();
    }
  }

  /**
   * Đọc ảnh vào bộ nhớ thành Blob mới (vẫn là Blob, không đổi cách lưu).
   * Lý do: trên Safari/iPhone, ghi lại một Blob vừa đọc ra từ IndexedDB — nhất là Blob vừa được
   * ghi ở thao tác trước — có thể lỗi "UnknownError", vì file ảnh cũ trên đĩa đã bị thay.
   * Ghi bản sao trong bộ nhớ giống hệt lúc thêm món mới, nên luôn ghi được.
   */
  async function memoryBlob(blob) {
    if (!blob) return null;
    try {
      const buffer = await blob.arrayBuffer();
      return new Blob([buffer], { type: blob.type || 'image/jpeg' });
    } catch (err) {
      console.warn('[Fitpick DB] Không đọc được ảnh vào bộ nhớ, ghi lại Blob gốc', err);
      return blob;
    }
  }

  /** Chuẩn bị bản sao ảnh trong bộ nhớ cho các món sắp được ghi lại: Map id → Blob. */
  async function snapshotImages(itemIds) {
    const ids = [...new Set(itemIds || [])];
    if (!ids.length) return new Map();
    const items = await tx('items', 'readonly',
      (t) => Promise.all(ids.map((id) => reqP(t.objectStore('items').get(id)))), 'Không đọc được ảnh món đồ.');
    const map = new Map();
    for (const it of items) {
      if (it && it.imageBlob) map.set(it.id, await memoryBlob(it.imageBlob));
    }
    return map;
  }

  /** Thay ảnh của món bằng bản sao trong bộ nhớ (chỉ khi vẫn là cùng ảnh đó). */
  function useSnapshot(item, images) {
    const copy = images.get(item.id);
    if (copy && item.imageBlob && copy.size === item.imageBlob.size) item.imageBlob = copy;
  }

  /* Báo cho giao diện biết món nào vừa được ghi lại (để làm mới URL ảnh). */
  let itemsWrittenListener = null;
  function onItemsWritten(fn) { itemsWrittenListener = fn; }
  function notifyItemsWritten(ids) {
    if (itemsWrittenListener && ids && ids.length) {
      try { itemsWrittenListener(ids); } catch (err) { console.error(err); }
    }
  }

  /** Lấy toàn bộ bản ghi của một store. */
  function getAll(store) {
    return tx(store, 'readonly', (t) => reqP(t.objectStore(store).getAll()), 'Không đọc được dữ liệu.');
  }

  /** Lấy một bản ghi theo id. */
  function get(store, id) {
    return tx(store, 'readonly', (t) => reqP(t.objectStore(store).get(id)), 'Không đọc được dữ liệu.');
  }

  /* ---------------------------- Danh mục ---------------------------- */

  /** Danh sách danh mục, sắp theo thứ tự người dùng. */
  async function getCategories() {
    const cats = await getAll('categories');
    return cats.sort((a, b) => a.order - b.order);
  }

  /** Thêm danh mục mới vào cuối danh sách. Báo lỗi nếu trùng tên. */
  async function addCategory(name) {
    const clean = String(name || '').trim();
    if (!clean) throw new DBError('Tên danh mục không được để trống.');
    return tx('categories', 'readwrite', async (t) => {
      const store = t.objectStore('categories');
      const all = await reqP(store.getAll());
      if (all.some((c) => c.name.toLowerCase() === clean.toLowerCase())) {
        throw new DBError('Đã có danh mục tên này.');
      }
      const order = all.reduce((m, c) => Math.max(m, c.order), -1) + 1;
      const cat = { id: newId(), name: clean, order };
      store.add(cat);
      return cat;
    }, 'Không thêm được danh mục.');
  }

  /** Đổi tên danh mục. Món đồ/outfit lưu id nên không cần sửa gì thêm. */
  async function renameCategory(id, name) {
    const clean = String(name || '').trim();
    if (!clean) throw new DBError('Tên danh mục không được để trống.');
    return tx('categories', 'readwrite', async (t) => {
      const store = t.objectStore('categories');
      const all = await reqP(store.getAll());
      if (all.some((c) => c.id !== id && c.name.toLowerCase() === clean.toLowerCase())) {
        throw new DBError('Đã có danh mục tên này.');
      }
      const cat = all.find((c) => c.id === id);
      if (!cat) throw new DBError('Danh mục không còn tồn tại.');
      cat.name = clean;
      store.put(cat);
      return cat;
    }, 'Không đổi tên được danh mục.');
  }

  /** Lưu thứ tự mới cho danh mục theo mảng id. */
  async function reorderCategories(ids) {
    return tx('categories', 'readwrite', async (t) => {
      const store = t.objectStore('categories');
      const all = await reqP(store.getAll());
      const byId = new Map(all.map((c) => [c.id, c]));
      ids.forEach((id, i) => {
        const c = byId.get(id);
        if (c && c.order !== i) { c.order = i; store.put(c); }
      });
    }, 'Không lưu được thứ tự danh mục.');
  }

  /**
   * Xóa danh mục: chỉ gỡ id khỏi món đồ và outfit, không xóa món/outfit nào.
   */
  async function deleteCategory(id) {
    const touched = [];
    await withRetry(async () => {
      const all = await getAll('items');
      const images = await snapshotImages(all.filter((it) => (it.categoryIds || []).includes(id)).map((it) => it.id));
      touched.length = 0;
      return tx(['categories', 'items', 'outfits'], 'readwrite', async (t) => {
        t.objectStore('categories').delete(id);
        const items = await reqP(t.objectStore('items').getAll());
        items.forEach((it) => {
          if ((it.categoryIds || []).includes(id)) {
            it.categoryIds = it.categoryIds.filter((c) => c !== id);
            useSnapshot(it, images);
            t.objectStore('items').put(it);
            touched.push(it.id);
          }
        });
        const outfits = await reqP(t.objectStore('outfits').getAll());
        outfits.forEach((o) => {
          const had = (o.categoryIds || []).includes(id) || (o.categoryAddedAt && id in o.categoryAddedAt);
          if (had) {
            o.categoryIds = (o.categoryIds || []).filter((c) => c !== id);
            if (o.categoryAddedAt) delete o.categoryAddedAt[id];
            t.objectStore('outfits').put(o);
          }
        });
      }, 'Không xóa được danh mục.');
    });
    notifyItemsWritten(touched);
  }

  /* ---------------------------- Món đồ ---------------------------- */

  /** Danh sách món đồ, món mới thêm đứng trước. */
  async function getItems() {
    const items = await getAll('items');
    return items.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  /** Lấy một món đồ theo id. */
  function getItem(id) {
    return get('items', id);
  }

  /** Thêm món đồ mới, đồng thời tăng bộ đếm "món thêm từ lần sao lưu trước". */
  async function addItem(data) {
    const item = {
      id: newId(),
      name: data.name,
      type: data.type,
      color: data.color,
      categoryIds: data.categoryIds || [],
      imageBlob: data.imageBlob || null,
      wearCount: 0,
      lastWornAt: null,
      previousLastWornAt: null,
      createdAt: nowISO()
    };
    await tx(['items', 'meta'], 'readwrite', async (t) => {
      t.objectStore('items').add(item);
      const meta = t.objectStore('meta');
      const row = await reqP(meta.get('itemsAddedSinceBackup'));
      meta.put({ key: 'itemsAddedSinceBackup', value: ((row && row.value) || 0) + 1 });
    }, 'Không lưu được món đồ.');
    return item;
  }

  /** Cập nhật một số trường của món đồ (giữ nguyên các trường khác). */
  async function updateItem(id, changes) {
    const item = await withRetry(async () => {
      // Không đổi ảnh thì ghi lại bản sao ảnh trong bộ nhớ (xem memoryBlob)
      const images = 'imageBlob' in changes ? new Map() : await snapshotImages([id]);
      return tx('items', 'readwrite', async (t) => {
        const store = t.objectStore('items');
        const current = await reqP(store.get(id));
        if (!current) throw new DBError('Món đồ không còn tồn tại.');
        Object.assign(current, changes, { id });
        if (current.wearCount < 0) current.wearCount = 0;
        useSnapshot(current, images);
        store.put(current);
        return current;
      }, 'Không lưu được thay đổi.');
    });
    notifyItemsWritten([id]);
    return item;
  }

  /**
   * Ghi "Mặc hôm nay": mỗi món chỉ 1 lần/ngày.
   * Trả về món đã cập nhật, hoặc null nếu hôm nay đã ghi rồi.
   */
  async function markWornToday(id) {
    const item = await withRetry(async () => {
      const images = await snapshotImages([id]);
      return tx('items', 'readwrite', async (t) => {
        const store = t.objectStore('items');
        const current = await reqP(store.get(id));
        if (!current) throw new DBError('Món đồ không còn tồn tại.');
        if (isToday(current.lastWornAt)) return null;
        current.previousLastWornAt = current.lastWornAt || null;
        current.wearCount = (current.wearCount || 0) + 1;
        current.lastWornAt = nowISO();
        useSnapshot(current, images);
        store.put(current);
        return current;
      }, 'Không ghi được lần mặc.');
    });
    if (item) notifyItemsWritten([id]);
    return item;
  }

  /**
   * Bỏ đánh dấu "Mặc hôm nay" — chỉ được trong cùng ngày.
   * wearCount −1, lastWornAt trở về previousLastWornAt.
   */
  async function unmarkWornToday(id) {
    const item = await withRetry(async () => {
      const images = await snapshotImages([id]);
      return tx('items', 'readwrite', async (t) => {
        const store = t.objectStore('items');
        const current = await reqP(store.get(id));
        if (!current) throw new DBError('Món đồ không còn tồn tại.');
        // Đã bỏ đánh dấu rồi (ví dụ bấm Hoàn tác hai lần) thì không làm gì, không báo lỗi
        if (!isToday(current.lastWornAt)) return null;
        current.wearCount = Math.max(0, (current.wearCount || 0) - 1);
        current.lastWornAt = current.previousLastWornAt || null;
        current.previousLastWornAt = null;
        useSnapshot(current, images);
        store.put(current);
        return current;
      }, 'Không bỏ đánh dấu được.');
    });
    if (item) notifyItemsWritten([id]);
    return item;
  }

  /**
   * "Mặc hôm nay" cho nhiều món cùng lúc (bộ gợi ý chưa lưu thành outfit).
   * Áp đúng quy tắc của từng món: món đã ghi hôm nay thì bỏ qua.
   * Dùng chung cơ chế an toàn của bản 1.1.1: sao ảnh vào bộ nhớ, tự thử lại, báo làm mới URL ảnh.
   * Trả về mảng id các món thực sự được +1.
   */
  async function markItemsWornToday(ids) {
    const added = [];
    await withRetry(async () => {
      const images = await snapshotImages(ids);
      added.length = 0;
      return tx('items', 'readwrite', async (t) => {
        const store = t.objectStore('items');
        const now = nowISO();
        for (const id of ids) {
          const item = await reqP(store.get(id));
          if (!item || isToday(item.lastWornAt)) continue;
          item.previousLastWornAt = item.lastWornAt || null;
          item.wearCount = (item.wearCount || 0) + 1;
          item.lastWornAt = now;
          useSnapshot(item, images);
          store.put(item);
          added.push(id);
        }
      }, 'Không ghi được lần mặc.');
    });
    notifyItemsWritten(added);
    return [...added];
  }

  /**
   * Hoàn tác "Mặc hôm nay" cho đúng các món đã được +1 (chỉ trong cùng ngày).
   * Món nào đã được bỏ đánh dấu rồi thì bỏ qua, không báo lỗi. Trả về mảng id đã trừ.
   */
  async function unmarkItemsWornToday(ids) {
    const removed = [];
    await withRetry(async () => {
      const images = await snapshotImages(ids);
      removed.length = 0;
      return tx('items', 'readwrite', async (t) => {
        const store = t.objectStore('items');
        for (const id of ids) {
          const item = await reqP(store.get(id));
          if (!item || !isToday(item.lastWornAt)) continue;
          item.wearCount = Math.max(0, (item.wearCount || 0) - 1);
          item.lastWornAt = item.previousLastWornAt || null;
          item.previousLastWornAt = null;
          useSnapshot(item, images);
          store.put(item);
          removed.push(id);
        }
      }, 'Không bỏ đánh dấu được.');
    });
    notifyItemsWritten(removed);
    return [...removed];
  }

  /**
   * Xóa món đồ, gỡ món khỏi các outfit; outfit nào rỗng thì xóa luôn.
   * Trả về { removedFrom, deletedOutfits } để báo cho người dùng.
   */
  async function deleteItem(id) {
    return tx(['items', 'outfits'], 'readwrite', async (t) => {
      t.objectStore('items').delete(id);
      const store = t.objectStore('outfits');
      const outfits = await reqP(store.getAll());
      let removedFrom = 0;
      let deletedOutfits = 0;
      outfits.forEach((o) => {
        if (!(o.itemIds || []).includes(id)) return;
        removedFrom++;
        o.itemIds = o.itemIds.filter((x) => x !== id);
        o.lastWearItemIds = (o.lastWearItemIds || []).filter((x) => x !== id);
        if (o.itemIds.length === 0) {
          store.delete(o.id);
          deletedOutfits++;
        } else {
          store.put(o);
        }
      });
      return { removedFrom, deletedOutfits };
    }, 'Không xóa được món đồ.');
  }

  /* ---------------------------- Outfit ---------------------------- */

  /** Danh sách outfit, bộ mới tạo đứng trước. */
  async function getOutfits() {
    const outfits = await getAll('outfits');
    return outfits.sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
  }

  /** Bỏ id trùng và id rỗng trong một mảng. */
  function uniqueIds(ids) {
    return [...new Set((ids || []).filter((x) => typeof x === 'string' && x))];
  }

  /**
   * Cập nhật danh mục của outfit, giữ đúng categoryAddedAt:
   * danh mục mới thêm → ghi thời điểm hiện tại; danh mục bị bỏ → xóa khỏi object;
   * danh mục giữ nguyên → giữ thời điểm cũ.
   */
  function applyCategories(outfit, categoryIds) {
    const ids = uniqueIds(categoryIds);
    const old = outfit.categoryAddedAt || {};
    const addedAt = {};
    const now = nowISO();
    ids.forEach((id) => { addedAt[id] = old[id] || now; });
    outfit.categoryIds = ids;
    outfit.categoryAddedAt = addedAt;
  }

  /** Tạo outfit mới. Cần ít nhất 1 món. */
  async function addOutfit({ name, itemIds, categoryIds }) {
    const items = uniqueIds(itemIds);
    if (!items.length) throw new DBError('Hãy chọn ít nhất 1 món cho outfit.');
    const outfit = {
      id: newId(),
      name: String(name || '').trim() || 'Outfit',
      itemIds: items,
      categoryIds: [],
      categoryAddedAt: {},
      wearCount: 0,
      lastWornAt: null,
      previousLastWornAt: null,
      lastWearItemIds: [],
      createdAt: nowISO()
    };
    applyCategories(outfit, categoryIds);
    await tx('outfits', 'readwrite', (t) => { t.objectStore('outfits').add(outfit); }, 'Không lưu được outfit.');
    return outfit;
  }

  /** Sửa tên, các món và danh mục của outfit (giữ nguyên số lần mặc). */
  async function updateOutfit(id, { name, itemIds, categoryIds }) {
    return tx('outfits', 'readwrite', async (t) => {
      const store = t.objectStore('outfits');
      const outfit = await reqP(store.get(id));
      if (!outfit) throw new DBError('Outfit không còn tồn tại.');
      const items = uniqueIds(itemIds);
      if (!items.length) throw new DBError('Hãy chọn ít nhất 1 món cho outfit.');
      outfit.name = String(name || '').trim() || outfit.name;
      outfit.itemIds = items;
      // Món bị bỏ khỏi bộ thì cũng không còn được tính trong lần mặc gần nhất
      outfit.lastWearItemIds = (outfit.lastWearItemIds || []).filter((x) => items.includes(x));
      applyCategories(outfit, categoryIds);
      store.put(outfit);
      return outfit;
    }, 'Không lưu được outfit.');
  }

  /** Xóa outfit. Các món đồ trong bộ không bị ảnh hưởng. */
  function deleteOutfit(id) {
    return tx('outfits', 'readwrite', (t) => { t.objectStore('outfits').delete(id); }, 'Không xóa được outfit.');
  }

  /**
   * Đặt lại danh sách outfit thuộc một danh mục (màn "Thêm outfit vào danh mục").
   * Outfit được chọn mà chưa có danh mục → thêm (ghi categoryAddedAt);
   * outfit không được chọn mà đang có → gỡ ra.
   */
  async function setCategoryOutfits(categoryId, outfitIds) {
    const chosen = new Set(outfitIds);
    return tx('outfits', 'readwrite', async (t) => {
      const store = t.objectStore('outfits');
      const outfits = await reqP(store.getAll());
      let changed = 0;
      outfits.forEach((o) => {
        const has = (o.categoryIds || []).includes(categoryId);
        if (chosen.has(o.id) === has) return;
        const ids = has ? o.categoryIds.filter((c) => c !== categoryId) : [...(o.categoryIds || []), categoryId];
        applyCategories(o, ids);
        store.put(o);
        changed++;
      });
      return changed;
    }, 'Không cập nhật được danh mục.');
  }

  /**
   * "Hôm nay mặc bộ này": outfit +1 và từng món trong bộ +1 theo quy tắc "Mặc hôm nay".
   * Món đã ghi hôm nay thì bỏ qua. Các món thực sự được cộng lưu vào lastWearItemIds.
   * Trả về { outfit, addedItems } hoặc null nếu hôm nay đã ghi bộ này rồi.
   */
  async function markOutfitWornToday(id) {
    const res = await withRetry(async () => {
      const before = await get('outfits', id);
      const images = await snapshotImages(before ? before.itemIds : []);
      return tx(['outfits', 'items'], 'readwrite', async (t) => {
        const outfits = t.objectStore('outfits');
        const itemsStore = t.objectStore('items');
        const outfit = await reqP(outfits.get(id));
        if (!outfit) throw new DBError('Outfit không còn tồn tại.');
        if (isToday(outfit.lastWornAt)) return null;
        const now = nowISO();
        const added = [];
        for (const itemId of outfit.itemIds || []) {
          const item = await reqP(itemsStore.get(itemId));
          if (!item || isToday(item.lastWornAt)) continue;
          item.previousLastWornAt = item.lastWornAt || null;
          item.wearCount = (item.wearCount || 0) + 1;
          item.lastWornAt = now;
          useSnapshot(item, images);
          itemsStore.put(item);
          added.push(itemId);
        }
        outfit.previousLastWornAt = outfit.lastWornAt || null;
        outfit.wearCount = (outfit.wearCount || 0) + 1;
        outfit.lastWornAt = now;
        outfit.lastWearItemIds = added;
        outfits.put(outfit);
        return { outfit, addedItems: added.length };
      }, 'Không ghi được lần mặc.');
    });
    if (res) notifyItemsWritten(res.outfit.lastWearItemIds);
    return res;
  }

  /**
   * Hoàn tác "Hôm nay mặc bộ này" — chỉ trong cùng ngày.
   * Trừ lại outfit và đúng các món trong lastWearItemIds (món nào đã tự bỏ đánh dấu thì bỏ qua).
   */
  async function unmarkOutfitWornToday(id) {
    const touched = [];
    const res = await withRetry(async () => {
      const before = await get('outfits', id);
      const images = await snapshotImages(before ? before.lastWearItemIds : []);
      touched.length = 0;
      return tx(['outfits', 'items'], 'readwrite', async (t) => {
        const outfits = t.objectStore('outfits');
        const itemsStore = t.objectStore('items');
        const outfit = await reqP(outfits.get(id));
        if (!outfit) throw new DBError('Outfit không còn tồn tại.');
        // Đã bỏ đánh dấu rồi (Hoàn tác và nút bấm gần như cùng lúc) thì không làm gì, không báo lỗi
        if (!isToday(outfit.lastWornAt)) return null;
        for (const itemId of outfit.lastWearItemIds || []) {
          const item = await reqP(itemsStore.get(itemId));
          if (!item || !isToday(item.lastWornAt)) continue;
          item.wearCount = Math.max(0, (item.wearCount || 0) - 1);
          item.lastWornAt = item.previousLastWornAt || null;
          item.previousLastWornAt = null;
          useSnapshot(item, images);
          itemsStore.put(item);
          touched.push(itemId);
        }
        outfit.wearCount = Math.max(0, (outfit.wearCount || 0) - 1);
        outfit.lastWornAt = outfit.previousLastWornAt || null;
        outfit.previousLastWornAt = null;
        outfit.lastWearItemIds = [];
        outfits.put(outfit);
        return { outfit, removedItems: touched.length };
      }, 'Không bỏ đánh dấu được.');
    });
    notifyItemsWritten(touched);
    return res;
  }

  /* ---------------------------- Meta ---------------------------- */

  /** Đọc toàn bộ meta thành object { lastBackupAt, itemsAddedSinceBackup }. */
  async function getMeta() {
    const rows = await getAll('meta');
    const meta = { lastBackupAt: null, itemsAddedSinceBackup: 0 };
    rows.forEach((r) => { meta[r.key] = r.value; });
    return meta;
  }

  /** Ghi một số khóa meta. */
  function setMeta(values) {
    return tx('meta', 'readwrite', (t) => {
      const store = t.objectStore('meta');
      Object.entries(values).forEach(([key, value]) => store.put({ key, value }));
    }, 'Không lưu được thông tin sao lưu.');
  }

  /* ---------------------- Sao lưu / khôi phục ---------------------- */

  /** Đọc toàn bộ dữ liệu (dùng khi xuất bản sao lưu). */
  async function exportAll() {
    return tx(STORES, 'readonly', async (t) => {
      const [categories, items, outfits, metaRows] = await Promise.all(
        STORES.map((s) => reqP(t.objectStore(s).getAll()))
      );
      const meta = {};
      metaRows.forEach((r) => { meta[r.key] = r.value; });
      return { categories, items, outfits, meta };
    }, 'Không đọc được dữ liệu để sao lưu.');
  }

  /**
   * Ghi dữ liệu nhập từ bản sao lưu.
   * mode = 'replace': xóa sạch rồi ghi lại. mode = 'merge': bỏ qua bản ghi trùng id.
   * Trả về số bản ghi đã thêm của từng loại.
   */
  async function importAll(data, mode) {
    return tx(STORES, 'readwrite', async (t) => {
      const added = { categories: 0, items: 0, outfits: 0 };
      if (mode === 'replace') {
        STORES.forEach((s) => t.objectStore(s).clear());
        data.categories.forEach((c) => { t.objectStore('categories').put(c); added.categories++; });
        data.items.forEach((it) => { t.objectStore('items').put(it); added.items++; });
        data.outfits.forEach((o) => { t.objectStore('outfits').put(o); added.outfits++; });
        const meta = Object.assign({ lastBackupAt: null, itemsAddedSinceBackup: 0 }, data.meta || {});
        Object.entries(meta).forEach(([key, value]) => t.objectStore('meta').put({ key, value }));
        return added;
      }

      // Gộp: danh mục trùng tên (khác id) được coi là cùng một danh mục.
      const catStore = t.objectStore('categories');
      const existingCats = await reqP(catStore.getAll());
      const idMap = new Map();
      const byName = new Map(existingCats.map((c) => [c.name.toLowerCase(), c.id]));
      const existingCatIds = new Set(existingCats.map((c) => c.id));
      let nextOrder = existingCats.reduce((m, c) => Math.max(m, c.order), -1) + 1;
      data.categories
        .slice()
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .forEach((c) => {
          if (existingCatIds.has(c.id)) return;
          const same = byName.get(String(c.name).toLowerCase());
          if (same) { idMap.set(c.id, same); return; }
          catStore.add({ id: c.id, name: c.name, order: nextOrder++ });
          byName.set(String(c.name).toLowerCase(), c.id);
          existingCatIds.add(c.id);
          added.categories++;
        });
      const mapIds = (ids) => [...new Set((ids || []).map((id) => idMap.get(id) || id))];

      const itemStore = t.objectStore('items');
      const itemKeys = new Set(await reqP(itemStore.getAllKeys()));
      data.items.forEach((it) => {
        if (itemKeys.has(it.id)) return;
        itemStore.add(Object.assign({}, it, { categoryIds: mapIds(it.categoryIds) }));
        added.items++;
      });

      const outfitStore = t.objectStore('outfits');
      const outfitKeys = new Set(await reqP(outfitStore.getAllKeys()));
      data.outfits.forEach((o) => {
        if (outfitKeys.has(o.id)) return;
        const addedAt = {};
        Object.entries(o.categoryAddedAt || {}).forEach(([k, v]) => { addedAt[idMap.get(k) || k] = v; });
        outfitStore.add(Object.assign({}, o, { categoryIds: mapIds(o.categoryIds), categoryAddedAt: addedAt }));
        added.outfits++;
      });
      return added;
    }, 'Không nhập được bản sao lưu.');
  }

  return {
    DBError, ITEM_TYPES, DB_VERSION,
    open, newId, nowISO, dayKey, isToday, onItemsWritten,
    getCategories, addCategory, renameCategory, reorderCategories, deleteCategory,
    getItems, getItem, addItem, updateItem, markWornToday, unmarkWornToday,
    markItemsWornToday, unmarkItemsWornToday, deleteItem,
    getOutfits, addOutfit, updateOutfit, deleteOutfit, setCategoryOutfits,
    markOutfitWornToday, unmarkOutfitWornToday,
    getMeta, setMeta, exportAll, importAll
  };
})();
