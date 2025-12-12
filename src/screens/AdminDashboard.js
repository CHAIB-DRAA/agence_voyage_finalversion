import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, ScrollView, 
  SafeAreaView, StatusBar, RefreshControl, Dimensions, Share, Linking, Platform, AppState, Alert
} from 'react-native';
import { Feather, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch';
import * as TaskManager from 'expo-task-manager';
import * as Clipboard from 'expo-clipboard'; // Import pour le presse-papier
import api from '../utils/api';

const { width } = Dimensions.get('window');

// URL DE BASE (A changer pour la prod)
const BASE_FORM_URL = "https://agence-voyage-finalversion.onrender.com/index.html"; 
const BACKGROUND_FETCH_TASK = 'background-fetch-quotes';

Notifications.setNotificationHandler({
  handleNotification: async () => ({ shouldShowAlert: true, shouldPlaySound: true, shouldSetBadge: true }),
});

// --- TÂCHE DE FOND (APP FERMÉE) ---
// Mise à jour de la logique : On regarde 'statustraitement' au lieu de 'status'
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    const allQuotes = await api.getQuotes(); 
    if (allQuotes && Array.isArray(allQuotes)) {
      // Détection : Demandes Web NON TRAITÉES
      const webRequests = allQuotes.filter(q => 
        q.createdBy && 
        q.createdBy.toLowerCase().includes('(web)') && 
        (!q.statustraitement || q.statustraitement === 'non-traité')
      );
      
      const count = webRequests.length;
      if (count > 0) {
        await Notifications.scheduleNotificationAsync({
          content: { title: "🔔 إجراء مطلوب", body: `${count} طلب(ات) ويب بانتظار المعالجة.`, sound: 'default', badge: count },
          trigger: null,
        });
        return BackgroundFetch.BackgroundFetchResult.NewData;
      }
    }
    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) { return BackgroundFetch.BackgroundFetchResult.Failed; }
});

