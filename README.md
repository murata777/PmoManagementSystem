# PMO Management System

Node.js と React で構築したプロジェクト管理システムです。

## 機能

- **ダッシュボード** - プロジェクト・タスクの統計とグラフ表示
- **プロジェクト管理** - プロジェクトの登録・編集・削除・進捗管理
- **タスク管理** - プロジェクトごとのタスク管理
- **メンバー管理** - チームメンバーの管理

## 技術スタック

- **フロントエンド**: React, Vite, Material UI, Recharts
- **バックエンド**: Node.js, Express
- **データベース**: SQLite

## 起動方法

### バックエンド（ポート5000）
```bash
cd server
node index.js
```

### フロントエンド（ポート3000）
```bash
cd client
npx vite
```

ブラウザで `http://localhost:3000` を開いてください。
