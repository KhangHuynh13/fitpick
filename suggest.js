/* =========================================================================
   suggest.js — Gợi ý phối đồ theo luật (GIAI ĐOẠN 3, chưa làm)
   Xem mục "Giai đoạn 3" trong SPEC.md. Hiện tab Gợi ý chỉ hiện "Sắp ra mắt".
   ========================================================================= */
'use strict';

const Suggest = (() => {
  // Màu trung tính dùng cho luật phối màu ở giai đoạn 3.
  const NEUTRAL_COLORS = ['Trắng', 'Đen', 'Xám', 'Be', 'Xanh navy'];

  /** Cho biết tính năng gợi ý đã sẵn sàng chưa (giai đoạn 1: chưa). */
  function isReady() {
    return false;
  }

  return { NEUTRAL_COLORS, isReady };
})();
