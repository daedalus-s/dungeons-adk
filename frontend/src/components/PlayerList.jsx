import { useState, useEffect } from 'react';
import { 
  Box, Card, CardContent, Typography, Button, TextField,
  Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  Paper, Chip, Dialog, DialogTitle, DialogContent, DialogActions,
  CircularProgress, Stack
} from '@mui/material';
import { Add } from '@mui/icons-material';
import { api } from '../services/api';

export default function PlayerList() {
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

  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    try {
      setLoading(true);
      const response = await api.getAllPlayers();
      setPlayers(response.data);
    } catch (error) {
      console.error('Failed to load players:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlayer = async () => {
    try {
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
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
        <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
          👥 Players
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => setDialogOpen(true)}
        >
          Add Player
        </Button>
      </Box>

      <Card elevation={3}>
        <CardContent>
          <TableContainer component={Paper} elevation={0}>
            <Table>
              <TableHead>
                <TableRow>
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
                        No players yet. Add your first player!
                      </Typography>
                    </TableCell>
                  </TableRow>
                ) : (
                  players.map((player) => (
                    <TableRow key={player.id}>
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

      {/* Add Player Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Add New Player</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label="Real Name"
              value={newPlayer.real_name}
              onChange={(e) => setNewPlayer({ ...newPlayer, real_name: e.target.value })}
              fullWidth
            />
            <TextField
              label="Character Name"
              value={newPlayer.in_game_name}
              onChange={(e) => setNewPlayer({ ...newPlayer, in_game_name: e.target.value })}
              fullWidth
            />
            <TextField
              label="Race"
              value={newPlayer.race}
              onChange={(e) => setNewPlayer({ ...newPlayer, race: e.target.value })}
              fullWidth
            />
            <TextField
              label="Class"
              value={newPlayer.role_type}
              onChange={(e) => setNewPlayer({ ...newPlayer, role_type: e.target.value })}
              fullWidth
            />
            <TextField
              label="Level"
              type="number"
              value={newPlayer.level}
              onChange={(e) => setNewPlayer({ ...newPlayer, level: parseInt(e.target.value) })}
              fullWidth
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
    </Box>
  );
}