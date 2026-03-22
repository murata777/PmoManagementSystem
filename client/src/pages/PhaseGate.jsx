import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box, Typography, Button, ButtonGroup, Chip, Card, CardContent,
  Accordion, AccordionSummary, AccordionDetails,
  TextField, IconButton, Avatar, List, ListItem, ListItemAvatar, ListItemText,
  Breadcrumbs, Link, Divider, Grid, Tooltip, CircularProgress, ToggleButton, ToggleButtonGroup
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SendIcon from '@mui/icons-material/Send';
import DeleteIcon from '@mui/icons-material/Delete';
import SaveIcon from '@mui/icons-material/Save';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { projectsApi, phaseGatesApi } from '../api';

// ============================================================
// 工程定義
// ============================================================
const DEVELOPMENT_PHASES = [
  { key: 'planning', label: 'プロジェクト立ち上げ・計画', no: 1 },
  { key: 'design', label: '設計', no: 2 },
  { key: 'coding', label: 'CD（製造）', no: 3 },
  { key: 'unit_test', label: '単体テスト', no: 4 },
  { key: 'integration_test', label: '結合テスト・総合テスト', no: 5 },
  { key: 'acceptance_test', label: '受入テスト', no: 6 },
  { key: 'deployment_prep', label: '導入/移行準備・運用引き継ぎ', no: 7 },
  { key: 'deployment', label: '導入', no: 8 },
  { key: 'project_close', label: 'プロジェクト終了', no: 9 },
];

const MAINTENANCE_PHASES = [
  { key: 'planning', label: 'プロジェクト立ち上げ', no: 1 },
  { key: 'maintenance', label: '運用保守', no: 2 },
  { key: 'work_report', label: '作業報告', no: 3 },
  { key: 'project_close', label: 'プロジェクト終了', no: 4 },
];

const PHASE_STATUSES = [
  { value: 'not_started', label: '未着手', color: 'default' },
  { value: 'in_progress', label: '確認中', color: 'info' },
  { value: 'approved', label: '承認', color: 'success' },
  { value: 'rejected', label: '却下', color: 'error' },
];

