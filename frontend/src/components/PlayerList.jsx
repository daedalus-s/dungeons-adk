// frontend/src/components/PlayerList-with-access-control.jsx
// Updated PlayerList with role-based access control
import { useState, useEffect } from 'react';
import { 
  Box, Card, CardContent, Typography, Button, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Stack, Alert
} from '@mui/material';
import { Add, Lock } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';
import { api } from '../services/api';

export default function PlayerList() {
  const { isAdmin } = useAuth();
  const [players, setPlayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newPlayer, setNewPlayer] = useState({
    real_name: '',
    in_game_name: '',
    race: '',
    role_type: '',
    level: 1,
    group: 'Paul'
  });
  const [error, setError] = useState(null);

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.getAllPlayers();
      setPlayers(response.data);
    } catch (error) {
      console.error('Failed to load players:', error);
      setError('Failed to load players');
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlayer = async () => {
    try {
      setError(null);
      await api.createPlayer(newPlayer);
      setDialogOpen(false);
      setNewPlayer({
        real_name: '',
        in_game_name: '',
        race: '',
        role_type: '',
        level: 1,
        group: 'Paul'
      });
      loadPlayers();
    } catch (error) {
      console.error('Failed to create player:', error);
      setError(error.response?.data?.error || 'Failed to create player');
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
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={3}>
        <Box>
          <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
            👥 Players
          </Typography>
          {!isAdmin() && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              <Lock fontSize="small" sx={{ verticalAlign: 'middle', mr: 0.5 }} />
              View-only mode (Admin access required to modify)
            </Typography>
          )}
        </Box>
        {isAdmin() && (
          <Button
            variant="contained"
            startIcon={<Add />}
            onClick={() => setDialogOpen(true)}
          >
            Add Player
          </Button>
        )}
      </Stack>

      {error && (
        <Alert severity="error" onClose={() => setError(null)} sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {!isAdmin() && (
        <Alert severity="info" sx={{ mb: 2 }}>
          You can view all players, but only administrators can add or modify player records.
        </Alert>
      )}

      <Card elevation={3}>
        <CardContent>
          <TableContainer component={Paper} elevation={0}>
            <Table>
              <TableHead>
                <TableRow sx={{ bgcolor: '#f5f5f5' }}>
                  <TableCell><strong>Real Name</strong></TableCell>
                  <TableCell><strong>Character</strong></TableCell>
                  <TableCell><strong>Race</strong></TableCell>
                  <TableCell><strong>Class</strong></TableCell>
                  <TableCell align="center"><strong>Level</strong></TableCell>
                  <TableCell><strong>Group</strong></TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {players.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} align="center">
                      <Typography color="text.secondary">
                        No players yet. {isAdmin() && 'Add your first player!'}
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  players.map((player) => (
                    <TableRow key={player.id} hover>
                      <TableCell>{player.real_name}</TableCell>
                      <TableCell><strong>{player.in_game_name}</strong></TableCell>
                      <TableCell>{player.race}</TableCell>
                      <TableCell>{player.role_type}</TableCell>
                      <TableCell align="center">
                        <Chip label={player.level} size="small" color="primary" />
                      </TableCell>
                      <TableCell>
                        <Chip 
                          label={player.group} 
                          size="small" 
                          color={player.group === 'Paul' ? 'success' : 'secondary'}
                        />
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Add Player Dialog (Admin Only) */}
      {isAdmin() && (
        <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Add New Player</DialogTitle>
          <DialogContent>
            <Stack spacing={2} sx={{ mt: 1 }}>
              <TextField
                label="Real Name"
                value={newPlayer.real_name}
                onChange={(e) => setNewPlayer({ ...newPlayer, real_name: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label="Character Name"
                value={newPlayer.in_game_name}
                onChange={(e) => setNewPlayer({ ...newPlayer, in_game_name: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label="Race"
                value={newPlayer.race}
                onChange={(e) => setNewPlayer({ ...newPlayer, race: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label="Class"
                value={newPlayer.role_type}
                onChange={(e) => setNewPlayer({ ...newPlayer, role_type: e.target.value })}
                fullWidth
                required
              />
              <TextField
                label="Level"
                type="number"
                value={newPlayer.level}
                onChange={(e) => setNewPlayer({ ...newPlayer, level: parseInt(e.target.value) })}
                fullWidth
                required
              />
              <TextField
                select
                label="Group"
                value={newPlayer.group}
                onChange={(e) => setNewPlayer({ ...newPlayer, group: e.target.value })}
                fullWidth
                SelectProps={{ native: true }}
              >
                <option value="Paul">Paul's Group</option>
                <option value="Jonathan">Jonathan's Group</option>
              </TextField>
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button 
              onClick={handleCreatePlayer} 
              variant="contained"
              disabled={!newPlayer.real_name || !newPlayer.in_game_name}
            >
              Create Player
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Box>
  );
}