import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  FlatList, Alert, Modal, ScrollView, SafeAreaView, StatusBar, Platform, ActivityIndicator
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../utils/api';

// Structure vide alignée sur votre modèle Mongoose
const emptyHotel = {
  id: null,
  name: '',
  city: 'Makkah', 
  distance: '',
  stars: '0',
  // Prix de base
  prices: { single: '0', double: '0', triple: '0', quad: '0', penta: '0', suite: '0' },
  // Prix saisonniers (Tableau d'objets)
  seasonalPrices: [] 
};

// Configuration pour générer les champs automatiquement
const ROOM_TYPES = [
  { key: 'double', label: 'Double (ثنائية)' },
  { key: 'triple', label: 'Triple (ثلاثية)' },
  { key: 'quad', label: 'Quad (رباعية)' },
  { key: 'penta', label: 'Penta (خماسية)' }, // 5 lits
  { key: 'suite', label: 'Suite (جناح)' },
  { key: 'single', label: 'Single (فردية)' },
];

export default function AdminHotels({ navigation, route }) {
  const [hotels, setHotels] = useState([]);
  const [periodsList, setPeriodsList] = useState([]); // Liste des saisons dispos (Settings)
  const [modalVisible, setModalVisible] = useState(false);
  const [currentHotel, setCurrentHotel] = useState(emptyHotel);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [activeTypes, setActiveTypes] = useState({}); // Pour cocher/décocher les types dispos
  
  // Onglets du modal
  const [modalTab, setModalTab] = useState('base'); 

  // Sécurité
  const userRole = route.params?.userRole || 'user';
  const isAdmin = userRole === 'admin';

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [hotelsData, settingsData] = await Promise.all([
        api.getHotels(),
        api.getSettings()
      ]);
      setHotels(hotelsData);
      setPeriodsList(settingsData.periods || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const handleSave = async () => {
    if (!isAdmin) return;
    if (!currentHotel.name || !currentHotel.distance) {
      Alert.alert('Erreur', 'Le nom et la distance sont obligatoires');
      return;
    }
    
    setSaving(true);
    try {
      await api.saveHotel(currentHotel);
      setModalVisible(false);
      loadData(); 
      Alert.alert('Succès', 'Hôtel enregistré');
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de sauvegarder');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    if (!isAdmin) return;
    Alert.alert("Supprimer ?", "Irréversible.", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: async () => { await api.deleteHotel(id); loadData(); } }
    ]);
  };

  const openEdit = (hotel) => {
    if (!isAdmin) return;
    
    // Fusion pour garantir la structure complète
    const hotelData = {
      ...emptyHotel,
      ...hotel,
      id: hotel.id || hotel._id, 
      prices: { ...emptyHotel.prices, ...(hotel.prices || {}) },
      seasonalPrices: hotel.seasonalPrices || []
    };

    setCurrentHotel(hotelData);
    
    // Déterminer les cases à cocher (si prix > 0)
    const activeState = {};
    ROOM_TYPES.forEach(type => {
      const price = hotelData.prices[type.key];
      activeState[type.key] = price && price !== '0';
    });
    setActiveTypes(activeState);

    setModalTab('base');
    setModalVisible(true);
  };

  const openNew = () => {
    if (!isAdmin) return;
    setCurrentHotel(emptyHotel);
    setActiveTypes({});
    setModalTab('base');
    setModalVisible(true);
  };

  // --- GESTION PRIX DE BASE ---
  const toggleRoomType = (key) => {
    const isActive = activeTypes[key];
    setActiveTypes(prev => ({ ...prev, [key]: !isActive }));
    if (isActive) {
      // Si décoché, prix = 0
      setCurrentHotel(prev => ({ ...prev, prices: { ...prev.prices, [key]: '0' } }));
    }
  };

  const updateBasePrice = (type, value) => {
    setCurrentHotel(prev => ({ ...prev, prices: { ...prev.prices, [type]: value } }));
  };

  // --- GESTION PRIX SAISONNIERS ---
  const addSeason = (periodName) => {
    if (currentHotel.seasonalPrices.find(p => p.periodName === periodName)) {
      Alert.alert('Info', 'Période déjà ajoutée.');
      return;
    }
    // On initialise les prix de la saison avec les prix de base pour gagner du temps
    const newSeason = {
      periodName,
      prices: { ...currentHotel.prices } 
    };
    setCurrentHotel(prev => ({ ...prev, seasonalPrices: [...prev.seasonalPrices, newSeason] }));
  };

  const removeSeason = (index) => {
    const updated = [...currentHotel.seasonalPrices];
    updated.splice(index, 1);
    setCurrentHotel(prev => ({ ...prev, seasonalPrices: updated }));
  };

  const updateSeasonPrice = (seasonIndex, type, value) => {
    // CORRECTION : Copie profonde pour que React détecte le changement
    const updatedSeasons = currentHotel.seasonalPrices.map((season, index) => {
      if (index === seasonIndex) {
        return {
          ...season,
          prices: {
            ...season.prices,
            [type]: value
          }
        };
      }
      return season;
    });

    setCurrentHotel(prev => ({ ...prev, seasonalPrices: updatedSeasons }));
  };

  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <View style={{flex: 1}}>
          <Text style={styles.hotelName}>{item.name}</Text>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, item.city === 'Makkah' ? styles.badgeMakkah : (item.city === 'Medina' ? styles.badgeMedina : styles.badgeJeddah)]}>
              <Text style={styles.badgeText}>{item.city === 'Makkah' ? 'مكة' : (item.city === 'Medina' ? 'المدينة' : 'جدة')}</Text>
            </View>
            <Text style={styles.subText}>⭐ {item.stars} • 📍 {item.distance}</Text>
          </View>
        </View>
        {isAdmin && (
          <View style={styles.actions}>
            <TouchableOpacity onPress={() => openEdit(item)} style={styles.iconBtn}><Feather name="edit-2" size={20} color="#F3C764" /></TouchableOpacity>
            <TouchableOpacity onPress={() => handleDelete(item.id || item._id)} style={styles.iconBtn}><Feather name="trash-2" size={20} color="#E74C3C" /></TouchableOpacity>
          </View>
        )}
      </View>
      <View style={styles.priceGrid}>
        <Text style={styles.priceText}>Base Double: {item.prices?.double || '0'} DA</Text>
        {item.seasonalPrices && item.seasonalPrices.length > 0 && (
          <Text style={[styles.priceText, {color: '#2ECC71', marginTop: 4}]}>+ {item.seasonalPrices.length} tarifs saisonniers</Text>
        )}
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#050B14" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Feather name="arrow-right" size={24} color="#F3C764" /></TouchableOpacity>
        <Text style={styles.headerTitle}>Hôtels & Saisons</Text>
        {isAdmin && <TouchableOpacity onPress={openNew} style={styles.addButton}><Feather name="plus" size={24} color="#050B14" /></TouchableOpacity>}
      </View>

      <FlatList 
        data={hotels} 
        keyExtractor={item => item.id || item._id} 
        renderItem={renderItem} 
        contentContainerStyle={{ padding: 20 }} 
        ListEmptyComponent={!loading && <Text style={styles.emptyText}>Aucun hôtel.</Text>}
      />

      <Modal visible={modalVisible} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>{currentHotel.id ? 'Modifier' : 'Nouveau'}</Text>
            <TouchableOpacity onPress={() => setModalVisible(false)}><Feather name="x" size={24} color="#FFF" /></TouchableOpacity>
          </View>
          
          <View style={styles.modalTabs}>
            <TouchableOpacity onPress={() => setModalTab('base')} style={[styles.modalTab, modalTab === 'base' && styles.modalTabActive]}>
              <Text style={[styles.modalTabText, modalTab === 'base' && {color: '#050B14'}]}>Infos & Base</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setModalTab('seasons')} style={[styles.modalTab, modalTab === 'seasons' && styles.modalTabActive]}>
              <Text style={[styles.modalTabText, modalTab === 'seasons' && {color: '#050B14'}]}>Saisons ({currentHotel.seasonalPrices.length})</Text>
            </TouchableOpacity>
          </View>

          <ScrollView contentContainerStyle={{ padding: 20 }}>
            
            {/* --- Utilisation de View au lieu de Fragment pour éviter le crash --- */}
            {modalTab === 'base' ? (
              <View>
                <View style={styles.row}>
                  <TouchableOpacity style={[styles.cityBtn, currentHotel.city === 'Makkah' && styles.cityBtnActive]} onPress={() => setCurrentHotel({...currentHotel, city: 'Makkah'})}><Text style={[styles.cityText, currentHotel.city === 'Makkah' && {color: '#050B14'}]}>Makkah</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.cityBtn, currentHotel.city === 'Medina' && styles.cityBtnActive]} onPress={() => setCurrentHotel({...currentHotel, city: 'Medina'})}><Text style={[styles.cityText, currentHotel.city === 'Medina' && {color: '#050B14'}]}>Medina</Text></TouchableOpacity>
                  <TouchableOpacity style={[styles.cityBtn, currentHotel.city === 'Jeddah' && styles.cityBtnActive]} onPress={() => setCurrentHotel({...currentHotel, city: 'Jeddah'})}><Text style={[styles.cityText, currentHotel.city === 'Jeddah' && {color: '#050B14'}]}>Jeddah</Text></TouchableOpacity>
                </View>

                <Text style={styles.label}>Nom</Text>
                <TextInput style={styles.input} value={currentHotel.name} onChangeText={t => setCurrentHotel({...currentHotel, name: t})} placeholder="Nom hôtel" placeholderTextColor="#556" textAlign="right"/>
                
                <View style={styles.row}>
                  <View style={{flex:1, marginRight:10}}>
                    <Text style={styles.label}>Distance (m)</Text>
                    <TextInput style={styles.input} value={currentHotel.distance} onChangeText={t => setCurrentHotel({...currentHotel, distance: t})} placeholder="50m" placeholderTextColor="#556" textAlign="right"/>
                  </View>
                  <View style={{flex:1}}>
                    <Text style={styles.label}>Étoiles</Text>
                    <TextInput style={styles.input} value={String(currentHotel.stars)} onChangeText={t => setCurrentHotel({...currentHotel, stars: t})} placeholder="0-5" keyboardType="numeric" placeholderTextColor="#556" textAlign="right"/>
                  </View>
                </View>

                <View style={styles.divider} />
                <Text style={[styles.sectionTitle, {color:'#F3C764'}]}>Prix de Base (Hors Saison)</Text>
                
                {ROOM_TYPES.map((type) => (
                  <View key={type.key} style={styles.roomRow}>
                    <TouchableOpacity style={[styles.checkboxContainer, activeTypes[type.key] && styles.checkboxActive]} onPress={() => toggleRoomType(type.key)}>
                      <Feather name={activeTypes[type.key] ? "check-square" : "square"} size={24} color={activeTypes[type.key] ? "#050B14" : "#666"} />
                      <Text style={[styles.checkboxLabel, activeTypes[type.key] && {color:'#050B14', fontWeight:'bold'}]}>{type.label}</Text>
                    </TouchableOpacity>
                    {activeTypes[type.key] && (
                      <View style={styles.priceInputContainer}>
                        <TextInput style={styles.priceInput} value={String(currentHotel.prices[type.key] || '')} onChangeText={t => updateBasePrice(type.key, t)} keyboardType="numeric" placeholder="0" placeholderTextColor="#556"/>
                        <Text style={{color:'#F3C764', fontSize:12, marginLeft:5}}>DA</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            ) : (
              <View>
                <Text style={{color:'#888', marginBottom:15, fontSize:13, textAlign:'center'}}>
                   Définissez ici les tarifs pour le Ramadan, Mawlid, etc. {"\n"}
                   (Incluant Penta et Suite)
                </Text>

                {currentHotel.seasonalPrices.map((season, seasonIndex) => (
                  <View key={seasonIndex} style={styles.seasonCard}>
                    <View style={styles.seasonHeader}>
                      <Text style={styles.seasonTitle}>{season.periodName}</Text>
                      <TouchableOpacity onPress={() => removeSeason(seasonIndex)}><Feather name="trash-2" size={20} color="#E74C3C" /></TouchableOpacity>
                    </View>
                    <View style={styles.seasonGrid}>
                        {ROOM_TYPES.map((type) => (
                           <View key={type.key} style={styles.seasonInputWrapper}>
                              <Text style={styles.seasonLabel}>{type.key.charAt(0).toUpperCase() + type.key.slice(1)}</Text>
                              <TextInput 
                                style={styles.seasonInput} 
                                value={String(season.prices[type.key] || '')} 
                                onChangeText={t => updateSeasonPrice(seasonIndex, type.key, t)} 
                                keyboardType="numeric" 
                                placeholder="0" 
                                placeholderTextColor="#556" 
                              />
                           </View>
                        ))}
                    </View>
                  </View>
                ))}

                <Text style={{color:'#FFF', marginTop:20, marginBottom:10, fontWeight:'bold'}}>Ajouter une période :</Text>
                <View style={{flexDirection:'row', flexWrap:'wrap', gap:10}}>
                  {periodsList.length > 0 ? periodsList.map(p => (
                    <TouchableOpacity key={p._id} style={styles.addSeasonBtn} onPress={() => addSeason(p.label)}>
                      <Text style={{color:'#050B14', fontSize:12, fontWeight:'bold'}}>{p.label}</Text>
                      <Feather name="plus" size={12} color="#050B14" style={{marginLeft:4}}/>
                    </TouchableOpacity>
                  )) : (
                    <Text style={{color:'#666'}}>Aucune période configurée dans les réglages.</Text>
                  )}
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color="#050B14" /> : <Text style={styles.saveText}>Enregistrer</Text>}
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
  card: { backgroundColor: '#101A2D', padding: 15, borderRadius: 12, marginBottom: 15, borderWidth: 1, borderColor: '#1F2937' },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start' },
  hotelName: { color: '#FFF', fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginBottom: 5 },
  badgeRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 },
  badgeMakkah: { backgroundColor: 'rgba(243, 199, 100, 0.2)' },
  badgeMedina: { backgroundColor: 'rgba(46, 204, 113, 0.2)' },
  badgeJeddah: { backgroundColor: 'rgba(52, 152, 219, 0.2)' },
  badgeText: { color: '#FFF', fontSize: 12 },
  subText: { color: '#888', fontSize: 12 },
  actions: { flexDirection: 'row', gap: 15 },
  iconBtn: { padding: 5 },
  priceGrid: { marginTop: 10 },
  priceText: { color: '#AAA', fontSize: 12, textAlign: 'right' },
  modalContainer: { flex: 1, backgroundColor: '#050B14' },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: '#1F2937', marginTop: Platform.OS === 'ios' ? 20 : 0 },
  modalTitle: { color: '#FFF', fontSize: 20, fontWeight: 'bold' },
  modalTabs: { flexDirection: 'row', borderBottomWidth: 1, borderColor: '#333' },
  modalTab: { flex: 1, padding: 15, alignItems: 'center' },
  modalTabActive: { backgroundColor: '#F3C764' },
  modalTabText: { color: '#888', fontWeight: 'bold' },
  row: { flexDirection: 'row-reverse', gap: 10, marginBottom: 15 },
  cityBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#F3C764', alignItems: 'center', marginHorizontal: 2 },
  cityBtnActive: { backgroundColor: '#F3C764' },
  cityText: { fontSize: 12, fontWeight: 'bold', color: '#FFF' }, 
  input: { backgroundColor: '#101A2D', color: '#FFF', padding: 12, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#333', textAlign:'right' },
  label: { color: '#8A95A5', marginBottom: 6, textAlign: 'right', fontSize: 13 },
  divider: { height: 1, backgroundColor: '#1F2937', marginVertical: 20 },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', textAlign: 'right', marginBottom: 5 },
  roomRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 12, justifyContent: 'space-between' },
  checkboxContainer: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', gap: 10, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#333' },
  checkboxActive: { backgroundColor: '#F3C764', borderColor: '#F3C764' },
  checkboxLabel: { color: '#888', fontSize: 14 },
  priceInputContainer: { flex: 1, flexDirection: 'row-reverse', alignItems: 'center', marginLeft: 10 },
  priceInput: { flex: 1, backgroundColor: '#101A2D', color: '#FFF', padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#333', textAlign:'center' },
  seasonCard: { backgroundColor: '#1A2634', padding: 15, borderRadius: 10, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  seasonHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15, borderBottomWidth:1, borderColor:'#333', paddingBottom:5 },
  seasonTitle: { color: '#F3C764', fontWeight: 'bold', fontSize: 16 },
  seasonGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 10 },
  seasonInputWrapper: { width: '30%', marginBottom: 10 },
  seasonLabel: { color: '#AAA', fontSize: 10, marginBottom: 2, textAlign:'right' },
  seasonInput: { backgroundColor: '#09121F', color: '#FFF', padding: 8, borderRadius: 6, borderWidth: 1, borderColor: '#444', textAlign: 'center', fontSize: 12 },
  addSeasonBtn: { backgroundColor: '#3498DB', padding: 10, borderRadius: 20, flexDirection: 'row', alignItems: 'center' },
  saveBtn: { backgroundColor: '#F3C764', padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 20, marginBottom: 50 },
  saveText: { color: '#050B14', fontWeight: 'bold', fontSize: 16 },
  emptyText: { color: '#888', textAlign: 'center', marginTop: 50, fontSize: 16 },
});