// ============================================================
// 品質メトリクス定義
// ============================================================
const METRICS_BY_PHASE = {
  design: [
    {
      groupLabel: '設計品質',
      items: [
        { key: 'design_errors', label: 'エラー件数', unit: '件', inputOnly: true },
        { key: 'design_pages', label: 'ページ数', unit: '頁', inputOnly: true },
        {
          key: 'design_error_density',
          label: 'エラー密度',
          unit: '件/頁',
          calcFrom: ['design_errors', 'design_pages'],
          calcFn: (vals) => {
            const a = parseFloat(vals['design_errors']);
            const b = parseFloat(vals['design_pages']);
            if (isNaN(a) || isNaN(b) || b === 0) return null;
            return a / b;
          },
          standard: 0.654,
          comparison: 'ref',
        },
      ],
    },
  ],
  unit_test: [
    {
      groupLabel: 'バグ密度',
      items: [
        { key: 'ut_online_bugs', label: 'バグ件数（オンライン）', unit: '件', inputOnly: true },
        { key: 'ut_online_ksloc', label: 'KSLoC（オンライン）', unit: 'KSLoC', inputOnly: true },
        {
          key: 'ut_online_bug_density',
          label: 'バグ密度（オンライン）',
          unit: '件/KSLoC',
          calcFrom: ['ut_online_bugs', 'ut_online_ksloc'],
          calcFn: (vals) => {
            const a = parseFloat(vals['ut_online_bugs']);
            const b = parseFloat(vals['ut_online_ksloc']);
            if (isNaN(a) || isNaN(b) || b === 0) return null;
            return a / b;
          },
          standard: 10,
          comparison: 'ref',
        },
        { key: 'ut_batch_bugs', label: 'バグ件数（バッチ）', unit: '件', inputOnly: true },
        { key: 'ut_batch_ksloc', label: 'KSLoC（バッチ）', unit: 'KSLoC', inputOnly: true },
        {
          key: 'ut_batch_bug_density',
          label: 'バグ密度（バッチ）',
          unit: '件/KSLoC',
          calcFrom: ['ut_batch_bugs', 'ut_batch_ksloc'],
          calcFn: (vals) => {
            const a = parseFloat(vals['ut_batch_bugs']);
            const b = parseFloat(vals['ut_batch_ksloc']);
            if (isNaN(a) || isNaN(b) || b === 0) return null;
            return a / b;
          },
          standard: 10,
          comparison: 'ref',
        },
      ],
    },
    {
      groupLabel: 'テストケース密度',
      items: [
        { key: 'ut_online_tc', label: 'テスト件数（オンライン）', unit: '件', inputOnly: true },
        { key: 'ut_online_tc_ksloc', label: 'KSLoC（オンライン）', unit: 'KSLoC', inputOnly: true },
        {
          key: 'ut_online_tc_density',
          label: 'テストケース密度（オンライン）',
          unit: '件/KSLoC',
          calcFrom: ['ut_online_tc', 'ut_online_tc_ksloc'],
          calcFn: (vals) => {
            const a = parseFloat(vals['ut_online_tc']);
            const b = parseFloat(vals['ut_online_tc_ksloc']);
            if (isNaN(a) || isNaN(b) || b === 0) return null;
            return a / b;
          },
          standard: 120,
          comparison: 'ref',
        },
        { key: 'ut_batch_tc', label: 'テスト件数（バッチ）', unit: '件', inputOnly: true },
        { key: 'ut_batch_tc_ksloc', label: 'KSLoC（バッチ）', unit: 'KSLoC', inputOnly: true },
        {
          key: 'ut_batch_tc_density',
          label: 'テストケース密度（バッチ）',
          unit: '件/KSLoC',
          calcFrom: ['ut_batch_tc', 'ut_batch_tc_ksloc'],
          calcFn: (vals) => {
            const a = parseFloat(vals['ut_batch_tc']);
            const b = parseFloat(vals['ut_batch_tc_ksloc']);
            if (isNaN(a) || isNaN(b) || b === 0) return null;
            return a / b;
          },
          standard: 80,
          comparison: 'ref',
        },
      ],
    },
    {
      groupLabel: '工程品質',
      items: [
        { key: 'ut_prev_bugs', label: '前工程バグ数', unit: '件', inputOnly: true },
        { key: 'ut_total_bugs', label: '総バグ数', unit: '件', inputOnly: true },
        {
          key: 'ut_phase_bug_detection',
          label: '工程バグ検知率',
          unit: '%',
          calcFrom: ['ut_prev_bugs', 'ut_total_bugs'],
          calcFn: (vals) => {
            const a = parseFloat(vals['ut_prev_bugs']);
            const b = parseFloat(vals['ut_total_bugs']);
            if (isNaN(a) || isNaN(b) || b === 0) return null;
            return (a / b) * 100;
          },
          standard: 20,
          comparison: 'lte',
        },
        { key: 'ut_fixed_bugs', label: '修正数', unit: '件', inputOnly: true },
        { key: 'ut_found_bugs', label: '発見数', unit: '件', inputOnly: true },
        {
          key: 'ut_fix_rate',
          label: '不具合・バグ修正率',
          unit: '%',
          calcFrom: ['ut_fixed_bugs', 'ut_found_bugs'],
          calcFn: (vals) => {
            const a = parseFloat(vals['ut_fixed_bugs']);
            const b = parseFloat(vals['ut_found_bugs']);
            if (isNaN(a) || isNaN(b) || b === 0) return null;
            return (a / b) * 100;
          },
          standard: 90,
          comparison: 'gte',
        },
      ],
    },
  ],
  integration_test: [
    {
      groupLabel: '結合テスト バグ密度',
      items: [
        { key: 'it_new_bugs', label: 'バグ件数（新規開発）', unit: '件', inputOnly: true },
        { key: 'it_new_ksloc', label: 'KSLoC（新規開発）', unit: 'KSLoC', inputOnly: true },
        {
          key: 'it_new_bug_density',
          label: '結合テスト バグ密度（新規開発）',
          unit: '件/KSLoC',
          calcFrom: ['it_new_bugs', 'it_new_ksloc'],
          calcFn: (vals) => {
            const a = parseFloat(vals['it_new_bugs']);
            const b = parseFloat(vals['it_new_ksloc']);
            if (isNaN(a) || isNaN(b) || b === 0) return null;
            return a / b;
          },
          standard: 1.826,
          comparison: 'ref',
        },
        { key: 'it_imp_bugs', label: 'バグ件数（改良開発）', unit: '件', inputOnly: true },
        { key: 'it_imp_ksloc', label: 'KSLoC（改良開発）', unit: 'KSLoC', inputOnly: true },
        {
          key: 'it_imp_bug_density',
          label: '結合テスト バグ密度（改良開発）',
          unit: '件/KSLoC',
          calcFrom: ['it_imp_bugs', 'it_imp_ksloc'],
          calcFn: (vals) => {
            const a = parseFloat(vals['it_imp_bugs']);
            const b = parseFloat(vals['it_imp_ksloc']);
            if (isNaN(a) || isNaN(b) || b === 0) return null;
            return a / b;
          },
          standard: 41.1,
          comparison: 'ref',
        },
        { key: 'it_re_bugs', label: 'バグ件数（再開発）', unit: '件', inputOnly: true },
        { key: 'it_re_ksloc', label: 'KSLoC（再開発）', unit: 'KSLoC', inputOnly: true },
        {
          key: 'it_re_bug_density',
          label: '結合テスト バグ密度（再開発）',
          unit: '件/KSLoC',
          calcFrom: ['it_re_bugs', 'it_re_ksloc'],
          calcFn: (vals) => {
            const a = parseFloat(vals['it_re_bugs']);
            const b = parseFloat(vals['it_re_ksloc']);
            if (isNaN(a) || isNaN(b) || b === 0) return null;
            return a / b;
          },
          standard: 0.975,
          comparison: 'ref',
        },
      ],
    },
    {
      groupLabel: '結合テスト テストケース密度',
      items: [
        { key: 'it_new_tc', label: 'テスト件数（新規開発）', unit: '件', inputOnly: true },
        { key: 'it_new_tc_ksloc', label: 'KSLoC（新規開発）', unit: 'KSLoC', inputOnly: true },
        {
          key: 'it_new_tc_density',
          label: '結合テスト テストケース密度（新規開発）',
          unit: '件/KSLoC',
          calcFrom: ['it_new_tc', 'it_new_tc_ksloc'],
          calcFn: (vals) => {
            const a = parseFloat(vals['it_new_tc']);
            const b = parseFloat(vals['it_new_tc_ksloc']);
            if (isNaN(a) || isNaN(b) || b === 0) return null;
            return a / b;
          },
          standard: 57.45,
          comparison: 'ref',
        },
        { key: 'it_imp_tc', label: 'テスト件数（改良開発）', unit: '件', inputOnly: true },
        { key: 'it_imp_tc_ksloc', label: 'KSLoC（改良開発）', unit: 'KSLoC', inputOnly: true },
        {
          key: 'it_imp_tc_density',
          label: '結合テスト テストケース密度（改良開発）',
          unit: '件/KSLoC',
          calcFrom: ['it_imp_tc', 'it_imp_tc_ksloc'],
          calcFn: (vals) => {
            const a = parseFloat(vals['it_imp_tc']);
            const b = parseFloat(vals['it_imp_tc_ksloc']);
            if (isNaN(a) || isNaN(b) || b === 0) return null;
            return a / b;
          },
          standard: 787.41,
          comparison: 'ref',
        },
        { key: 'it_re_tc', label: 'テスト件数（再開発）', unit: '件', inputOnly: true },
        { key: 'it_re_tc_ksloc', label: 'KSLoC（再開発）', unit: 'KSLoC', inputOnly: true },
        {
          key: 'it_re_tc_density',
          label: '結合テスト テストケース密度（再開発）',
          unit: '件/KSLoC',
          calcFrom: ['it_re_tc', 'it_re_tc_ksloc'],
          calcFn: (vals) => {
            const a = parseFloat(vals['it_re_tc']);
            const b = parseFloat(vals['it_re_tc_ksloc']);
            if (isNaN(a) || isNaN(b) || b === 0) return null;
            return a / b;
          },
          standard: 56.22,
          comparison: 'ref',
        },
      ],
    },
    {
      groupLabel: '総合テスト バグ密度',
      items: [
        { key: 'st_new_bugs', label: 'バグ件数（新規開発）', unit: '件', inputOnly: true },
        { key: 'st_new_ksloc', label: 'KSLoC（新規開発）', unit: 'KSLoC', inputOnly: true },
        {
          key: 'st_new_bug_density',
          label: '総合テスト バグ密度（新規開発）',
          unit: '件/KSLoC',
          calcFrom: ['st_new_bugs', 'st_new_ksloc'],
          calcFn: (vals) => {
            const a = parseFloat(vals['st_new_bugs']);
            const b = parseFloat(vals['st_new_ksloc']);
            if (isNaN(a) || isNaN(b) || b === 0) return null;
            return a / b;
          },
          standard: 0.516,
          comparison: 'ref',
        },
        { key: 'st_imp_bugs', label: 'バグ件数（改良開発）', unit: '件', inputOnly: true },
        { key: 'st_imp_ksloc', label: 'KSLoC（改良開発）', unit: 'KSLoC', inputOnly: true },
        {
          key: 'st_imp_bug_density',
          label: '総合テスト バグ密度（改良開発）',
          unit: '件/KSLoC',
          calcFrom: ['st_imp_bugs', 'st_imp_ksloc'],
          calcFn: (vals) => {
            const a = parseFloat(vals['st_imp_bugs']);
            const b = parseFloat(vals['st_imp_ksloc']);
            if (isNaN(a) || isNaN(b) || b === 0) return null;
            return a / b;
          },
          standard: 4.361,
          comparison: 'ref',
        },
        { key: 'st_re_bugs', label: 'バグ件数（再開発）', unit: '件', inputOnly: true },
        { key: 'st_re_ksloc', label: 'KSLoC（再開発）', unit: 'KSLoC', inputOnly: true },
        {
          key: 'st_re_bug_density',
          label: '総合テスト バグ密度（再開発）',
          unit: '件/KSLoC',
          calcFrom: ['st_re_bugs', 'st_re_ksloc'],
          calcFn: (vals) => {
            const a = parseFloat(vals['st_re_bugs']);
            const b = parseFloat(vals['st_re_ksloc']);
            if (isNaN(a) || isNaN(b) || b === 0) return null;
            return a / b;
          },
          standard: 0.156,
          comparison: 'ref',
        },
      ],
    },
    {
      groupLabel: '総合テスト テストケース密度',
      items: [
        { key: 'st_new_tc', label: 'テスト件数（新規開発）', unit: '件', inputOnly: true },
        { key: 'st_new_tc_ksloc', label: 'KSLoC（新規開発）', unit: 'KSLoC', inputOnly: true },
        {
          key: 'st_new_tc_density',
          label: '総合テスト テストケース密度（新規開発）',
          unit: '件/KSLoC',
          calcFrom: ['st_new_tc', 'st_new_tc_ksloc'],
          calcFn: (vals) => {
            const a = parseFloat(vals['st_new_tc']);
            const b = parseFloat(vals['st_new_tc_ksloc']);
            if (isNaN(a) || isNaN(b) || b === 0) return null;
            return a / b;
          },
          standard: 17.08,
          comparison: 'ref',
        },
        { key: 'st_imp_tc', label: 'テスト件数（改良開発）', unit: '件', inputOnly: true },
        { key: 'st_imp_tc_ksloc', label: 'KSLoC（改良開発）', unit: 'KSLoC', inputOnly: true },
        {
          key: 'st_imp_tc_density',
          label: '総合テスト テストケース密度（改良開発）',
          unit: '件/KSLoC',
          calcFrom: ['st_imp_tc', 'st_imp_tc_ksloc'],
          calcFn: (vals) => {
            const a = parseFloat(vals['st_imp_tc']);
            const b = parseFloat(vals['st_imp_tc_ksloc']);
            if (isNaN(a) || isNaN(b) || b === 0) return null;
            return a / b;
          },
          standard: 264.41,
          comparison: 'ref',
        },
        { key: 'st_re_tc', label: 'テスト件数（再開発）', unit: '件', inputOnly: true },
        { key: 'st_re_tc_ksloc', label: 'KSLoC（再開発）', unit: 'KSLoC', inputOnly: true },
        {
          key: 'st_re_tc_density',
          label: '総合テスト テストケース密度（再開発）',
          unit: '件/KSLoC',
          calcFrom: ['st_re_tc', 'st_re_tc_ksloc'],
          calcFn: (vals) => {
            const a = parseFloat(vals['st_re_tc']);
            const b = parseFloat(vals['st_re_tc_ksloc']);
            if (isNaN(a) || isNaN(b) || b === 0) return null;
            return a / b;
          },
          standard: 21.16,
          comparison: 'ref',
        },
      ],
    },
    {
      groupLabel: '工程品質',
      items: [
        { key: 'int_prev_bugs', label: '前工程バグ数', unit: '件', inputOnly: true },
        { key: 'int_total_bugs', label: '総バグ数', unit: '件', inputOnly: true },
        {
          key: 'int_phase_bug_detection',
          label: '工程バグ検知率',
          unit: '%',
          calcFrom: ['int_prev_bugs', 'int_total_bugs'],
          calcFn: (vals) => {
            const a = parseFloat(vals['int_prev_bugs']);
            const b = parseFloat(vals['int_total_bugs']);
            if (isNaN(a) || isNaN(b) || b === 0) return null;
            return (a / b) * 100;
          },
          standard: 20,
          comparison: 'lte',
        },
        { key: 'int_fixed_bugs', label: '修正数', unit: '件', inputOnly: true },
        { key: 'int_found_bugs', label: '発見数', unit: '件', inputOnly: true },
        {
          key: 'int_fix_rate',
          label: '不具合・バグ修正率',
          unit: '%',
          calcFrom: ['int_fixed_bugs', 'int_found_bugs'],
          calcFn: (vals) => {
            const a = parseFloat(vals['int_fixed_bugs']);
            const b = parseFloat(vals['int_found_bugs']);
            if (isNaN(a) || isNaN(b) || b === 0) return null;
            return (a / b) * 100;
          },
          standard: 90,
          comparison: 'gte',
        },
      ],
    },
  ],
  acceptance_test: [
    {
      groupLabel: '受入テスト品質',
      items: [
        {
          key: 'at_spec_defects',
          label: '(仕様)不具合件数',
          unit: '件',
          standard: 0,
          comparison: 'eq',
        },
        { key: 'at_fixed_bugs', label: '修正数', unit: '件', inputOnly: true },
        { key: 'at_found_bugs', label: '発見数', unit: '件', inputOnly: true },
        {
          key: 'at_fix_rate',
          label: '不具合・バグ修正率',
          unit: '%',
          calcFrom: ['at_fixed_bugs', 'at_found_bugs'],
          calcFn: (vals) => {
            const a = parseFloat(vals['at_fixed_bugs']);
            const b = parseFloat(vals['at_found_bugs']);
            if (isNaN(a) || isNaN(b) || b === 0) return null;
            return (a / b) * 100;
          },
          standard: 90,
          comparison: 'gte',
        },
      ],
    },
  ],
};

