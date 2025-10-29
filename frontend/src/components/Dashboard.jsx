import { useState, useEffect } from 'react';
import { 
  Box, Card, CardContent, Typography, Grid, CircularProgress,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow, 
  Paper, Chip, Button, Dialog, DialogTitle, DialogContent, DialogActions,
  Divider, Stack, Accordion, AccordionSummary, AccordionDetails
} from '@mui/material';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer 
} from 'recharts';
import { 
  Visibility, ExpandMore, Message, Email, Group as GroupIcon 
} from '@mui/icons-material';
import { api } from '../services/api';

export default function Dashboard() {
  const [stats, setStats] = useState(null);
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState(null);
  const [sessionDetails, setSessionDetails] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [statsRes, sessionsRes] = await Promise.all([
        api.getStats(),
        api.getAllSessions()
      ]);
      
      setStats(statsRes.data);
      setSessions(sessionsRes.data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewSummary = async (sessionId) => {
    try {
      setLoadingDetails(true);
      setSelectedSession(sessionId);
      
      const response = await api.getSessionDetails(sessionId);
      setSessionDetails(response.data);
    } catch (error) {
      console.error('Failed to load session details:', error);
    } finally {
      setLoadingDetails(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  const chartData = [
    { name: 'Sessions', value: stats?.totalSessions || 0 },
    { name: 'Completed', value: stats?.completedSessions || 0 },
    { name: 'Players', value: stats?.totalPlayers || 0 },
    { name: 'Events', value: Math.min(stats?.totalEvents || 0, 100) }
  ];

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          📊 Campaign Dashboard
        </Typography>
        <Button variant="outlined" onClick={loadData}>
          Refresh
        </Button>
      </Stack>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3} sx={{ background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' }}>
            <CardContent>
              <Typography color="white" gutterBottom sx={{ opacity: 0.9 }}>
                Total Sessions
              </Typography>
              <Typography variant="h3" component="div" color="white" sx={{ fontWeight: 'bold' }}>
                {stats?.totalSessions || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3} sx={{ background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' }}>
            <CardContent>
              <Typography color="white" gutterBottom sx={{ opacity: 0.9 }}>
                Completed
              </Typography>
              <Typography variant="h3" component="div" color="white" sx={{ fontWeight: 'bold' }}>
                {stats?.completedSessions || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3} sx={{ background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)' }}>
            <CardContent>
              <Typography color="white" gutterBottom sx={{ opacity: 0.9 }}>
                Total Players
              </Typography>
              <Typography variant="h3" component="div" color="white" sx={{ fontWeight: 'bold' }}>
                {stats?.totalPlayers || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={3} sx={{ background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)' }}>
            <CardContent>
              <Typography color="white" gutterBottom sx={{ opacity: 0.9 }}>
                Total Events
              </Typography>
              <Typography variant="h3" component="div" color="white" sx={{ fontWeight: 'bold' }}>
                {stats?.totalEvents || 0}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Chart */}
      <Card elevation={3} sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Statistics Overview
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Bar dataKey="value" fill="#6200ee" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Recent Sessions with Summaries */}
      <Card elevation={3}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            📜 Session Chronicles
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            View session summaries and GroupMe messages
          </Typography>
          
          <TableContainer component={Paper} elevation={0}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell><strong>Session ID</strong></TableCell>
                  <TableCell><strong>Status</strong></TableCell>
                  <TableCell align="center"><strong>Events</strong></TableCell>
                  <TableCell align="center"><strong>Summary</strong></TableCell>
                  <TableCell><strong>Date</strong></TableCell>
                  <TableCell align="right"><strong>Actions</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {sessions.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography color="text.secondary">
                        No sessions yet. Start recording your first epic adventure!
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  sessions.map((session) => (
                    <TableRow key={session.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {session.id.slice(-8)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={session.status} 
                          color={session.status === 'completed' ? 'success' : 'default'}
                          size="small"
                        />
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={session.event_count || 0} 
                          size="small" 
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell align="center">
                        {session.has_summaries ? (
                          <Chip 
                            icon={<Message />} 
                            label="Available" 
                            size="small" 
                            color="primary"
                          />
                        ) : (
                          <Chip label="None" size="small" variant="outlined" />
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {formatDate(session.start_ts)}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          startIcon={<Visibility />}
                          onClick={() => handleViewSummary(session.id)}
                          disabled={!session.has_summaries}
                        >
                          View
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Session Summary Dialog */}
      <Dialog
        open={!!selectedSession}
        onClose={() => {
          setSelectedSession(null);
          setSessionDetails(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Message />
            <Typography variant="h6">Session Summary</Typography>
          </Stack>
        </DialogTitle>
        
        <DialogContent>
          {loadingDetails ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : sessionDetails?.summaries ? (
            <Box>
              {/* Group Summary */}
              <Accordion defaultExpanded>
                <AccordionSummary expandIcon={<ExpandMore />}>
                  <Stack direction="row" alignItems="center" spacing={1}>
                    <GroupIcon />
                    <Typography variant="h6">Group Summary</Typography>
                  </Stack>
                </AccordionSummary>
                <AccordionDetails>
                  <Paper elevation={0} sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                    {/* TL;DR */}
                    <Card variant="outlined" sx={{ mb: 2, bgcolor: '#fff3e0' }}>
                      <CardContent>
                        <Typography variant="caption" color="text.secondary">
                          TL;DR
                        </Typography>
                        <Typography variant="body1" sx={{ fontWeight: 'bold' }}>
                          {sessionDetails.summaries.groupSummary.tldr}
                        </Typography>
                      </CardContent>
                    </Card>

                    {/* Full Narrative */}
                    <Typography variant="body2" paragraph sx={{ whiteSpace: 'pre-wrap' }}>
                      {sessionDetails.summaries.groupSummary.message_text}
                    </Typography>

                    <Divider sx={{ my: 2 }} />

                    {/* Key Events */}
                    {sessionDetails.summaries.groupSummary.key_events?.length > 0 && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                          ⚔️ Epic Moments
                        </Typography>
                        <Stack spacing={0.5}>
                          {sessionDetails.summaries.groupSummary.key_events.map((event, idx) => (
                            <Typography key={idx} variant="body2">
                              • {event}
                            </Typography>
                          ))}
                        </Stack>
                      </Box>
                    )}

                    {/* Loot */}
                    {sessionDetails.summaries.groupSummary.top_loot?.length > 0 && (
                      <Box sx={{ mb: 2 }}>
                        <Typography variant="subtitle2" gutterBottom sx={{ fontWeight: 'bold' }}>
                          💰 Spoils of Victory
                        </Typography>
                        <Stack spacing={0.5}>
                          {sessionDetails.summaries.groupSummary.top_loot.map((item, idx) => (
                            <Typography key={idx} variant="body2">
                              • {item}
                            </Typography>
                          ))}
                        </Stack>
                      </Box>
                    )}

                    {/* Cliffhanger */}
                    {sessionDetails.summaries.groupSummary.cliffhanger && (
                      <Card variant="outlined" sx={{ bgcolor: '#e3f2fd', mt: 2 }}>
                        <CardContent>
                          <Typography variant="caption" color="text.secondary">
                            What Lies Ahead...
                          </Typography>
                          <Typography variant="body2" sx={{ fontStyle: 'italic' }}>
                            {sessionDetails.summaries.groupSummary.cliffhanger}
                          </Typography>
                        </CardContent>
                      </Card>
                    )}
                  </Paper>
                </AccordionDetails>
              </Accordion>

              {/* Player Summaries */}
              {sessionDetails.summaries.playerSummaries?.length > 0 && (
                <Accordion>
                  <AccordionSummary expandIcon={<ExpandMore />}>
                    <Stack direction="row" alignItems="center" spacing={1}>
                      <Email />
                      <Typography variant="h6">
                        Player Summaries ({sessionDetails.summaries.playerSummaries.length})
                      </Typography>
                    </Stack>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Stack spacing={2}>
                      {sessionDetails.summaries.playerSummaries.map((playerSum, idx) => (
                        <Card key={idx} variant="outlined">
                          <CardContent>
                            <Typography variant="subtitle1" color="primary" gutterBottom>
                              Player {idx + 1}
                            </Typography>
                            <Paper elevation={0} sx={{ p: 2, bgcolor: '#fafafa' }}>
                              <Typography variant="body2" paragraph sx={{ whiteSpace: 'pre-wrap' }}>
                                {playerSum.message_text}
                              </Typography>
                              
                              {playerSum.accomplishments?.length > 0 && (
                                <Box sx={{ mt: 2 }}>
                                  <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 'bold' }}>
                                    Accomplishments:
                                  </Typography>
                                  {playerSum.accomplishments.map((acc, i) => (
                                    <Typography key={i} variant="body2">
                                      • {acc}
                                    </Typography>
                                  ))}
                                </Box>
                              )}
                            </Paper>
                          </CardContent>
                        </Card>
                      ))}
                    </Stack>
                  </AccordionDetails>
                </Accordion>
              )}
            </Box>
          ) : (
            <Typography color="text.secondary">
              No summary available for this session
            </Typography>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => {
            setSelectedSession(null);
            setSessionDetails(null);
          }}>
            Close
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}