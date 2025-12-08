const mongoose = require('mongoose');

const QuoteSchema = new mongoose.Schema({
  // --- INFOS CLIENT ---
  clientName: String,
  clientPhone: String,
  createdBy: String, 
  passportImage: String,

  // --- VOYAGE ---
  destination: String,
  period: String,
  
  // --- HÉBERGEMENT ---
  nightsMakkah: String,
  nightsMedina: String,
  nightsJeddah: String,
  hotelMakkah: String, 
  hotelMedina: String, 
  hotelJeddah: String,
  dates: {
    makkahCheckIn: String, makkahCheckOut: String,
    medinaCheckIn: String, medinaCheckOut: String,
    jeddahCheckIn: String, jeddahCheckOut: String
  },
  
  // --- OPTIONS ---
  meals: [String],
  
  // --- TRANSPORT ---
  transport: String,              
  transportMakkahMedina: String,  
  
  // --- CHIFFRES CLÉS ---
  numberOfPeople: { type: String, default: '1' }, 
  flightPrice: { type: String, default: '0' },    
  transportPrice: { type: String, default: '0' }, 
  visaPrice: { type: String, default: '0' },
  
  // --- QUANTITÉS (Mise à jour) ---
  quantities: {
    single: { type: String, default: '0' },
    double: { type: String, default: '0' },
    triple: { type: String, default: '0' },
    quad: { type: String, default: '0' },
    penta: { type: String, default: '0' }, // <--- NOUVEAU (5 lits)
    suite: { type: String, default: '0' }  // <--- NOUVEAU (Suite)
  },
  
  // --- PRIX (Mise à jour) ---
  prices: {
    single: { type: String, default: '0' },
    double: { type: String, default: '0' },
    triple: { type: String, default: '0' },
    quad: { type: String, default: '0' },
    penta: { type: String, default: '0' }, // <--- NOUVEAU
    suite: { type: String, default: '0' }  // <--- NOUVEAU
  },

  // --- TOTAUX ---
  hotelTotal: { type: String, default: '0' }, 
  totalAmount: { type: String, default: '0' }, 
  advanceAmount: { type: String, default: '0' },
  remainingAmount: { type: String, default: '0' },
  
  status: { type: String, enum: ['pending', 'confirmed', 'cancelled'], default: 'pending' },
  notes: String,
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Quote', QuoteSchema);