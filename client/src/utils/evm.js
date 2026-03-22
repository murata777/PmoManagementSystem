/** PV/EV/AC から SPI・CPI（進捗確認 EVM と同じ定義） */
export function spiCpiFromPevAc(pv, ev, ac) {
  const n = (v) => (v !== null && v !== undefined && v !== '' ? Number(v) : null);
  const p = n(pv);
  const e = n(ev);
  const a = n(ac);
  let spi = p !== null && p !== 0 && e !== null ? e / p : null;
  let cpi = a !== null && a !== 0 && e !== null ? e / a : null;
  if (spi !== null && !Number.isFinite(spi)) spi = null;
  if (cpi !== null && !Number.isFinite(cpi)) cpi = null;
  return { spi, cpi };
}

export function fmtEvmIndex(v) {
  return v === null || v === undefined ? '—' : Number(v).toFixed(2);
}

export function evmIndexChipColor(v) {
  if (v === null || v === undefined) return 'default';
  if (v >= 1.0) return 'success';
  if (v >= 0.9) return 'warning';
  return 'error';
}
