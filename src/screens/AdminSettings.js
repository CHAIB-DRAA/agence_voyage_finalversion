import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, 
  SafeAreaView, StatusBar, Modal, ActivityIndicator, Alert, ScrollView 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../utils/api';

export default function AdminSettings({ navigation }) {
  // État initial avec toutes les catégories possibles
  const [settings, setSettings] = useState({ destinations: [], periods: [], transports: [], intercity: [], meals: [] });
  const [activeTab, setActiveTab] = useState('destination');
  const [loading, setLoading] = useState(false);
  
  // États pour le formulaire (Ajout/Edition)
  const [modalVisible, setModalVisible] = useState(false);
  const [currentItem, setCurrentItem] = useState({ id: null, label: '', price: '' });
  const [saving, setSaving] = useState(false);

  // Chargement des données au démarrage
  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const data = await api.getSettings();
    setSettings(data);
    setLoading(false);
  };

  const handleSave = async () => {
    if (!currentItem.label.trim()) {
      Alert.alert('Erreur', 'Le nom est obligatoire');
      return;
    }

    setSaving(true);
    try {
      if (currentItem.id) {
        // Mode Modification
        await api.updateSetting(currentItem.id, { 
          label: currentItem.label, 
          price: currentItem.price || '0' 
        });
      } else {
        // Mode Création
        await api.addSetting(activeTab, currentItem.label, currentItem.price || '0');
      }
      setModalVisible(false);
      loadData(); // Recharger la liste pour voir les changements
    } catch (e) {
      Alert.alert('Erreur', 'Impossible de sauvegarder');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    Alert.alert("Supprimer ?", "Cette action est irréversible.", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: async () => {
          await api.deleteSetting(id);
          loadData();
        } 
      }
    ]);
  };

  const openEdit = (item) => {
    setCurrentItem({ id: item._id, label: item.label, price: String(item.price || '0') });
    setModalVisible(true);
  };

  const openNew = () => {
    setCurrentItem({ id: null, label: '', price: '' });
    setModalVisible(true);
  };

  // Configuration des onglets (Tabs)
  const tabs = [
    { key: 'destination', label: 'الوجهات (Dest)', hasPrice: false },
    { key: 'period', label: 'الفترات (Saison)', hasPrice: false },
    { key: 'transport_main', label: 'الطيران (Vols)', hasPrice: false }, 
    { key: 'transport_intercity', label: 'نقل داخلي', hasPrice: true }, // Transport a un prix fixe
    { key: 'meal', label: 'الإعاشة (Repas)', hasPrice: true }, // Repas a un prix fixe
  ];

  const currentTabConfig = tabs.find(t => t.key === activeTab);
  
  // Récupérer les données correspondant à l'onglet actif
  const getDataForTab = () => {
    if (activeTab === 'destination') return settings.destinations;
    if (activeTab === 'period') return settings.periods;
    if (activeTab === 'transport_main') return settings.transports;
    if (activeTab === 'transport_intercity') return settings.intercity;
    if (activeTab === 'meal') return settings.meals;
    return [];
  };

  const renderItem = ({ item }) => (
    <View style={styles.itemRow}>
      <View style={{flex: 1}}>
        <Text style={styles.itemText}>{item.label}</Text>
        {/* On affiche le prix seulement si pertinent ou s'il est > 0 */}
        {(currentTabConfig.hasPrice || (item.price && item.price !== '0')) && (
          <Text style={styles.itemPrice}>{item.price} DA</Text>
        )}
      </View>
      <View style={styles.actions}>
        <TouchableOpacity onPress={() => openEdit(item)} style={styles.iconBtn}>
          <Feather name="edit-2" size={20} color="#F3C764" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handleDelete(item._id)} style={styles.iconBtn}>
          <Feather name="trash-2" size={20} color="#E74C3C" />
        </TouchableOpacity>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#050B14" />
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-right" size={24} color="#F3C764" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>إعدادات عامة</Text>
        <TouchableOpacity onPress={openNew} style={styles.addButton}>
          <Feather name="plus" size={24} color="#050B14" />
        </TouchableOpacity>
      </View>

      {/* BARRE D'ONGLETS */}
      <View style={styles.tabsContainer}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{paddingHorizontal: 10}}>
          {tabs.map(tab => (
            <TouchableOpacity 
              key={tab.key} 
              onPress={() => setActiveTab(tab.key)} 
              style={[styles.tab, activeTab === tab.key && styles.activeTab]}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.activeTabText]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* LISTE DES OPTIONS */}
      <FlatList
        data={getDataForTab()}
        keyExtractor={item => item._id}
        renderItem={renderItem}
        contentContainerStyle={{ padding: 20 }}
        refreshing={loading}
        onRefresh={loadData}
        ListEmptyComponent={<Text style={{color:'#666', textAlign:'center', marginTop:50}}>Aucune option trouvée.</Text>}
      />

      {/* MODAL AJOUT / MODIFICATION */}
      <Modal visible={modalVisible} animationType="fade" transparent={true} onRequestClose={() => setModalVisible(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>
              {currentItem.id ? 'Modifier l\'option' : 'Nouvelle option'}
            </Text>
            
            <Text style={styles.label}>Nom / Libellé</Text>
            <TextInput 
              style={styles.input} 
              value={currentItem.label} 
              onChangeText={t => setCurrentItem({...currentItem, label: t})}
              placeholder="Ex: Bus VIP" 
              placeholderTextColor="#556"
              textAlign="right"
            />

            {/* Champ Prix (Affiché seulement si pertinent pour la catégorie) */}
            {currentTabConfig && currentTabConfig.hasPrice && (
              <>
                <Text style={styles.label}>Prix par défaut (DA)</Text>
                <TextInput 
                  style={styles.input} 
                  value={currentItem.price} 
                  onChangeText={t => setCurrentItem({...currentItem, price: t})}
                  keyboardType="numeric"
                  placeholder="0" 
                  placeholderTextColor="#556"
                  textAlign="right"
                />
              </>
            )}

            <View style={styles.modalButtons}>
              <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.cancelBtn}>
                <Text style={styles.cancelText}>Annuler</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} style={styles.saveBtn} disabled={saving}>
                {saving ? <ActivityIndicator color="#050B14" /> : <Text style={styles.saveText}>Enregistrer</Text>}
              </TouchableOpacity>
            </View>
          </View>
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

  tabsContainer: { height: 60, marginTop: 10 },
  tab: { paddingVertical: 10, paddingHorizontal: 16, marginRight: 10, borderRadius: 20, borderWidth: 1, borderColor: '#333', height: 40, justifyContent: 'center' },
  activeTab: { backgroundColor: '#F3C764', borderColor: '#F3C764' },
  tabText: { color: '#AAA', fontSize: 13 },
  activeTabText: { color: '#050B14', fontWeight: 'bold' },

  itemRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 15, backgroundColor: '#101A2D', borderRadius: 12, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  itemText: { color: '#FFF', fontSize: 16, fontWeight: '600', textAlign: 'right' },
  itemPrice: { color: '#F3C764', fontSize: 14, textAlign: 'right', marginTop: 4 },
  actions: { flexDirection: 'row', gap: 15 },
  iconBtn: { padding: 5 },

  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: '#101A2D', borderRadius: 16, padding: 20, borderWidth: 1, borderColor: '#333' },
  modalTitle: { color: '#F3C764', fontSize: 20, fontWeight: 'bold', textAlign: 'center', marginBottom: 20 },
  label: { color: '#8A95A5', marginBottom: 8, textAlign: 'right' },
  input: { backgroundColor: '#050B14', color: '#FFF', padding: 12, borderRadius: 8, marginBottom: 15, borderWidth: 1, borderColor: '#333' },
  modalButtons: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  cancelBtn: { padding: 15, flex: 1, alignItems: 'center' },
  cancelText: { color: '#888' },
  saveBtn: { backgroundColor: '#F3C764', padding: 15, borderRadius: 10, flex: 1, alignItems: 'center', marginLeft: 10 },
  saveText: { color: '#050B14', fontWeight: 'bold' },
});