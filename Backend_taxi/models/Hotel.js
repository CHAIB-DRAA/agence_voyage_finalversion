const mongoose = require('mongoose');

// Sous-schéma pour les prix saisonniers
const SeasonalPriceSchema = new mongoose.Schema({
  periodName: { type: String, required: true }, // ex: "Ramadan", "Chawal"
  prices: {
    single: { type: String, default: '0' },
    double: { type: String, default: '0' },
    triple: { type: String, default: '0' },
    quad: { type: String, default: '0' },
    penta: { type: String, default: '0' }, // <--- NOUVEAU (5 lits)
    suite: { type: String, default: '0' }  // <--- NOUVEAU (Suite)
  }
}, { _id: true }); 

const HotelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  city: { 
    type: String, 
    required: true, 
    enum: ['Makkah', 'Medina', 'Jeddah'] 
  },
  distance: { type: String, required: true },
  stars: { type: String, required: true },
  
  // Prix par défaut (Standard / Basse saison)
  prices: {
    single: { type: String, default: '0' },
    double: { type: String, default: '0' },
    triple: { type: String, default: '0' },
    quad: { type: String, default: '0' },
    penta: { type: String, default: '0' }, // <--- NOUVEAU
    suite: { type: String, default: '0' }  // <--- NOUVEAU
  },

  // Liste des prix par période
  seasonalPrices: [SeasonalPriceSchema],

  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Hotel', HotelSchema);