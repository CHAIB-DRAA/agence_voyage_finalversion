const Quote = require('../models/Quote');

// GET : Récupérer tous les devis
exports.getQuotes = async (req, res) => {
  console.log('🔍 [CONTROLLER] Récupération des devis...');
  try {
    // On trie par date de création décroissante (le plus récent en premier)
    const quotes = await Quote.find().sort({ createdAt: -1 });
    console.log(`✅ [CONTROLLER] ${quotes.length} devis trouvés.`);
    
    // Transformation _id (MongoDB) -> id (Frontend React Native)
    const formatted = quotes.map(q => ({ ...q._doc, id: q._id }));
    res.json(formatted);
  } catch (err) {
    console.error('❌ [CONTROLLER] Erreur GET :', err.message);
    res.status(500).json({ error: err.message });
  }
};

// POST : Créer un devis
exports.createQuote = async (req, res) => {
  console.log('✨ [CONTROLLER] Création d\'un devis...');
  try {
    // Log des données financières critiques pour vérification
    console.log(`📊 [DATA] Client: ${req.body.clientName}`);
    console.log(`💰 [DATA] Total: ${req.body.totalAmount} DA | Pax: ${req.body.numberOfPeople}`);
    if (req.body.createdBy) console.log(`👤 [DATA] Créé par: ${req.body.createdBy}`);

    const newQuote = new Quote(req.body);
    const saved = await newQuote.save();
    
    console.log('✅ [CONTROLLER] Sauvegardé ID :', saved._id);
    res.json({ ...saved._doc, id: saved._id });
  } catch (err) {
    console.error('❌ [CONTROLLER] Erreur POST :', err.message);
    res.status(400).json({ error: err.message });
  }
};

// PUT : Modifier un devis
exports.updateQuote = async (req, res) => {
  console.log(`🔄 [CONTROLLER] Mise à jour ID : ${req.params.id}...`);
  try {
    // On loggue le nouveau montant pour s'assurer que la modif est prise en compte
    if (req.body.totalAmount) {
      console.log(`💰 [UPDATE] Nouveau Total: ${req.body.totalAmount} DA`);
    }

    const updated = await Quote.findByIdAndUpdate(req.params.id, req.body, { new: true });
    
    if (!updated) {
      console.warn('⚠️ [CONTROLLER] Devis introuvable pour mise à jour');
      return res.status(404).json({ error: "Devis introuvable" });
    }
    
    console.log('✅ [CONTROLLER] Mise à jour réussie.');
    res.json({ ...updated._doc, id: updated._id });
  } catch (err) {
    console.error('❌ [CONTROLLER] Erreur PUT :', err.message);
    res.status(400).json({ error: err.message });
  }
};

// DELETE : Supprimer un devis
exports.deleteQuote = async (req, res) => {
  console.log(`🗑️ [CONTROLLER] Suppression ID : ${req.params.id}...`);
  try {
    await Quote.findByIdAndDelete(req.params.id);
    console.log('✅ [CONTROLLER] Suppression confirmée.');
    res.json({ message: 'Supprimé' });
  } catch (err) {
    console.error('❌ [CONTROLLER] Erreur DELETE :', err.message);
    res.status(500).json({ error: err.message });
  }
};