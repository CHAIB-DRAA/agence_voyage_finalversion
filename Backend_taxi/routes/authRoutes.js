const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

// --- ROUTES PUBLIQUES ---

// Connexion (Login)
// POST /auth/login
router.post('/login', authController.login);

// Initialisation du Super Admin (Ne fonctionne qu'une seule fois si la base est vide ou sans admin)
// GET /auth/seed
router.get('/seed', authController.seedAdmin);

// --- ROUTES PROTÉGÉES (LOGIQUE DANS LE CONTROLEUR) ---
// Ces routes vérifient le rôle de l'utilisateur via 'adminUsername' dans le corps de la requête

// Créer un nouvel utilisateur (Vendeur ou Admin)
// POST /auth/create
// Nécessite { username, password, role, adminUsername } dans le body
router.post('/create', authController.createUser);

// Lister tous les utilisateurs
// GET /auth/users
router.get('/users', authController.getUsers);

// Supprimer un utilisateur
// DELETE /auth/users/:id
router.delete('/users/:id', authController.deleteUser);

router.put('/users/:id', authController.updateUser); 
module.exports = router;