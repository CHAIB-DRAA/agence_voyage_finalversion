import Constants from 'expo-constants';

// --- DÉTECTION AUTOMATIQUE DE L'IP ---
const getBaseUrl = () => {
  const debuggerHost = Constants.expoConfig?.hostUri;
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    return `http://${ip}:3000`;
  }
  return 'http://10.0.2.2:3000';
};

const API_BASE_URL = "https://agence-voyage1.onrender.com";
console.log('🚀 [API] Cible :', API_BASE_URL);

// --- VARIABLE POUR STOCKER LE TOKEN DE SESSION ---
let SESSION_TOKEN = null;

// Helper pour générer les headers avec le token
const getHeaders = () => {
  const headers = { 'Content-Type': 'application/json' };
  if (SESSION_TOKEN) {
    headers['Authorization'] = `Bearer ${SESSION_TOKEN}`;
  }
  return headers;
};

export default {
  
  // ============================================================
  // 1. AUTHENTIFICATION
  // ============================================================
  
  login: async (username, password) => {
    console.log('🔐 [API] login...');
    try {
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!response.ok) throw new Error('Identifiants incorrects');
      
      const data = await response.json();
      
      // 🛑 SAUVEGARDE DU TOKEN EN MÉMOIRE
      if (data.token) {
        SESSION_TOKEN = data.token;
        console.log('🔑 Token sécurisé enregistré');
      }
      
      return data; 
    } catch (error) {
      console.error("❌ [API] login ERROR :", error.message);
      throw error;
    }
  },

  seed: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/seed`);
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || 'Erreur seed');
      return json.message;
    } catch (error) {
      console.error("❌ [API] seed ERROR :", error.message);
      throw error;
    }
  },

  // ============================================================
  // 2. GESTION UTILISATEURS (Nécessite Token Admin)
  // ============================================================

  getUsers: async () => {
    try {
      // ✅ AJOUT DU HEADER D'AUTORISATION
      const response = await fetch(`${API_BASE_URL}/auth/users`, {
        method: 'GET',
        headers: getHeaders() 
      });
      
      if (!response.ok) throw new Error('Accès refusé (Admin requis)');
      return await response.json();
    } catch (error) { 
      console.error("❌ [API] getUsers:", error.message);
      return []; 
    }
  },

  createUser: async (userData) => {
    try {
      // Plus besoin d'envoyer adminUsername, le token suffit
      const response = await fetch(`${API_BASE_URL}/auth/create`, {
        method: 'POST',
        headers: getHeaders(), // ✅ Token inclus
        body: JSON.stringify(userData), 
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erreur création');
      }
      return await response.json();
    } catch (error) { throw error; }
  },

  deleteUser: async (id) => {
    try {
      await fetch(`${API_BASE_URL}/auth/users/${id}`, { 
        method: 'DELETE',
        headers: getHeaders() // ✅ Token inclus
      });
      return true;
    } catch (error) { return false; }
  },

  updateUser: async (id, data) => {
    try {
      const response = await fetch(`${API_BASE_URL}/auth/users/${id}`, {
        method: 'PUT',
        headers: getHeaders(), // ✅ Token inclus
        body: JSON.stringify(data), 
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Erreur mise à jour');
      }
      return await response.json();
    } catch (error) {
      throw error;
    }
  },

  // ============================================================
  // 3. GESTION DES DEVIS (QUOTES)
  // ============================================================

  getQuotes: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/quotes`, {
        headers: getHeaders() // Optionnel selon ta config serveur, mais conseillé
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("❌ [API] getQuotes ERROR :", error.message);
      return []; 
    }
  },

  saveQuote: async (quoteData) => {
    try {
      const isEdit = !!quoteData.id;
      const url = isEdit ? `${API_BASE_URL}/quotes/${quoteData.id}` : `${API_BASE_URL}/quotes`;
      const method = isEdit ? 'PUT' : 'POST';
      const bodyData = isEdit ? quoteData : (({ id, ...o }) => o)(quoteData);

      const response = await fetch(url, {
        method: method,
        headers: getHeaders(), // ✅ Token inclus (si tu protèges l'écriture)
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

  // Nouveau : Suppression de devis
  deleteQuote: async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/quotes/${id}`, {
        method: 'DELETE',
        headers: getHeaders()
      });
      if (!response.ok) throw new Error('Erreur suppression');
      return true;
    } catch (error) {
      console.error("❌ [API] deleteQuote ERROR :", error.message);
      throw error;
    }
  },

  // ============================================================
  // 4. GESTION DES HÔTELS
  // ============================================================

  getHotels: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/hotels`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      console.error("❌ [API] getHotels ERROR :", error.message);
      return [];
    }
  },

  saveHotel: async (hotelData) => {
    try {
      const isEdit = !!hotelData.id;
      const url = isEdit ? `${API_BASE_URL}/hotels/${hotelData.id}` : `${API_BASE_URL}/hotels`;
      const method = isEdit ? 'PUT' : 'POST';
      const bodyData = isEdit ? hotelData : (({ id, ...o }) => o)(hotelData);

      const response = await fetch(url, {
        method: method,
        headers: getHeaders(), // ✅ Token Admin requis
        body: JSON.stringify(bodyData),
      });

      if (!response.ok) {
        const errorText = await response.text(); 
        throw new Error(errorText);
      }
      
      return await response.json();
    } catch (error) {
      console.error("❌ [API] saveHotel ERROR :", error.message);
      throw error;
    }
  },

  deleteHotel: async (id) => {
    try {
      const response = await fetch(`${API_BASE_URL}/hotels/${id}`, { 
        method: 'DELETE',
        headers: getHeaders() // ✅ Token Admin requis
      });
      if (!response.ok) throw new Error('Erreur suppression');
      return true;
    } catch (error) {
      console.error("❌ [API] deleteHotel ERROR :", error.message);
      throw error;
    }
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
        meals: json.meals || []
      };
    } catch (error) {
      console.error("❌ [API] getSettings:", error.message);
      return { destinations: [], periods: [], transports: [], intercity: [], meals: [] };
    }
  },

  addSetting: async (category, label, price = '0') => {
    try {
      const response = await fetch(`${API_BASE_URL}/settings`, {
        method: 'POST',
        headers: getHeaders(), // ✅ Token Admin requis
        body: JSON.stringify({ category, label, price }),
      });
      return await response.json();
    } catch (error) { throw error; }
  },

  updateSetting: async (id, data) => {
    try {
      const response = await fetch(`${API_BASE_URL}/settings/${id}`, {
        method: 'PUT',
        headers: getHeaders(), // ✅ Token Admin requis
        body: JSON.stringify(data),
      });
      return await response.json();
    } catch (error) { throw error; }
  },

  deleteSetting: async (id) => {
    try {
      await fetch(`${API_BASE_URL}/settings/${id}`, { 
        method: 'DELETE',
        headers: getHeaders() // ✅ Token Admin requis
      });
      return true;
    } catch (error) { throw error; }
  }
};