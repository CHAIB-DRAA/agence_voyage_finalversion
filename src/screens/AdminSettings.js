import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, 
  SafeAreaView, StatusBar, Modal, ActivityIndicator, Alert, ScrollView, Platform, KeyboardAvoidingView
} from 'react-native';
import { Feather, FontAwesome5, MaterialIcons } from '@expo/vector-icons';
import api from '../utils/api';

// --- CONSTANTES DESIGN ---
const COLORS = {
  bg: '#050B14',
  card: '#101A2D',
  primary: '#F3C764',
  text: '#FFFFFF',
  textDim: '#8A95A5',
  border: '#2A3B55',
  danger: '#E74C3C',
  success: '#2ECC71'
};

export default function AdminSettings({ navigation }) {
  // Données
  const [settings, setSettings] = useState({ destinations: [], periods: [], transports: [], intercity: [], meals: [], agency_info: [] });
  const [activeTab, setActiveTab] = useState('destination');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal
  const [modalVisible, setModalVisible] = useState(false);
  const [currentItem, setCurrentItem] = useState({ id: null, label: '', price: '', category: '' });
  const [saving, setSaving] = useState(false);

  // Configuration des Onglets
  const TABS = [
    { key: 'destination', label: 'الوجهات', sub: 'Destinations', icon: 'map-pin', hasPrice: false },
    { key: 'period', label: 'الفترات', sub: 'Saisons', icon: 'calendar', hasPrice: false },
    { key: 'transport_main', label: 'الطيران', sub: 'Vols', icon: 'plane', hasPrice: false }, 
    { key: 'transport_intercity', label: 'نقل داخلي', sub: 'Transport', icon: 'bus', hasPrice: true }, 
    { key: 'meal', label: 'الإعاشة', sub: 'Repas', icon: 'coffee', hasPrice: true },
    { key: 'agency_info', label: 'الوكالة', sub: 'Config', icon: 'settings', hasPrice: false, isConfig: true }, // NOUVEAU
  ];

  const currentTabConfig = TABS.find(t => t.key === activeTab);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getSettings();
      // On s'assure que toutes les clés existent
      setSettings({
        destinations: data.destinations || [],
        periods: data.periods || [],
        transports: data.transports || [],
        intercity: data.intercity || [],
        meals: data.meals || [],
        agency_info: data.agency_info || [] // Stockage générique pour la config
      });
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // --- LOGIQUE FILTRAGE ---
  const getFilteredData = () => {
    let data = [];
    if (activeTab === 'destination') data = settings.destinations;
    else if (activeTab === 'period') data = settings.periods;
    else if (activeTab === 'transport_main') data = settings.transports;
    else if (activeTab === 'transport_intercity') data = settings.intercity;
    else if (activeTab === 'meal') data = settings.meals;
    else if (activeTab === 'agency_info') data = settings.agency_info;

    if (!searchQuery) return data;
    return data.filter(item => item.label.toLowerCase().includes(searchQuery.toLowerCase()));
  };

  // --- ACTIONS ---
  const handleSave = async () => {
    if (!currentItem.label.trim()) {
      Alert.alert('Erreur', 'Le champ est vide');
      return;
    }

    setSaving(true);
    try {
      if (currentItem.id) {
        await api.updateSetting(currentItem.id, { 
          label: currentItem.label, 
          price: currentItem.price || '0' 
        });
      } else {
        await api.addSetting(activeTab, currentItem.label, currentItem.price || '0');
      }
      setModalVisible(false);
      loadData();
    } catch (e) {
      Alert.alert('Erreur', 'Echec sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    Alert.alert("Supprimer ?", "Cette action est définitive.", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: async () => { await api.deleteSetting(id); loadData(); } }
    ]);
  };

  const openEdit = (item) => {
    setCurrentItem({ id: item._id, label: item.label, price: String(item.price || '0'), category: activeTab });
    setModalVisible(true);
  };

  const openNew = () => {
    setCurrentItem({ id: null, label: '', price: '', category: activeTab });
    setModalVisible(true);
  };

  // --- RENDERERS ---
  const renderItem = ({ item }) => (
    <View style={styles.card}>
      <View style={[styles.iconBox, {backgroundColor: COLORS.primary + '20'}]}>
         <Feather name={currentTabConfig.icon} size={20} color={COLORS.primary} />
      </View>
      
      <View style={{flex: 1, marginHorizontal: 10}}>
        <Text style={styles.itemTitle}>{item.label}</Text>
        {currentTabConfig.hasPrice && item.price && item.price !== '0' && (
           <Text style={styles.itemPrice}>{parseInt(item.price).toLocaleString()} DA</Text>
        )}
        {/* Affichage spécial pour la config agence */}
        {activeTab === 'agency_info' && (
           <Text style={styles.itemSub}>Paramètre Système</Text>
        )}
      </View>

      <View style={styles.actions}>
        <TouchableOpacity onPress={() => openEdit(item)} style={styles.actionBtn}>
          <Feather name="edit-2" size={18} color={COLORS.textDim} />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item._id)} style={[styles.actionBtn, {backgroundColor: COLORS.danger + '20'}]}>
          <Feather name="trash-2" size={18} color={COLORS.danger} />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-right" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paramètres & Options</Text>
        <TouchableOpacity onPress={openNew} style={styles.addButton}>
          <Feather name="plus" size={24} color={COLORS.bg} />
        </TouchableOpacity>
      </View>

      {/* TABS (SCROLLABLE) */}
      <View style={{height: 70}}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
          {TABS.map(tab => {
            const isActive = activeTab === tab.key;
            return (
              <TouchableOpacity 
                key={tab.key} 
                onPress={() => { setActiveTab(tab.key); setSearchQuery(''); }} 
                style={[styles.tabItem, isActive && styles.tabItemActive]}
              >
                <Feather name={tab.icon} size={16} color={isActive ? COLORS.bg : COLORS.textDim} style={{marginBottom: 4}} />
                <Text style={[styles.tabLabel, isActive && styles.tabLabelActive]}>{tab.label}</Text>
                <Text style={[styles.tabSub, isActive && {color: 'rgba(0,0,0,0.5)'}]}>{tab.sub}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* SEARCH BAR */}
      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color={COLORS.textDim} style={{marginRight: 10}} />
        <TextInput 
          style={styles.searchInput} 
          placeholder={`Rechercher dans ${currentTabConfig.label}...`} 
          placeholderTextColor={COLORS.textDim}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Feather name="x" size={18} color={COLORS.textDim} />
          </TouchableOpacity>
        )}
      </View>

      {/* LISTE */}
      <FlatList
        data={getFilteredData()}
        keyExtractor={item => item._id || Math.random().toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={loadData}
        ListEmptyComponent={
          !loading && (
            <View style={styles.emptyState}>
              <Feather name="sliders" size={40} color={COLORS.border} />
              <Text style={styles.emptyText}>Aucune option configurée</Text>
              <Text style={styles.emptySub}>Appuyez sur + pour ajouter</Text>
            </View>
          )
        }
      />

      {/* MODAL */}
      <Modal visible={modalVisible} animationType="slide" transparent={true} onRequestClose={() => setModalVisible(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{currentItem.id ? 'Modifier' : 'Ajouter'} {currentTabConfig.sub}</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Feather name="x" size={24} color={COLORS.text} />
              </TouchableOpacity>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Libellé / Nom</Text>
              <TextInput 
                style={styles.input} 
                value={currentItem.label} 
                onChangeText={t => setCurrentItem({...currentItem, label: t})}
                placeholder={activeTab === 'agency_info' ? "Ex: Nom Agence" : "Ex: Bus VIP"} 
                placeholderTextColor={COLORS.textDim}
                autoFocus
              />
              {activeTab === 'agency_info' && <Text style={styles.hint}>Utilisé pour configurer les variables globales (CCP, Tél...)</Text>}
            </View>

            {(currentTabConfig.hasPrice || (currentItem.price && currentItem.price !== '0')) && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Prix par défaut (Optionnel)</Text>
                <View style={styles.priceInputContainer}>
                   <TextInput 
                    style={[styles.input, {flex:1, marginBottom:0}]} 
                    value={currentItem.price} 
                    onChangeText={t => setCurrentItem({...currentItem, price: t})}
                    keyboardType="numeric"
                    placeholder="0" 
                    placeholderTextColor={COLORS.textDim}
                  />
                  <Text style={styles.currencySuffix}>DA</Text>
                </View>
              </View>
            )}

            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              {saving ? <ActivityIndicator color={COLORS.bg} /> : <Text style={styles.saveText}>Enregistrer</Text>}
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', padding: 20, borderBottomWidth: 1, borderColor: COLORS.border },
  headerTitle: { color: COLORS.text, fontSize: 20, fontWeight: 'bold' },
  addButton: { backgroundColor: COLORS.primary, padding: 10, borderRadius: 12 },
  backButton: { padding: 5 },

  tabsScroll: { paddingHorizontal: 15, alignItems: 'center' },
  tabItem: { paddingVertical: 10, paddingHorizontal: 16, marginRight: 10, borderRadius: 16, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.card, alignItems: 'center', minWidth: 80 },
  tabItemActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  tabLabel: { color: COLORS.textDim, fontSize: 12, fontWeight: 'bold' },
  tabLabelActive: { color: COLORS.bg },
  tabSub: { fontSize: 10, color: COLORS.textDim, marginTop: 2 },

  searchContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.card, marginHorizontal: 20, marginTop: 10, borderRadius: 12, paddingHorizontal: 15, paddingVertical: 12, borderWidth: 1, borderColor: COLORS.border },
  searchInput: { flex: 1, color: COLORS.text, fontSize: 16 },

  listContent: { padding: 20, paddingBottom: 100 },
  
  card: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: COLORS.card, padding: 15, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: COLORS.border },
  iconBox: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  itemTitle: { color: COLORS.text, fontSize: 16, fontWeight: '600', textAlign: 'right' },
  itemPrice: { color: COLORS.primary, fontSize: 14, fontWeight: 'bold', textAlign: 'right', marginTop: 4 },
  itemSub: { color: COLORS.textDim, fontSize: 10, textAlign: 'right', marginTop: 2, fontStyle: 'italic' },
  
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)' },

  emptyState: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: COLORS.text, fontSize: 16, fontWeight: 'bold', marginTop: 10 },
  emptySub: { color: COLORS.textDim, fontSize: 14, marginTop: 5 },

  // MODAL
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 25, borderWidth: 1, borderColor: COLORS.border },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { color: COLORS.text, fontSize: 20, fontWeight: 'bold' },
  
  formGroup: { marginBottom: 20 },
  label: { color: COLORS.textDim, marginBottom: 8, textAlign: 'right', fontSize: 14 },
  input: { backgroundColor: COLORS.card, color: COLORS.text, padding: 15, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, fontSize: 16, textAlign: 'right' },
  hint: { color: COLORS.primary, fontSize: 11, marginTop: 5, textAlign: 'right' },
  
  priceInputContainer: { flexDirection: 'row', alignItems: 'center' },
  currencySuffix: { color: COLORS.primary, marginLeft: 10, fontWeight: 'bold' },

  saveBtn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  saveText: { color: COLORS.bg, fontWeight: 'bold', fontSize: 16 },
});