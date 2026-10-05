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
    return new Promise((resolve, reject) => {
      let result;
      let t;
      try {
        t = db.transaction(storeNames, mode);
      } catch (err) {
        reject(new DBError(errorMessage || 'Không đọc/ghi được dữ liệu.', err));
        return;
      }
      t.oncomplete = () => resolve(result);
      t.onerror = () => reject(new DBError(errorMessage || 'Không đọc/ghi được dữ liệu.', t.error));
      t.onabort = () => {
        const quota = t.error && t.error.name === 'QuotaExceededError';
        reject(new DBError(quota ? 'Bộ nhớ trình duyệt đã đầy. Hãy xóa bớt món đồ hoặc giải phóng dung lượng máy.' : (errorMessage || 'Thao tác dữ liệu bị hủy.'), t.error));
      };
      Promise.resolve()
        .then(() => work(t))
        .then((r) => { result = r; })
        .catch((err) => {
          try { t.abort(); } catch (_) { /* đã kết thúc */ }
          reject(err instanceof DBError ? err : new DBError(errorMessage || 'Không đọc/ghi được dữ liệu.', err));
        });
    });
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
    return tx(['categories', 'items', 'outfits'], 'readwrite', async (t) => {
      t.objectStore('categories').delete(id);
      const items = await reqP(t.objectStore('items').getAll());
      items.forEach((it) => {
        if ((it.categoryIds || []).includes(id)) {
          it.categoryIds = it.categoryIds.filter((c) => c !== id);
          t.objectStore('items').put(it);
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
    return tx('items', 'readwrite', async (t) => {
      const store = t.objectStore('items');
      const item = await reqP(store.get(id));
      if (!item) throw new DBError('Món đồ không còn tồn tại.');
      Object.assign(item, changes, { id });
      if (item.wearCount < 0) item.wearCount = 0;
      store.put(item);
      return item;
    }, 'Không lưu được thay đổi.');
  }

  /**
   * Ghi "Mặc hôm nay": mỗi món chỉ 1 lần/ngày.
   * Trả về món đã cập nhật, hoặc null nếu hôm nay đã ghi rồi.
   */
  async function markWornToday(id) {
    return tx('items', 'readwrite', async (t) => {
      const store = t.objectStore('items');
      const item = await reqP(store.get(id));
      if (!item) throw new DBError('Món đồ không còn tồn tại.');
      if (isToday(item.lastWornAt)) return null;
      item.previousLastWornAt = item.lastWornAt || null;
      item.wearCount = (item.wearCount || 0) + 1;
      item.lastWornAt = nowISO();
      store.put(item);
      return item;
    }, 'Không ghi được lần mặc.');
  }

  /**
   * Bỏ đánh dấu "Mặc hôm nay" — chỉ được trong cùng ngày.
   * wearCount −1, lastWornAt trở về previousLastWornAt.
   */
  async function unmarkWornToday(id) {
    return tx('items', 'readwrite', async (t) => {
      const store = t.objectStore('items');
      const item = await reqP(store.get(id));
      if (!item) throw new DBError('Món đồ không còn tồn tại.');
      if (!isToday(item.lastWornAt)) throw new DBError('Chỉ bỏ đánh dấu được trong cùng ngày.');
      item.wearCount = Math.max(0, (item.wearCount || 0) - 1);
      item.lastWornAt = item.previousLastWornAt || null;
      item.previousLastWornAt = null;
      store.put(item);
      return item;
    }, 'Không bỏ đánh dấu được.');
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

  /** Danh sách outfit (giai đoạn 2 sẽ có màn tạo/sửa). */
  function getOutfits() {
    return getAll('outfits');
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
    open, newId, nowISO, dayKey, isToday,
    getCategories, addCategory, renameCategory, reorderCategories, deleteCategory,
    getItems, getItem, addItem, updateItem, markWornToday, unmarkWornToday, deleteItem,
    getOutfits, getMeta, setMeta, exportAll, importAll
  };
})();
