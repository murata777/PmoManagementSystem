/** 現在画面をお気に入りに登録するときのキー（クエリ・ハッシュ込み） */
export function favoritePathFromLocation(location) {
  return `${location.pathname}${location.search || ''}${location.hash || ''}`;
}

/** パスから表示ラベル（保存時の初期値） */
export function deriveFavoriteLabel(pathname, search = '') {
  const p = pathname.replace(/\/$/, '') || '/';
  const q = search && search.startsWith('?') ? search.slice(1) : search.replace(/^\?/, '');
  const map = {
    '/': 'ダッシュボード',
    '/projects': 'プロジェクト一覧',
    '/tasks': 'タスク一覧',
    '/my-todos': 'マイToDo',
    '/activity-history': '操作履歴',
    '/settings/notifications': '通知設定',
    '/groups': 'グループ',
    '/members': 'メンバー',
    '/change-password': 'パスワード変更',
    '/manual': '操作マニュアル',
    '/feature-requests': '要望の入力',
  };
  if (map[p]) {
    if (p === '/projects' && q) {
      const sp = new URLSearchParams(q);
      const st = sp.get('status');
      if (st) return `プロジェクト一覧（${st}）`;
    }
    return map[p];
  }
  if (/^\/projects\/[^/]+$/.test(p)) return 'プロジェクト詳細';
  if (/^\/projects\/[^/]+\/phase-gates$/.test(p)) return 'フェーズゲート';
  if (/^\/projects\/[^/]+\/progress$/.test(p)) return '進捗確認（EVM）';
  if (p.startsWith('/projects/')) return 'プロジェクト関連';
  return p + (search || '');
}
