import React, { useState, useCallback } from 'react';
import { 
  View, Text, TouchableOpacity, FlatList, StyleSheet, 
  SafeAreaView, StatusBar, TextInput, ActivityIndicator, 
  RefreshControl, Keyboard, Alert
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../utils/api';

export default function QuotesList({ navigation, route }) {
  const [allQuotes, setAllQuotes] = useState([]);
  const [displayedQuotes, setDisplayedQuotes] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const { filterUser, userRole } = route.params || {};
  const isAdmin = userRole === 'admin';

  useFocusEffect(
    useCallback(() => {
      loadQuotes();
    }, [filterUser, userRole])
  );

  const loadQuotes = async () => {
    setLoading(true);
    try {
      const data = await api.getQuotes();
      let safeData = Array.isArray(data) ? data : [];
      
      // Filtrage intelligent : 
      // Si filterUser est 'Client (Web)', on montre tout ce qui vient du web (clic depuis dashboard)
      // Sinon, logique standard (Admin voit tout, Vendeur voit ses devis)
      if (filterUser === 'Client (Web)') {
         safeData = safeData.filter(q => q.createdBy === 'Client (Web)');
      } else if (!isAdmin && filterUser) {
        safeData = safeData.filter(q => q.createdBy === filterUser || !q.createdBy);
      }
      
      setAllQuotes(safeData);
      
      if (searchQuery) {
        filterData(searchQuery, safeData);
      } else {
        setDisplayedQuotes(safeData);
      }
    } catch (error) {
      console.error("Erreur chargement:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadQuotes();
  };

  const handleDelete = (id) => {
    Alert.alert(
      "Supprimer le devis ?",
      "Cette action est définitive.",
      [
        { text: "Annuler", style: "cancel" },
        { text: "Supprimer", style: "destructive", onPress: async () => {
            try { await api.deleteQuote(id); loadQuotes(); } 
            catch (e) { Alert.alert("Erreur", "Impossible de supprimer."); }
          } 
        }
      ]
    );
  };

  const handleEdit = (item) => {
    navigation.navigate('AddEdit', { edit: true, quote: item, username: filterUser, userRole: userRole });
  };

  const handleDetails = (item) => {
    navigation.navigate('Details', { quote: item, userRole: userRole, username: filterUser });
  };

  const filterData = (text, sourceData = allQuotes) => {
    setSearchQuery(text);
    if (text.trim() === '') {
      setDisplayedQuotes(sourceData);
    } else {
      const lowerText = text.toLowerCase();
      const filtered = sourceData.filter(item => {
        const dest = item.destination ? item.destination.toLowerCase() : '';
        const client = item.clientName ? item.clientName.toLowerCase() : '';
        const creator = item.createdBy ? item.createdBy.toLowerCase() : '';
        return dest.includes(lowerText) || client.includes(lowerText) || creator.includes(lowerText);
      });
      setDisplayedQuotes(filtered);
    }
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
    const isWeb = item.createdBy === 'Client (Web)';
    
    return (
      <View style={[styles.cardContainer, { borderColor: status.color }]}>
        
        <TouchableOpacity 
          style={styles.cardMainArea} 
          onPress={() => handleDetails(item)}
          activeOpacity={0.7}
        >
          <View style={styles.cardHeader}>
            <View style={[styles.statusBadge, { backgroundColor: status.bg }]}>
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
              <Feather name={status.icon} size={12} color={status.color} style={{ marginLeft: 5 }} />
            </View>
            <Text style={styles.date}>{new Date(item.createdAt).toLocaleDateString('fr-FR')}</Text>
          </View>

          <View style={styles.mainInfo}>
            <Text style={styles.clientName} numberOfLines={1}>
              {item.clientName || 'Client Inconnu'}
            </Text>
            <Text style={styles.destination}>{item.destination || '---'}</Text>
          </View>

          <View style={styles.metaRow}>
            
            {/* --- BADGE CRÉATEUR SPÉCIAL --- */}
            {isWeb ? (
               <View style={[styles.creatorTag, {backgroundColor: '#3498DB'}]}>
                  <Text style={[styles.creatorText, {color: '#FFF'}]}>🌐 طلب أونلاين</Text>
               </View>
            ) : (
               isAdmin && item.createdBy ? <Text style={styles.creatorText}>Par: {item.createdBy}</Text> : <View />
            )}

            <Text style={styles.nightsText}>
              {item.nightsMakkah || 0} ليالي مكة • {item.nightsMedina || 0} ليالي المدينة
            </Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.totalLabel}>الإجمالي</Text>
            <Text style={styles.totalPrice}>{item.totalAmount ? parseInt(item.totalAmount).toLocaleString() : '0'} DA</Text>
          </View>

        </TouchableOpacity>

        <View style={styles.actionBar}>
          <TouchableOpacity onPress={() => handleDelete(item.id || item._id)} style={styles.actionBtn}>
            <Feather name="trash-2" size={18} color="#E74C3C" />
            <Text style={[styles.actionText, {color: '#E74C3C'}]}>حذف</Text>
          </TouchableOpacity>
          
          <View style={styles.divider} />
          
          <TouchableOpacity onPress={() => handleEdit(item)} style={styles.actionBtn}>
            <Feather name="edit-3" size={18} color="#F3C764" />
            <Text style={[styles.actionText, {color: '#F3C764'}]}>تعديل</Text>
          </TouchableOpacity>
        </View>

      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#050B14" />
      
      <View style={styles.headerContainer}>
        <View style={styles.topBar}>
           <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Feather name="arrow-right" size={24} color="#F3C764" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {filterUser === 'Client (Web)' ? 'طلبات الموقع' : (filterUser ? 'عروضي' : 'أرشيف العروض')}
          </Text>
        </View>

        <View style={styles.searchBarContainer}>
          <Feather name="search" size={20} color="#8A95A5" style={{ marginLeft: 10 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="بحث..."
            placeholderTextColor="#556"
            value={searchQuery}
            onChangeText={(text) => filterData(text)}
            textAlign="right" 
          />
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
            <Text style={styles.emptyTitle}>القائمة فارغة</Text>
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
  
  headerContainer: { backgroundColor: '#050B14', paddingBottom: 15, paddingTop: 10, paddingHorizontal: 20, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  topBar: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 15 },
  headerTitle: { flex: 1, color: '#F3C764', fontSize: 22, fontWeight: '800', textAlign: 'center', marginRight: -30 },
  backBtn: { padding: 8, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.05)' },
  
  searchBarContainer: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#101A2D', borderRadius: 12, paddingHorizontal: 12, height: 46, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  searchInput: { flex: 1, color: '#FFF', fontSize: 16, marginRight: 10, height: '100%' },
  
  listContent: { padding: 20, paddingBottom: 100 },
  
  // --- CARD DESIGN ---
  cardContainer: { backgroundColor: '#101A2D', borderRadius: 16, marginBottom: 16, borderWidth: 1, borderLeftWidth: 4, overflow: 'hidden', shadowColor: "#000", shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
  cardMainArea: { padding: 16 },

  cardHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  date: { color: '#556', fontSize: 12, fontWeight: '500' },
  statusBadge: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: 'bold' },

  mainInfo: { marginBottom: 10 },
  clientName: { color: '#FFF', fontSize: 20, fontWeight: 'bold', textAlign: 'right', marginBottom: 4 },
  destination: { color: '#8A95A5', fontSize: 14, textAlign: 'right' },

  metaRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  creatorText: { color: '#556', fontSize: 11, fontStyle: 'italic' },
  
  // Styles badge spécifique pour web
  creatorTag: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  
  nightsText: { color: '#8A95A5', fontSize: 12 },

  priceRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'flex-start', marginTop: 5 },
  totalLabel: { color: '#8A95A5', fontSize: 12, marginLeft: 8 },
  totalPrice: { color: '#F3C764', fontSize: 22, fontWeight: 'bold' },

  // --- ACTIONS ---
  actionBar: { flexDirection: 'row', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', backgroundColor: 'rgba(0,0,0,0.2)' },
  actionBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 14 },
  actionText: { marginLeft: 8, fontWeight: '600', fontSize: 14 },
  divider: { width: 1, backgroundColor: 'rgba(255,255,255,0.05)' },

  // --- EMPTY & LOADING ---
  emptyContainer: { alignItems: 'center', justifyContent: 'center', marginTop: 80 },
  emptyTitle: { color: '#666', fontSize: 18, fontWeight: '700', marginTop: 10 },
  loaderCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(5,11,20,0.5)' },
  
  fab: { position: 'absolute', bottom: 30, left: 30, width: 60, height: 60, borderRadius: 30, backgroundColor: '#F3C764', alignItems: 'center', justifyContent: 'center', shadowColor: '#F3C764', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 8 },
});