import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Container, Box, Tabs, Tab } from '@mui/material';
import { useState } from 'react';
import SessionRecorder from './components/SessionRecorder';
import Dashboard from './components/Dashboard';
import ApprovalQueue from './components/ApprovalQueue';
import PlayerList from './components/PlayerList';

function App() {
  const [currentTab, setCurrentTab] = useState(0);

  return (
    <BrowserRouter>
      <Box sx={{ flexGrow: 1 }}>
        <AppBar position="static" sx={{ background: 'linear-gradient(45deg, #6200ee 30%, #9c27b0 90%)' }}>
          <Toolbar>
            <Typography variant="h5" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
              🎲 Dungeons ADK
            </Typography>
          </Toolbar>
          <Tabs 
            value={currentTab} 
            onChange={(e, v) => setCurrentTab(v)}
            textColor="inherit"
            indicatorColor="secondary"
            sx={{ px: 2 }}
          >
            <Tab label="Record Session" component={Link} to="/" />
            <Tab label="Dashboard" component={Link} to="/dashboard" />
            <Tab label="Approvals" component={Link} to="/approvals" />
            <Tab label="Players" component={Link} to="/players" />
          </Tabs>
        </AppBar>

        <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
          <Routes>
            <Route path="/" element={<SessionRecorder />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/approvals" element={<ApprovalQueue />} />
            <Route path="/players" element={<PlayerList />} />
          </Routes>
        </Container>

        <Box component="footer" sx={{ py: 3, px: 2, mt: 'auto', backgroundColor: '#f5f5f5', textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            Built with ❤️ for D&D Players | Powered by Google ADK & Claude
          </Typography>
        </Box>
      </Box>
    </BrowserRouter>
  );
}

export default App;