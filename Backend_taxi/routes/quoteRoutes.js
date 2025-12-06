const express = require('express');
const router = express.Router();

// Import du contrôleur (vérifie bien que ce fichier existe aussi dans ../controllers/)
const quoteController = require('../controllers/quoteController');
  
router.post('/public', quoteController.createQuote);

// --- DÉFINITION DES ROUTES ---

// GET /quotes -> Récupérer tous les devis
router.get('/', quoteController.getQuotes);

// POST /quotes -> Créer un devis
router.post('/', quoteController.createQuote);

// PUT /quotes/:id -> Modifier un devis
router.put('/:id', quoteController.updateQuote);

// DELETE /quotes/:id -> Supprimer un devis
router.delete('/:id', quoteController.deleteQuote);

// ⚠️ C'EST CETTE LIGNE QUI MANQUAIT ET QUI CAUSAIT L'ERREUR :
module.exports = router;