// frontend/src/components/SessionRecorder-with-player-selection.jsx
// Updated SessionRecorder with player selection
import { useState, useEffect } from 'react';
import {
  Box, Button, Card, CardContent, Typography, Chip, 
  LinearProgress, Alert, Stack, Paper, Divider, Dialog,
  DialogTitle, DialogContent, DialogActions, FormControl,
  FormLabel, FormGroup, FormControlLabel, Checkbox
} from '@mui/material';
import { 
  Mic, Stop, CloudUpload, CheckCircle, Error as ErrorIcon, People 
} from '@mui/icons-material';
import { useAudioRecorder } from '../hooks/useAudioRecorder';
import { useSessionStore } from '../store/sessionStore';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

export default function SessionRecorder() {
  const { user, isAdmin } = useAuth();
  const { 
    isRecording, 
    duration, 
    startRecording, 
    stopRecording,
    error: recorderError 
  } = useAudioRecorder();

  const { 
    sessionId, 
    events, 
    transcript, 
    setSession, 
    addEvent, 
    appendTranscript,
    clearSession 
  } = useSessionStore();

  const [isProcessing, setIsProcessing] = useState(false);
  const [uploadStatus, setUploadStatus] = useState(null);
  const [chunkCount, setChunkCount] = useState(0);
  
  // Player selection state
  const [showPlayerDialog, setShowPlayerDialog] = useState(false);
  const [allPlayers, setAllPlayers] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState([]);
  const [loadingPlayers, setLoadingPlayers] = useState(false);

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    try {
      setLoadingPlayers(true);
      const response = await api.getAllPlayers();
      setAllPlayers(response.data);
      
      // Auto-select current user's player if they have one
      if (user.player_id) {
        setSelectedPlayers([user.player_id]);
      }
    } catch (error) {
      console.error('Failed to load players:', error);
    } finally {
      setLoadingPlayers(false);
    }
  };

  const handlePlayerToggle = (playerId) => {
    setSelectedPlayers(prev => 
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };

  const formatDuration = (seconds) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleStartSession = async () => {
    // Non-admin users must include themselves
    if (!isAdmin() && !selectedPlayers.includes(user.player_id)) {
      setUploadStatus({ 
        type: 'error', 
        message: 'You must be a participant in the session' 
      });
      return;
    }

    if (selectedPlayers.length === 0) {
      setUploadStatus({ 
        type: 'error', 
        message: 'Please select at least one player' 
      });
      return;
    }

    try {
      // Create session on backend
      const response = await api.createSession(selectedPlayers);
      setSession(response.data.sessionId);
      
      // Start recording
      await startRecording();
      
      setShowPlayerDialog(false);
      setUploadStatus({ type: 'success', message: 'Session started! Recording audio...' });
    } catch (error) {
      console.error('Failed to start session:', error);
      setUploadStatus({ 
        type: 'error', 
        message: error.response?.data?.error || 'Failed to start session' 
      });
    }
  };

  const handleProcessChunk = async () => {
    if (!isRecording) {
      setUploadStatus({ type: 'error', message: 'No active recording' });
      return;
    }

    try {
      setIsProcessing(true);
      setUploadStatus({ type: 'info', message: 'Processing audio chunk...' });

      // Stop current recording and get blob
      const audioBlob = await stopRecording();
      
      if (!audioBlob) {
        throw new Error('No audio recorded');
      }

      console.log(`Recording chunk: ${(audioBlob.size / 1024).toFixed(2)} KB`);

      // Upload and transcribe
      const formData = new FormData();
      formData.append('audio', audioBlob, `chunk_${chunkCount}.webm`);
      formData.append('chunkIndex', chunkCount);

      const response = await api.uploadAudio(sessionId, formData);

      // Add transcript
      if (response.data.transcript?.text) {
        appendTranscript(response.data.transcript.text);
        setUploadStatus({ 
          type: 'success', 
          message: `Transcribed: ${response.data.transcript.wordCount} words` 
        });
      }

      // Add events
      if (response.data.events?.length > 0) {
        response.data.events.forEach(event => addEvent(event));
      }

      setChunkCount(prev => prev + 1);

      // Start new recording
      setTimeout(() => startRecording(), 500);

    } catch (error) {
      console.error('Failed to process chunk:', error);
      setUploadStatus({ 
        type: 'error', 
        message: error.message || 'Failed to process audio' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleEndSession = async () => {
    try {
      setIsProcessing(true);
      
      // Stop recording
      await stopRecording();

      // End session on backend
      await api.endSession(sessionId);

      setUploadStatus({ 
        type: 'success', 
        message: 'Session completed! Generating summaries...' 
      });

      // Clear after delay
      setTimeout(() => {
        clearSession();
        setChunkCount(0);
        setUploadStatus(null);
        setSelectedPlayers(user.player_id ? [user.player_id] : []);
      }, 3000);

    } catch (error) {
      console.error('Failed to end session:', error);
      setUploadStatus({ 
        type: 'error', 
        message: error.message || 'Failed to end session' 
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const getSelectedPlayerNames = () => {
    return allPlayers
      .filter(p => selectedPlayers.includes(p.id))
      .map(p => p.in_game_name)
      .join(', ');
  };

  return (
    <Box>
      <Card elevation={3}>
        <CardContent>
          <Stack spacing={3}>
            {/* Header */}
            <Box>
              <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
                🎤 D&D Session Recorder
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Record your gameplay, extract events automatically, and generate summaries
              </Typography>
            </Box>

            {/* Status Messages */}
            {recorderError && (
              <Alert severity="error" icon={<ErrorIcon />}>
                {recorderError}
              </Alert>
            )}

            {uploadStatus && (
              <Alert severity={uploadStatus.type} onClose={() => setUploadStatus(null)}>
                {uploadStatus.message}
              </Alert>
            )}

            <Divider />

            {/* Recording Controls */}
            {!isRecording ? (
              <Box>
                <Button
                  variant="contained"
                  size="large"
                  startIcon={<People />}
                  onClick={() => setShowPlayerDialog(true)}
                  disabled={isProcessing}
                  sx={{
                    py: 2,
                    fontSize: '1.1rem',
                    background: 'linear-gradient(45deg, #6200ee 30%, #9c27b0 90%)',
                    '&:hover': {
                      background: 'linear-gradient(45deg, #4e00b3 30%, #7b1fa2 90%)',
                    }
                  }}
                >
                  Start Recording Session
                </Button>

                {selectedPlayers.length > 0 && (
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
                    Selected players: {getSelectedPlayerNames()}
                  </Typography>
                )}
              </Box>
            ) : (
              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={<CloudUpload />}
                  onClick={handleProcessChunk}
                  disabled={isProcessing}
                  sx={{ flex: 1 }}
                >
                  {isProcessing ? 'Processing...' : 'Process Chunk'}
                </Button>
                <Button
                  variant="contained"
                  color="error"
                  startIcon={<Stop />}
                  onClick={handleEndSession}
                  disabled={isProcessing}
                  sx={{ flex: 1 }}
                >
                  End Session
                </Button>
              </Stack>
            )}

            {/* Recording Status */}
            {isRecording && (
              <Paper elevation={1} sx={{ p: 2, bgcolor: '#f5f5f5' }}>
                <Stack spacing={2}>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Chip 
                      icon={<Mic />} 
                      label="RECORDING" 
                      color="error" 
                      sx={{ fontWeight: 'bold' }}
                    />
                    <Typography variant="h4" sx={{ fontFamily: 'monospace', fontWeight: 'bold' }}>
                      {formatDuration(duration)}
                    </Typography>
                  </Box>

                  {isProcessing && <LinearProgress />}

                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      📋 Session: {sessionId?.slice(-8)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      📦 Chunks processed: {chunkCount}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      ⚔️ Events detected: {events.length}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      👥 Players: {getSelectedPlayerNames()}
                    </Typography>
                  </Box>
                </Stack>
              </Paper>
            )}

            <Divider />

            {/* Transcript Display */}
            {transcript && (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    📝 Transcript
                  </Typography>
                  <Paper 
                    elevation={0} 
                    sx={{ 
                      p: 2, 
                      maxHeight: 200, 
                      overflow: 'auto', 
                      bgcolor: '#fafafa',
                      fontFamily: 'monospace',
                      fontSize: '0.9rem',
                      lineHeight: 1.6
                    }}
                  >
                    {transcript}
                  </Paper>
                </CardContent>
              </Card>
            )}

            {/* Events Display */}
            {events.length > 0 && (
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    ⚔️ Events ({events.length})
                  </Typography>
                  <Stack spacing={1} sx={{ maxHeight: 300, overflow: 'auto' }}>
                    {events.slice(-10).reverse().map((event, idx) => (
                      <Paper key={idx} elevation={1} sx={{ p: 2 }}>
                        <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                          <Chip 
                            label={event.type.toUpperCase()} 
                            size="small" 
                            color="primary" 
                            variant="outlined"
                          />
                          <Typography variant="body2">
                            <strong>{event.actor}:</strong> {event.action}
                          </Typography>
                        </Stack>
                        {event.metadata?.damage && (
                          <Typography variant="caption" color="error" sx={{ display: 'block', mt: 0.5 }}>
                            💥 {event.metadata.damage} damage
                          </Typography>
                        )}
                        {event.metadata?.gold_value && (
                          <Typography variant="caption" color="warning.main" sx={{ display: 'block', mt: 0.5 }}>
                            💰 {event.metadata.gold_value} gold
                          </Typography>
                        )}
                      </Paper>
                    ))}
                  </Stack>
                </CardContent>
              </Card>
            )}
          </Stack>
        </CardContent>
      </Card>

      {/* Player Selection Dialog */}
      <Dialog open={showPlayerDialog} onClose={() => setShowPlayerDialog(false)} maxWidth="sm" fullWidth>
        <DialogTitle>
          <Stack direction="row" alignItems="center" spacing={1}>
            <People />
            <Typography variant="h6">Select Players for Session</Typography>
          </Stack>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {isAdmin() 
              ? 'Select the players participating in this session'
              : 'You must be included in the session. Select other participants:'
            }
          </Typography>

          {loadingPlayers ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <FormControl component="fieldset">
              <FormGroup>
                {allPlayers.map(player => (
                  <FormControlLabel
                    key={player.id}
                    control={
                      <Checkbox
                        checked={selectedPlayers.includes(player.id)}
                        onChange={() => handlePlayerToggle(player.id)}
                        disabled={!isAdmin() && player.id === user.player_id} // Non-admin must include themselves
                      />
                    }
                    label={
                      <Box>
                        <Typography variant="body1">
                          {player.in_game_name}
                          {player.id === user.player_id && ' (You)'}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {player.real_name} - {player.race} {player.role_type} (Lvl {player.level})
                        </Typography>
                      </Box>
                    }
                  />
                ))}
              </FormGroup>
            </FormControl>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowPlayerDialog(false)}>Cancel</Button>
          <Button 
            onClick={handleStartSession}
            variant="contained"
            disabled={selectedPlayers.length === 0}
          >
            Start Session ({selectedPlayers.length} player{selectedPlayers.length !== 1 ? 's' : ''})
          </Button>
        </DialogActions>
      </Dialog>

      {/* Instructions */}
      {!isRecording && !sessionId && (
        <Card sx={{ mt: 3 }} elevation={1}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              📖 How to Use
            </Typography>
            <Stack spacing={1}>
              <Typography variant="body2">
                <strong>1.</strong> Click "Start Recording Session" and select participants
              </Typography>
              <Typography variant="body2">
                <strong>2.</strong> Allow microphone access when prompted
              </Typography>
              <Typography variant="body2">
                <strong>3.</strong> Play your D&D game normally - speak clearly for best results
              </Typography>
              <Typography variant="body2">
                <strong>4.</strong> Click "Process Chunk" every 30-60 seconds to transcribe and extract events
              </Typography>
              <Typography variant="body2">
                <strong>5.</strong> Click "End Session" when finished - summaries will be generated
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                💡 <strong>Tip:</strong> For best transcription, use a good microphone and minimize background noise
              </Typography>
            </Stack>
          </CardContent>
        </Card>
      )}
    </Box>
  );
}