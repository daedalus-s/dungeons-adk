// backend/auth/routes.js
// Authentication routes
import bcrypt from 'bcrypt';

export function setupAuthRoutes(app, stateManager) {
  // Login endpoint
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { username, password } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      // Find user
      const user = await stateManager.User.findOne({ username });

      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password);

      if (!validPassword) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // Update last login
      user.last_login = new Date();
      await user.save();

      // Create session
      req.session.user = {
        id: user.id,
        username: user.username,
        role: user.role,
        player_id: user.player_id
      };

      res.json({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          player_id: user.player_id
        }
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ error: 'Login failed' });
    }
  });

  // Logout endpoint
  app.post('/api/auth/logout', (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        return res.status(500).json({ error: 'Logout failed' });
      }
      res.json({ message: 'Logged out successfully' });
    });
  });

  // Check authentication status
  app.get('/api/auth/me', (req, res) => {
    if (!req.session?.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    res.json({ user: req.session.user });
  });

  // Register new user (admin only for production, open for initial setup)
  app.post('/api/auth/register', async (req, res) => {
    try {
      const { username, password, role, player_id } = req.body;

      if (!username || !password) {
        return res.status(400).json({ error: 'Username and password required' });
      }

      // Check if user exists
      const existing = await stateManager.User.findOne({ username });
      if (existing) {
        return res.status(400).json({ error: 'Username already exists' });
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create user
      const user = new stateManager.User({
        id: `user_${Date.now()}`,
        username,
        password: hashedPassword,
        role: role || 'user',
        player_id,
        created_at: new Date()
      });

      await user.save();

      res.json({
        user: {
          id: user.id,
          username: user.username,
          role: user.role,
          player_id: user.player_id
        }
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ error: 'Registration failed' });
    }
  });

  // Get all users (admin only)
  app.get('/api/auth/users', async (req, res) => {
    try {
      // Check admin
      if (!req.session?.user || req.session.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const users = await stateManager.User.find({}, '-password');
      res.json(users);
    } catch (error) {
      console.error('Get users error:', error);
      res.status(500).json({ error: 'Failed to get users' });
    }
  });
}