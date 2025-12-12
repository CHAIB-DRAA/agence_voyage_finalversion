const express = require('express');
const router = express.Router();
// IMPORTANT : Respecter la majuscule du fichier (SettingController) pour Linux/Render
const settingController = require('../controllers/settingController');

// --- ROUTES /settings ---

// Récupérer tous les paramètres (groupés par catégorie)
router.get('/', settingController.getSettings);

// Créer un nouveau paramètre
// CORRECTION : La fonction exportée dans le contrôleur est 'addSetting'
router.post('/', settingController.addSetting);

// Modifier un paramètre existant (ex: changer son prix)
router.put('/:id', settingController.updateSetting);

// Supprimer un paramètre
router.delete('/:id', settingController.deleteSetting);

module.exports = router;