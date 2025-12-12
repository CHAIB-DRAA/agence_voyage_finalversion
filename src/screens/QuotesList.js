import React, { useState, useCallback, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, FlatList, StyleSheet, 
  SafeAreaView, StatusBar, TextInput, ActivityIndicator, 
  RefreshControl, Keyboard, Alert, Linking, Switch,
  LayoutAnimation, Platform, UIManager
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../utils/api';

// Activation des animations de layout pour Android
if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function QuotesList({ navigation, route }) {
  const [allQuotes, setAllQuotes] = useState([]);
  const [displayedQuotes, setDisplayedQuotes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Par défaut, on ouvre sur l'onglet "Non traité" (Inbox)
  const [activeTab, setActiveTab] = useState('non-traité'); 
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);

  const { filterUser, userRole } = route.params || {};
  const isAdmin = userRole === 'admin';

  useFocusEffect(
    useCallback(() => {
      loadQuotes();
    }, [filterUser, userRole])
  );

  useEffect(() => {
    // Animation fluide lors du changement de filtre
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    applyFilters();
  }, [searchQuery, activeTab, allQuotes]);

  const loadQuotes = async () => {
    setLoading(true);
    try {
      const data = await api.getQuotes();
      let safeData = Array.isArray(data) ? data : [];
      
      if (filterUser === 'Client (Web)') {
         safeData = safeData.filter(q => q.createdBy && q.createdBy.toLowerCase().includes('(web)'));
      } else if (!isAdmin && filterUser) {
        safeData = safeData.filter(q => q.createdBy === filterUser || !q.createdBy);
      }
      
      safeData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setAllQuotes(safeData);
    } catch (error) {
      console.error("Erreur chargement:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = () => {
    let filtered = allQuotes;

    // --- LOGIQUE WORKFLOW ---
    if (activeTab === 'non-traité') {
      filtered = filtered.filter(item => !item.statustraitement || item.statustraitement === 'non-traité');
    } else if (activeTab === 'traité') {
      filtered = filtered.filter(item => item.statustraitement === 'traité');
    }

    // --- FILTRE RECHERCHE ---
    if (searchQuery.trim() !== '') {
      const lowerText = searchQuery.toLowerCase();
      filtered = filtered.filter(item => {
        const dest = item.destination ? item.destination.toLowerCase() : '';
        const client = item.clientName ? item.clientName.toLowerCase() : '';
        const phone = item.clientPhone ? item.clientPhone : '';
        return dest.includes(lowerText) || client.includes(lowerText) || phone.includes(lowerText);
      });
    }

    setDisplayedQuotes(filtered);
  };

  const toggleProcessingStatus = async (item) => {
    if (updatingId === item.id || updatingId === item._id) return; 

    const newStatus = item.statustraitement === 'traité' ? 'non-traité' : 'traité';
    setUpdatingId(item.id || item._id);

    // Mise à jour optimiste + Animation
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    
    const updatedList = allQuotes.map(q => 
      (q.id === item.id || q._id === item._id) ? { ...q, statustraitement: newStatus } : q
    );
    setAllQuotes(updatedList);

    try {
      await api.saveQuote({ ...item, statustraitement: newStatus });
    } catch (error) {
      console.error("Erreur switch:", error);
      Alert.alert("Erreur", "Impossible de mettre à jour le statut");
      loadQuotes();
    } finally {
      setUpdatingId(null);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadQuotes();
  };

  const handleDelete = (id) => {
    Alert.alert("Supprimer ?", "Cette action est irréversible.", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: async () => { 
        LayoutAnimation.configureNext(LayoutAnimation.Presets.spring); // Animation de suppression
        try { await api.deleteQuote(id); loadQuotes(); } catch (e) {} 
      }}
    ]);
  };

  const handleEdit = (item) => navigation.navigate('AddEdit', { edit: true, quote: item, username: filterUser, userRole: userRole });
  const handleDetails = (item) => navigation.navigate('Details', { quote: item, userRole: userRole, username: filterUser });

  const quickWhatsApp = (phone) => {
    if (!phone) return;
    let cleanPhone = phone.replace(/\D/g, ''); 
    if (cleanPhone.startsWith('0')) cleanPhone = '213' + cleanPhone.substring(1);
    Linking.openURL(`whatsapp://send?phone=${cleanPhone}`);
  };

  const getStatusConfig = (status) => {
    switch (status) {
      case 'confirmed': return { color: '#2ECC71', label: 'مؤكد', bg: 'rgba(46, 204, 113, 0.15)', icon: 'check' };
      case 'cancelled': return { color: '#E74C3C', label: 'ملغى', bg: 'rgba(231, 76, 60, 0.15)', icon: 'x' };
      default: return { color: '#F39C12', label: 'انتظار', bg: 'rgba(243, 156, 18, 0.15)', icon: 'clock' };
    }
  };

  const renderItem = ({ item }) => {
    const statusConfig = getStatusConfig(item.status);
    const isWeb = item.createdBy && item.createdBy.toLowerCase().includes('(web)');
    const creatorDisplay = isWeb ? item.createdBy.replace(/ \(Web\)/i, '').replace(/ \(web\)/i, '') : item.createdBy;
    
    const total = parseInt(item.totalAmount) || 0;
    const remaining = parseInt(item.remainingAmount) || 0;
    const isPaid = total > 0 && remaining <= 0;
    const isTraite = item.statustraitement === 'traité';

    return (
      <View style={styles.cardContainer}>
        {/* Barre de statut latérale fine */}
        <View style={[styles.statusStrip, { backgroundColor: statusConfig.color }]} />

        <View style={{flex: 1}}>
          <TouchableOpacity style={styles.cardMainArea} onPress={() => handleDetails(item)} activeOpacity={0.7}>
            
            {/* Header: Date + Switch Traitement */}
            <View style={styles.cardHeader}>
              <Text style={styles.dateText}>{new Date(item.createdAt).toLocaleDateString('fr-FR')}</Text>
              
              <View style={[styles.switchWrapper, isTraite && styles.switchWrapperActive]}>
                <Text style={[styles.switchLabel, isTraite && {color: '#2ECC71'}]}>
                  {isTraite ? 'Traité' : 'À faire'}
                </Text>
                <Switch
                    trackColor={{ false: "#3e3e3e", true: "rgba(46, 204, 113, 0.3)" }}
                    thumbColor={isTraite ? "#2ECC71" : "#B0B0B0"}
                    ios_backgroundColor="#3e3e3e"
                    onValueChange={() => toggleProcessingStatus(item)}
                    value={isTraite}
                    style={{ transform: [{ scaleX: 0.7 }, { scaleY: 0.7 }] }} 
                />
              </View>
            </View>

            {/* Info Principale */}
            <View style={styles.mainInfo}>
              <View style={{flex: 1}}>
                <Text style={styles.clientName} numberOfLines={1}>{item.clientName || 'Sans Nom'}</Text>
                <View style={styles.destRow}>
                  <Feather name="map-pin" size={12} color="#8A95A5" />
                  <Text style={styles.destination}>{item.destination || 'Non spécifiée'}</Text>
                </View>
              </View>
              
              {/* Badge Statut Commercial */}
              <View style={[styles.statusBadge, { backgroundColor: statusConfig.bg }]}>
                <Feather name={statusConfig.icon} size={12} color={statusConfig.color} />
                <Text style={[styles.statusText, { color: statusConfig.color }]}>{statusConfig.label}</Text>
              </View>
            </View>

            {/* Footer: Prix & Créateur */}
            <View style={styles.footerRow}>
               <Text style={styles.totalPrice}>{total > 0 ? `${total.toLocaleString()} DA` : 'Devis en cours'}</Text>
               
               <View style={{flexDirection:'row', gap: 6}}>
                 {isWeb && (
                    <View style={styles.tagWeb}>
                       <Text style={styles.tagWebText}>WEB</Text>
                    </View>
                 )}
                 {total > 0 && (
                    <View style={[styles.paymentDot, { backgroundColor: isPaid ? '#2ECC71' : '#E74C3C' }]} />
                 )}
               </View>
            </View>
          </TouchableOpacity>

          {/* Actions Flottantes (Boutons Circulaires) */}
          <View style={styles.floatingActions}>
            <TouchableOpacity onPress={() => quickWhatsApp(item.clientPhone)} style={[styles.circleBtn, {backgroundColor: 'rgba(37, 211, 102, 0.15)'}]}>
              <Feather name="message-circle" size={18} color="#25D366" />
            </TouchableOpacity>
            
            <TouchableOpacity onPress={() => handleEdit(item)} style={[styles.circleBtn, {backgroundColor: 'rgba(243, 199, 100, 0.15)'}]}>
              <Feather name="edit-2" size={18} color="#F3C764" />
            </TouchableOpacity>

            <TouchableOpacity onPress={() => handleDelete(item.id || item._id)} style={[styles.circleBtn, {backgroundColor: 'rgba(231, 76, 60, 0.15)'}]}>
              <Feather name="trash-2" size={18} color="#E74C3C" />
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  };

  const FilterTab = ({ label, id, color, icon }) => (
    <TouchableOpacity 
      style={[
        styles.filterTab, 
        activeTab === id && { backgroundColor: color, borderColor: color }
      ]} 
      onPress={() => {
        setActiveTab(id);
      }}
    >
      {icon && <Feather name={icon} size={14} color={activeTab === id ? '#050B14' : '#888'} style={{marginRight: 6}} />}
      <Text style={[styles.filterTabText, activeTab === id ? { color: '#050B14' } : { color: '#888' }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#050B14" />
      
      <View style={styles.headerContainer}>
        {/* Titre & Retour */}
        <View style={styles.topBar}>
           <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-right" size={24} color="#F3C764" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {filterUser === 'Client (Web)' ? 'Demandes Web' : (filterUser ? 'Mes Devis' : 'Suivi des Devis')}
          </Text>
        </View>

        {/* Barre de Recherche Améliorée */}
        <View style={styles.searchBarContainer}>
          <Feather name="search" size={20} color="#8A95A5" />
          <TextInput
            style={styles.searchInput}
            placeholder="Nom client, téléphone, destination..."
            placeholderTextColor="#556"
            value={searchQuery}
            onChangeText={setSearchQuery}
            textAlign="right" 
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Feather name="x-circle" size={18} color="#8A95A5" />
            </TouchableOpacity>
          )}
        </View>

        {/* Onglets */}
        <View style={styles.tabsContainer}>
            <FilterTab label="À traiter" id="non-traité" color="#E74C3C" icon="inbox" />
            <FilterTab label="Historique" id="traité" color="#2ECC71" icon="archive" />
            <FilterTab label="Tout" id="all" color="#FFF" />
        </View>
      </View>

      <FlatList 
        data={displayedQuotes} 
        keyExtractor={item => item.id || item._id || Math.random().toString()} 
        renderItem={renderItem} 
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F3C764" />}
        ListEmptyComponent={!loading && (
          <View style={styles.emptyContainer}>
            <View style={[styles.emptyIconBg, {backgroundColor: activeTab === 'traité' ? 'rgba(46, 204, 113, 0.1)' : 'rgba(231, 76, 60, 0.1)'}]}>
              <Feather name={activeTab === 'traité' ? "check-circle" : "inbox"} size={40} color={activeTab === 'traité' ? "#2ECC71" : "#E74C3C"} />
            </View>
            <Text style={styles.emptyTitle}>
                {activeTab === 'non-traité' ? 'Tout est à jour !' : 'Aucun dossier ici'}
            </Text>
            <Text style={styles.emptySubtitle}>
               {activeTab === 'non-traité' ? "Vous avez traité toutes les demandes en attente." : "L'historique est vide pour le moment."}
            </Text>
          </View>
        )}
      />

      {loading && !refreshing && <View style={styles.loaderCenter}><ActivityIndicator size="large" color="#F3C764" /></View>}
      
      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => navigation.navigate('AddEdit', { username: filterUser, userRole })}
        activeOpacity={0.8}
      >
        <Feather name="plus" size={32} color="#050B14" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050B14' },
  headerContainer: { backgroundColor: '#050B14', paddingBottom: 15, paddingTop: 10, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: '#1F2937' },
  
  topBar: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 15 },
  headerTitle: { flex: 1, color: '#F3C764', fontSize: 20, fontWeight: '800', textAlign: 'center', marginRight: -30 },
  backBtn: { padding: 8, borderRadius: 12, backgroundColor: '#101A2D' },
  
  searchBarContainer: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#101A2D', borderRadius: 12, paddingHorizontal: 12, height: 48, marginBottom: 15, borderWidth: 1, borderColor: '#1F2937' },
  searchInput: { flex: 1, color: '#FFF', fontSize: 15, marginHorizontal: 10, height: '100%' },
  
  tabsContainer: { flexDirection: 'row-reverse', gap: 10, justifyContent: 'center' },
  filterTab: { flexDirection: 'row-reverse', alignItems: 'center', paddingVertical: 8, paddingHorizontal: 16, borderRadius: 25, borderWidth: 1, borderColor: '#333' },
  filterTabText: { fontSize: 13, fontWeight: '600' },

  listContent: { padding: 15, paddingBottom: 100 },
  
  // NOUVEAU STYLE CARTE
  cardContainer: { backgroundColor: '#101A2D', borderRadius: 16, marginBottom: 12, flexDirection: 'row-reverse', overflow: 'hidden', elevation: 3, shadowColor: '#000', shadowOffset: {width:0, height:2}, shadowOpacity: 0.3, shadowRadius: 4 },
  statusStrip: { width: 4, height: '100%' },
  cardMainArea: { padding: 16, paddingBottom: 12 },
  
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  dateText: { color: '#6B7280', fontSize: 11, fontWeight: '600' },
  
  switchWrapper: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, paddingHorizontal: 6, paddingVertical: 2, gap: 6 },
  switchWrapperActive: { backgroundColor: 'rgba(46, 204, 113, 0.1)' },
  switchLabel: { fontSize: 11, fontWeight: '600', color: '#888' },

  mainInfo: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  clientName: { color: '#FFF', fontSize: 17, fontWeight: 'bold', textAlign: 'right', marginBottom: 4 },
  destRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 4 },
  destination: { color: '#9CA3AF', fontSize: 13 },
  
  statusBadge: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, gap: 4, alignSelf: 'flex-start' },
  statusText: { fontSize: 11, fontWeight: 'bold' },

  footerRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  totalPrice: { color: '#F3C764', fontSize: 16, fontWeight: '800' },
  
  tagWeb: { backgroundColor: '#3498DB', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  tagWebText: { color: '#FFF', fontSize: 9, fontWeight: 'bold' },
  paymentDot: { width: 8, height: 8, borderRadius: 4 },

  // Boutons d'action flottants (intégrés visuellement en bas à gauche de la carte LTR ou droite RTL)
  floatingActions: { flexDirection: 'column', position: 'absolute', left: 10, top: 12, gap: 8 },
  circleBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },

  // Empty State
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 60, padding: 20 },
  emptyIconBg: { width: 80, height: 80, borderRadius: 40, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 8 },
  emptySubtitle: { color: '#888', fontSize: 14, textAlign: 'center' },
  
  loaderCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(5,11,20,0.5)' },
  fab: { position: 'absolute', bottom: 30, left: 30, width: 56, height: 56, borderRadius: 28, backgroundColor: '#F3C764', alignItems: 'center', justifyContent: 'center', shadowColor: '#F3C764', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
});