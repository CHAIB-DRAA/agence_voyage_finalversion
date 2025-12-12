const mongoose = require('mongoose');

const SettingSchema = new mongoose.Schema({
  // La catégorie permet de trier (Destination, Transport, Config Agence...)
  category: { 
    type: String, 
    required: true, 
    enum: [
      'destination', 
      'period', 
      'transport_main', // Vols
      'transport_intercity', // Bus/Transferts
      'meal', 
      'agency_info' // <--- AJOUT CRITIQUE ICI
    ] 
  },
  
  // Le nom visible (ex: "Makkah", "Turkish Airlines", "CCP: 123456")
  label: { type: String, required: true },
  
  // Prix optionnel (pour les repas ou transports payants)
  price: { type: Number, default: 0 },
  
  isActive: { type: Boolean, default: true }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Setting', SettingSchema);