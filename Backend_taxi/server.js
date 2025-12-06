const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const os = require('os'); 
const path = require('path'); // <--- IMPORT NÉCESSAIRE POUR LE WEB

// Import des modules locaux
const connectDB = require('./config/db');
const quoteRoutes = require('./routes/quoteRoutes');
const hotelRoutes = require('./routes/hotelRoutes');
const authRoutes = require('./routes/authRoutes');
const settingRoutes = require('./routes/settingRoutes');

dotenv.config();
const app = express();

// --- 1. CONFIGURATION FICHIERS STATIQUES (WEB) ---
// Permet d'accéder au formulaire client via http://ip:3000/index.html
app.use(express.static(path.join(__dirname, 'public')));

// --- 2. CORRECTIF PAYLOAD TOO LARGE (MOBILE) ---
// On augmente la limite à 50mb pour accepter les photos de passeport
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

app.use(cors());

console.log('🔄 [SYSTEM] Initialisation du serveur...');
connectDB();

// Vérifications sécurité
if (!quoteRoutes || !hotelRoutes || !authRoutes || !settingRoutes) {
  console.error('❌ [ERREUR FATALE] Une route manque.');
  process.exit(1);
}

// Routes API
app.use('/quotes', quoteRoutes);
app.use('/hotels', hotelRoutes);
app.use('/auth', authRoutes);
app.use('/settings', settingRoutes);

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  const networkInterfaces = os.networkInterfaces();
  let myIp = 'localhost';
  
  Object.keys(networkInterfaces).forEach((name) => {
    networkInterfaces[name].forEach((iface) => {
      if (iface.family === 'IPv4' && !iface.internal) myIp = iface.address;
    });
  });

  console.log(`🚀 Serveur prêt sur le port ${PORT}`);
  console.log(`📡 URL API (Mobile) : http://${myIp}:${PORT}`);
  console.log(`📄 Formulaire Client  : http://${myIp}:${PORT}/index.html`); // <--- LIEN À PARTAGER
});