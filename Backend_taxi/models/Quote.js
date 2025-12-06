const mongoose = require('mongoose');

const QuoteSchema = new mongoose.Schema({
  // --- INFOS CLIENT ---
  clientName: String,
  clientPhone: String,
  createdBy: String, 
  
  // --- STATUT DU DEVIS (NOUVEAU) ---
  // pending = En attente (Jaune)
  // confirmed = Confirmé (Vert)
  // cancelled = Annulé (Rouge)
  status: { 
    type: String, 
    enum: ['pending', 'confirmed', 'cancelled'], 
    default: 'pending' 
  },

  // --- DOCUMENTS ---
  passportImage: String,

  // --- VOYAGE ---
  destination: String,
  period: String,
  
  // --- HÉBERGEMENT ---
  nightsMakkah: String,
  nightsMedina: String,
  hotelMakkah: String, 
  hotelMedina: String, 
  dates: {
    makkahCheckIn: String,
    makkahCheckOut: String,
    medinaCheckIn: String,
    medinaCheckOut: String
  },
  
  meals: [String],
  
  // --- TRANSPORT ---
  transport: String,              
  transportMakkahMedina: String,  
  
  // --- CHIFFRES CLÉS ---
  numberOfPeople: { type: String, default: '1' }, 
  flightPrice: { type: String, default: '0' },    
  transportPrice: { type: String, default: '0' }, 
  visaPrice: { type: String, default: '0' },
  
  // --- QUANTITÉS ---
  quantities: {
    single: { type: String, default: '0' },
    double: { type: String, default: '0' },
    triple: { type: String, default: '0' },
    quad: { type: String, default: '0' }
  },
  
  // --- PRIX ---
  prices: {
    single: { type: String, default: '0' },
    double: { type: String, default: '0' },
    triple: { type: String, default: '0' },
    quad: { type: String, default: '0' }
  },

  hotelTotal: { type: String, default: '0' }, 
  totalAmount: { type: String, default: '0' }, 

  advanceAmount: { type: String, default: '0' },
remainingAmount: { type: String, default: '0' },
  
  notes: String,
  createdAt: { type: Date, default: Date.now }


});

module.exports = mongoose.model('Quote', QuoteSchema);