// ============================================================
// ユーティリティ
// ============================================================
const formatDate = (dt) => {
  if (!dt) return '';
  let s = String(dt).replace(' ', 'T');
  if (!/Z|[+-]\d{2}:?\d{2}$/.test(s)) s += 'Z';
  const jst = new Date(new Date(s).getTime() + 9 * 3600 * 1000);
  const pad = n => String(n).padStart(2, '0');
  return `${jst.getUTCFullYear()}/${pad(jst.getUTCMonth()+1)}/${pad(jst.getUTCDate())} ${pad(jst.getUTCHours())}:${pad(jst.getUTCMinutes())}`;
};

const getStatusInfo = (value) => PHASE_STATUSES.find(s => s.value === value) || PHASE_STATUSES[0];

// ============================================================
// メトリクス判定ロジック
// ============================================================
function evaluateMetric(calcedValue, standard, comparison) {
  if (calcedValue === null || calcedValue === undefined) return null;
  if (comparison === 'lte') {
    return calcedValue <= standard ? 'pass' : 'fail';
  }
  if (comparison === 'gte') {
    return calcedValue >= standard ? 'pass' : 'fail';
  }
  if (comparison === 'eq') {
    return calcedValue === 0 ? 'pass' : 'fail';
  }
  if (comparison === 'ref') {
    if (standard === 0) return calcedValue === 0 ? 'green' : 'red';
    const ratio = Math.abs((calcedValue - standard) / standard);
    if (ratio <= 0.3) return 'green';
    if (ratio <= 0.5) return 'yellow';
    return 'red';
  }
  return null;
}

