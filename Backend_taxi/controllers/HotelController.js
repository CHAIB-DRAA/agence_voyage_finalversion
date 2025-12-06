const Hotel = require('../models/Hotel');

// GET : Liste de tous les hôtels
exports.getHotels = async (req, res) => {
  console.log('🏨 [CONTROLLER] Récupération de la liste des hôtels...');
  try {
    const hotels = await Hotel.find().sort({ city: 1, name: 1 });
    // Formatage pour le frontend
    const formatted = hotels.map(h => ({ ...h._doc, id: h._id }));
    res.json(formatted);
  } catch (err) {
    console.error('❌ [CONTROLLER] Erreur GET Hotels :', err.message);
    res.status(500).json({ error: err.message });
  }
};

// POST : Ajouter un nouvel hôtel
exports.createHotel = async (req, res) => {
  console.log('✨ [CONTROLLER] Ajout d\'un nouvel hôtel...');
  try {
    const newHotel = new Hotel(req.body);
    const saved = await newHotel.save();
    console.log('✅ [CONTROLLER] Hôtel créé avec succès :', saved.name);
    res.json({ ...saved._doc, id: saved._id });
  } catch (err) {
    console.error('❌ [CONTROLLER] Erreur Création Hôtel :', err.message);
    res.status(400).json({ error: err.message });
  }
};

// PUT : Modifier les prix ou infos d'un hôtel
exports.updateHotel = async (req, res) => {
  console.log(`🔄 [CONTROLLER] Modification hôtel ID : ${req.params.id}...`);
  try {
    const updated = await Hotel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!updated) return res.status(404).json({ error: "Hôtel introuvable" });
    console.log('✅ [CONTROLLER] Hôtel mis à jour.');
    res.json({ ...updated._doc, id: updated._id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
};

// DELETE : Supprimer un hôtel
exports.deleteHotel = async (req, res) => {
  console.log(`🗑️ [CONTROLLER] Suppression hôtel ID : ${req.params.id}...`);
  try {
    await Hotel.findByIdAndDelete(req.params.id);
    res.json({ message: 'Hôtel supprimé' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};