import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage'; // Requis pour la mémoire

// --- DÉTECTION AUTOMATIQUE DE L'IP ---
const getBaseUrl = () => {
  const debuggerHost = Constants.expoConfig?.hostUri;
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    return `http://${ip}:3000`;
  }
  return 'http://10.0.2.2:3000';
};

const API_BASE_URL = "https://agence-voyage-finalversion.onrender.com"; 
console.log('🚀 [API] Cible détectée :', API_BASE_URL);

// --- GESTION INTELLIGENTE DU TOKEN ---
// Récupère le token stocké (mémoire ou disque)
const getAuthHeaders = async () => {
  let token = null;
  try {
    token = await AsyncStorage.getItem('user_token');
  } catch (e) { console.error('Erreur lecture token', e); }

  const headers = { 'Content-Type': 'application/json' };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
};

export default {
  
  // ============================================================
  // 1. AUTHENTIFICATION
  // ============================================================
  
  login: async (username, password) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) throw new Error('Identifiants incorrects');
      
      const data = await response.json();
      
      // 🛑 SAUVEGARDE PERSISTANTE DU TOKEN
      if (data.token) {
        await AsyncStorage.setItem('user_token', data.token);
        console.log('🔑 Token sauvegardé sur le disque');
      }
      
      return data; 
    } catch (error) {
      console.error("❌ [API] login ERROR :", error.message);
      throw error;
    }
  },

  // ... (Seed reste inchangé) ...
  seed: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/seed`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Erreur seed');
      return json.message;
    } catch (error) { throw error; }
  },

  // ============================================================
  // 2. GESTION UTILISATEURS
  // ============================================================

  getUsers: async () => {
    try {
      const headers = await getAuthHeaders(); // <--- AWAIT IMPORTANT
      const response = await fetch(`${API_BASE_URL}/auth/users`, { headers });
      return await response.json();
    } catch (error) { return []; }
  },

  createUser: async (userData, adminUsername) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/auth/create`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({ ...userData, adminUsername }), 
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erreur création');
      }
      return await response.json();
    } catch (error) { throw error; }
  },

  updateUser: async (id, data, adminUsername) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/auth/users/${id}`, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify({ ...data, adminUsername }), 
      });
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erreur mise à jour');
      }
      return await response.json();
    } catch (error) { throw error; }
  },

  deleteUser: async (id) => {
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_BASE_URL}/auth/users/${id}`, { 
        method: 'DELETE',
        headers: headers 
      });
      return true;
    } catch (error) { return false; }
  },

  // ============================================================
  // 3. GESTION DES DEVIS (QUOTES)
  // ============================================================

  getQuotes: async () => {
    try {
      const headers = await getAuthHeaders(); // Nécessaire pour la tâche de fond
      const response = await fetch(`${API_BASE_URL}/quotes`, { headers });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("❌ [API] getQuotes ERROR :", error.message);
      return []; 
    }
  },

  saveQuote: async (quoteData) => {
    try {
      const headers = await getAuthHeaders();
      const isEdit = !!quoteData.id;
      const url = isEdit ? `${API_BASE_URL}/quotes/${quoteData.id}` : `${API_BASE_URL}/quotes`;
      const method = isEdit ? 'PUT' : 'POST';
      const bodyData = isEdit ? quoteData : (({ id, ...o }) => o)(quoteData);

      const response = await fetch(url, {
        method: method,
        headers: headers,
        body: JSON.stringify(bodyData),
      });

      if (!response.ok) {
        const text = await response.text(); 
        throw new Error(`Erreur HTTP: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      console.error("❌ [API] saveQuote ERROR :", error.message);
      throw error;
    }
  },

  deleteQuote: async (id) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/quotes/${id}`, {
        method: 'DELETE',
        headers: headers
      });
      if (!response.ok) throw new Error('Erreur suppression');
      return true;
    } catch (error) { throw error; }
  },

  // ============================================================
  // 4. GESTION DES HÔTELS
  // ============================================================

  getHotels: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/hotels`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) { return []; }
  },

  saveHotel: async (hotelData) => {
    try {
      const headers = await getAuthHeaders();
      const isEdit = !!hotelData.id;
      const url = isEdit ? `${API_BASE_URL}/hotels/${hotelData.id}` : `${API_BASE_URL}/hotels`;
      const method = isEdit ? 'PUT' : 'POST';
      const bodyData = isEdit ? hotelData : (({ id, ...o }) => o)(hotelData);

      const response = await fetch(url, {
        method: method,
        headers: headers,
        body: JSON.stringify(bodyData),
      });

      if (!response.ok) {
        const errorText = await response.text(); 
        throw new Error(errorText);
      }
      return await response.json();
    } catch (error) { throw error; }
  },

  getHotels: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/hotels`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) { return []; }
  },

  saveHotel: async (hotelData) => {
    try {
      const headers = await getAuthHeaders();
      // CRITIQUE : On s'assure que le serveur sait qu'on envoie du JSON
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';

      const isEdit = !!hotelData.id;
      const url = isEdit ? `${API_BASE_URL}/hotels/${hotelData.id}` : `${API_BASE_URL}/hotels`;
      const method = isEdit ? 'PUT' : 'POST';
      
      // Sécurisation : on retire l'ID du payload pour éviter les conflits
      const bodyData = isEdit ? hotelData : (({ id, ...o }) => o)(hotelData);

      // DEBUG : Vérifie dans la console React Native/Expo que "seasonalPrices" est bien rempli ici
      console.log("💾 [API] Envoi saveHotel :", JSON.stringify(bodyData, null, 2));

      const response = await fetch(url, {
        method: method,
        headers: headers,
        body: JSON.stringify(bodyData),
      });

      if (!response.ok) {
        const errorText = await response.text(); 
        console.error("❌ [API] Erreur saveHotel :", errorText);
        throw new Error(errorText || 'Erreur sauvegarde');
      }
      return await response.json();
    } catch (error) { throw error; }
  },

  // CORRECTION : Passage en PUT car ton routeur n'a pas de route PATCH
  saveSeasonalPrices: async (hotelId, seasonalPrices) => {
    try {
      const headers = await getAuthHeaders();
      if (!headers['Content-Type']) headers['Content-Type'] = 'application/json';

      // On utilise la route PUT existante (/hotels/:id).
      // Mongoose 'findByIdAndUpdate' ne modifie que les champs envoyés (patch partiel), 
      // donc envoyer juste { seasonalPrices } est sûr et ne supprimera pas le reste.
      const url = `${API_BASE_URL}/hotels/${hotelId}`; 
      
      console.log("💾 [API] Force Update Prices...", seasonalPrices.length);

      const response = await fetch(url, {
        method: 'PUT', // Changé de PATCH à PUT pour correspondre à routes/hotels.js
        headers: headers,
        body: JSON.stringify({ seasonalPrices: seasonalPrices }),
      });

      if (!response.ok) throw new Error('Erreur lors de la sauvegarde des prix saisonniers');
      return await response.json();
    } catch (error) { throw error; }
  },

  deleteHotel: async (id) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/hotels/${id}`, { 
        method: 'DELETE',
        headers: headers 
      });
      if (!response.ok) throw new Error('Erreur suppression');
      return true;
    } catch (error) { throw error; }
  },
// ============================================================
  // 5. GESTION DES PARAMÈTRES (SETTINGS)
  // ============================================================

  getSettings: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/settings`);
      if (!response.ok) throw new Error('Erreur settings');
      const json = await response.json();
      
      return {
        destinations: json.destinations || [],
        periods: json.periods || [],
        transports: json.transports || [],
        intercity: json.intercity || [],
        meals: json.meals || [],
        agency_info: json.agency_info || [] // S'assurer que cette ligne est présente
      };
    } catch (error) {
      return { destinations: [], periods: [], transports: [], intercity: [], meals: [], agency_info: [] };
    }
  },

  // MISE À JOUR : Ajout du paramètre optionnel 'value' (par défaut '')
  addSetting: async (category, label, price = '0', value = '') => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/settings`, {
        method: 'POST',
        headers: headers,
        // On inclut 'value' dans le corps de la requête JSON
        body: JSON.stringify({ category, label, price, value }),
      });
      
      if (!response.ok) {
         const errorText = await response.text();
         throw new Error(errorText || 'Erreur lors de l\'ajout');
      }
      
      return await response.json();
    } catch (error) { throw error; }
  },

  updateSetting: async (id, data) => {
    try {
      const headers = await getAuthHeaders();
      // data contient déjà { label, price, value } si envoyé depuis AdminSettings
      const response = await fetch(`${API_BASE_URL}/settings/${id}`, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
         const errorText = await response.text();
         throw new Error(errorText || 'Erreur lors de la modification');
      }

      return await response.json();
    } catch (error) { throw error; }
  },

  deleteSetting: async (id) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/settings/${id}`, { 
        method: 'DELETE',
        headers: headers 
      });
      if (!response.ok) throw new Error('Erreur suppression');
      return true;
    } catch (error) { throw error; }
  },

  // ============================================================
  // 5. GESTION DES PARAMÈTRES
  // ============================================================

  getSettings: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/settings`);
      if (!response.ok) throw new Error('Erreur settings');
      const json = await response.json();
      
      return {
        destinations: json.destinations || [],
        periods: json.periods || [],
        transports: json.transports || [],
        intercity: json.intercity || [],
        meals: json.meals || [],
        agency_info: json.agency_info || [] 
      };
    } catch (error) {
      return { destinations: [], periods: [], transports: [], intercity: [], meals: [], agency_info: [] };
    }
  },

  // MISE À JOUR : Ajout du paramètre 'value'
  addSetting: async (category, label, price = '0', value = '') => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${API_BASE_URL}/settings`, {
        method: 'POST',
        headers: headers,
        // On envoie 'value' au backend
        body: JSON.stringify({ category, label, price, value }),
      });
      return await response.json();
    } catch (error) { throw error; }
  },

  updateSetting: async (id, data) => {
    try {
      const headers = await getAuthHeaders();
      // data contient déjà { label, price, value } grâce au composant AdminSettings
      const response = await fetch(`${API_BASE_URL}/settings/${id}`, {
        method: 'PUT',
        headers: headers,
        body: JSON.stringify(data),
      });
      return await response.json();
    } catch (error) { throw error; }
  },

  deleteSetting: async (id) => {
    try {
      const headers = await getAuthHeaders();
      await fetch(`${API_BASE_URL}/settings/${id}`, { 
        method: 'DELETE',
        headers: headers 
      });
      return true;
    } catch (error) { throw error; }
  }
};