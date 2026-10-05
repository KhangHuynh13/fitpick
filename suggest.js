/* =========================================================================
   suggest.js — Gợi ý phối đồ theo luật (giai đoạn 3), KHÔNG dùng AI
   Chỉ tính toán trên dữ liệu đưa vào, không đọc/ghi database, không đụng giao diện.

   Luật (xem SPEC.md, mục Giai đoạn 3):
   - Lọc món theo danh mục đang chọn (Tất cả thì lấy hết).
   - Một bộ = 1 áo + 1 quần HOẶC 1 váy/đầm, cộng 1 giày; thêm túi/phụ kiện nếu có; áo khoác tùy chọn.
   - Ưu tiên món lâu chưa mặc hoặc chưa mặc lần nào; KHÔNG chọn món đã mặc hôm nay hoặc hôm qua.
   - Màu: tối đa 1 món màu nổi, còn lại màu trung tính (trắng, đen, xám, be, xanh navy).
   - Không trùng outfit đã lưu hoặc bộ vừa gợi ý.
   ========================================================================= */
'use strict';

const Suggest = (() => {
  // Màu trung tính dùng cho luật phối màu
  const NEUTRAL_COLORS = ['Trắng', 'Đen', 'Xám', 'Be', 'Xanh navy'];
  // Thứ tự hiển thị các món trong một bộ
  const TYPE_ORDER = ['Áo', 'Váy/Đầm', 'Áo khoác', 'Quần', 'Giày', 'Túi', 'Phụ kiện'];
  const NEVER_WORN = 365;   // "độ lâu chưa mặc" của món chưa mặc lần nào
  const LONG_UNWORN = 14;   // từ 14 ngày trở lên coi là "lâu chưa mặc"
  const TOP_PER_GROUP = 6;  // chỉ xét 6 món "lâu chưa mặc" nhất mỗi nhóm để giới hạn số tổ hợp

  /** Món có màu trung tính không (món chưa có màu coi như trung tính). */
  function isNeutral(item) {
    return !item.color || NEUTRAL_COLORS.includes(item.color);
  }

  /** Khóa ngày địa phương YYYY-MM-DD (giống DB.dayKey). */
  function dayKey(date) {
    const d = new Date(date);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }

  /** Số ngày theo lịch từ lần mặc gần nhất đến hôm nay. */
  function daysSinceWorn(item, now) {
    if (!item.lastWornAt) return NEVER_WORN;
    const a = new Date(dayKey(item.lastWornAt) + 'T00:00:00');
    const b = new Date(dayKey(now) + 'T00:00:00');
    return Math.max(0, Math.round((b - a) / 86400000));
  }

  /** Món vừa mặc hôm nay hoặc hôm qua thì không được gợi ý. */
  function wornRecently(item, now) {
    return !!item.lastWornAt && daysSinceWorn(item, now) <= 1;
  }

  /** Khóa nhận diện một bộ: id các món đã sắp xếp (để so trùng). */
  function lookKey(itemIds) {
    return [...itemIds].sort().join('|');
  }

  /** Sắp xếp món trong bộ theo thứ tự hiển thị (áo trước, giày, túi, phụ kiện sau). */
  function orderItems(items) {
    return [...items].sort((a, b) => TYPE_ORDER.indexOf(a.type) - TYPE_ORDER.indexOf(b.type));
  }

  /**
   * Chia món thành các nhóm và xếp mỗi nhóm theo "lâu chưa mặc" giảm dần
   * (thêm chút ngẫu nhiên để các món ngang nhau lần lượt được chọn).
   */
  function groupPool(pool, now, rng) {
    const score = new Map(pool.map((i) => [i.id, daysSinceWorn(i, now) + rng() * 0.9]));
    const pick = (type) => pool
      .filter((i) => i.type === type)
      .sort((a, b) => score.get(b.id) - score.get(a.id))
      .slice(0, TOP_PER_GROUP);
    return {
      tops: pick('Áo'), bottoms: pick('Quần'), dresses: pick('Váy/Đầm'), shoes: pick('Giày'),
      bags: pick('Túi'), accessories: pick('Phụ kiện'), jackets: pick('Áo khoác'), score
    };
  }

  /** Lý do cụ thể khi không phối được bộ nào. */
  function missingReason(pool, allInCategory, now) {
    if (!allInCategory.length) return 'Chưa có món nào thuộc dịp này.';
    const has = (type) => pool.some((i) => i.type === type);
    const missing = [];
    if (!(has('Áo') && has('Quần')) && !has('Váy/Đầm')) {
      if (!has('Váy/Đầm') && !has('Áo') && !has('Quần')) missing.push('áo + quần hoặc váy/đầm');
      else if (!has('Áo')) missing.push('áo (hoặc váy/đầm)');
      else missing.push('quần (hoặc váy/đầm)');
    }
    if (!has('Giày')) missing.push('giày');
    const recent = allInCategory.filter((i) => wornRecently(i, now)).length;
    let text = missing.length ? `Còn thiếu ${missing.join(' và ')}.` : 'Các bộ phối được đều trùng outfit đã lưu hoặc có hơn 1 món màu nổi.';
    if (recent) text += ` ${recent} món vừa mặc hôm nay hoặc hôm qua nên được để dành.`;
    return text;
  }

  /**
   * Tạo danh sách các bộ hợp lệ, bộ tốt nhất đứng trước.
   * - items: toàn bộ món đồ; outfits: outfit đã lưu; categoryId: danh mục đang lọc hoặc null (Tất cả)
   * - rng: hàm ngẫu nhiên (mặc định Math.random) — truyền vào để kiểm thử được
   * Trả về { looks: [{ itemIds, items, score, accentCount }], reason } (reason khi không có bộ nào).
   */
  function buildLooks({ items, outfits, categoryId = null, now = new Date(), rng = Math.random }) {
    const inCategory = items.filter((i) => !categoryId || (i.categoryIds || []).includes(categoryId));
    const pool = inCategory.filter((i) => !wornRecently(i, now));
    const g = groupPool(pool, now, rng);
    const saved = new Set((outfits || []).map((o) => lookKey(o.itemIds || [])));

    // Phần chính: áo + quần, hoặc váy/đầm; luôn có 1 giày
    const cores = [];
    for (const shoe of g.shoes) {
      for (const top of g.tops) for (const bottom of g.bottoms) cores.push([top, bottom, shoe]);
      for (const dress of g.dresses) cores.push([dress, shoe]);
    }

    const looks = [];
    const seen = new Set();
    /** Thêm một bộ vào danh sách nếu không trùng bộ khác hoặc outfit đã lưu. */
    const addLook = (chosen, accents) => {
      const key = lookKey(chosen.map((i) => i.id));
      if (seen.has(key) || saved.has(key)) return;
      seen.add(key);
      const score = chosen.reduce((s, i) => s + g.score.get(i.id), 0) / chosen.length + rng() * 20;
      looks.push({ key, itemIds: orderItems(chosen).map((i) => i.id), items: orderItems(chosen), score, accentCount: accents });
    };
    for (const core of cores) {
      let accents = core.filter((i) => !isNeutral(i)).length;
      if (accents > 1) continue; // tối đa 1 món màu nổi
      const chosen = [...core];
      // Thêm túi / phụ kiện nếu có (món lâu chưa mặc nhất mà vẫn giữ luật màu)
      for (const group of [g.bags, g.accessories]) {
        const extra = group.find((i) => isNeutral(i) || accents === 0);
        if (extra) { chosen.push(extra); if (!isNeutral(extra)) accents++; }
      }
      // Áo khoác tùy chọn: mỗi tổ hợp có cả bản không áo khoác và bản có áo khoác (nếu hợp màu)
      addLook(chosen, accents);
      const jacket = g.jackets.find((i) => isNeutral(i) || accents === 0);
      if (jacket) addLook([...chosen, jacket], accents + (isNeutral(jacket) ? 0 : 1));
    }
    looks.sort((a, b) => b.score - a.score);
    return { looks, reason: looks.length ? '' : missingReason(pool, inCategory, now) };
  }

  /**
   * Chọn bộ tiếp theo, bỏ qua các bộ vừa gợi ý (shownKeys).
   * Nếu đã xem hết thì quay vòng lại (cycled = true), nhưng tránh lặp lại đúng bộ đang xem.
   */
  function nextLook(looks, shownKeys, currentKey) {
    const fresh = looks.find((l) => !shownKeys.has(l.key));
    if (fresh) return { look: fresh, cycled: false };
    const other = looks.find((l) => l.key !== currentKey);
    return { look: other || looks[0] || null, cycled: true };
  }

  /**
   * Chip lý do sinh từ các luật: cùng phong cách, màu, món lâu chưa mặc.
   * categoryName: tên danh mục đang lọc hoặc null.
   */
  function reasons(look, categoryName, now = new Date()) {
    const out = [];
    if (categoryName) out.push(`Cùng phong cách ${categoryName}`);
    if (look.accentCount === 0) out.push('Màu trung tính dễ phối');
    else {
      const accent = look.items.find((i) => !isNeutral(i));
      out.push(`Điểm nhấn màu ${accent.color.toLowerCase()}`);
    }
    const never = look.items.filter((i) => !i.lastWornAt);
    const long = look.items.filter((i) => i.lastWornAt && daysSinceWorn(i, now) >= LONG_UNWORN);
    if (never.length === 1) out.push(`${never[0].name} chưa mặc lần nào`);
    else if (never.length > 1) out.push(`${never.length} món chưa mặc lần nào`);
    if (long.length) out.push(`${long.length} món lâu chưa mặc`);
    return out.slice(0, 3); // thiết kế hiện tối đa 3 chip lý do
  }

  return { NEUTRAL_COLORS, isNeutral, lookKey, buildLooks, nextLook, reasons, daysSinceWorn, wornRecently };
})();
