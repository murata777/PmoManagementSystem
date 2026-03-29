import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  CardMedia,
  Container,
  Divider,
  Link as MuiLink,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';

const appBase = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/');
const manualSrc = (file) => `${appBase}manual/${file}`;

function ManualFigure({ src, alt, caption }) {
  return (
    <Card variant="outlined" sx={{ mb: 2, overflow: 'hidden' }}>
      <CardMedia
        component="img"
        image={src}
        alt={alt}
        sx={{
          width: '100%',
          maxHeight: 280,
          objectFit: 'contain',
          bgcolor: 'grey.50',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      />
      {caption ? (
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Typography variant="caption" color="text.secondary">
            {caption}
          </Typography>
        </CardContent>
      ) : null}
    </Card>
  );
}

function Section({ id, title, children }) {
  return (
    <Box id={id} component="section" sx={{ scrollMarginTop: 88, mb: 4 }}>
      <Typography variant="h5" component="h2" gutterBottom sx={{ fontWeight: 700, color: 'primary.main' }}>
        {title}
      </Typography>
      <Divider sx={{ mb: 2 }} />
      {children}
    </Box>
  );
}

const toc = [
  { id: 'manual-intro', label: 'はじめに' },
  { id: 'manual-layout', label: '画面の構成' },
  { id: 'manual-auth', label: 'ログインとアカウント' },
  { id: 'manual-dashboard', label: 'ダッシュボード' },
  { id: 'manual-projects', label: 'プロジェクトとタスク' },
  { id: 'manual-phase-evm', label: 'フェーズゲートと進捗（EVM）' },
  { id: 'manual-task-list', label: 'タスク一覧' },
  { id: 'manual-mytodo', label: 'マイToDo' },
  { id: 'manual-favorites', label: 'お気に入り' },
  { id: 'manual-admin', label: '管理者向け機能' },
];

export default function Manual() {
  const location = useLocation();

  useEffect(() => {
    const hash = location.hash?.replace(/^#/, '');
    if (!hash) return;
    const el = document.getElementById(hash);
    if (el) {
      requestAnimationFrame(() => {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    }
  }, [location.hash, location.pathname]);

  return (
    <Container maxWidth="md" sx={{ pb: 6 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontWeight: 800, mt: 1 }}>
        操作マニュアル
      </Typography>
      <Typography variant="body1" color="text.secondary" paragraph>
        PMO Management System の主な機能と操作手順をまとめました。画面上部の
        <strong>ヘルプ（?）</strong>
        アイコンからいつでも開けます。
      </Typography>

      <Paper variant="outlined" sx={{ p: 2, mb: 4, bgcolor: 'grey.50' }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700 }}>
          目次（クリックでジャンプ）
        </Typography>
        <Stack direction="row" flexWrap="wrap" gap={0.75}>
          {toc.map((item) => (
            <MuiLink
              key={item.id}
              href={`#${item.id}`}
              underline="hover"
              sx={{ fontSize: '0.875rem' }}
            >
              {item.label}
            </MuiLink>
          ))}
        </Stack>
      </Paper>

      <Section id="manual-intro" title="はじめに">
        <Typography variant="body1" paragraph>
          本システムは、プロジェクトの進捗・タスク・コミュニケーションを一か所で管理するためのツールです。左のサイドメニューで各画面に移動し、プロジェクトごとの詳細は「プロジェクト一覧」から開きます。
        </Typography>
        <List dense>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <CheckCircleOutlineIcon color="primary" fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="業務データはプロジェクト単位で整理されます。" />
          </ListItem>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <CheckCircleOutlineIcon color="primary" fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="タスクへのコメントや進捗報告では、テキストに加えて画像の貼り付け（Ctrl+V）が利用できます。" />
          </ListItem>
        </List>
      </Section>

      <Section id="manual-layout" title="画面の構成">
        <ManualFigure
          src={manualSrc('screen-layout.svg')}
          alt="画面上部のアプリバー、左サイドメニュー、中央のメイン領域を示す概念図"
          caption="図：典型的な画面レイアウト。左で画面を切り替え、上部からヘルプ・お気に入り・ユーザー設定にアクセスします。"
        />
        <Typography variant="body1" paragraph>
          <strong>アプリバー（画面上部）</strong>
          ：システム名の右側に、お気に入り（ハート）、ユーザーアバター（パスワード変更・ログアウト）があります。その左に
          <strong>ヘルプ（?）</strong>
          があり、本マニュアルを表示します。
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>サイドメニュー</strong>
          ：ダッシュボード、プロジェクト一覧、タスク一覧、マイToDo などへ移動します。下部には登録したお気に入りリンクが並び、ドラッグで並べ替えできます。
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>メイン領域</strong>
          ：選択した画面の一覧・フォーム・詳細が表示されます。
        </Typography>
      </Section>

      <Section id="manual-auth" title="ログインとアカウント">
        <Typography variant="body1" paragraph>
          初回は管理者から案内された URL でログインします。パスワードを忘れた場合はログイン画面の「パスワードを忘れた場合」から再設定の流れに進みます（メール設定が有効な環境を想定）。
        </Typography>
        <Typography variant="body1" paragraph>
          ログイン後、右上のアバターから
          <strong>パスワード変更</strong>
          を行えます。共有端末を使ったあとは必ずログアウトしてください。
        </Typography>
      </Section>

      <Section id="manual-dashboard" title="ダッシュボード">
        <Typography variant="body1" paragraph>
          ログイン直後のホームです。プロジェクトやタスクのサマリー、期限が近い項目など、日々の確認に使う情報がまとまっています（表示内容は運用設定により異なります）。
        </Typography>
      </Section>

      <Section id="manual-projects" title="プロジェクトとタスク">
        <ManualFigure
          src={manualSrc('project-tasks.svg')}
          alt="プロジェクトからタスクやコメントへ進むイメージ"
          caption="図：プロジェクトを開くと、タスク一覧・コメント・担当者などプロジェクト単位の情報にアクセスできます。"
        />
        <Typography variant="body1" paragraph>
          <strong>プロジェクト一覧</strong>
          から対象プロジェクトを選ぶと、プロジェクト詳細画面が開きます。ここでタスクの追加・編集、ステータスや担当者の更新、コメントの投稿ができます。
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>タスクのコメント欄</strong>
          では、通常どおり文字を入力できるほか、スクリーンショットなどを
          <strong>Ctrl+V（貼り付け）</strong>
          で追加できます。貼り付けた画像はサムネイルで確認でき、クリックで拡大表示されます。枚数には上限があります。
        </Typography>
        <Typography variant="body1" paragraph>
          コメント送信は多くの画面で
          <strong>Shift+Enter</strong>
          で改行、
          <strong>Enter</strong>
          で送信といった操作が使われます（画面に案内が出ます）。
        </Typography>
      </Section>

      <Section id="manual-phase-evm" title="フェーズゲートと進捗（EVM）">
        <ManualFigure
          src={manualSrc('evm-progress.svg')}
          alt="EVMの棒グラフと曲線のイメージ"
          caption="図：記録した指標から進捗を可視化するイメージ。実際の画面では日付ごとに数値を入力します。"
        />
        <Typography variant="body1" paragraph>
          プロジェクト詳細から、タブまたはメニュー経由で
          <strong>フェーズゲート</strong>
          および
          <strong>進捗確認（EVM）</strong>
          の各画面に移動できます。
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>進捗確認（EVM）</strong>
          では、BAC・PV・EV・AC などの値を記録し、プロジェクトの価値・進捗を追跡します。
          <strong>進捗報告内容</strong>
          欄には状況説明のテキストに加え、コメントと同様に
          <strong>画像の貼り付け</strong>
          が可能です。内容は保存のうえ、必要に応じてタスク化する操作も利用できます。
        </Typography>
        <Typography variant="body1" paragraph>
          <strong>フェーズゲート</strong>
          では、フェーズごとのレビューやコメントを残せます。操作は画面内の説明に従ってください。
        </Typography>
      </Section>

      <Section id="manual-task-list" title="タスク一覧">
        <Typography variant="body1" paragraph>
          サイドメニューの
          <strong>タスク一覧</strong>
          では、権限の範囲内のタスクを横断的に一覧できます。プロジェクト名・ステータス・担当者・期日などで絞り込み、キーワード検索も利用できます。日々のタスク洗い出しや全体レビューに使います。
        </Typography>
      </Section>

      <Section id="manual-mytodo" title="マイToDo">
        <ManualFigure
          src={manualSrc('my-todo.svg')}
          alt="チェックリストとフィルタのイメージ"
          caption="図：個人用の ToDo 一覧。完了／未完了の切り替えやフィルタで目的の項目を探しやすくします。"
        />
        <Typography variant="body1" paragraph>
          <strong>マイToDo</strong>
          は、プロジェクトのタスクとは別の、個人メモ用の ToDo です。他のユーザーからは見えません。
        </Typography>
        <List dense>
          <ListItem>
            <ListItemText
              primary="未完了・完了の表示切替、キーワード検索、期日（あり／なし／期限切れ）で絞り込みができます。"
            />
          </ListItem>
          <ListItem>
            <ListItemText primary="編集画面のメモ欄では、Ctrl+V で画像を貼り付け可能です（枚数上限あり）。" />
          </ListItem>
          <ListItem>
            <ListItemText primary="「すべて」表示時のみ、ドラッグで並べ替えできます。絞り込み中は並べ替えできません。" />
          </ListItem>
        </List>
      </Section>

      <Section id="manual-favorites" title="お気に入り">
        <Typography variant="body1" paragraph>
          アプリバーの
          <strong>ハート</strong>
          から、現在開いている画面をお気に入りに登録できます。登録したリンクはサイドメニュー下部に表示され、名前の変更や並べ替え（ドラッグ）、削除が可能です。よく使うプロジェクト詳細や進捗画面へすばやく移動するために活用してください。
        </Typography>
      </Section>

      <Section id="manual-admin" title="管理者向け機能">
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
          <AdminPanelSettingsIcon color="action" />
          <Typography variant="body2" color="text.secondary">
            以下のメニューは管理者アカウントのみサイドバーに表示されます。
          </Typography>
        </Box>
        <List dense>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <InfoOutlinedIcon color="info" fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="操作履歴" secondary="システム上の主な操作の記録を参照します。" />
          </ListItem>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <InfoOutlinedIcon color="info" fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="通知設定" secondary="アクティビティ通知まわりの設定を行います。" />
          </ListItem>
          <ListItem>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <InfoOutlinedIcon color="info" fontSize="small" />
            </ListItemIcon>
            <ListItemText primary="グループ / メンバー" secondary="利用者やグループの管理に使います。" />
          </ListItem>
        </List>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          一般ユーザーには表示されないため、権限に応じた案内を管理者側で行ってください。
        </Typography>
      </Section>

      <Paper variant="outlined" sx={{ p: 2, bgcolor: 'primary.50', borderColor: 'primary.light' }}>
        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 700 }}>
          困ったときは
        </Typography>
        <Typography variant="body2" color="text.secondary">
          操作で分からない点は、システム管理者または PMO 担当へお問い合わせください。画面に表示されるエラーメッセージは、そのまま伝えると原因調査がスムーズです。
        </Typography>
      </Paper>
    </Container>
  );
}
