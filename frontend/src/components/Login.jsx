// frontend/src/components/Login.jsx
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, Card, CardContent, TextField, Button, Typography,
  Alert, Stack, Container, Link, Divider
} from '@mui/material';
import { Login as LoginIcon, PersonAdd } from '@mui/icons-material';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegistering) {
        const result = await register(username, password);
        if (result.success) {
          // After registration, log in
          const loginResult = await login(username, password);
          if (loginResult.success) {
            navigate('/');
          } else {
            setError(loginResult.error);
          }
        } else {
          setError(result.error);
        }
      } else {
        const result = await login(username, password);
        if (result.success) {
          navigate('/');
        } else {
          setError(result.error);
        }
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Card elevation={4} sx={{ width: '100%' }}>
          <CardContent sx={{ p: 4 }}>
            <Box sx={{ textAlign: 'center', mb: 3 }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold', mb: 1 }}>
                🎲 Dungeons ADK
              </Typography>
              <Typography variant="body2" color="text.secondary">
                {isRegistering ? 'Create your account' : 'Sign in to continue'}
              </Typography>
            </Box>

            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleSubmit}>
              <Stack spacing={2}>
                <TextField
                  label="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  fullWidth
                  required
                  autoFocus
                  disabled={loading}
                />

                <TextField
                  label="Password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  fullWidth
                  required
                  disabled={loading}
                />

                <Button
                  type="submit"
                  variant="contained"
                  size="large"
                  fullWidth
                  disabled={loading}
                  startIcon={isRegistering ? <PersonAdd /> : <LoginIcon />}
                  sx={{
                    py: 1.5,
                    background: 'linear-gradient(45deg, #6200ee 30%, #9c27b0 90%)',
                  }}
                >
                  {loading ? 'Please wait...' : isRegistering ? 'Register' : 'Sign In'}
                </Button>
              </Stack>
            </form>

            <Divider sx={{ my: 3 }} />

            <Box sx={{ textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                {isRegistering ? 'Already have an account?' : "Don't have an account?"}
              </Typography>
              <Link
                component="button"
                variant="body2"
                onClick={() => {
                  setIsRegistering(!isRegistering);
                  setError(null);
                }}
                sx={{ mt: 1 }}
              >
                {isRegistering ? 'Sign in instead' : 'Register here'}
              </Link>
            </Box>

            <Box sx={{ mt: 3, p: 2, bgcolor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="caption" color="text.secondary" display="block" gutterBottom>
                <strong>Demo Credentials:</strong>
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                Admin: admin / admin123
              </Typography>
              <Typography variant="caption" color="text.secondary" display="block">
                User: user / user123
              </Typography>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}