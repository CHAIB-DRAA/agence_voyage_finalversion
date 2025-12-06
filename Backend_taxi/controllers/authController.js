const User = require('../models/User');

// 1. LOGIN : Connexion classique
exports.login = async (req, res) => {
  const { username, password } = req.body;
  console.log(`🔐 [AUTH] Tentative de connexion : ${username}`);

  try {
    const user = await User.findOne({ username });

    if (!user || user.password !== password) {
      console.log('❌ [AUTH] Echec connexion');
      return res.status(401).json({ error: 'Identifiants incorrects' });
    }

    console.log(`✅ [AUTH] Connexion réussie (${user.role})`);
    // On renvoie le rôle pour que l'appli sache quelles pages afficher
    res.json({ 
      token: 'fake-jwt-token-' + user._id, 
      username: user.username,
      role: user.role 
    });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 2. SEED : Création du PREMIER et UNIQUE Admin initial
// Cette route se verrouille automatiquement dès qu'un utilisateur existe.
exports.seedAdmin = async (req, res) => {
  try {
    const count = await User.countDocuments();
    
    if (count > 0) {
      return res.status(403).json({ error: "L'initialisation a déjà été faite. Impossible de recréer un admin." });
    }

    const admin = new User({ 
      username: 'admin', 
      password: '123', // À changer immédiatement
      role: 'admin' 
    }); 
    
    await admin.save();
    console.log('👑 [AUTH] Super Admin créé via Seed');
    res.json({ message: "Super Admin créé : admin / 123" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 3. CREATE USER : Ajout d'utilisateurs (Réservé aux Admins)
exports.createUser = async (req, res) => {
  // On attend 'adminUsername' dans le corps de la requête pour vérifier l'autorité
  const { username, password, role, adminUsername } = req.body; 
  
  console.log(`👤 [AUTH] Création utilisateur demandée par ${adminUsername}`);

  try {
    // A. VÉRIFICATION DE SÉCURITÉ (Backend Enforcement)
    // On vérifie si celui qui demande est bien un admin en base
    const requester = await User.findOne({ username: adminUsername });
    
    if (!requester || requester.role !== 'admin') {
      console.log('⛔ [AUTH] Tentative non autorisée');
      return res.status(403).json({ error: "Accès refusé. Seul un admin peut créer des utilisateurs." });
    }

    // B. Création
    const exists = await User.findOne({ username });
    if (exists) return res.status(400).json({ error: "Ce nom d'utilisateur existe déjà." });

    const newUser = new User({ username, password, role: role || 'user' });
    await newUser.save();
    
    console.log(`✅ [AUTH] Nouvel utilisateur créé : ${username} (${role})`);
    res.json({ message: "Utilisateur créé avec succès", user: { username, role } });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 4. GET USERS : Lister les utilisateurs
exports.getUsers = async (req, res) => {
  try {
    const users = await User.find({}, '-password').sort({ role: 1 }); // Tri par rôle
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// 5. DELETE USER
exports.deleteUser = async (req, res) => {
  try {
    await User.findByIdAndDelete(req.params.id);
    res.json({ message: "Utilisateur supprimé" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ... (Code existant : login, seedAdmin, createUser, getUsers, deleteUser) ...

// 6. UPDATE USER : Modifier (ex: Reset Mot de passe)
exports.updateUser = async (req, res) => {
    const { password, role, adminUsername } = req.body;
    const userIdToUpdate = req.params.id;
  
    console.log(`📝 [AUTH] Modification demandée par ${adminUsername} pour l'ID ${userIdToUpdate}`);
  
    try {
      // A. VÉRIFICATION SÉCURITÉ
      const requester = await User.findOne({ username: adminUsername });
      if (!requester || requester.role !== 'admin') {
        return res.status(403).json({ error: "Accès refusé. Admin requis." });
      }
  
      // B. PRÉPARATION DES DONNÉES
      const updateData = {};
      
      // On ne change le rôle que s'il est fourni
      if (role) updateData.role = role;
  
      // On ne change le mot de passe QUE s'il est fourni (Reset)
      if (password && password.trim() !== '') {
        // Ici, idéalement on hache le mot de passe (bcrypt)
        // Pour l'instant, on garde ta logique actuelle :
        updateData.password = password; 
      }
  
      const updatedUser = await User.findByIdAndUpdate(userIdToUpdate, updateData, { new: true });
  
      if (!updatedUser) return res.status(404).json({ error: "Utilisateur introuvable" });
  
      console.log(`✅ [AUTH] Utilisateur mis à jour : ${updatedUser.username}`);
      res.json({ message: "Mise à jour réussie", user: updatedUser });
  
    } catch (err) {
      res.status(500).json({ error: err.message });
    }
  };