import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  FlatList, Alert, Modal, ScrollView, SafeAreaView, StatusBar, Platform, ActivityIndicator
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../utils/api';

const emptyHotel = {
  id: null,
  name: '',
  city: 'Makkah', 
  distance: '',
  stars: '0',
  prices: { single: '0', double: '0', triple: '0', quad: '0' }
};

export default function AdminHotels({ navigation, route }) {
  const [hotels, setHotels] = useState([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentHotel, setCurrentHotel] = useState(emptyHotel);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // --- SÉCURITÉ : VÉRIFICATION DU RÔLE ---
  const userRole = route.params?.userRole || 'user';
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    loadHotels();
  }, []);

  const loadHotels = async () => {
    setLoading(true);
    const data = await api.getHotels();
    setHotels(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!isAdmin) {
      Alert.alert('Accès refusé', 'Seuls les administrateurs peuvent modifier les données.');
      return;
    }

    if (!currentHotel.name || !currentHotel.distance) {
      Alert.alert('Erreur', 'Le nom et la distance sont obligatoires');
      return;
    }
    
    setSaving(true);
    try {
      await api.saveHotel(currentHotel);
      setModalVisible(false);
      loadHotels(); 
      Alert.alert('Succès', 'Hôtel enregistré');
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de sauvegarder');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    if (!isAdmin) return;

    Alert.alert(
      "Supprimer ?",
      "Cette action est irréversible.",
      [
        { text: "Annuler", style: "cancel" },
        { 
          text: "Supprimer", 
          style: "destructive", 
          onPress: async () => {
            await api.deleteHotel(id);
            loadHotels();
          } 
        }
      ]
    );
  };

  const openEdit = (hotel) => {
    if (!isAdmin) {
      return; 
    }
    setCurrentHotel({
      ...emptyHotel,
      ...hotel,
      prices: { ...emptyHotel.prices, ...(hotel.prices || {}) },
      stars: String(hotel.stars || '0')
    });
    setModalVisible(true);
  };

  const openNew = () => {
    if (!isAdmin) return;
    setCurrentHotel(emptyHotel);
    setModalVisible(true);
  };

  const updatePrice = (type, value) => {
    setCurrentHotel(prev => ({
      ...prev,
      prices: { ...prev.prices, [type]: value }
    }));
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{flex: 1}}>
          <Text style={styles.hotelName}>{item.name}</Text>
          <View style={styles.badgeRow}>
            {/* Gestion des 3 villes pour le badge */}
            <View style={[
              styles.badge, 
              item.city === 'Makkah' ? styles.badgeMakkah : 
              item.city === 'Medina' ? styles.badgeMedina : styles.badgeJeddah
            ]}>
              <Text style={styles.badgeText}>
                {item.city === 'Makkah' ? 'مكة' : 
                 item.city === 'Medina' ? 'المدينة' : 'جدة'}
              </Text>
            </View>
            <Text style={styles.subText}>⭐ {item.stars} • 📍 {item.distance}</Text>
          </View>
        </View>
        
        {isAdmin && (
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => openEdit(item)} style={styles.iconBtn}>
              <Feather name="edit-2" size={20} color="#F3C764" />
            </TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item.id)} style={styles.iconBtn}>
              <Feather name="trash-2" size={20} color="#E74C3C" />
            </TouchableOpacity>
          </View>
        )}

      </View>
      
      <View style={styles.priceGrid}>
        <Text style={styles.priceText}>2: <Text style={{color:'#FFF'}}>{item.prices?.double || '-'}</Text></Text>
        <Text style={styles.priceText}>3: <Text style={{color:'#FFF'}}>{item.prices?.triple || '-'}</Text></Text>
        <Text style={styles.priceText}>4: <Text style={{color:'#FFF'}}>{item.prices?.quad || '-'}</Text></Text>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#050B14" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-right" size={24} color="#F3C764" />
        </TouchableOpacity>
        
        <Text style={styles.headerTitle}>
          {isAdmin ? 'Gestion des Hôtels' : 'Liste des Hôtels'}
        </Text>
        
        {isAdmin ? (
          <TouchableOpacity onPress={openNew} style={styles.addButton}>
            <Feather name="plus" size={24} color="#050B14" />
          </TouchableOpacity>
        ) : (
          <View style={{width: 40}} /> 
        )}
      </View>

      <FlatList
        data={hotels}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
        refreshing={loading}
        onRefresh={loadHotels}
        ListEmptyComponent={
          !loading && <Text style={styles.emptyText}>Aucun hôtel enregistré.</Text>
        }
      />

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{currentHotel.id ? 'Modifier' : 'Nouveau'}</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.closeBtn}>
              <Feather name="x" size={24} color="#FFF" />
            </TouchableOpacity>
          </View>
          
          <ScrollView contentContainerStyle={{ padding: 20 }}>
            
            {/* SÉLECTEUR VILLE (Avec Jeddah ajouté) */}
            <View style={styles.row}>
              <TouchableOpacity 
                style={[styles.cityBtn, currentHotel.city === 'Makkah' && styles.cityBtnActive]}
                onPress={() => setCurrentHotel({...currentHotel, city: 'Makkah'})}
              >
                <Text style={[styles.cityText, currentHotel.city === 'Makkah' && {color:'#050B14'}]}>مكة</Text>
              </TouchableOpacity>
              <TouchableOpacity 
                style={[styles.cityBtn, currentHotel.city === 'Medina' && styles.cityBtnActive]}
                onPress={() => setCurrentHotel({...currentHotel, city: 'Medina'})}
              >
                <Text style={[styles.cityText, currentHotel.city === 'Medina' && {color:'#050B14'}]}>المدينة</Text>
              </TouchableOpacity>
              {/* Ajout de Jeddah */}
              <TouchableOpacity 
                style={[styles.cityBtn, currentHotel.city === 'Jeddah' && styles.cityBtnActive]}
                onPress={() => setCurrentHotel({...currentHotel, city: 'Jeddah'})}
              >
                <Text style={[styles.cityText, currentHotel.city === 'Jeddah' && {color:'#050B14'}]}>جدة</Text>
              </TouchableOpacity>
            </View>

            <Text style={styles.label}>Nom</Text>
            <TextInput style={styles.input} value={currentHotel.name} onChangeText={t => setCurrentHotel({...currentHotel, name: t})} placeholder="Nom hôtel" placeholderTextColor="#556" textAlign="right"/>

            <View style={styles.row}>
              <View style={{flex:1, marginRight:10}}>
                <Text style={styles.label}>Distance</Text>
                <TextInput style={styles.input} value={currentHotel.distance} onChangeText={t => setCurrentHotel({...currentHotel, distance: t})} placeholder="50m" placeholderTextColor="#556" textAlign="right"/>
              </View>
              <View style={{flex:1}}>
                <Text style={styles.label}>Étoiles</Text>
                <TextInput style={styles.input} value={currentHotel.stars} onChangeText={t => setCurrentHotel({...currentHotel, stars: t})} keyboardType="numeric" placeholder="0-5" placeholderTextColor="#556" textAlign="right"/>
              </View>
            </View>

            <Text style={[styles.sectionTitle, {color:'#F3C764'}]}>Tarifs par NUIT (DA)</Text>
            
            <View style={styles.row}>
              <View style={{flex:1, marginRight:10}}>
                <Text style={styles.label}>Double</Text>
                <TextInput style={styles.input} value={currentHotel.prices.double} onChangeText={t => updatePrice('double', t)} keyboardType="numeric" placeholder="0" textAlign="right"/>
              </View>
              <View style={{flex:1}}>
                <Text style={styles.label}>Triple</Text>
                <TextInput style={styles.input} value={currentHotel.prices.triple} onChangeText={t => updatePrice('triple', t)} keyboardType="numeric" placeholder="0" textAlign="right"/>
              </View>
            </View>
            <View style={styles.row}>
              <View style={{flex:1, marginRight:10}}>
                <Text style={styles.label}>Quad</Text>
                <TextInput style={styles.input} value={currentHotel.prices.quad} onChangeText={t => updatePrice('quad', t)} keyboardType="numeric" placeholder="0" textAlign="right"/>
              </View>
              <View style={{flex:1}}>
                <Text style={styles.label}>Single</Text>
                <TextInput style={styles.input} value={currentHotel.prices.single} onChangeText={t => updatePrice('single', t)} keyboardType="numeric" placeholder="0" textAlign="right"/>
              </View>
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#050B14" /> : <Text style={styles.saveText}>Enregistrer l'hôtel</Text>}
            </TouchableOpacity>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050B14', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: '#050B14', borderBottomWidth: 1, borderColor: '#1F2937' },
  headerTitle: { color: '#F3C764', fontSize: 20, fontWeight: 'bold' },
  addButton: { backgroundColor: '#F3C764', padding: 8, borderRadius: 8 },
  backButton: { padding: 8 },
  
  emptyText: { color: '#888', textAlign: 'center', marginTop: 50, fontSize: 16 },

  card: { backgroundColor: '#101A2D', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#1F2937' },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start' },
  hotelName: { color: '#FFF', fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginBottom: 5 },
  badgeRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  
  // Styles des Badges Villes
  badgeMakkah: { backgroundColor: 'rgba(243, 199, 100, 0.2)' },
  badgeMedina: { backgroundColor: 'rgba(46, 204, 113, 0.2)' },
  badgeJeddah: { backgroundColor: 'rgba(52, 152, 219, 0.2)' }, // Nouveau badge bleu pour Jeddah

  badgeText: { color: '#FFF', fontSize: 12 },
  subText: { color: '#888', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 15 },
  iconBtn: { padding: 5 },
  priceGrid: { flexDirection: 'row-reverse', justifyContent: 'space-around', marginTop: 15, paddingTop: 10, borderTopWidth: 1, borderColor: '#1F2937' },
  priceText: { color: '#AAA', fontSize: 12 },

  modalContainer: { flex: 1, backgroundColor: '#050B14' },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: '#1F2937', marginTop: Platform.OS === 'ios' ? 20 : 0 },
  modalTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  closeBtn: { padding: 5 },
  
  row: { flexDirection: 'row-reverse', gap: 10, marginBottom: 15 },
  cityBtn: { flex: 1, padding: 12, borderRadius: 8, borderWidth: 1, borderColor: '#F3C764', alignItems: 'center' },
  cityBtnActive: { backgroundColor: '#F3C764' },
  cityText: { color: '#F3C764', fontWeight: 'bold' },
  
  label: { color: '#8A95A5', marginBottom: 6, textAlign: 'right', fontSize: 13 },
  input: { backgroundColor: '#101A2D', color: '#FFF', padding: 12, borderRadius: 8, textAlign: 'right', borderWidth: 1, borderColor: '#1F2937', fontSize: 15 },
  
  divider: { height: 1, backgroundColor: '#1F2937', marginVertical: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', textAlign: 'right', marginBottom: 5 },
  saveBtn: { backgroundColor: '#F3C764', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 30, marginBottom: 50 },
  saveText: { color: '#050B14', fontWeight: 'bold', fontSize: 16 },
});