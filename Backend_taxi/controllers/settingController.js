const Setting = require('../models/Setting');

// GET : Récupérer tout et trier par catégorie
exports.getSettings = async (req, res) => {
  try {
    const settings = await Setting.find().sort({ label: 1 });
    
    // On organise les données pour l'appli mobile
    const grouped = {
      destinations: settings.filter(s => s.category === 'destination'),
      periods: settings.filter(s => s.category === 'period'),
      transports: settings.filter(s => s.category === 'transport_main'),
      intercity: settings.filter(s => s.category === 'transport_intercity'),
      meals: settings.filter(s => s.category === 'meal'),
    };
    res.json(grouped);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST : Ajouter une option
exports.createSetting = async (req, res) => {
  try {
    const newSetting = new Setting(req.body);
    const saved = await newSetting.save();
    res.json(saved);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// PUT : Modifier (ex: changer le prix ou le libellé)
exports.updateSetting = async (req, res) => {
  try {
    const updated = await Setting.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) {
      return res.status(404).json({ error: 'Option introuvable' });
    }
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// DELETE : Supprimer une option
exports.deleteSetting = async (req, res) => {
  try {
    await Setting.findByIdAndDelete(req.params.id);
    res.json({ message: 'Supprimé' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};