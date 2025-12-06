import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, 
  SafeAreaView, StatusBar, Alert, Modal, ActivityIndicator, Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../utils/api';

export default function AdminUsers({ route, navigation }) {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // États du Modal (Formulaire unifié Création/Édition)
  const [modalVisible, setModalVisible] = useState(false);
  const [editingUser, setEditingUser] = useState(null); // Null = Création, Objet = Modification
  
  // Champs du formulaire
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [isAdminRole, setIsAdminRole] = useState(false);
  const [saving, setSaving] = useState(false);
  
  // Sécurité : Identité de l'admin connecté
  const currentAdmin = route.params?.username || 'admin';

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try {
      const data = await api.getUsers();
      setUsers(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // --- GESTION DU MODAL ---

  const openCreate = () => {
    setEditingUser(null);
    setFormUsername('');
    setFormPassword('');
    setIsAdminRole(false);
    setModalVisible(true);
  };

  const openEdit = (user) => {
    setEditingUser(user);
    setFormUsername(user.username);
    setFormPassword(''); // On laisse vide par sécurité (le mot de passe n'est pas affiché)
    setIsAdminRole(user.role === 'admin');
    setModalVisible(true);
  };

  // --- ACTIONS CRUD ---

  const handleSave = async () => {
    // Validation de base
    if (!formUsername.trim()) {
      Alert.alert('Erreur', "Le nom d'utilisateur est requis");
      return;
    }
    // En création, mot de passe obligatoire. En édition, il est optionnel (pour ne pas l'écraser).
    if (!editingUser && !formPassword.trim()) {
      Alert.alert('Erreur', "Le mot de passe est requis pour un nouveau compte");
      return;
    }

    setSaving(true);
    try {
      const roleToSend = isAdminRole ? 'admin' : 'user';
      
      if (editingUser) {
        // MODE MODIFICATION (UPDATE)
        // On ne change le mot de passe que si l'admin a écrit quelque chose
        const updatePayload = { role: roleToSend };
        if (formPassword.trim() !== '') {
            updatePayload.password = formPassword;
        }

        await api.updateUser(
          editingUser._id || editingUser.id, 
          updatePayload, 
          currentAdmin
        );
        Alert.alert('Succès', 'Le compte a été mis à jour.');

      } else {
        // MODE CRÉATION (CREATE)
        await api.createUser(
          { 
            username: formUsername, 
            password: formPassword, 
            role: roleToSend 
          }, 
          currentAdmin
        );
        Alert.alert('Succès', `Nouveau compte ${roleToSend} créé.`);
      }
      
      setModalVisible(false);
      loadUsers(); // Rafraîchir la liste

    } catch (e) {
      Alert.alert('Erreur', e.message || "Une erreur est survenue");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id, username) => {
    if (username === 'admin' || username === currentAdmin) {
      Alert.alert('Sécurité', 'Impossible de supprimer ce compte administrateur.');
      return;
    }

    Alert.alert("Confirmation", "Cette suppression est définitive et immédiate.", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: async () => {
          try {
            await api.deleteUser(id);
            loadUsers();
          } catch(e) {
            Alert.alert('Erreur', "Impossible de supprimer l'utilisateur.");
          }
        }}
    ]);
  };

  // --- RENDER ITEM ---
  const renderItem = ({ item }) => {
    const isItemAdmin = item.role === 'admin';
    
    return (
      <View style={[styles.card, isItemAdmin ? styles.cardAdmin : styles.cardUser]}>
        <View style={styles.cardLeft}>
          <View style={[styles.avatar, isItemAdmin ? styles.avatarAdmin : styles.avatarUser]}>
            <Feather name={isItemAdmin ? 'shield' : 'briefcase'} size={20} color="#FFF" />
          </View>
          <View style={{marginLeft: 12}}>
            <Text style={styles.username}>{item.username}</Text>
            <Text style={[styles.roleLabel, {color: isItemAdmin ? '#E67E22' : '#3498DB'}]}>
              {isItemAdmin ? 'Administrateur' : 'Agence / Vendeur'}
            </Text>
          </View>
        </View>
        
        <View style={styles.cardActions}>
          {/* Bouton Modifier (Crayon) */}
          <TouchableOpacity onPress={() => openEdit(item)} style={[styles.actionBtn, {backgroundColor: 'rgba(243, 199, 100, 0.1)'}]}>
            <Feather name="edit-2" size={18} color="#F3C764" />
          </TouchableOpacity>
          
          {/* Bouton Supprimer (Corbeille) - Sauf pour le super admin 'admin' */}
          {item.username !== 'admin' && (
            <TouchableOpacity onPress={() => handleDelete(item._id || item.id, item.username)} style={[styles.actionBtn, {backgroundColor: 'rgba(231, 76, 60, 0.1)'}]}>
              <Feather name="trash-2" size={18} color="#E74C3C" />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#050B14" />
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-right" size={24} color="#F3C764" />
        </TouchableOpacity>
        <View>
          <Text style={styles.headerTitle}>Gestion des Accès</Text>
          <Text style={styles.headerSub}>Utilisateurs & Permissions</Text>
        </View>
        <TouchableOpacity onPress={openCreate} style={styles.addButton}>
          <Feather name="plus" size={24} color="#050B14" />
        </TouchableOpacity>
      </View>

      {/* LISTE UTILISATEURS */}
      <FlatList 
        data={users} 
        renderItem={renderItem} 
        keyExtractor={item => item._id || item.id} 
        contentContainerStyle={{padding:20, paddingBottom: 100}} 
        refreshing={loading}
        onRefresh={loadUsers}
        ListEmptyComponent={!loading && <Text style={styles.emptyText}>Aucun utilisateur trouvé.</Text>}
      />

      {/* MODAL UNIFIÉ (CRÉATION / ÉDITION) */}
      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {editingUser ? 'Modifier le compte' : 'Créer un compte'}
            </Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
              <Feather name="x" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>

          <View style={styles.modalBody}>
            <Text style={styles.label}>Identifiant (Login)</Text>
            <TextInput 
              style={[styles.input, editingUser && {opacity: 0.5, backgroundColor: '#1A2634'}]} 
              value={formUsername} 
              onChangeText={setFormUsername} 
              editable={!editingUser} // On empêche de changer le username en édition
              textAlign="right"
              placeholder="Ex: agence_oran"
              placeholderTextColor="#556"
              autoCapitalize="none"
            />
            
            <Text style={styles.label}>
              {editingUser ? 'Nouveau mot de passe (Optionnel)' : 'Mot de passe'}
            </Text>
            <TextInput 
              style={styles.input} 
              value={formPassword} 
              onChangeText={setFormPassword} 
              placeholder={editingUser ? "Laisser vide pour conserver l'actuel" : "Requis"}
              placeholderTextColor="#556"
              secureTextEntry 
              textAlign="right"
            />

            {/* SWITCH RÔLE */}
            <TouchableOpacity 
              style={[styles.roleSwitch, isAdminRole && styles.roleSwitchActive]} 
              onPress={() => setIsAdminRole(!isAdminRole)}
              activeOpacity={0.8}
            >
              <View style={{flex: 1}}>
                <Text style={[styles.roleSwitchTitle, isAdminRole && {color:'#050B14'}]}>
                  {isAdminRole ? 'Rôle : Administrateur' : 'Rôle : Vendeur (Agence)'}
                </Text>
                <Text style={[styles.roleSwitchDesc, isAdminRole && {color:'#050B14'}]}>
                  {isAdminRole ? 'Accès complet (Prix, Hôtels, Users)' : 'Accès restreint (Devis uniquement)'}
                </Text>
              </View>
              <Feather 
                name={isAdminRole ? "shield" : "briefcase"} 
                size={24} 
                color={isAdminRole ? "#050B14" : "#666"} 
              />
            </TouchableOpacity>

            <TouchableOpacity onPress={handleSave} style={styles.saveBtn} disabled={saving}>
              {saving ? (
                <ActivityIndicator color="#050B14" />
              ) : (
                <Text style={styles.saveText}>
                    {editingUser ? 'Mettre à jour' : 'Créer le compte'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050B14', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 20, paddingBottom: 15, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)', backgroundColor: '#050B14' },
  headerTitle: { color: '#FFF', fontSize: 20, fontWeight:'bold', textAlign: 'right' },
  headerSub: { color: '#8A95A5', fontSize: 12, textAlign: 'right' },
  backButton: { padding: 8 },
  addButton: { backgroundColor: '#F3C764', padding: 10, borderRadius: 10 },
  
  emptyText: { color: '#666', textAlign: 'center', marginTop: 50 },

  // CARTE UTILISATEUR
  card: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#101A2D', padding: 15, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)' },
  cardAdmin: { borderLeftWidth: 4, borderLeftColor: '#E67E22' },
  cardUser: { borderLeftWidth: 4, borderLeftColor: '#3498DB' },
  
  cardLeft: { flexDirection: 'row', alignItems: 'center' },
  avatar: { width: 44, height: 44, borderRadius: 14, justifyContent: 'center', alignItems: 'center' },
  avatarAdmin: { backgroundColor: 'rgba(230, 126, 34, 0.15)' },
  avatarUser: { backgroundColor: 'rgba(52, 152, 219, 0.15)' },
  
  username: { color: '#FFF', fontSize: 16, fontWeight: 'bold' },
  roleLabel: { fontSize: 11, marginTop: 2, fontWeight: '500' },
  
  cardActions: { flexDirection: 'row', gap: 10 },
  actionBtn: { padding: 10, borderRadius: 10 },

  // MODAL
  modalContainer: { flex: 1, backgroundColor: '#050B14' },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 20, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.1)', marginTop: Platform.OS === 'ios' ? 20 : 0 },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight:'bold' },
  closeBtn: { padding: 5 },
  modalBody: { padding: 20 },

  label: { color: '#8A95A5', marginBottom: 8, textAlign: 'right', fontSize: 13, fontWeight: '600' },
  input: { backgroundColor: '#101A2D', color: '#FFF', padding: 15, borderRadius: 12, marginBottom: 20, borderWidth:1, borderColor:'#333', fontSize: 16 },
  
  roleSwitch: { flexDirection: 'row-reverse', justifyContent:'space-between', alignItems: 'center', padding: 15, borderRadius: 12, marginBottom: 30, borderWidth: 1, borderColor: '#333', backgroundColor: '#101A2D' },
  roleSwitchActive: { backgroundColor: '#F3C764', borderColor: '#F3C764' },
  roleSwitchTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 15, textAlign: 'right' },
  roleSwitchDesc: { color: '#8A95A5', fontSize: 11, marginTop: 2, textAlign: 'right' },

  saveBtn: { backgroundColor: '#F3C764', padding: 16, alignItems: 'center', borderRadius: 12 },
  saveText: { color: '#050B14', fontWeight: 'bold', fontSize: 16 }
});