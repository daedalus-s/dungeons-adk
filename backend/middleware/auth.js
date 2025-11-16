// backend/middleware/auth.js
// Authentication middleware for role-based access control

export const requireAuth = (req, res, next) => {
  const user = req.session?.user;
  
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  req.user = user;
  next();
};

export const requireAdmin = (req, res, next) => {
  const user = req.session?.user;
  
  if (!user) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  
  if (user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  
  req.user = user;
  next();
};

export const optionalAuth = (req, res, next) => {
  req.user = req.session?.user || null;
  next();
};