const express = require('express');
const router = express.Router();
const settingController = require('../controllers/settingController');

// --- ROUTES /settings ---

// Récupérer tous les paramètres (groupés par catégorie)
// GET /settings
router.get('/', settingController.getSettings);

// Créer un nouveau paramètre
// POST /settings
router.post('/', settingController.createSetting);

// Modifier un paramètre existant (ex: changer son prix)
// PUT /settings/:id
router.put('/:id', settingController.updateSetting);

// Supprimer un paramètre
// DELETE /settings/:id
router.delete('/:id', settingController.deleteSetting);

module.exports = router;