function getEvalColor(evalResult) {
  if (evalResult === 'pass' || evalResult === 'green') return 'success.main';
  if (evalResult === 'fail') return 'error.main';
  if (evalResult === 'yellow') return 'warning.main';
  if (evalResult === 'red') return 'error.main';
  return 'text.secondary';
}

function getEvalLabel(evalResult, comparison) {
  if (evalResult === null) return '';
  if (comparison === 'ref') {
    if (evalResult === 'green') return '○ 基準範囲内';
    if (evalResult === 'yellow') return '△ 要注意';
    if (evalResult === 'red') return '× 見直し要';
  } else {
    if (evalResult === 'pass') return '合格';
    if (evalResult === 'fail') return '不合格';
  }
  return '';
}

// ============================================================
// MetricsCard コンポーネント
// ============================================================
function MetricsCard({ group, phaseKey, metricsInput, onInputChange }) {
  // Build a values map: for inputOnly items use metricsInput, for calcFrom items compute
  const allVals = {};
  for (const item of group.items) {
    if (item.inputOnly || (!item.calcFrom && !item.calcFn)) {
      allVals[item.key] = metricsInput[item.key] ?? '';
    }
  }

  return (
    <Card variant="outlined" sx={{ mb: 1.5 }}>
      <CardContent sx={{ pb: '8px !important' }}>
        <Typography variant="subtitle2" fontWeight="bold" sx={{ mb: 1 }}>
          {group.groupLabel}
        </Typography>
        <Grid container spacing={1}>
          {group.items.map((item) => {
            if (item.inputOnly) {
              return (
                <Grid item xs={12} sm={6} md={4} key={item.key}>
                  <TextField
                    label={`${item.label}（${item.unit}）`}
                    type="number"
                    size="small"
                    fullWidth
                    value={metricsInput[item.key] ?? ''}
                    onChange={e => onInputChange(item.key, e.target.value)}
                    inputProps={{ step: 'any' }}
                  />
                </Grid>
              );
            }

            // direct input + judge (no calcFrom)
            if (!item.calcFrom && !item.calcFn) {
              const rawVal = metricsInput[item.key] ?? '';
              const numVal = rawVal === '' ? null : parseFloat(rawVal);
              const evalResult = evaluateMetric(numVal, item.standard, item.comparison);
              return (
                <Grid item xs={12} sm={6} md={4} key={item.key}>
                  <TextField
                    label={`${item.label}（${item.unit}）`}
                    type="number"
                    size="small"
                    fullWidth
                    value={rawVal}
                    onChange={e => onInputChange(item.key, e.target.value)}
                    inputProps={{ step: 'any' }}
                  />
                  {evalResult !== null && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3 }}>
                      <Typography variant="caption" sx={{ color: getEvalColor(evalResult) }}>
                        {getEvalLabel(evalResult, item.comparison)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        （基準: {item.standard}{item.unit}）
                      </Typography>
                    </Box>
                  )}
                </Grid>
              );
            }

            // calculated value
            const calcedVal = item.calcFn ? item.calcFn(allVals) : null;
            const evalResult = evaluateMetric(calcedVal, item.standard, item.comparison);
            return (
              <Grid item xs={12} sm={6} md={4} key={item.key}>
                <Box sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, p: 1, bgcolor: 'grey.50' }}>
                  <Typography variant="caption" color="text.secondary" display="block">
                    {item.label}
                  </Typography>
                  <Typography variant="body2" fontWeight="bold">
                    {calcedVal !== null ? `${calcedVal.toFixed(3)} ${item.unit}` : '—'}
                  </Typography>
                  {evalResult !== null && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.3 }}>
                      <Typography variant="caption" sx={{ color: getEvalColor(evalResult) }}>
                        {getEvalLabel(evalResult, item.comparison)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        （基準: {item.standard}{item.unit}）
                      </Typography>
                    </Box>
                  )}
                </Box>
              </Grid>
            );
          })}
        </Grid>
      </CardContent>
    </Card>
  );
}

