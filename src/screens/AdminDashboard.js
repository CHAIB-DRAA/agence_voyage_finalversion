import React, { useState, useCallback, useEffect, useRef } from 'react';
import { 
  View, Text, TouchableOpacity, StyleSheet, ScrollView, 
  SafeAreaView, StatusBar, RefreshControl, Dimensions, Share, Linking, Platform, AppState
} from 'react-native';
import { Feather, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import * as Notifications from 'expo-notifications';
import * as BackgroundFetch from 'expo-background-fetch'; // <--- NOUVEAU
import * as TaskManager from 'expo-task-manager';       // <--- NOUVEAU
import api from '../utils/api';

const { width } = Dimensions.get('window');
const FORM_URL = "http://10.211.205.58:3000/index.html"; 
const BACKGROUND_FETCH_TASK = 'background-fetch-quotes';

// --- CONFIGURATION DES NOTIFICATIONS ---
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// --- 1. DÉFINITION DE LA TÂCHE DE FOND (HORS COMPOSANT) ---
// Cette fonction peut s'exécuter même si l'app est en arrière-plan (toutes les ~15 min)
TaskManager.defineTask(BACKGROUND_FETCH_TASK, async () => {
  try {
    console.log('🔄 [BACKGROUND] Vérification des nouveaux devis...');
    
    // On récupère les devis (Note: api.js doit avoir le token en mémoire ou AsyncStorage pour que ça marche parfaitement)
    // Dans une architecture idéale, on stockerait le token dans SecureStore pour le relire ici.
    const allQuotes = await api.getQuotes(); 
    
    if (allQuotes && Array.isArray(allQuotes)) {
      const webRequests = allQuotes.filter(q => q.createdBy === 'Client (Web)' && q.status === 'pending');
      const count = webRequests.length;
      
      // Ici, on pourrait comparer avec une valeur stockée dans AsyncStorage pour savoir si c'est "nouveau"
      // Pour l'exemple, on notifie s'il y a des demandes en attente
      if (count > 0) {
        await Notifications.scheduleNotificationAsync({
          content: {
            title: "🔔 Mise à jour Agence",
            body: `Il y a ${count} demande(s) Web en attente de traitement.`,
            sound: 'default',
            badge: count,
          },
          trigger: null,
        });
        return BackgroundFetch.BackgroundFetchResult.NewData;
      }
    }
    return BackgroundFetch.BackgroundFetchResult.NoData;
  } catch (error) {
    console.error('❌ [BACKGROUND] Erreur:', error);
    return BackgroundFetch.BackgroundFetchResult.Failed;
  }
});

export default function AdminDashboard({ navigation, route }) {
  const [stats, setStats] = useState({
    quotesCount: 0,
    totalRevenue: 0,
    hotelsCount: 0,
    recentQuotes: [],
    webRequestsCount: 0
  });
  const [refreshing, setRefreshing] = useState(false);
  const prevWebCountRef = useRef(0);
  const appState = useRef(AppState.currentState);

  const currentUsername = route.params?.username || 'utilisateur';
  const userRole = route.params?.userRole || 'user'; 
  const isAdmin = userRole === 'admin'; 

  // --- 2. ENREGISTREMENT DE LA TÂCHE DE FOND ---
  useEffect(() => {
    registerForPushNotificationsAsync();
    registerBackgroundFetchAsync();
  }, []);

  // --- 3. BOUCLE DE VÉRIFICATION ACTIVE (FOREGROUND) ---
  // Celle-ci est rapide (30s) tant que l'app est ouverte
  useFocusEffect(
    useCallback(() => {
      loadData(true);
      const interval = setInterval(() => {
        if (AppState.currentState === 'active') {
           loadData(false);
        }
      }, 30000);
      return () => clearInterval(interval);
    }, [])
  );

  async function registerBackgroundFetchAsync() {
    try {
        // Enregistre la tâche pour tourner périodiquement (minimum 15min imposé par OS)
        await BackgroundFetch.registerTaskAsync(BACKGROUND_FETCH_TASK, {
            minimumInterval: 60 * 15, // 15 minutes
            stopOnTerminate: false,   // Continue même si l'utilisateur ferme l'app (sur Android)
            startOnBoot: true,        // Redémarre avec le téléphone (Android)
        });
        console.log('✅ [SYSTEM] Tâche de fond enregistrée');
    } catch (err) {
        console.log("⚠️ [SYSTEM] Background fetch non supporté ou échoué:", err);
    }
  }

  async function registerForPushNotificationsAsync() {
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#FF231F7C',
      });
    }
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') {
      // Alert.alert('Attention', 'Sans permission, vous ne recevrez pas les alertes devis !');
    }
  }

  const loadData = async (showLoading = false) => {
    if (showLoading) setRefreshing(true);
    try {
        const [allQuotes, hotels] = await Promise.all([
           api.getQuotes(),
           api.getHotels()
        ]);

        const myQuotes = isAdmin 
        ? allQuotes 
        : allQuotes.filter(q => q.createdBy === currentUsername);

        const webRequests = allQuotes.filter(q => q.createdBy === 'Client (Web)' && q.status === 'pending');
        const currentWebCount = webRequests.length;

        // Détection Live (App ouverte)
        if (currentWebCount > prevWebCountRef.current && prevWebCountRef.current !== 0) {
            await Notifications.scheduleNotificationAsync({
              content: {
                title: "🔔 Nouveau Client Web !",
                body: `Une nouvelle demande vient d'arriver. Total en attente : ${currentWebCount}`,
                sound: 'default',
              },
              trigger: null,
            });
        }
        
        prevWebCountRef.current = currentWebCount;

        const totalRev = myQuotes.reduce((acc, q) => {
           if (q.status === 'confirmed') return acc + (parseInt(q.totalAmount) || 0);
           return acc;
        }, 0);
        
        setStats({
           quotesCount: myQuotes.length,
           totalRevenue: totalRev,
           hotelsCount: hotels.length,
           recentQuotes: myQuotes.slice(0, 5),
           webRequestsCount: currentWebCount
        });
    } catch (e) { console.error(e); }
    if (showLoading) setRefreshing(false);
  };

  const onRefresh = () => {
    loadData(true);
  };

  // ... (Reste des fonctions shareLink, StatCard, MenuButton inchangées) ...
  const shareLink = async (platform) => {
    const message = `السلام عليكم 👋\nيمكنكم الآن طلب عرض سعر للعمرة مباشرة عبر هذا الرابط:\n${FORM_URL}`;
    const urlEncoded = encodeURIComponent(FORM_URL);
    const textEncoded = encodeURIComponent(message);
    let link = "";
    switch (platform) {
        case 'whatsapp': link = `whatsapp://send?text=${textEncoded}`; break;
        case 'facebook': link = `https://www.facebook.com/sharer/sharer.php?u=${urlEncoded}`; break;
        case 'messenger': link = `fb-messenger://share/?link=${urlEncoded}`; break;
        case 'general': default:
            try { await Share.share({ message: message, url: FORM_URL, title: 'Demande de devis Omra' }); return; } catch (error) { alert(error.message); return; }
    }
    if (link) { Linking.canOpenURL(link).then(supported => { if (supported) return Linking.openURL(link); else Share.share({ message: message }); }); }
  };

  const StatCard = ({ title, value, icon, color, isCurrency }) => (
    <View style={[styles.statCard, { shadowColor: color }]}>
      <View style={[styles.iconCircle, { backgroundColor: `${color}20` }]}>
        <Feather name={icon} size={22} color={color} />
      </View>
      <View>
        <Text style={styles.statValue}>{isCurrency ? value.toLocaleString() : value}{isCurrency && <Text style={styles.currency}> DA</Text>}</Text>
        <Text style={styles.statLabel}>{title}</Text>
      </View>
    </View>
  );

  const MenuButton = ({ title, subtitle, icon, target, params, color }) => (
    <TouchableOpacity style={[styles.menuBtn, { shadowColor: color }]} onPress={() => navigation.navigate(target, params)} activeOpacity={0.9}>
      <View style={[styles.menuIconBox, { backgroundColor: color }]}><Feather name={icon} size={24} color="#FFF" /></View>
      <View style={styles.menuContent}><Text style={styles.menuTitle}>{title}</Text><Text style={styles.menuSub}>{subtitle}</Text></View>
      <Feather name="chevron-left" size={20} color="#556" />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#050B14" />
      <View style={styles.header}>
        <View style={styles.headerTop}>
            <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.logoutBtn}>
                <Feather name="log-out" size={18} color="#E74C3C" />
            </TouchableOpacity>
            <View>
                <Text style={styles.greeting}>مرحباً بك 👋</Text>
                <Text style={styles.username}>{currentUsername}</Text>
            </View>
        </View>
        <View style={styles.roleBadge}><Text style={styles.roleText}>{isAdmin ? 'Administrateur' : 'Vendeur'}</Text></View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F3C764" />}>
        
        {stats.webRequestsCount > 0 && isAdmin && (
          <TouchableOpacity style={styles.alertCard} onPress={() => navigation.navigate('List', { filterUser: 'Client (Web)', userRole: 'admin' })}>
            <View style={styles.alertContent}>
                <Text style={styles.alertTitle}>طلبات الويب الجديدة</Text>
                <Text style={styles.alertDesc}>لديك <Text style={{fontWeight:'bold', color:'#FFF'}}>{stats.webRequestsCount}</Text> طلبات تنتظر المعالجة</Text>
            </View>
            <View style={styles.alertIconPulse}><Feather name="globe" size={24} color="#FFF" /></View>
          </TouchableOpacity>
        )}

        <Text style={styles.sectionTitle}>نظرة عامة</Text>
        <View style={styles.statsRow}>
          <StatCard title="إجمالي العروض" value={stats.quotesCount} icon="file-text" color="#3498DB" />
          {isAdmin && <StatCard title="الفنادق" value={stats.hotelsCount} icon="home" color="#9B59B6" />}
        </View>
        <View style={{marginTop: 10}}>
             <StatCard title="المبيعات المؤكدة (CA Réel)" value={stats.totalRevenue} icon="pie-chart" color="#2ECC71" isCurrency />
        </View>

        <Text style={styles.sectionTitle}>مشاركة رابط الحجز (Marketing)</Text>
        <View style={styles.shareContainer}>
            <Text style={styles.shareLabel}>أرسل الرابط للعملاء ليقوموا بالحجز بأنفسهم:</Text>
            <View style={styles.shareButtonsRow}>
                <TouchableOpacity style={[styles.shareBtn, {backgroundColor: '#25D366'}]} onPress={() => shareLink('whatsapp')}><FontAwesome5 name="whatsapp" size={24} color="#FFF" /></TouchableOpacity>
                <TouchableOpacity style={[styles.shareBtn, {backgroundColor: '#1877F2'}]} onPress={() => shareLink('facebook')}><FontAwesome5 name="facebook-f" size={24} color="#FFF" /></TouchableOpacity>
                <TouchableOpacity style={[styles.shareBtn, {backgroundColor: '#006AFF'}]} onPress={() => shareLink('messenger')}><FontAwesome5 name="facebook-messenger" size={24} color="#FFF" /></TouchableOpacity>
                <TouchableOpacity style={[styles.shareBtn, {backgroundColor: '#8E44AD'}]} onPress={() => shareLink('general')}><Feather name="share-2" size={24} color="#FFF" /></TouchableOpacity>
            </View>
            <View style={styles.linkPreview}>
                <Text style={styles.linkText} numberOfLines={1}>{FORM_URL}</Text>
                <TouchableOpacity onPress={() => shareLink('general')}><Feather name="copy" size={16} color="#F3C764" /></TouchableOpacity>
            </View>
        </View>

        <Text style={styles.sectionTitle}>لوحة التحكم</Text>
        
        {isAdmin && <MenuButton title="إنشاء عرض جديد" subtitle="Créer un devis manuellement" icon="plus" target="AddEdit" params={{ username: currentUsername, userRole: userRole }} color="#2ECC71" />}
        {isAdmin && <MenuButton title="المستخدمين (Staff)" subtitle="Gérer les comptes vendeurs" icon="users" target="AdminUsers" params={{ username: currentUsername }} color="#E74C3C" />}
        <MenuButton title="الفنادق والأسعار" subtitle="Gestion des hôtels et saisons" icon="server" target="AdminHotels" params={{ userRole: userRole }} color="#F3C764" />
        {isAdmin && <MenuButton title="الإعدادات" subtitle="Destinations & Options" icon="sliders" target="AdminSettings" color="#95A5A6" />}
        <MenuButton title="الأرشيف" subtitle="Consulter l'historique" icon="archive" target="List" params={{ filterUser: isAdmin ? null : currentUsername, userRole: userRole }} color="#3498DB" />

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050B14' },
  header: { padding: 25, paddingTop: 10, paddingBottom: 20, borderBottomLeftRadius: 30, borderBottomRightRadius: 30, backgroundColor: '#101A2D', shadowColor: "#000", shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 10, zIndex: 100 },
  headerTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  greeting: { fontSize: 14, color: '#8A95A5', textAlign: 'right' },
  username: { fontSize: 24, fontWeight: 'bold', color: '#FFF', textAlign: 'right' },
  logoutBtn: { padding: 10, backgroundColor: 'rgba(231, 76, 60, 0.1)', borderRadius: 12 },
  roleBadge: { alignSelf: 'flex-end', backgroundColor: 'rgba(243, 199, 100, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, marginTop: 5, borderWidth: 1, borderColor: 'rgba(243, 199, 100, 0.3)' },
  roleText: { color: '#F3C764', fontSize: 12, fontWeight: '600' },
  scrollContent: { padding: 20, paddingBottom: 50 },
  alertCard: { backgroundColor: '#E74C3C', borderRadius: 16, padding: 15, marginBottom: 25, flexDirection: 'row-reverse', alignItems: 'center', shadowColor: "#E74C3C", shadowOffset: {width: 0, height: 4}, shadowOpacity: 0.4, shadowRadius: 8, elevation: 5 },
  alertContent: { flex: 1, paddingRight: 10 },
  alertTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  alertDesc: { color: 'rgba(255,255,255,0.9)', fontSize: 12, textAlign: 'right' },
  alertIconPulse: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', justifyContent: 'center', alignItems: 'center' },
  sectionTitle: { color: '#8A95A5', fontSize: 14, fontWeight: '700', marginBottom: 15, textTransform: 'uppercase', letterSpacing: 1, textAlign: 'right', marginTop: 10 },
  statsRow: { flexDirection: 'row-reverse', justifyContent: 'space-between' },
  statCard: { backgroundColor: '#101A2D', borderRadius: 16, padding: 15, width: (width - 50) / 2, elevation: 2 },
  iconCircle: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center', marginBottom: 10, alignSelf: 'flex-end' },
  statValue: { fontSize: 20, fontWeight: 'bold', color: '#FFF', textAlign: 'right' },
  currency: { fontSize: 12, color: '#8A95A5', fontWeight: 'normal' },
  statLabel: { fontSize: 12, color: '#8A95A5', textAlign: 'right' },
  shareContainer: { backgroundColor: '#101A2D', borderRadius: 16, padding: 15, marginBottom: 20 },
  shareLabel: { color: '#CCC', fontSize: 13, marginBottom: 15, textAlign: 'right' },
  shareButtonsRow: { flexDirection: 'row-reverse', justifyContent: 'space-around', marginBottom: 15 },
  shareBtn: { width: 45, height: 45, borderRadius: 22.5, justifyContent: 'center', alignItems: 'center', shadowColor: "#000", shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.25, shadowRadius: 3.84, elevation: 5 },
  linkPreview: { flexDirection: 'row-reverse', backgroundColor: '#09121F', padding: 10, borderRadius: 8, alignItems: 'center', justifyContent: 'space-between' },
  linkText: { color: '#3498DB', fontSize: 12, flex: 1, textAlign: 'left', marginRight: 10 },
  menuBtn: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#101A2D', padding: 12, borderRadius: 16, marginBottom: 12, shadowColor: "#000", shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 4, elevation: 2 },
  menuIconBox: { width: 48, height: 48, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginLeft: 15 },
  menuContent: { flex: 1 },
  menuTitle: { color: '#FFF', fontSize: 16, fontWeight: 'bold', textAlign: 'right' },
  menuSub: { color: '#666', fontSize: 11, textAlign: 'right' },
});