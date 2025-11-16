// frontend/src/App-with-auth.jsx
// Updated App.jsx with authentication
import { BrowserRouter, Routes, Route, Link, Navigate } from 'react-router-dom';
import { AppBar, Toolbar, Typography, Container, Box, Tabs, Tab, Button, Menu, MenuItem } from '@mui/material';
import { useState } from 'react';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AccountCircle, ExitToApp } from '@mui/icons-material';

// Components
import Login from './components/Login';
import ProtectedRoute from './components/ProtectedRoute';
import SessionRecorder from './components/SessionRecorder';
import Dashboard from './components/Dashboard';
import ApprovalQueue from './components/ApprovalQueue';
import PlayerList from './components/PlayerList';
import QueryInterface from './components/QueryInterface';

function AppContent() {
  const [currentTab, setCurrentTab] = useState(0);
  const [anchorEl, setAnchorEl] = useState(null);
  const { user, logout, isAdmin } = useAuth();

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = () => {
    logout();
    handleClose();
  };

  if (!user) {
    return <Login />;
  }

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" sx={{ background: 'linear-gradient(45deg, #6200ee 30%, #9c27b0 90%)' }}>
        <Toolbar>
          <Typography variant="h5" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
            🎲 Dungeons ADK
          </Typography>

          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Typography variant="body2">
              {user.username} {isAdmin() && '(Admin)'}
            </Typography>
            <Button
              color="inherit"
              onClick={handleMenu}
              startIcon={<AccountCircle />}
            >
              Account
            </Button>
            <Menu
              anchorEl={anchorEl}
              open={Boolean(anchorEl)}
              onClose={handleClose}
            >
              <MenuItem onClick={handleLogout}>
                <ExitToApp sx={{ mr: 1 }} fontSize="small" />
                Logout
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
        <Tabs 
          value={currentTab} 
          onChange={(e, v) => setCurrentTab(v)}
          textColor="inherit"
          indicatorColor="secondary"
          sx={{ px: 2 }}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab label="Record Session" component={Link} to="/" />
          <Tab label="Query History" component={Link} to="/query" />
          <Tab label="Dashboard" component={Link} to="/dashboard" />
          {isAdmin() && <Tab label="Approvals" component={Link} to="/approvals" />}
          <Tab label="Players" component={Link} to="/players" />
        </Tabs>
      </AppBar>

      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Routes>
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/" element={
            <ProtectedRoute>
              <SessionRecorder />
            </ProtectedRoute>
          } />
          <Route path="/query" element={
            <ProtectedRoute>
              <QueryInterface />
            </ProtectedRoute>
          } />
          <Route path="/dashboard" element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          } />
          <Route path="/approvals" element={
            <ProtectedRoute adminOnly>
              <ApprovalQueue />
            </ProtectedRoute>
          } />
          <Route path="/players" element={
            <ProtectedRoute>
              <PlayerList />
            </ProtectedRoute>
          } />
        </Routes>
      </Container>

      <Box component="footer" sx={{ py: 3, px: 2, mt: 'auto', backgroundColor: '#f5f5f5', textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          Built with ❤️ for the D&D Community | Powered by Google ADK, Claude & Pinecone
        </Typography>
      </Box>
    </Box>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;