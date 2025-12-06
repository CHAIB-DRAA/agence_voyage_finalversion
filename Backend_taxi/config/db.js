const mongoose = require('mongoose');

console.log('🔄 [DB] Chargement du module de base de données...');

const connectDB = async () => {
  // J'ai ajouté 'travel_agency' dans l'URL ci-dessous
  const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://mouss2700:realLOVE456@cluster0.9okes.mongodb.net/travel_agency?retryWrites=true&w=majority';

  console.log('⏳ [DB] Tentative de connexion à MongoDB...');
  
  try {
    await mongoose.connect(MONGO_URI);
    console.log('✅ [DB] Connecté avec succès à MongoDB Atlas (Base: travel_agency)');
  } catch (err) {
    console.error('❌ [DB] CRASH Connexion MongoDB:', err.message);
    process.exit(1);
  }
};

module.exports = connectDB;