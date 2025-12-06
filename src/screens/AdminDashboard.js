import React, { useState, useCallback } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, ScrollView, 
  SafeAreaView, StatusBar, RefreshControl, Dimensions 
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import api from '../utils/api';

const { width } = Dimensions.get('window');

export default function AdminDashboard({ navigation, route }) {
  const [stats, setStats] = useState({
    quotesCount: 0,
    totalRevenue: 0,
    hotelsCount: 0,
    recentQuotes: [],
    webRequestsCount: 0 // <--- NOUVEAU KPI
  });
  const [refreshing, setRefreshing] = useState(false);

  // RÉCUPÉRATION DU RÔLE
  const currentUsername = route.params?.username || 'utilisateur';
  const userRole = route.params?.userRole || 'user'; 
  const isAdmin = userRole === 'admin'; 

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const loadData = async () => {
    const [allQuotes, hotels] = await Promise.all([
      api.getQuotes(),
      api.getHotels()
    ]);

    // --- FILTRAGE DE SÉCURITÉ ---
    const myQuotes = isAdmin 
      ? allQuotes 
      : allQuotes.filter(q => q.createdBy === currentUsername);

    // --- DÉTECTION DES DEMANDES WEB ---
    // On compte les devis créés par "Client (Web)" qui sont encore "pending"
    // Ce calcul se fait sur 'allQuotes' car seul l'admin doit voir ça
    const webRequests = allQuotes.filter(q => q.createdBy === 'Client (Web)' && q.status === 'pending');

    const totalRev = myQuotes.reduce((acc, q) => {
      if (q.status === 'confirmed') {
        return acc + (parseInt(q.totalAmount) || 0);
      }
      return acc;
    }, 0);
    
    setStats({
      quotesCount: myQuotes.length,
      totalRevenue: totalRev,
      hotelsCount: hotels.length,
      recentQuotes: myQuotes.slice(0, 5),
      webRequestsCount: webRequests.length // <--- Stockage
    });
    setRefreshing(false);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const StatCard = ({ title, value, icon, color, isCurrency }) => (
    <View style={[styles.statCard, { borderLeftColor: color }]}>
      <View style={[styles.iconBox, { backgroundColor: `${color}15` }]}>
        <Feather name={icon} size={24} color={color} />
      </View>
      <View>
        <Text style={styles.statLabel}>{title}</Text>
        <Text style={[styles.statValue, { color: color }]}>
          {isCurrency ? value.toLocaleString() + ' DA' : value}
        </Text>
      </View>
    </View>
  );

  const MenuButton = ({ title, subtitle, icon, target, params, color, disabled }) => (
    <TouchableOpacity 
      style={[styles.menuBtn, disabled && {opacity: 0.5}]} 
      onPress={() => !disabled && navigation.navigate(target, params)}
      activeOpacity={0.8}
      disabled={disabled}
    >
      <View style={[styles.menuIcon, { backgroundColor: disabled ? '#ccc' : color }]}>
        <Feather name={icon} size={24} color="#050B14" />
      </View>
      <View style={styles.menuTextContent}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSub}>{subtitle}</Text>
      </View>
      {!disabled && <Feather name="chevron-left" size={24} color="#556" />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#050B14" />
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>لوحة القيادة</Text>
          <Text style={styles.headerSub}>
            Bienvenue {currentUsername} 
            <Text style={{color: isAdmin ? '#E67E22' : '#3498DB'}}> ({isAdmin ? 'Admin' : 'Vendeur'})</Text>
          </Text>
        </View>
        <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.logoutBtn}>
          <Feather name="log-out" size={20} color="#E74C3C" />
        </TouchableOpacity>
      </View>

      <ScrollView 
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F3C764" />}
      >
        
        {/* --- ALERT BOX POUR LES DEMANDES WEB (ADMIN SEULEMENT) --- */}
        {stats.webRequestsCount > 0 && isAdmin && (
          <TouchableOpacity 
            style={styles.alertBox} 
            onPress={() => navigation.navigate('List', { filterUser: 'Client (Web)', userRole: 'admin' })}
          >
            <View style={styles.alertIcon}>
              <Feather name="globe" size={24} color="#FFF" />
            </View>
            <View style={{flex: 1, paddingRight: 15}}>
              <Text style={styles.alertTitle}>طلبات من الموقع (Web)</Text>
              <Text style={styles.alertDesc}>لديك {stats.webRequestsCount} طلبات جديدة من العملاء</Text>
            </View>
            <Feather name="chevron-left" size={24} color="#FFF" />
          </TouchableOpacity>
        )}

        {/* STATS */}
        <Text style={styles.sectionTitle}>
          {isAdmin ? 'نظرة عامة (Global)' : 'أدائي (Mes Stats)'}
        </Text>
        <View style={styles.statsGrid}>
          <StatCard title="إجمالي العروض" value={stats.quotesCount} icon="file-text" color="#3498DB" />
          {isAdmin && <StatCard title="الفنادق المسجلة" value={stats.hotelsCount} icon="home" color="#9B59B6" />}
          
          <View style={{width: '100%', marginTop: 10}}>
            <StatCard 
              title="المبيعات المؤكدة (CA Réel)" 
              value={stats.totalRevenue} 
              icon="pie-chart" 
              color="#2ECC71" 
              isCurrency 
            />
          </View>
        </View>

        <Text style={[styles.sectionTitle, {marginTop: 30}]}>الإدارة (Gestion)</Text>
        
        {isAdmin && (
          <MenuButton 
            title="إنشاء عرض جديد" 
            subtitle="Créer un devis pour un client" 
            icon="plus-circle" 
            target="AddEdit" 
            params={{ username: currentUsername, userRole: userRole }} 
            color="#2ECC71" 
          />
        )}

        {isAdmin && (
          <MenuButton 
            title="المستخدمين (Utilisateurs)" 
            subtitle="Créer des comptes agences & admins" 
            icon="users" 
            target="AdminUsers"
            params={{ username: currentUsername }} 
            color="#E74C3C" 
          />
        )}

        <MenuButton 
          title="قائمة الفنادق & الأسعار" 
          subtitle={isAdmin ? "Ajouter, modifier les prix" : "Consulter les tarifs uniquement"} 
          icon="home" 
          target="AdminHotels"
          params={{ userRole: userRole }} 
          color="#F3C764" 
        />

        {isAdmin && (
          <MenuButton 
            title="إعدادات عامة" 
            subtitle="Destinations, Saisons, Transports" 
            icon="settings" 
            target="AdminSettings" 
            color="#E67E22" 
          />
        )}

        <MenuButton 
          title="أرشيف العروض" 
          subtitle={isAdmin ? "Tous les devis de l'agence" : "Mes devis uniquement"} 
          icon="list" 
          target="List" 
          params={{ filterUser: isAdmin ? null : currentUsername, userRole: userRole }} 
          color="#3498DB" 
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050B14' },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingBottom: 15, borderBottomWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  headerTitle: { fontSize: 28, fontWeight: 'bold', color: '#FFF', textAlign: 'right' },
  headerSub: { fontSize: 14, color: '#8A95A5', textAlign: 'right' },
  logoutBtn: { padding: 10, backgroundColor: 'rgba(231, 76, 60, 0.1)', borderRadius: 12 },
  content: { padding: 20 },
  sectionTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold', marginBottom: 15, textAlign: 'right' },
  statsGrid: { flexDirection: 'row-reverse', flexWrap: 'wrap', justifyContent: 'space-between' },
  statCard: { backgroundColor: '#101A2D', width: (width - 50) / 2, padding: 15, borderRadius: 16, borderLeftWidth: 4, marginBottom: 10, flexDirection: 'row-reverse', alignItems: 'center', gap: 12 },
  iconBox: { padding: 10, borderRadius: 10 },
  statLabel: { color: '#8A95A5', fontSize: 12, marginBottom: 4, textAlign: 'right' },
  statValue: { fontSize: 18, fontWeight: 'bold', textAlign: 'right' },
  menuBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#101A2D', padding: 15, borderRadius: 16, marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)' },
  menuIcon: { width: 50, height: 50, borderRadius: 12, justifyContent: 'center', alignItems: 'center', marginLeft: 15 },
  menuTextContent: { flex: 1 },
  menuTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  menuSub: { color: '#8A95A5', fontSize: 12, marginTop: 2, textAlign: 'right' },
  
  // Nouveau Style Alerte Web
  alertBox: {
    backgroundColor: '#E74C3C',
    borderRadius: 16,
    padding: 15,
    marginBottom: 20,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: "#E74C3C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6
  },
  alertIcon: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    padding: 10,
    borderRadius: 10,
    marginLeft: 15
  },
  alertTitle: { color: '#FFF', fontWeight: 'bold', fontSize: 16, textAlign: 'right' },
  alertDesc: { color: 'rgba(255,255,255,0.9)', fontSize: 12, textAlign: 'right' },
});