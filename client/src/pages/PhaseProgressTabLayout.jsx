import { Outlet, useNavigate, useParams, useLocation } from 'react-router-dom';
import { Box, Tabs, Tab } from '@mui/material';

/**
 * フェーズゲートと進捗確認（EVM）を同一画面内のタブで切り替え
 */
export default function PhaseProgressTabLayout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const lastSegment = location.pathname.split('/').filter(Boolean).pop();
  const tabValue = lastSegment === 'progress' ? 1 : 0;

  const handleChange = (_, newValue) => {
    if (newValue === 0) {
      navigate(`/projects/${id}/phase-gates`);
    } else {
      navigate(`/projects/${id}/progress`);
    }
  };

  return (
    <Box>
      <Tabs
        value={tabValue}
        onChange={handleChange}
        sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}
        aria-label="フェーズゲートと進捗確認の切り替え"
      >
        <Tab label="フェーズゲート" id="project-tab-phase-gates" aria-controls="project-tab-panel" />
        <Tab label="進捗確認（EVM）" id="project-tab-progress" aria-controls="project-tab-panel" />
      </Tabs>
      <Box role="tabpanel" id="project-tab-panel" aria-labelledby={tabValue === 0 ? 'project-tab-phase-gates' : 'project-tab-progress'}>
        <Outlet />
      </Box>
    </Box>
  );
}
