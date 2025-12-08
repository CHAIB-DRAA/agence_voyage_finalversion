import React, { useState, useCallback, useEffect } from 'react';
import { 
  View, Text, TouchableOpacity, FlatList, StyleSheet, 
  SafeAreaView, StatusBar, TextInput, ActivityIndicator, 
  RefreshControl, Keyboard, Alert, Linking
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../utils/api';

export default function QuotesList({ navigation, route }) {
  const [allQuotes, setAllQuotes] = useState([]);
  const [displayedQuotes, setDisplayedQuotes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('all'); // 'all', 'pending', 'confirmed', 'cancelled'
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { filterUser, userRole } = route.params || {};
  const isAdmin = userRole === 'admin';

  useFocusEffect(
    useCallback(() => {
      loadQuotes();
    }, [filterUser, userRole])
  );

  // Re-filtrer quand l'onglet ou la recherche change
  useEffect(() => {
    applyFilters();
  }, [searchQuery, activeTab, allQuotes]);

  const loadQuotes = async () => {
    setLoading(true);
    try {
      const data = await api.getQuotes();
      let safeData = Array.isArray(data) ? data : [];
      
      // Filtre de sécurité (Admin/Vendeur/Web)
      if (filterUser === 'Client (Web)') {
         safeData = safeData.filter(q => q.createdBy && q.createdBy.toLowerCase().includes('(web)') && q.status === 'pending');
      } else if (!isAdmin && filterUser) {
        safeData = safeData.filter(q => q.createdBy === filterUser || !q.createdBy);
      }
      
      // Tri par date (plus récent en haut)
      safeData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

      setAllQuotes(safeData);
      // applyFilters sera appelé par le useEffect
    } catch (error) {
      console.error("Erreur chargement:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const applyFilters = () => {
    let filtered = allQuotes;

    // 1. Filtre par Tab (Statut)
    if (activeTab !== 'all') {
      filtered = filtered.filter(item => item.status === activeTab);
    }

    // 2. Filtre par Recherche
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

  const onRefresh = () => {
    setRefreshing(true);
    loadQuotes();
  };

  const handleDelete = (id) => {
    Alert.alert("Supprimer ?", "Irréversible.", [
      { text: "Annuler", style: "cancel" },
      { text: "Supprimer", style: "destructive", onPress: async () => { try { await api.deleteQuote(id); loadQuotes(); } catch (e) {} } }
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
      case 'confirmed': return { color: '#2ECC71', label: 'مؤكد', bg: 'rgba(46, 204, 113, 0.1)', icon: 'check-circle' };
      case 'cancelled': return { color: '#E74C3C', label: 'ملغى', bg: 'rgba(231, 76, 60, 0.1)', icon: 'x-circle' };
      default: return { color: '#F39C12', label: 'في الانتظار', bg: 'rgba(243, 156, 18, 0.1)', icon: 'clock' };
    }
  };

  const renderItem = ({ item }) => {
    const status = getStatusConfig(item.status);
    const isWeb = item.createdBy && item.createdBy.toLowerCase().includes('(web)');
    const creatorDisplay = isWeb ? item.createdBy.replace(/ \(Web\)/i, '').replace(/ \(web\)/i, '') : item.createdBy;
    
    // Calcul Paiement
    const total = parseInt(item.totalAmount) || 0;
    const remaining = parseInt(item.remainingAmount) || 0;
    const isPaid = total > 0 && remaining <= 0;

    return (
      <View style={[styles.cardContainer, { borderColor: status.color }]}>
        
        <TouchableOpacity style={styles.cardMainArea} onPress={() => handleDetails(item)} activeOpacity={0.7}>
          {/* Header Carte */}
          <View style={styles.cardHeader}>
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <Feather name={status.icon} size={10} color={status.color} />
              <Text style={[styles.statusText, { color: status.color, marginLeft: 4 }]}>{status.label}</Text>
            </View>
            {/* Indicateur Paiement */}
            {total > 0 && (
                <View style={[styles.paymentBadge, { backgroundColor: isPaid ? '#2ECC71' : '#E74C3C' }]}>
                    <Text style={styles.paymentText}>{isPaid ? 'Payé' : 'Non soldé'}</Text>
                </View>
            )}
          </View>

          {/* Info Client */}
          <View style={styles.mainInfo}>
            <Text style={styles.clientName} numberOfLines={1}>{item.clientName || 'Client Inconnu'}</Text>
            <Text style={styles.destination}>{item.destination || '---'} • {new Date(item.createdAt).toLocaleDateString('fr-FR')}</Text>
          </View>

          {/* Meta & Prix */}
          <View style={styles.metaRow}>
             <View>
                {isWeb ? (
                   <View style={[styles.creatorTag, {backgroundColor: '#3498DB'}]}>
                      <Text style={[styles.creatorText, {color: '#FFF'}]}>🌐 {creatorDisplay}</Text>
                   </View>
                ) : (
                   isAdmin && item.createdBy ? <Text style={styles.creatorText}>👤 {item.createdBy}</Text> : null
                )}
             </View>
             <Text style={styles.totalPrice}>{total.toLocaleString()} DA</Text>
          </View>
        </TouchableOpacity>

        {/* Actions */}
        <View style={styles.actionBar}>
          <TouchableOpacity onPress={() => handleDelete(item.id || item._id)} style={styles.actionBtn}>
            <Feather name="trash-2" size={18} color="#E74C3C" />
          </TouchableOpacity>
          <View style={styles.divider} />
          
          <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionBtn}>
            <Feather name="edit-3" size={18} color="#F3C764" />
          </TouchableOpacity>
          <View style={styles.divider} />
          
          {/* Nouveau : Bouton WhatsApp Rapide */}
          <TouchableOpacity onPress={() => quickWhatsApp(item.clientPhone)} style={styles.actionBtn}>
            <Feather name="message-circle" size={18} color="#25D366" />
          </TouchableOpacity>
        </View>

      </View>
    );
  };

  // --- COMPOSANT ONGLETS ---
  const FilterTab = ({ label, id, color }) => (
    <TouchableOpacity 
      style={[styles.filterTab, activeTab === id && { backgroundColor: color, borderColor: color }]} 
      onPress={() => setActiveTab(id)}
    >
      <Text style={[styles.filterTabText, activeTab === id ? { color: '#050B14' } : { color: '#888' }]}>{label}</Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#050B14" />
      
      <View style={styles.headerContainer}>
        <View style={styles.topBar}>
           <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-right" size={24} color="#F3C764" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {filterUser === 'Client (Web)' ? 'Demandes Web' : (filterUser ? 'Mes Devis' : 'Tous les Dossiers')}
          </Text>
        </View>

        <View style={styles.searchBarContainer}>
          <Feather name="search" size={20} color="#8A95A5" style={{ marginLeft: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Rechercher (Nom, Tél...)"
            placeholderTextColor="#556"
            value={searchQuery}
            onChangeText={setSearchQuery}
            textAlign="right" 
          />
        </View>

        {/* NOUVEAU : BARRE D'ONGLETS */}
        <View style={styles.tabsContainer}>
            <FilterTab label="الكل (Tous)" id="all" color="#FFF" />
            <FilterTab label="في الانتظار" id="pending" color="#F39C12" />
            <FilterTab label="مؤكد" id="confirmed" color="#2ECC71" />
            <FilterTab label="ملغى" id="cancelled" color="#E74C3C" />
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
            <Feather name="inbox" size={50} color="rgba(255,255,255,0.1)" />
            <Text style={styles.emptyTitle}>Aucun dossier trouvé</Text>
          </View>
        )}
      />

      {loading && !refreshing && <View style={styles.loaderCenter}><ActivityIndicator size="large" color="#F3C764" /></View>}

      <TouchableOpacity 
        style={styles.fab} 
        onPress={() => navigation.navigate('AddEdit', { username: filterUser, userRole })}
      >
        <Feather name="plus" size={32} color="#050B14" />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050B14' },
  headerContainer: { backgroundColor: '#050B14', paddingBottom: 10, paddingTop: 10, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  topBar: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 15 },
  headerTitle: { flex: 1, color: '#F3C764', fontSize: 20, fontWeight: '800', textAlign: 'center', marginRight: -30 },
  backBtn: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)' },
  searchBarContainer: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#101A2D', borderRadius: 12, paddingHorizontal: 12, height: 46, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', marginBottom: 15 },
  searchInput: { flex: 1, color: '#FFF', fontSize: 16, marginRight: 10, height: '100%' },
  
  // Tabs
  tabsContainer: { flexDirection: 'row-reverse', gap: 8 },
  filterTab: { paddingVertical: 6, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.2)' },
  filterTabText: { fontSize: 12, fontWeight: '600' },

  listContent: { padding: 20, paddingBottom: 100 },
  
  // Card
  cardContainer: { backgroundColor: '#101A2D', borderRadius: 16, marginBottom: 16, borderWidth: 1, borderLeftWidth: 4, overflow: 'hidden', shadowColor: "#000", shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
  cardMainArea: { padding: 16, paddingBottom: 10 },
  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  
  statusBadge: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: 'bold' },
  
  paymentBadge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  paymentText: { color: '#FFF', fontSize: 10, fontWeight: 'bold' },

  mainInfo: { marginBottom: 8 },
  clientName: { color: '#FFF', fontSize: 18, fontWeight: 'bold', textAlign: 'right', marginBottom: 2 },
  destination: { color: '#8A95A5', fontSize: 13, textAlign: 'right' },

  metaRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginTop: 5 },
  creatorText: { color: '#556', fontSize: 11, fontStyle: 'italic' },
  creatorTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  
  priceRow: { marginTop: 10, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: 8, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  totalLabel: { color: '#8A95A5', fontSize: 12 },
  totalPrice: { color: '#F3C764', fontSize: 18, fontWeight: '900' },

  actionBar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(0,0,0,0.2)' },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 12 },
  divider: { width: 1, backgroundColor: 'rgba(255,255,255,0.05)' },

  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyTitle: { color: '#666', fontSize: 18, fontWeight: '700', marginTop: 10 },
  loaderCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(5,11,20,0.5)' },
  fab: { position: 'absolute', bottom: 30, left: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: '#F3C764', alignItems: 'center', justifyContent: 'center', shadowColor: '#F3C764', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
});