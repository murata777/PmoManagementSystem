const PAYLOAD_PREFIX = '{"v":1,';

const MAX_PLAIN_LENGTH = 100_000;
const MAX_TOTAL_JSON = 12 * 1024 * 1024;
const MAX_IMAGE_DATA_URL = 4 * 1024 * 1024;
const MAX_IMAGES = 8;

/**
 * @param {string} raw DB に保存済みのコメント文字列
 * @returns {{ text: string, images: string[] }}
 */
function parseStoredComment(raw) {
  const s = String(raw ?? '');
  if (s.startsWith(PAYLOAD_PREFIX)) {
    try {
      const o = JSON.parse(s);
      if (o.v === 1 && typeof o.text === 'string') {
        return { text: o.text, images: Array.isArray(o.images) ? o.images : [] };
      }
    } catch (_) {
      /* fallthrough */
    }
  }
  return { text: s, images: [] };
}

/**
 * タスク名など用のプレーンテキスト（JSON コメントから text のみ）
 */
function plainTextFromStoredComment(raw) {
  const { text } = parseStoredComment(raw);
  const t = text.trim();
  if (t) return t.length > 500 ? `${t.slice(0, 497)}…` : t;
  const { images } = parseStoredComment(raw);
  if (images.length > 0) return '（画像付きコメント）';
  return '';
}

/**
 * API 入力を検証し、保存用の文字列に正規化
 * @param {string} raw
 * @returns {{ ok: true, value: string } | { ok: false, error: string }}
 */
function validateAndNormalizeCommentInput(raw) {
  const s = String(raw ?? '').trim();
  if (!s) {
    return { ok: false, error: 'コメントを入力してください' };
  }
  if (s.startsWith(PAYLOAD_PREFIX)) {
    let o;
    try {
      o = JSON.parse(s);
    } catch {
      return { ok: false, error: 'コメントの形式が不正です' };
    }
    if (o.v !== 1 || typeof o.text !== 'string') {
      return { ok: false, error: 'コメントの形式が不正です' };
    }
    const images = Array.isArray(o.images) ? o.images : [];
    if (images.length > MAX_IMAGES) {
      return { ok: false, error: `画像は${MAX_IMAGES}枚までです` };
    }
    if (!o.text.trim() && images.length === 0) {
      return { ok: false, error: 'コメントを入力してください' };
    }
    const dataUrlRe = /^data:image\/(png|jpeg|jpg|gif|webp);base64,/i;
    for (const im of images) {
      if (typeof im !== 'string' || !dataUrlRe.test(im)) {
        return { ok: false, error: '画像の形式が不正です' };
      }
      if (im.length > MAX_IMAGE_DATA_URL) {
        return { ok: false, error: '1枚の画像が大きすぎます' };
      }
    }
    const normalized = JSON.stringify({ v: 1, text: o.text, images });
    if (normalized.length > MAX_TOTAL_JSON) {
      return { ok: false, error: 'コメント全体のサイズが大きすぎます' };
    }
    return { ok: true, value: normalized };
  }
  if (s.length > MAX_PLAIN_LENGTH) {
    return { ok: false, error: 'コメントが長すぎます' };
  }
  return { ok: true, value: s };
}

module.exports = {
  parseStoredComment,
  plainTextFromStoredComment,
  validateAndNormalizeCommentInput,
  PAYLOAD_PREFIX,
};
