import { useState, useEffect } from 'react';
import { 
  Box, Card, CardContent, Typography, Button, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Alert
} from '@mui/material';
import { CheckCircle, Cancel } from '@mui/icons-material';
import { api } from '../services/api';

export default function ApprovalQueue() {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [comment, setComment] = useState('');
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadRequests();
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
  const handleApprove = async (requestId) => {
    try {
      setProcessing(true);
      await api.approveRequest(requestId, 'dm_1', 'approve', comment);
      setSelectedRequest(null);
      setComment('');
      loadRequests();
    } catch (error) {
      console.error('Failed to approve:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async (requestId) => {
    try {
      setProcessing(true);
      await api.approveRequest(requestId, 'dm_1', 'reject', comment);
      setSelectedRequest(null);
      setComment('');
      loadRequests();
    } catch (error) {
      console.error('Failed to reject:', error);
    } finally {
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="60vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Box>
      <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
        ✅ Approval Queue
      </Typography>

      {requests.length === 0 ? (
        <Alert severity="info">
          No pending approvals. New write requests will appear here.
        </Alert>
      ) : (
        <Card elevation={3}>
          <CardContent>
            <TableContainer component={Paper} elevation={0}>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell><strong>Request ID</strong></TableCell>
                    <TableCell><strong>Sheet</strong></TableCell>
                    <TableCell><strong>Created</strong></TableCell>
                    <TableCell align="right"><strong>Actions</strong></TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {requests.map((request) => (
                    <TableRow key={request.id}>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {request.id.slice(-8)}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip label={request.target_sheet} size="small" />
                      </TableCell>
                      <TableCell>
                        {new Date(request.created_ts).toLocaleString()}
                      </TableCell>
                      <TableCell align="right">
                        <Button
                          size="small"
                          variant="outlined"
                          onClick={() => setSelectedRequest(request)}
                        >
                          Review
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

      {/* Review Dialog */}
      <Dialog 
        open={!!selectedRequest} 
        onClose={() => setSelectedRequest(null)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Review Write Request</DialogTitle>
        <DialogContent>
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Target Sheet
            </Typography>
            <Typography variant="body1">
              {selectedRequest?.target_sheet}
            </Typography>
          </Box>
          
          <Box sx={{ mb: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">
              Payload
            </Typography>
            <Paper elevation={0} sx={{ p: 2, bgcolor: '#f5f5f5' }}>
              <pre style={{ margin: 0, fontSize: '0.85rem', overflow: 'auto' }}>
                {JSON.stringify(selectedRequest?.payload, null, 2)}
              </pre>
            </Paper>
          </Box>

          <TextField
            fullWidth
            label="Comment (optional)"
            multiline
            rows={3}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            variant="outlined"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setSelectedRequest(null)} disabled={processing}>
            Cancel
          </Button>
          <Button
            onClick={() => handleReject(selectedRequest.id)}
            disabled={processing}
            color="error"
            startIcon={<Cancel />}
          >
            Reject
          </Button>
          <Button
            onClick={() => handleApprove(selectedRequest.id)}
            disabled={processing}
            color="success"
            variant="contained"
            startIcon={<CheckCircle />}
          >
            Approve
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}