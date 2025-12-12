const Setting = require('../models/Setting');

// GET: Récupérer et grouper tous les paramètres
exports.getSettings = async (req, res) => {
  try {
    const settings = await Setting.find({ isActive: true }).sort({ createdAt: 1 });
    
    // On transforme la liste plate en objet groupé pour le Frontend
    const grouped = {
      destinations: [],
      periods: [],
      transports: [],
      intercity: [],
      meals: [],
      agency_info: [] // Stockage des infos agence
    };

    settings.forEach(item => {
      // Mapping Catégorie DB -> Clé Frontend
      switch(item.category) {
        case 'destination': grouped.destinations.push(item); break;
        case 'period': grouped.periods.push(item); break;
        case 'transport_main': grouped.transports.push(item); break;
        case 'transport_intercity': grouped.intercity.push(item); break;
        case 'meal': grouped.meals.push(item); break;
        case 'agency_info': grouped.agency_info.push(item); break;
        default: break;
      }
    });

    res.json(grouped);
  } catch (err) {
    console.error('Erreur getSettings:', err);
    res.status(500).json({ error: err.message });
  }
};

// POST: Ajouter un paramètre
exports.addSetting = async (req, res) => {
  try {
    // IMPORTANT : On récupère 'value' ici pour le texte libre
    const { category, label, price, value } = req.body;
    
    // Validation basique
    if (!label || !category) return res.status(400).json({ error: "Label et catégorie requis" });

    // Création avec le champ value
    const newSetting = new Setting({ category, label, price, value });
    const saved = await newSetting.save();
    
    res.json(saved);
  } catch (err) {
    console.error('Erreur addSetting:', err);
    res.status(400).json({ error: err.message });
  }
};

// PUT: Modifier un paramètre
exports.updateSetting = async (req, res) => {
  try {
    // req.body contient { label, price, value... }
    // Mongoose mettra à jour 'value' automatiquement grâce au $set
    const updated = await Setting.findByIdAndUpdate(
      req.params.id, 
      { $set: req.body }, 
      { new: true }
    );
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE: Supprimer
exports.deleteSetting = async (req, res) => {
  try {
    await Setting.findByIdAndDelete(req.params.id);
    res.json({ message: "Paramètre supprimé" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};