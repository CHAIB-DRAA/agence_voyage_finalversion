const mongoose = require('mongoose');

const HotelSchema = new mongoose.Schema({
  name: { type: String, required: true },
  city: { 
    type: String, 
    required: true, 
    enum: ['Makkah', 'Medina', 'Jeddah'] // Sécurité : On force l'une de ces deux villes
  },
  distance: { type: String, default: '0m' }, // Distance du Haram
  stars: { type: Number, default: 0 },
  prices: {
    single: { type: Number, default: 0 },
    double: { type: Number, default: 0 },
    triple: { type: Number, default: 0 },
    quad: { type: Number, default: 0 }
  },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Hotel', HotelSchema);