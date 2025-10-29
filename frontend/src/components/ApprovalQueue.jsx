import { useState, useEffect } from 'react';
import { 
  Box, Card, CardContent, Typography, Button, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Alert, Tabs, Tab, Divider, Stack, Switch, FormControlLabel
} from '@mui/material';
import { CheckCircle, Cancel, Message, Visibility, Send } from '@mui/icons-material';
import { api } from '../services/api';

export default function ApprovalQueue() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [comment, setComment] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [previewTab, setPreviewTab] = useState(0);
  const [sendToGroupMe, setSendToGroupMe] = useState(true);
  const [messagePreview, setMessagePreview] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    loadRequests();
    const interval = setInterval(loadRequests, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  const loadRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📋 Fetching pending approvals...');
      const response = await api.getPendingApprovals();
      console.log('📊 Response:', response.data);
      
      if (!Array.isArray(response.data)) {
        throw new Error('API response is not an array');
      }
      
      setRequests(response.data);
      console.log(`✅ Loaded ${response.data.length} pending approvals`);
    } catch (error) {
      console.error('❌ Failed to load approvals:', error);
      setError(error.message);
    } finally {
      setLoading(false);
    }
  };

  const loadMessagePreview = async (request) => {
    try {
      // Get session to fetch summaries
      const sessionResponse = await api.getSession(request.created_by);
      const session = sessionResponse.data;
      
      if (session.summaries) {
        setMessagePreview({
          group: session.summaries.groupSummary,
          players: session.summaries.playerSummaries || []
        });
      }
    } catch (error) {
      console.error('Failed to load message preview:', error);
    }
  };

  const handleReviewClick = async (request) => {
    setSelectedRequest(request);
    setPreviewTab(0);
    await loadMessagePreview(request);
  };

  const handleApprove = async (requestId) => {
    try {
      setProcessing(true);
      setSuccessMessage(null);
      
      const response = await api.approveRequest(requestId, 'dm_1', 'approve', comment, sendToGroupMe);
      
      setSelectedRequest(null);
      setComment('');
      setMessagePreview(null);
      
      // Show success message
      setSuccessMessage({
        type: 'success',
        message: sendToGroupMe 
          ? '✅ Approved and messages sent to GroupMe!' 
          : '✅ Approved! (Messages not sent)'
      });
      
      // Reload requests
      await loadRequests();
      
      // Clear success message after 5 seconds
      setTimeout(() => setSuccessMessage(null), 5000);
      
    } catch (error) {
      console.error('Failed to approve:', error);
      setError('Failed to approve request: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (requestId) => {
    if (!comment.trim()) {
      setError('Please provide a reason for rejection');
      return;
    }
    
    try {
      setProcessing(true);
      await api.approveRequest(requestId, 'dm_1', 'reject', comment);
      setSelectedRequest(null);
      setComment('');
      setMessagePreview(null);
      loadRequests();
    } catch (error) {
      console.error('Failed to reject:', error);
      setError('Failed to reject request: ' + error.message);
    } finally {
      setProcessing(false);
    }
  };

  const formatGroupMessagePreview = (summary) => {
    if (!summary) return '';
    
    let preview = `🎲✨ SESSION RECAP ✨🎲\n\n`;
    preview += `📜 ${summary.tldr}\n\n`;
    preview += `═══════════════════════════\n`;
    preview += `📖 THE TALE UNFOLDS\n`;
    preview += `═══════════════════════════\n\n`;
    
    const paragraphs = summary.message_text?.split('\n\n') || [];
    preview += paragraphs.slice(0, 2).join('\n\n') + '\n\n';
    
    if (summary.key_events?.length > 0) {
      preview += `⚔️ EPIC MOMENTS:\n`;
      summary.key_events.slice(0, 3).forEach(event => {
        preview += `  ⚡ ${event}\n`;
      });
      preview += `\n`;
    }

    if (summary.top_loot?.length > 0) {
      preview += `💰 SPOILS OF VICTORY:\n`;
      summary.top_loot.slice(0, 3).forEach(item => {
        preview += `  💎 ${item}\n`;
      });
    }
    
    return preview;
  };

  const formatPlayerMessagePreview = (playerSummary) => {
    if (!playerSummary) return '';
    
    let preview = `🗡️ YOUR PERSONAL SESSION RECAP 🛡️\n\n`;
    preview += playerSummary.message_text?.substring(0, 300) + '...\n\n';
    
    if (playerSummary.accomplishments?.length > 0) {
      preview += `⚔️ YOUR VALOROUS DEEDS:\n`;
      playerSummary.accomplishments.slice(0, 2).forEach(deed => {
        preview += `  🏆 ${deed}\n`;
      });
    }
    
    return preview;
  };

  if (loading && requests.length === 0) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          ✅ DM Approval Queue
        </Typography>
        <Button
          variant="outlined"
          onClick={loadRequests}
          disabled={loading}
          sx={{ minWidth: 120 }}
        >
          {loading ? <CircularProgress size={20} /> : 'Refresh'}
        </Button>
      </Stack>

      {successMessage && (
        <Alert severity={successMessage.type} onClose={() => setSuccessMessage(null)} sx={{ mb: 2 }}>
          {successMessage.message}
        </Alert>
      )}

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {requests.length === 0 ? (
        <Alert severity="info" icon={<Message />}>
          No pending approvals. New write requests and summaries will appear here for your review.
        </Alert>
      ) : (
        <Card elevation={3}>
          <CardContent>
            <TableContainer component={Paper} elevation={0}>
              <Table>
                <TableHead>
                  <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                    <TableCell><strong>Session ID</strong></TableCell>
                    <TableCell><strong>Sheet Target</strong></TableCell>
                    <TableCell><strong>Created</strong></TableCell>
                    <TableCell align="center"><strong>Status</strong></TableCell>
                    <TableCell align="right"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id} hover>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {request.created_by?.slice(-8) || 'N/A'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={request.target_sheet} 
                          size="small" 
                          color="primary"
                          variant="outlined"
                        />
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" color="text.secondary">
                          {new Date(request.created_ts).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell align="center">
                        <Chip 
                          label={request.status} 
                          size="small" 
                          color="warning"
                        />
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="contained"
                          startIcon={<Visibility />}
                          onClick={() => handleReviewClick(request)}
                        >
                          Review & Send
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          </CardContent>
        </Card>
      )}

      {/* Review Dialog with Message Preview */}
      <Dialog 
        open={!!selectedRequest} 
        onClose={() => {
          setSelectedRequest(null);
          setMessagePreview(null);
        }}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Message />
            <Typography variant="h6">Review Request & Messages</Typography>
          </Stack>
        </DialogTitle>
        
        <DialogContent>
          <Tabs value={previewTab} onChange={(e, v) => setPreviewTab(v)} sx={{ mb: 2 }}>
            <Tab label="📊 Data Payload" />
            <Tab label="💬 Group Message" />
            <Tab label="👤 Player Messages" />
          </Tabs>

          {previewTab === 0 && (
            <Box>
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Target Sheet
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                {selectedRequest?.target_sheet}
              </Typography>
              
              <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                Payload Preview
              </Typography>
              <Paper elevation={0} sx={{ p: 2, bgcolor: '#f5f5f5', maxHeight: 400, overflow: 'auto' }}>
                <pre style={{ margin: 0, fontSize: '0.85rem' }}>
                  {JSON.stringify(selectedRequest?.payload, null, 2)}
                </pre>
              </Paper>
            </Box>
          )}

          {previewTab === 1 && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }} icon={<Send />}>
                This message will be sent to the GroupMe group chat
              </Alert>
              <Paper 
                elevation={0} 
                sx={{ 
                  p: 2, 
                  bgcolor: '#f5f5f5', 
                  maxHeight: 500, 
                  overflow: 'auto',
                  fontFamily: 'monospace',
                  fontSize: '0.9rem',
                  whiteSpace: 'pre-wrap'
                }}
              >
                {messagePreview?.group 
                  ? formatGroupMessagePreview(messagePreview.group)
                  : 'Loading preview...'
                }
              </Paper>
            </Box>
          )}

          {previewTab === 2 && (
            <Box>
              <Alert severity="info" sx={{ mb: 2 }} icon={<Send />}>
                Personal messages will be sent as DMs to each player
              </Alert>
              {messagePreview?.players?.length > 0 ? (
                <Stack spacing={2}>
                  {messagePreview.players.map((playerSum, idx) => (
                    <Card key={idx} variant="outlined">
                      <CardContent>
                        <Typography variant="subtitle2" color="primary" gutterBottom>
                          Player {idx + 1}
                        </Typography>
                        <Paper 
                          elevation={0} 
                          sx={{ 
                            p: 2, 
                            bgcolor: '#fafafa',
                            fontFamily: 'monospace',
                            fontSize: '0.85rem',
                            whiteSpace: 'pre-wrap',
                            maxHeight: 300,
                            overflow: 'auto'
                          }}
                        >
                          {formatPlayerMessagePreview(playerSum)}
                        </Paper>
                      </CardContent>
                    </Card>
                  ))}
                </Stack>
              ) : (
                <Typography color="text.secondary">No player summaries available</Typography>
              )}
            </Box>
          )}

          <Divider sx={{ my: 3 }} />

          <FormControlLabel
            control={
              <Switch 
                checked={sendToGroupMe} 
                onChange={(e) => setSendToGroupMe(e.target.checked)}
                color="primary"
              />
            }
            label={
              <Typography variant="body2">
                Send messages to GroupMe upon approval
              </Typography>
            }
          />

          <TextField
            fullWidth
            label="Comment (optional)"
            placeholder="Add any notes about this session..."
            multiline
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            variant="outlined"
            sx={{ mt: 2 }}
          />
        </DialogContent>
        
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button 
            onClick={() => {
              setSelectedRequest(null);
              setMessagePreview(null);
            }} 
            disabled={processing}
          >
            Cancel
          </Button>
          <Button
            onClick={() => handleReject(selectedRequest.id)}
            disabled={processing}
            color="error"
            variant="outlined"
            startIcon={<Cancel />}
          >
            Reject
          </Button>
          <Button
            onClick={() => handleApprove(selectedRequest.id)}
            disabled={processing}
            color="success"
            variant="contained"
            startIcon={processing ? <CircularProgress size={20} /> : <CheckCircle />}
          >
            {sendToGroupMe ? 'Approve & Send' : 'Approve Only'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}