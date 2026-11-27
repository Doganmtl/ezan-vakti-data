// Quota/My yanıtından güvenli karar (saf). Yanıt biçimi belgelenmemiştir; pilotta görülen: {daily:[{benefit,totalUsed,...}],...}.
// Uç-grup eşleşmesi bilinmediği için en temkinli yorum kullanılır: TÜM günlük gruplar içinde en az kalan hak.
// Biçim beklenmedikse ya da hiç grup yoksa (henüz kullanım yok) kalan hak "bilinmiyor" sayılır.
export const BILINMIYOR_GUVENLI_ISTEK = 8; // belgelerdeki en düşük sınır (5/10) altında kalan, bilinmezlikte izin verilen en çok istek
export function enAzKalan(kota) {
  const g = kota?.daily;
  if (!Array.isArray(g) || g.length === 0) return null;
  let min = Infinity;
  for (const x of g) {
    if (!Number.isFinite(x?.benefit) || !Number.isFinite(x?.totalUsed) || (x.totalExceeded ?? 0) > 0) return x?.totalExceeded > 0 ? 0 : null;
    min = Math.min(min, x.benefit - x.totalUsed);
  }
  return Math.max(0, min);
}
/** İzin verilen istek sayısı: kalan hak − pay; bilinmiyorsa küçük güvenli sınır. */
export function izinVerilen(kota, { pay = 5 } = {}) {
  const k = enAzKalan(kota);
  return k === null ? BILINMIYOR_GUVENLI_ISTEK : Math.max(0, k - pay);
}
