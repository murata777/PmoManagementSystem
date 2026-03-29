/** 操作履歴行の detail（API の JSONB）をオブジェクト化 */
export function parseDetail(raw) {
  if (raw == null) return null;
  if (typeof raw === 'object') return raw;
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * React Router の `to` に渡せるパス（ハッシュ含む）。遷移できないときは null。
 */
export function getActivityNavTo(row) {
  if (!row) return null;
  const d = parseDetail(row.detail);
  const pid = d?.project_id;
  if (row.target_type === 'project' && row.target_id) {
    return `/projects/${row.target_id}`;
  }
  if (row.target_type === 'member') {
    return '/members';
  }
  if (row.target_type === 'group') {
    return '/groups';
  }
  if (row.target_type === 'notification_config') {
    return '/settings/notifications';
  }
  if (row.target_type === 'personal_todo') {
    const tid =
      row.target_id != null && String(row.target_id).trim() !== ''
        ? String(row.target_id).trim()
        : d?.todo_id != null && String(d.todo_id).trim() !== ''
          ? String(d.todo_id).trim()
          : null;
    return tid ? `/my-todos#todo-${encodeURIComponent(tid)}` : '/my-todos';
  }
  if (pid && row.target_type === 'progress_evaluation' && row.target_id) {
    return `/projects/${pid}/progress#evm-eval-${encodeURIComponent(row.target_id)}`;
  }
  if (pid && row.target_type === 'progress_record' && row.target_id) {
    return `/projects/${pid}/progress#evm-record-${encodeURIComponent(row.target_id)}`;
  }
  if (!pid) return null;
  if (row.target_type === 'task' && row.target_id) {
    return `/projects/${pid}#task-${encodeURIComponent(row.target_id)}`;
  }
  return `/projects/${pid}`;
}

/** ツールチップ・アイコン用の短い説明 */
export function getActivityLinkLabel(row) {
  if (!row) return '開く';
  const d = parseDetail(row.detail);
  const pid = d?.project_id;
  if (row.target_type === 'project' && row.target_id) return 'プロジェクトを開く';
  if (row.target_type === 'member') return 'メンバー一覧へ';
  if (row.target_type === 'group') return 'グループ一覧へ';
  if (row.target_type === 'notification_config') return '通知設定へ';
  if (row.target_type === 'personal_todo') return 'マイToDoへ';
  if (pid && row.target_type === 'progress_evaluation' && row.target_id) return '進捗報告へ';
  if (pid && row.target_type === 'progress_record' && row.target_id) return '進捗確認（EVM）へ';
  if (!pid) return '開く';
  if (row.target_type === 'task' && row.target_id) return 'タスクへ';
  return 'プロジェクトへ';
}