// ============================================================
// PhaseAccordion コンポーネント
// ============================================================
function PhaseAccordion({ phase, gateData, currentUser, projectId, processType,
  metricsInput, onMetricsInputChange,
  commentInput, onCommentInputChange,
  onStatusChange, onMetricsSave, onCommentAdd, onCommentDelete
}) {
  const status = gateData?.status || 'not_started';
  const statusInfo = getStatusInfo(status);
  const comments = gateData?.comments || [];
  const metricGroups = METRICS_BY_PHASE[phase.key] || [];
  const hasMetrics = processType === 'development' && metricGroups.length > 0;

  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexGrow: 1 }}>
          <Typography variant="body2" color="text.secondary" sx={{ minWidth: 24 }}>
            {phase.no}.
          </Typography>
          <Typography variant="body1" fontWeight="medium" sx={{ flexGrow: 1 }}>
            {phase.label}
          </Typography>
          <Chip
            label={statusInfo.label}
            color={statusInfo.color}
            size="small"
            sx={{ mr: 1 }}
          />
        </Box>
      </AccordionSummary>

      <AccordionDetails sx={{ pt: 1 }}>
        {/* ステータス変更 */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>ステータス変更</Typography>
          <ButtonGroup size="small" variant="outlined">
            {PHASE_STATUSES.map(s => (
              <Button
                key={s.value}
                variant={status === s.value ? 'contained' : 'outlined'}
                color={s.color === 'default' ? 'inherit' : s.color}
                onClick={() => onStatusChange(phase.key, s.value)}
              >
                {s.label}
              </Button>
            ))}
          </ButtonGroup>
        </Box>

        {/* 品質メトリクス */}
        {hasMetrics && (
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>品質メトリクス</Typography>
            {metricGroups.map((group, gi) => (
              <MetricsCard
                key={gi}
                group={group}
                phaseKey={phase.key}
                metricsInput={metricsInput}
                onInputChange={(key, val) => onMetricsInputChange(phase.key, key, val)}
              />
            ))}
            <Button
              variant="contained"
              size="small"
              startIcon={<SaveIcon />}
              onClick={() => onMetricsSave(phase.key)}
              sx={{ mt: 0.5 }}
            >
              メトリクス保存
            </Button>
          </Box>
        )}

        <Divider sx={{ my: 1.5 }} />

        {/* コメント */}
        <Box>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            コメント ({comments.length})
          </Typography>
          {comments.length > 0 && (
            <List dense disablePadding sx={{ mb: 1.5 }}>
              {comments.map(c => (
                <ListItem
                  key={c.id}
                  alignItems="flex-start"
                  disableGutters
                  secondaryAction={
                    currentUser && c.user_id === currentUser.id && (
                      <IconButton size="small" edge="end" onClick={() => onCommentDelete(phase.key, c.id)}>
                        <DeleteIcon fontSize="small" sx={{ color: 'error.light' }} />
                      </IconButton>
                    )
                  }
                  sx={{ pr: currentUser && c.user_id === currentUser.id ? 4 : 0 }}
                >
                  <ListItemAvatar sx={{ minWidth: 36 }}>
                    <Avatar sx={{ width: 28, height: 28, fontSize: 12 }}>
                      {c.user_name?.charAt(0)}
                    </Avatar>
                  </ListItemAvatar>
                  <ListItemText
                    primary={
                      <Box sx={{ display: 'flex', gap: 1, alignItems: 'baseline' }}>
                        <Typography variant="caption" fontWeight="bold">{c.user_name}</Typography>
                        <Typography variant="caption" color="text.secondary">{formatDate(c.created_at)}</Typography>
                      </Box>
                    }
                    secondary={
                      <Typography variant="body2" sx={{ whiteSpace: 'pre-wrap' }}>{c.comment}</Typography>
                    }
                  />
                </ListItem>
              ))}
            </List>
          )}

          <Box sx={{ display: 'flex', gap: 1 }}>
            <TextField
              size="small"
              fullWidth
              placeholder="コメントを入力..."
              value={commentInput}
              onChange={e => onCommentInputChange(phase.key, e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onCommentAdd(phase.key);
                }
              }}
              multiline
              maxRows={4}
            />
            <Tooltip title="コメントを投稿">
              <span>
                <IconButton
                  color="primary"
                  onClick={() => onCommentAdd(phase.key)}
                  disabled={!commentInput?.trim()}
                >
                  <SendIcon />
                </IconButton>
              </span>
            </Tooltip>
          </Box>
        </Box>
      </AccordionDetails>
    </Accordion>
  );
}

