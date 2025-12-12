import React, { useState, useEffect } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, FlatList, StyleSheet, 
  SafeAreaView, StatusBar, Modal, ActivityIndicator, Alert, ScrollView, Platform, KeyboardAvoidingView, Image
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker'; 
import api from '../utils/api';

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
  const [settings, setSettings] = useState({ destinations: [], periods: [], transports: [], intercity: [], meals: [], agency_info: [] });
  const [activeTab, setActiveTab] = useState('destination');
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [modalVisible, setModalVisible] = useState(false);
  const [currentItem, setCurrentItem] = useState({ id: null, label: '', price: '', value: '', category: '' });
  const [inputType, setInputType] = useState('text'); 
  const [saving, setSaving] = useState(false);

  const TABS = [
    { key: 'destination', label: 'الوجهات', sub: 'Destinations', icon: 'map-pin', hasPrice: false },
    { key: 'period', label: 'الفترات', sub: 'Saisons', icon: 'calendar', hasPrice: false },
    { key: 'transport_main', label: 'الطيران', sub: 'Vols', icon: 'send', hasPrice: false }, 
    { key: 'transport_intercity', label: 'نقل داخلي', sub: 'Transport', icon: 'truck', hasPrice: true }, 
    { key: 'meal', label: 'الإعاشة', sub: 'Repas', icon: 'coffee', hasPrice: true },
    { key: 'agency_info', label: 'الوكالة', sub: 'Config', icon: 'settings', hasPrice: false, isConfig: true }, 
  ];

  const currentTabConfig = TABS.find(t => t.key === activeTab) || TABS[0];

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const data = await api.getSettings();
      setSettings({
        destinations: data.destinations || [],
        periods: data.periods || [],
        transports: data.transports || [],
        intercity: data.intercity || [],
        meals: data.meals || [],
        agency_info: data.agency_info || [] 
      });
    } catch (e) { 
      Alert.alert("Erreur", "Impossible de charger les paramètres");
    }
    setLoading(false);
  };

  const getFilteredData = () => {
    let data = [];
    if (activeTab === 'destination') data = settings.destinations;
    else if (activeTab === 'period') data = settings.periods;
    else if (activeTab === 'transport_main') data = settings.transports;
    else if (activeTab === 'transport_intercity') data = settings.intercity;
    else if (activeTab === 'meal') data = settings.meals;
    else if (activeTab === 'agency_info') data = settings.agency_info;

    if (!searchQuery) return data;
    return data.filter(item => item.label && item.label.toLowerCase().includes(searchQuery.toLowerCase()));
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.5,
      base64: true, 
    });

    if (!result.canceled && result.assets && result.assets.length > 0) {
      const base64Img = `data:image/jpeg;base64,${result.assets[0].base64}`;
      setCurrentItem(prev => ({ ...prev, value: base64Img }));
    }
  };

  const handleSave = async () => {
    if (!currentItem.label.trim()) {
      Alert.alert('Erreur', 'Le titre est obligatoire');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        label: currentItem.label,
        price: currentItem.price || '0',
        value: currentItem.value || '' 
      };

      if (currentItem.id) {
        await api.updateSetting(currentItem.id, payload);
      } else {
        await api.addSetting(activeTab, payload.label, payload.price, payload.value);
      }
      setModalVisible(false);
      loadData();
    } catch (e) {
      Alert.alert('Erreur Sauvegarde', e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (id) => {
    Alert.alert("Supprimer ?", "Irréversible.", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: async () => { await api.deleteSetting(id); loadData(); } }
    ]);
  };

  const openEdit = (item) => {
    const isImage = item.value && item.value.startsWith('data:image');
    setInputType(isImage ? 'image' : 'text');

    setCurrentItem({ 
      id: item._id, 
      label: item.label, 
      price: String(item.price || '0'), 
      value: item.value || '', 
      category: activeTab 
    });
    setModalVisible(true);
  };

  const openNew = () => {
    setInputType('text');
    setCurrentItem({ id: null, label: '', price: '', value: '', category: activeTab });
    setModalVisible(true);
  };

  const renderItem = ({ item }) => {
    const showPrice = currentTabConfig.hasPrice && !!item.price && String(item.price) !== '0';
    const isAgency = activeTab === 'agency_info';
    const isImageValue = isAgency && item.value && item.value.startsWith('data:image');

    return (
      <View style={styles.card}>
        <View style={[styles.iconBox, {backgroundColor: COLORS.primary + '20'}]}>
           <Feather name={isImageValue ? "image" : currentTabConfig.icon} size={20} color={COLORS.primary} />
        </View>
        
        <View style={{flex: 1, marginHorizontal: 10}}>
          {/* Label affiché en gras (La Clé) */}
          <Text style={styles.itemTitle}>{item.label}</Text>
          
          {/* Valeur affichée en dessous */}
          {isImageValue ? (
             <Image 
               source={{ uri: item.value }} 
               style={{ width: 100, height: 50, marginTop: 5, borderRadius: 4, resizeMode: 'contain', alignSelf:'flex-end' }} 
             />
          ) : (
             isAgency && item.value ? <Text style={styles.itemValue} numberOfLines={2}>{item.value}</Text> : null
          )}

          {showPrice && !isAgency ? (
             <Text style={styles.itemPrice}>{parseInt(item.price || 0).toLocaleString()} DA</Text>
          ) : null}
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
  };

  const showModalPrice = activeTab !== 'agency_info' && (currentTabConfig.hasPrice || (!!currentItem.price && currentItem.price !== '0'));

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Feather name="arrow-right" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Paramètres & Options</Text>
        <TouchableOpacity onPress={openNew} style={styles.addButton}>
          <Feather name="plus" size={24} color={COLORS.bg} />
        </TouchableOpacity>
      </View>

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

      <View style={styles.searchContainer}>
        <Feather name="search" size={18} color={COLORS.textDim} style={{marginRight: 10}} />
        <TextInput 
          style={styles.searchInput} 
          placeholder={`Rechercher...`} 
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

      <FlatList
        data={getFilteredData()}
        keyExtractor={item => item._id || Math.random().toString()}
        renderItem={renderItem}
        contentContainerStyle={styles.listContent}
        refreshing={loading}
        onRefresh={loadData}
        ListEmptyComponent={!loading ? (
            <View style={styles.emptyState}>
              <Feather name="sliders" size={40} color={COLORS.border} />
              <Text style={styles.emptyText}>Aucune option configurée</Text>
              <Text style={styles.emptySub}>Appuyez sur + pour ajouter</Text>
            </View>
          ) : null
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

            {/* MESSAGE D'AIDE POUR L'AGENCE */}
            {activeTab === 'agency_info' && (
              <View style={{backgroundColor: 'rgba(243, 199, 100, 0.1)', padding: 10, borderRadius: 8, marginBottom: 15}}>
                <Text style={{color: COLORS.primary, fontSize: 12, textAlign: 'center'}}>
                  💡 Créez une entrée distincte pour chaque info. {"\n"}
                  Exemple : une entrée pour "Téléphone", une autre pour "Adresse".
                </Text>
              </View>
            )}

            <View style={styles.formGroup}>
              <Text style={styles.label}>
                 {activeTab === 'agency_info' ? "Nom de l'info (La Clé)" : "Libellé / Nom"}
              </Text>
              <TextInput 
                style={styles.input} 
                value={currentItem.label} 
                onChangeText={t => setCurrentItem({...currentItem, label: t})}
                placeholder={activeTab === 'agency_info' ? "Ex: Téléphone Officiel" : "Ex: Makkah..."} 
                placeholderTextColor={COLORS.textDim}
              />
            </View>

            {/* SÉLECTEUR TYPE D'ENTRÉE (AGENCE UNIQUEMENT) */}
            {activeTab === 'agency_info' && (
              <View style={{flexDirection:'row', marginBottom:15, gap:10}}>
                 <TouchableOpacity 
                    style={[styles.typeBtn, inputType === 'text' && styles.typeBtnActive]}
                    onPress={() => setInputType('text')}
                 >
                    <Text style={[styles.typeBtnText, inputType === 'text' && {color: COLORS.bg}]}>Texte</Text>
                 </TouchableOpacity>
                 <TouchableOpacity 
                    style={[styles.typeBtn, inputType === 'image' && styles.typeBtnActive]}
                    onPress={() => setInputType('image')}
                 >
                    <Text style={[styles.typeBtnText, inputType === 'image' && {color: COLORS.bg}]}>Image</Text>
                 </TouchableOpacity>
              </View>
            )}

            {activeTab === 'agency_info' && inputType === 'text' && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Contenu (La Valeur)</Text>
                <TextInput 
                  style={[styles.input, {height: 80, textAlignVertical: 'top'}]} 
                  value={currentItem.value} 
                  onChangeText={t => setCurrentItem({...currentItem, value: t})}
                  placeholder="Ex: 0661 12 34 56" 
                  placeholderTextColor={COLORS.textDim}
                  multiline
                />
              </View>
            )}

            {activeTab === 'agency_info' && inputType === 'image' && (
              <View style={styles.formGroup}>
                <Text style={styles.label}>Sélectionner une image</Text>
                <TouchableOpacity style={styles.uploadBtn} onPress={pickImage}>
                   <Feather name="image" size={24} color={COLORS.primary} />
                   <Text style={{color: COLORS.textDim, marginLeft: 10}}>
                      {currentItem.value && currentItem.value.startsWith('data:image') ? 'Image chargée (Changer)' : 'Choisir depuis la galerie'}
                   </Text>
                </TouchableOpacity>
                {currentItem.value && currentItem.value.startsWith('data:image') && (
                   <Image source={{ uri: currentItem.value }} style={{ width: '100%', height: 100, marginTop: 10, resizeMode: 'contain' }} />
                )}
              </View>
            )}

            {showModalPrice ? (
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
            ) : null}

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
  itemValue: { color: '#AAA', fontSize: 14, textAlign: 'right', marginTop: 4 }, 
  itemSub: { color: COLORS.textDim, fontSize: 10, textAlign: 'right', marginTop: 2, fontStyle: 'italic' },
  actions: { flexDirection: 'row', gap: 10 },
  actionBtn: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)' },
  emptyState: { alignItems: 'center', marginTop: 50 },
  emptyText: { color: COLORS.text, fontSize: 16, fontWeight: 'bold', marginTop: 10 },
  emptySub: { color: COLORS.textDim, fontSize: 14, marginTop: 5 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 25, borderWidth: 1, borderColor: COLORS.border },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { color: COLORS.text, fontSize: 20, fontWeight: 'bold' },
  formGroup: { marginBottom: 20 },
  label: { color: COLORS.textDim, marginBottom: 8, textAlign: 'right', fontSize: 14 },
  input: { backgroundColor: COLORS.card, color: COLORS.text, padding: 15, borderRadius: 12, borderWidth: 1, borderColor: COLORS.border, fontSize: 16, textAlign: 'right' },
  priceInputContainer: { flexDirection: 'row', alignItems: 'center' },
  currencySuffix: { color: COLORS.primary, marginLeft: 10, fontWeight: 'bold' },
  saveBtn: { backgroundColor: COLORS.primary, padding: 16, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  saveText: { color: COLORS.bg, fontWeight: 'bold', fontSize: 16 },
  typeBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center' },
  typeBtnActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  typeBtnText: { color: COLORS.textDim, fontWeight: 'bold', fontSize: 12 },
  uploadBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 15, borderRadius: 12, borderWidth: 1, borderColor: COLORS.primary, borderStyle: 'dashed' },
});