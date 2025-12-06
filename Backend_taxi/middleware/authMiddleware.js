const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'ton_secret_super_securise_2025'; // À mettre dans .env en prod

// 1. Vérifie si l'utilisateur est connecté
const protect = (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      // Le token ressemble à "Bearer eyJhbGciOi..."
      token = req.headers.authorization.split(' ')[1];

      // Décryptage
      const decoded = jwt.verify(token, JWT_SECRET);
      
      // On attache l'info utilisateur à la requête pour la suite
      req.user = decoded; 
      
      next(); // C'est bon, passe à la suite
    } catch (error) {
      return res.status(401).json({ error: 'Session expirée ou invalide, reconnectez-vous.' });
    }
  }

  if (!token) {
    return res.status(401).json({ error: 'Accès non autorisé, pas de token.' });
  }
};

// 2. Vérifie si l'utilisateur est Admin
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') {
    next();
  } else {
    res.status(403).json({ error: 'Accès refusé : Réservé aux administrateurs.' });
  }
};

module.exports = { protect, adminOnly, JWT_SECRET };