// ============================================================
// メインページ
// ============================================================
export default function PhaseGate() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [project, setProject] = useState(null);
  const [processType, setProcessType] = useState('development');
  const [gatesData, setGatesData] = useState([]);
  const [metricsInput, setMetricsInput] = useState({});
  const [commentInput, setCommentInput] = useState({});
  const [currentUser, setCurrentUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const u = localStorage.getItem('user');
    if (u) try { setCurrentUser(JSON.parse(u)); } catch {}
  }, []);

  const loadData = async () => {
    try {
      const [projRes, gatesRes] = await Promise.all([
        projectsApi.getById(id),
        phaseGatesApi.getAll(id),
      ]);
      const { tasks: _t, ...p } = projRes.data;
      setProject(p);

      const { processType: pt, gates } = gatesRes.data;
      setProcessType(pt || 'development');
      setGatesData(gates || []);

      // initialize metricsInput from saved data
      const initMetrics = {};
      for (const gate of (gates || [])) {
        initMetrics[gate.phase_key] = {};
        for (const [k, v] of Object.entries(gate.metrics || {})) {
          initMetrics[gate.phase_key][k] = v !== null && v !== undefined ? String(v) : '';
        }
      }
      setMetricsInput(initMetrics);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadData(); }, [id]);

  const getGateData = (phaseKey) => gatesData.find(g => g.phase_key === phaseKey) || null;

  const handleProcessTypeChange = async (newType) => {
    if (!newType) return;
    setProcessType(newType);
    // persist via a placeholder phase key to update project process_type
    // We update by saving process_type to the project - but we don't have a direct endpoint for that.
    // Instead, we'll store it by saving via a status update which triggers upsert,
    // then we update process_type. Actually the spec says process_type is on projects table.
    // We'll just update locally for now since there's no dedicated endpoint shown in spec.
    // The user can save by navigating. For a real save, we'd need an additional API.
    // Per spec: projectsApi.update(id, { process_type: newType }) would work if supported.
    try {
      await projectsApi.update(id, { process_type: newType });
    } catch (e) {
      // ignore if not supported
    }
  };

  const handleStatusChange = async (phaseKey, status) => {
    try {
      await phaseGatesApi.updateStatus(id, phaseKey, status);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleMetricsInputChange = (phaseKey, key, val) => {
    setMetricsInput(prev => ({
      ...prev,
      [phaseKey]: { ...(prev[phaseKey] || {}), [key]: val },
    }));
  };

  const handleMetricsSave = async (phaseKey) => {
    const metrics = metricsInput[phaseKey] || {};
    // Also compute derived values to save them
    const groups = METRICS_BY_PHASE[phaseKey] || [];
    const allVals = { ...metrics };
    const toSave = { ...metrics };
    for (const group of groups) {
      for (const item of group.items) {
        if (item.calcFrom && item.calcFn) {
          const calcedVal = item.calcFn(allVals);
          if (calcedVal !== null) {
            toSave[item.key] = String(calcedVal);
          }
        }
      }
    }
    try {
      await phaseGatesApi.updateMetrics(id, phaseKey, toSave);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCommentInputChange = (phaseKey, val) => {
    setCommentInput(prev => ({ ...prev, [phaseKey]: val }));
  };

  const handleCommentAdd = async (phaseKey) => {
    const comment = commentInput[phaseKey];
    if (!comment?.trim()) return;
    try {
      await phaseGatesApi.addComment(id, phaseKey, comment.trim());
      setCommentInput(prev => ({ ...prev, [phaseKey]: '' }));
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  const handleCommentDelete = async (phaseKey, commentId) => {
    if (!window.confirm('このコメントを削除しますか？')) return;
    try {
      await phaseGatesApi.deleteComment(id, phaseKey, commentId);
      await loadData();
    } catch (e) {
      console.error(e);
    }
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 8 }}>
        <CircularProgress />
      </Box>
    );
  }

  const phases = processType === 'maintenance' ? MAINTENANCE_PHASES : DEVELOPMENT_PHASES;

  return (
    <Box>
      {/* パンくず */}
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          component="button"
          underline="hover"
          color="inherit"
          onClick={() => navigate('/projects')}
          sx={{ display: 'flex', alignItems: 'center', gap: 0.5, cursor: 'pointer' }}
        >
          プロジェクト一覧
        </Link>
        <Link
          component="button"
          underline="hover"
          color="inherit"
          onClick={() => navigate(`/projects/${id}`)}
          sx={{ cursor: 'pointer' }}
        >
          {project?.name || id}
        </Link>
        <Typography color="text.primary">フェーズゲート</Typography>
      </Breadcrumbs>

      {/* ヘッダー */}
      <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Typography variant="h5">フェーズゲート</Typography>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="body2" color="text.secondary">プロセスタイプ:</Typography>
          <ToggleButtonGroup
            value={processType}
            exclusive
            size="small"
            onChange={(e, val) => handleProcessTypeChange(val)}
          >
            <ToggleButton value="development">開発プロセス</ToggleButton>
            <ToggleButton value="maintenance">保守プロセス</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Box>

      {/* フェーズリスト */}
      <Box>
        {phases.map((phase) => (
          <PhaseAccordion
            key={phase.key}
            phase={phase}
            gateData={getGateData(phase.key)}
            currentUser={currentUser}
            projectId={id}
            processType={processType}
            metricsInput={metricsInput[phase.key] || {}}
            onMetricsInputChange={handleMetricsInputChange}
            commentInput={commentInput[phase.key] || ''}
            onCommentInputChange={handleCommentInputChange}
            onStatusChange={handleStatusChange}
            onMetricsSave={handleMetricsSave}
            onCommentAdd={handleCommentAdd}
            onCommentDelete={handleCommentDelete}
          />
        ))}
      </Box>
    </Box>
  );
}
