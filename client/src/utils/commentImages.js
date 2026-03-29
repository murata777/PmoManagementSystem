export const COMMENT_PAYLOAD_VERSION = 1;
export const MAX_PASTED_IMAGES_PER_COMMENT = 8;

/**
 * @param {string} text
 * @param {string[]} imageDataUrls
 * @returns {string} 空なら ''
 */
export function encodeCommentForStorage(text, imageDataUrls) {
  const t = String(text ?? '');
  const imgs = Array.isArray(imageDataUrls) ? imageDataUrls.filter(Boolean) : [];
  if (!t.trim() && imgs.length === 0) return '';
  return JSON.stringify({ v: COMMENT_PAYLOAD_VERSION, text: t, images: imgs });
}

/**
 * @param {string} raw
 * @returns {{ text: string, images: string[] }}
 */
export function decodeCommentStored(raw) {
  const s = String(raw ?? '');
  if (s.startsWith('{"v":1,')) {
    try {
      const o = JSON.parse(s);
      if (o.v === 1 && typeof o.text === 'string') {
        return { text: o.text, images: Array.isArray(o.images) ? o.images : [] };
      }
    } catch {
      /* fallthrough */
    }
  }
  return { text: s, images: [] };
}

/**
 * タスクタイトル用（投稿前の下書きから）
 */
export function plainTextForTaskTitleFromDraft(text, imageDataUrls) {
  const payload = encodeCommentForStorage(text, imageDataUrls);
  if (!payload) return '';
  const { text: t, images } = decodeCommentStored(payload);
  const tr = t.trim();
  if (tr) return tr.length > 500 ? `${tr.slice(0, 497)}…` : tr;
  if (images.length > 0) return '（画像付きコメント）';
  return '';
}

/**
 * クリップボードの画像を縮小 JPEG の data URL に変換
 */
export function fileToDownscaledDataUrl(file, maxWidth = 1280, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const scale = w > maxWidth ? maxWidth / w : 1;
        const cw = Math.max(1, Math.round(w * scale));
        const ch = Math.max(1, Math.round(h * scale));
        const canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('canvas'));
          return;
        }
        ctx.drawImage(img, 0, 0, cw, ch);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => reject(new Error('image'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('read'));
    reader.readAsDataURL(file);
  });
}

/**
 * @param {DataTransfer | null | undefined} clipboardData
 * @returns {Promise<string | null>}
 */
export async function tryConsumeClipboardImageAsDataUrl(clipboardData) {
  const items = clipboardData?.items;
  if (!items) return null;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.type.startsWith('image/')) {
      const f = item.getAsFile();
      if (f) return fileToDownscaledDataUrl(f);
    }
  }
  return null;
}
