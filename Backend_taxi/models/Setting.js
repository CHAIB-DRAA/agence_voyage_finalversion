const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema({
  category: { 
    type: String, 
    required: true, 
    // Liste des catégories autorisées
    enum: ['destination', 'period', 'transport_main', 'transport_intercity', 'meal'] 
  },
  label: { type: String, required: true }, // Exemple: "Ramadan", "Bus VIP"
  price: { type: String, default: '0' },   // Prix optionnel
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Setting', SettingSchema);