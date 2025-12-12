const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema({
  category: { 
    type: String, 
    required: true, 
    enum: [
      'destination', 
      'period', 
      'transport_main', 
      'transport_intercity', 
      'meal', 
      'agency_info'
    ] 
  },
  
  label: { type: String, required: true }, // Ex: "Téléphone"
  
  // NOUVEAU : Champ texte pour la valeur (Ex: "0550 12 34 56")
  value: { type: String, default: '' }, 

  // Champ numérique pour les prix
  price: { type: Number, default: 0 },
  
  isActive: { type: Boolean, default: true }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Setting', SettingSchema);