export default function AdminDashboard({ navigation, route }) {
  const [stats, setStats] = useState({ quotesCount: 0, totalRevenue: 0, hotelsCount: 0, recentQuotes: [], webRequestsCount: 0 });
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);
  const prevWebCountRef = useRef(0);
  const appState = useRef(AppState.currentState);

  const currentUsername = route.params?.username || 'المستخدم';
  const userRole = route.params?.userRole || 'user'; 
  const isAdmin = userRole === 'admin'; 

  // --- LIEN PERSONNALISÉ ---
  const personalizedLink = `${BASE_FORM_URL}?source=${currentUsername}`;

  useEffect(() => {
    registerForPushNotificationsAsync();
    registerBackgroundFetchAsync();
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadData(true);
      const interval = setInterval(() => { if (AppState.currentState === 'active') loadData(false); }, 30000);
      return () => clearInterval(interval);
    }, [])
  );

  async function registerBackgroundFetchAsync() {
    try { await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, { minimumInterval: 60 * 15, stopOnTerminate: false, startOnBoot: true }); } catch (err) {}
  }
  async function registerForPushNotificationsAsync() {
    if (Platform.OS === 'android') { await Notifications.setNotificationChannelAsync('default', { name: 'default', importance: Notifications.AndroidImportance.MAX, vibrationPattern: [0, 250, 250, 250], lightColor: '#FF231F7C' }); }
    const { status } = await Notifications.requestPermissionsAsync();
  }

  const loadData = async (showLoading = false) => {
    if (showLoading) setRefreshing(true);
    try {
        const [allQuotes, hotels] = await Promise.all([api.getQuotes(), api.getHotels()]);

        // Filtrage pour stats perso : Admin voit tout, Vendeur voit ses devis + ses devis web
        const myQuotes = isAdmin 
            ? allQuotes 
            : allQuotes.filter(q => q.createdBy === currentUsername || q.createdBy === `${currentUsername} (Web)`);

        // Détection Web pour l'alerte (Logique mise à jour : Traité vs Non-traité)
        let webRequests = [];
        const isUntreated = (q) => !q.statustraitement || q.statustraitement === 'non-traité';

        if (isAdmin) {
            // ADMIN : Voit TOUTES les demandes Web non traitées
            webRequests = allQuotes.filter(q => 
                q.createdBy && 
                q.createdBy.toLowerCase().includes('(web)') && 
                isUntreated(q)
            );
        } else {
            // VENDEUR : Ne voit que SES demandes Web non traitées
            webRequests = allQuotes.filter(q => 
                q.createdBy === `${currentUsername} (Web)` && 
                isUntreated(q)
            );
        }

        const currentWebCount = webRequests.length;

        // Notification locale si nouvelle demande arrive pendant que l'app est ouverte
        if (currentWebCount > prevWebCountRef.current && prevWebCountRef.current !== 0) {
            await Notifications.scheduleNotificationAsync({
              content: { title: "🔔 عميل ويب جديد!", body: `وصل طلب جديد (${currentWebCount} بانتظار المعالجة).`, sound: 'default' },
              trigger: null,
            });
        }
        prevWebCountRef.current = currentWebCount;

        const totalRev = myQuotes.reduce((acc, q) => { if (q.status === 'confirmed') return acc + (parseInt(q.totalAmount) || 0); return acc; }, 0);
        
        setStats({ quotesCount: myQuotes.length, totalRevenue: totalRev, hotelsCount: hotels.length, recentQuotes: myQuotes.slice(0, 5), webRequestsCount: currentWebCount });
        setLastUpdated(new Date());
    } catch (e) { console.error(e); }
    if (showLoading) setRefreshing(false);
  };

  const onRefresh = () => { loadData(true); };

  // --- NOUVELLE FONCTION COPIE PRESSE-PAPIER ---
  const copyToClipboard = async () => {
    try {
        await Clipboard.setStringAsync(personalizedLink);
        Alert.alert("تم النسخ", "تم نسخ رابط الحجز الخاص بك إلى الحافظة بنجاح.");
    } catch (error) {
        Alert.alert("خطأ", "حدث خطأ أثناء النسخ.");
    }
  };

  const shareLink = async (platform) => {
    const message = `السلام عليكم 👋\nيمكنكم الآن طلب عرض سعر للعمرة مباشرة عبر هذا الرابط:\n${personalizedLink}`;
    const urlEncoded = encodeURIComponent(personalizedLink);
    const textEncoded = encodeURIComponent(message);
    let link = "";
    switch (platform) {
        case 'whatsapp': link = `whatsapp://send?text=${textEncoded}`; break;
        case 'facebook': link = `https://www.facebook.com/sharer/sharer.php?u=${urlEncoded}`; break;
        case 'messenger': link = `fb-messenger://share/?link=${urlEncoded}`; break;
        case 'general': default: try { await Share.share({ message: message, url: personalizedLink, title: 'Demande de devis Omra' }); return; } catch (error) { alert(error.message); return; }
    }
    if (link) { Linking.canOpenURL(link).then(supported => { if (supported) return Linking.openURL(link); else Share.share({ message: message }); }); }
  };

  const StatCard = ({ title, value, icon, color, isCurrency, secondary }) => (
    <View style={[styles.statCard, secondary && styles.statCardSecondary]}>
      <View style={[styles.iconCircle, { backgroundColor: `${color}15` }]}>
        <Feather name={icon} size={20} color={color} />
      </View>
      <View>
        <Text style={styles.statValue}>
          {isCurrency ? value.toLocaleString() : value}
          {isCurrency && <Text style={styles.currency}> د.ج</Text>}
        </Text>
        <Text style={styles.statLabel}>{title}</Text>
      </View>
    </View>
  );

  const MenuButton = ({ title, subtitle, icon, target, params, color }) => (
    <TouchableOpacity style={styles.menuBtn} onPress={() => navigation.navigate(target, params)} activeOpacity={0.7}>
      <View style={[styles.menuIconBox, { backgroundColor: `${color}15` }]}>
        <Feather name={icon} size={22} color={color} />
      </View>
      <View style={styles.menuContent}>
        <Text style={styles.menuTitle}>{title}</Text>
        <Text style={styles.menuSub}>{subtitle}</Text>
      </View>
      <Feather name="chevron-left" size={18} color="#556" />
    </TouchableOpacity>
  );

  // Format de date en Arabe
  const currentDate = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#050B14" />
      
      {/* HEADER PRO */}
      <View style={styles.header}>
        <View style={styles.headerTop}>
          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.logoutBtn}>
            <Feather name="log-out" size={16} color="#E74C3C" />
          </TouchableOpacity>
          <View>
            <Text style={styles.dateText}>{currentDate}</Text>
            <Text style={styles.username}>مرحباً، {currentUsername}</Text>
          </View>
        </View>
        <View style={styles.roleContainer}>
             <View style={[styles.statusDot, { backgroundColor: '#2ECC71' }]} />
             <Text style={styles.roleText}>{isAdmin ? 'مسؤول (Admin)' : 'مستشار سفر'}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F3C764" />}>
        
        {/* ALERTE WEB "INBOX" */}
        {stats.webRequestsCount > 0 && (
          <TouchableOpacity style={styles.alertCard} onPress={() => navigation.navigate('List', { filterUser: 'Client (Web)', userRole: isAdmin ? 'admin' : 'user' })} activeOpacity={0.9}>
            <View style={styles.alertContent}>
               <View style={{flexDirection:'row-reverse', alignItems:'center', marginBottom:4}}>
                 <Text style={styles.alertTitle}>صندوق الوارد</Text>
                 <View style={styles.alertBadge}><Text style={styles.alertBadgeText}>جديد</Text></View>
               </View>
               <Text style={styles.alertDesc}>لديك <Text style={{fontWeight:'800', color:'#FFF'}}>{stats.webRequestsCount}</Text> طلبات ويب بانتظار المعالجة.</Text>
            </View>
            <View style={styles.alertIconPulse}>
               <Feather name="inbox" size={24} color="#FFF" />
            </View>
          </TouchableOpacity>
        )}

        <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>الأداء (Performance)</Text>
            {lastUpdated && <Text style={styles.lastUpdate}>تحديث: {lastUpdated.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</Text>}
        </View>

        {/* STATS GRID */}
        <View style={styles.statsGrid}>
           <View style={styles.statsCol}>
              <StatCard title="المبيعات المؤكدة" value={stats.totalRevenue} icon="trending-up" color="#2ECC71" isCurrency />
              <StatCard title="إجمالي الملفات" value={stats.quotesCount} icon="file-text" color="#3498DB" secondary />
           </View>
           {isAdmin && (
               <View style={styles.statsCol}>
                  <StatCard title="شركاء الفنادق" value={stats.hotelsCount} icon="map-pin" color="#9B59B6" secondary />
                  {/* Placeholder pour une future stat (ex: conversion) */}
                  <StatCard title="نسبة الاستجابة" value="100%" icon="activity" color="#F3C764" secondary />
               </View>
           )}
        </View>

        <Text style={styles.sectionTitle}>التسويق المباشر (Marketing)</Text>
        <View style={styles.shareContainer}>
            <Text style={styles.shareLabel}>رابط الحجز الخاص بك</Text>
            <View style={styles.linkPreview}>
                <Feather name="link" size={14} color="#F3C764" style={{marginRight: 10}} />
                <Text style={styles.linkText} numberOfLines={1}>{personalizedLink}</Text>
                
                {/* BOUTON COPIER MODIFIÉ */}
                <TouchableOpacity onPress={copyToClipboard} style={styles.copyBtn}>
                    <Text style={styles.copyBtnText}>نسخ</Text>
                </TouchableOpacity>
            </View>
            <View style={styles.shareButtonsRow}>
                <TouchableOpacity style={[styles.shareIcon, {backgroundColor: '#25D366'}]} onPress={() => shareLink('whatsapp')}><FontAwesome5 name="whatsapp" size={20} color="#FFF" /></TouchableOpacity>
                <TouchableOpacity style={[styles.shareIcon, {backgroundColor: '#1877F2'}]} onPress={() => shareLink('facebook')}><FontAwesome5 name="facebook-f" size={20} color="#FFF" /></TouchableOpacity>
                <TouchableOpacity style={[styles.shareIcon, {backgroundColor: '#006AFF'}]} onPress={() => shareLink('messenger')}><FontAwesome5 name="facebook-messenger" size={20} color="#FFF" /></TouchableOpacity>
            </View>
        </View>

        <Text style={styles.sectionTitle}>الإدارة (Gestion)</Text>
        <View style={styles.menuContainer}>
            {isAdmin && <MenuButton title="عرض جديد" subtitle="إنشاء يدوي" icon="plus-circle" target="AddEdit" params={{ username: currentUsername, userRole: userRole }} color="#2ECC71" />}
            <MenuButton title="الأرشيف والمتابعة" subtitle="عرض جميع الملفات" icon="list" target="List" params={{ filterUser: isAdmin ? null : currentUsername, userRole: userRole }} color="#3498DB" />
            <MenuButton title="كتالوج الفنادق" subtitle="الأسعار والتوافر" icon="server" target="AdminHotels" params={{ userRole: userRole }} color="#F3C764" />
            {isAdmin && <MenuButton title="فريق المبيعات" subtitle="إدارة حسابات الموظفين" icon="users" target="AdminUsers" params={{ username: currentUsername }} color="#E74C3C" />}
            {isAdmin && <MenuButton title="إعدادات الوكالة" subtitle="الإعدادات العامة" icon="settings" target="AdminSettings" color="#95A5A6" />}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050B14' },
  
  // HEADER
  header: { paddingHorizontal: 25, paddingTop: 15, paddingBottom: 20, backgroundColor: '#050B14', borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)' },
  headerTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  dateText: { fontSize: 11, color: '#8A95A5', textAlign: 'right', textTransform: 'uppercase', letterSpacing: 1 },
  username: { fontSize: 20, fontWeight: '700', color: '#FFF', textAlign: 'right', marginTop: 2 },
  logoutBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8 },
  roleContainer: { flexDirection: 'row-reverse', alignItems: 'center' },
  statusDot: { width: 6, height: 6, borderRadius: 3, marginLeft: 6 },
  roleText: { color: '#8A95A5', fontSize: 12, fontWeight: '500' },
  
  scrollContent: { padding: 20, paddingBottom: 50 },

  // ALERT CARD
  alertCard: { backgroundColor: '#E74C3C', borderRadius: 12, padding: 16, marginBottom: 25, flexDirection: 'row-reverse', alignItems: 'center', shadowColor: "#E74C3C", shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  alertContent: { flex: 1, paddingRight: 12 },
  alertTitle: { color: '#FFF', fontSize: 16, fontWeight: '800', textAlign: 'right' },
  alertBadge: { backgroundColor: 'rgba(0,0,0,0.2)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4, marginRight: 8 },
  alertBadgeText: { color: '#FFF', fontSize: 9, fontWeight: 'bold', textTransform: 'uppercase' },
  alertDesc: { color: 'rgba(255,255,255,0.9)', fontSize: 13, textAlign: 'right', lineHeight: 18 },
  alertIconPulse: { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },

  // SECTIONS
  sectionHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 15, marginTop: 5 },
  sectionTitle: { color: '#8A95A5', fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.2, textAlign: 'right' },
  lastUpdate: { color: '#556', fontSize: 10, fontStyle: 'italic' },

  // STATS
  statsGrid: { flexDirection: 'row-reverse', gap: 12, marginBottom: 25 },
  statsCol: { flex: 1, gap: 12 },
  statCard: { backgroundColor: '#101A2D', borderRadius: 12, padding: 16, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  statCardSecondary: { backgroundColor: 'transparent', borderColor: 'rgba(255,255,255,0.1)' },
  iconCircle: { width: 32, height: 32, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginBottom: 12, alignSelf: 'flex-end' },
  statValue: { fontSize: 22, fontWeight: '700', color: '#FFF', textAlign: 'right', letterSpacing: 0.5 },
  currency: { fontSize: 12, color: '#8A95A5', fontWeight: '500' },
  statLabel: { fontSize: 11, color: '#8A95A5', textAlign: 'right', marginTop: 2, textTransform: 'uppercase' },

  // SHARE
  shareContainer: { backgroundColor: '#101A2D', borderRadius: 12, padding: 20, marginBottom: 25, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  shareLabel: { color: '#FFF', fontSize: 14, fontWeight: '600', marginBottom: 12, textAlign: 'right' },
  linkPreview: { flexDirection: 'row-reverse', backgroundColor: '#050B14', padding: 4, paddingRight: 12, borderRadius: 8, alignItems: 'center', marginBottom: 15, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  linkText: { color: '#8A95A5', fontSize: 12, flex: 1, textAlign: 'left', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },
  copyBtn: { backgroundColor: '#F3C764', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6 },
  copyBtnText: { color: '#050B14', fontSize: 10, fontWeight: 'bold' },
  shareButtonsRow: { flexDirection: 'row-reverse', justifyContent: 'center', gap: 15 },
  shareIcon: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },

  // MENU
  menuContainer: { gap: 10 },
  menuBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#101A2D', padding: 16, borderRadius: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  menuIconBox: { width: 40, height: 40, borderRadius: 10, justifyContent: 'center', alignItems: 'center', marginLeft: 16 },
  menuContent: { flex: 1 },
  menuTitle: { color: '#FFF', fontSize: 15, fontWeight: '600', textAlign: 'right' },
  menuSub: { color: '#666', fontSize: 12, textAlign: 'right', marginTop: 2 },
});