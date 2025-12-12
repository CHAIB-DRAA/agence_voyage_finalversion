import React, { useState, useMemo, useEffect } from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  SafeAreaView, 
  StatusBar, 
  Linking, 
  Alert, 
  ActivityIndicator, 
  Platform,
  Image,
  TextInput,
  Modal
} from 'react-native';
import { Feather, FontAwesome5, MaterialCommunityIcons } from '@expo/vector-icons'; 
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import api from '../utils/api'; 

// CONSTANTES
const COLORS = {
  bgDark: '#050B14',
  bgCard: '#101A2D',
  bgCardLight: '#1A273E',
  primary: '#F3C764',
  success: '#2ECC71',
  danger: '#E74C3C',
  info: '#3498DB',
  textLight: '#FFFFFF',
  textGrey: '#8A95A5',
};
const SPACING = { s: 8, m: 16, l: 24 };
const FONT_SIZE = { s: 12, m: 14, l: 16, xl: 20, xxl: 24 };
const AGENCY_CCP_DEFAULT = "0000000000 00"; 

// --- COMPOSANTS INTERNES ---
const DetailCard = ({ title, icon, children, sideColor, style }) => (
  <View style={[styles.cardContainer, style]}>
    {sideColor && <View style={[styles.cardSideBorder, { backgroundColor: sideColor }]} />}
    <View style={[styles.cardContent, { backgroundColor: COLORS.bgCard }]}>
      <View style={styles.cardHeaderRow}>
        {icon && <Feather name={icon} size={20} color={sideColor || COLORS.primary} style={styles.cardIcon} />}
        <Text style={[styles.cardTitle, sideColor && { color: sideColor }]}>{title}</Text>
      </View>
      <View style={[styles.divider, sideColor && { backgroundColor: sideColor + '40' }]} />
      {children}
    </View>
  </View>
);

const InfoRow = ({ label, value, color, bold, size = 'm', icon }) => (
  <View style={styles.infoRow}>
    <View style={styles.infoLabelContainer}>
      {icon && <Feather name={icon} size={14} color={COLORS.textGrey} style={{ marginRight: 8 }} />}
      <Text style={styles.label}>{label}</Text>
    </View>
    <Text style={[
      styles.value, 
      color && { color: color }, 
      bold && { fontWeight: '800' },
      { fontSize: FONT_SIZE[size] || 14 }
    ]}>
      {value || '-'}
    </Text>
  </View>
);

const StatusChip = ({ label, icon, color, bgColor }) => (
  <View style={[styles.statusChip, { backgroundColor: bgColor }]}>
    {icon && <Feather name={icon} size={12} color={color} style={{ marginLeft: 4 }} />}
    <Text style={[styles.statusChipText, { color: color }]}>{label}</Text>
  </View>
);

const ProgressBar = ({ total, current }) => {
  const percent = total > 0 ? Math.min((current / total) * 100, 100) : 0;
  return (
    <View style={styles.progressContainer}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${percent}%`, backgroundColor: percent >= 100 ? COLORS.success : COLORS.primary }]} />
      </View>
      <Text style={styles.progressText}>{percent.toFixed(0)}% Payé</Text>
    </View>
  );
};

export default function QuoteDetails({ route, navigation }) {
  const [q, setQ] = useState(route.params?.quote || null);
  const { userRole, username } = route.params || {};
  
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  // --- NOUVEAUX ÉTATS POUR MODIFICATION RAPIDE ---
  const [editAdvanceVisible, setEditAdvanceVisible] = useState(false);
  const [newAdvanceAmount, setNewAdvanceAmount] = useState('');
  const [savingAdvance, setSavingAdvance] = useState(false);

  // --- ETAT POUR LES INFOS AGENCE ---
  const [agencyInfo, setAgencyInfo] = useState([]);

  useEffect(() => {
    if(route.params?.quote) setQ(route.params.quote);
    loadAgencySettings(); 
  }, [route.params?.quote]);

  // Récupération des paramètres agence depuis le backend
  const loadAgencySettings = async () => {
    try {
        const settings = await api.getSettings();
        setAgencyInfo(settings.agency_info || []);
    } catch (e) {
        console.log("Erreur chargement infos agence", e);
    }
  };

  // Helper intelligent pour trouver une valeur agence par mots-clés
  const getAgencyVal = (keywords) => {
      if (!agencyInfo.length) return null;
      const item = agencyInfo.find(i => {
          const label = i.label?.toLowerCase() || '';
          return keywords.some(k => label.includes(k));
      });
      return item ? item.value : null;
  };

  // --- LOGIQUE REFERENCE (AUTO-GENEREE SI ABSENTE) ---
  const derivedReference = useMemo(() => {
      if (q.reference) return q.reference;
      const id = q.id || q._id;
      const idStr = (typeof id === 'object' && id?.$oid) ? id.$oid : id;
      if (idStr && typeof idStr === 'string') {
          return `REF-${idStr.slice(-6).toUpperCase()}`;
      }
      return 'DRAFT';
  }, [q]);

  // --- CALCULATEUR COMPLET (ADULTES/ENFANTS) ---
  const totals = useMemo(() => {
    if (!q) return { hotelTotal: 0, fixedTotal: 0, grandTotal: 0, numAdults: 1, numChildren: 0, totalPax: 1, flight: 0, transport: 0, visa: 0, advance: 0, remaining: 0, expenses: 0, margin: 0, extraCosts: 0, marginPercent: 0 };
    
    const safeParse = (val) => { const parsed = parseInt(val); return isNaN(parsed) ? 0 : parsed; };

    // Pax
    const numAdults = safeParse(q.numberOfAdults || q.numberOfPeople || 1);
    const numChildren = safeParse(q.numberOfChildren || 0);
    const totalPax = numAdults + numChildren;

    // Hotels
    const p = q.prices || {};
    const qt = q.quantities || {};
    const hotelTotal = (safeParse(p.single) * safeParse(qt.single)) + 
                       (safeParse(p.double) * safeParse(qt.double)) + 
                       (safeParse(p.triple) * safeParse(qt.triple)) + 
                       (safeParse(p.quad) * safeParse(qt.quad)) + 
                       (safeParse(p.penta) * safeParse(qt.penta)) + 
                       (safeParse(p.suite) * safeParse(qt.suite));

    // Coûts Variables (Adulte vs Enfant)
    const flightCost = (safeParse(q.flightPrice) * numAdults) + (safeParse(q.flightPriceChild) * numChildren);
    const transportCost = (safeParse(q.transportPrice) * numAdults) + (safeParse(q.transportPriceChild) * numChildren);
    const visaCost = (safeParse(q.visaPrice) * numAdults) + (safeParse(q.visaPriceChild) * numChildren);
    
    const fixedTotal = flightCost + transportCost + visaCost;
    
    // Totaux Généraux
    const grandTotal = safeParse(q.totalAmount);
    const advance = safeParse(q.advanceAmount);
    const remaining = grandTotal - advance;
    const expenses = safeParse(q.expenses);
    const margin = safeParse(q.margin);
    const extraCosts = safeParse(q.extraCosts);
    const marginPercent = grandTotal > 0 ? ((margin / grandTotal) * 100).toFixed(1) : 0;

    return { 
        hotelTotal: safeParse(q.hotelTotal) || hotelTotal, 
        fixedTotal, grandTotal, 
        numAdults, numChildren, totalPax,
        flightCost, transportCost, visaCost, 
        advance, remaining, expenses, margin, marginPercent, extraCosts 
    };
  }, [q]);

  if (!q) return null;

  const dates = q.dates || {}; 
  const quantities = q.quantities || {};
  const prices = q.prices || {};

  // --- ACTIONS ---
  const handleEdit = () => navigation.navigate('AddEdit', { edit: true, quote: q, username: username, userRole: userRole });
  
  const handleDelete = () => {
    Alert.alert("Supprimer ?", "Action définitive", [{ text: "Annuler" }, { text: "Supprimer", style: 'destructive', onPress: async () => { await api.deleteQuote(q.id || q._id); navigation.goBack(); }}]);
  };

  const updateStatus = async (newStatus) => {
    setUpdatingStatus(true);
    try {
        const updatedQuote = { ...q, status: newStatus };
        await api.saveQuote(updatedQuote);
        setQ(updatedQuote);
        Alert.alert("Succès", `Dossier marqué comme : ${newStatus === 'confirmed' ? 'Confirmé' : 'Annulé'}`);
    } catch (error) {
        Alert.alert("Erreur", "Impossible de mettre à jour le statut");
    } finally {
        setUpdatingStatus(false);
    }
  };

  const openAdvanceModal = () => {
    setNewAdvanceAmount(q.advanceAmount || '0');
    setEditAdvanceVisible(true);
  };

  const saveNewAdvance = async () => {
    setSavingAdvance(true);
    try {
        const safeTotal = parseInt(q.totalAmount) || 0;
        const safeAdvance = parseInt(newAdvanceAmount) || 0;
        const newRemaining = safeTotal - safeAdvance;

        const updatedQuote = { 
            ...q, 
            advanceAmount: String(safeAdvance),
            remainingAmount: String(newRemaining)
        };

        await api.saveQuote(updatedQuote);
        setQ(updatedQuote);
        setEditAdvanceVisible(false);
        Alert.alert('Succès', 'Paiement mis à jour !');
    } catch (error) {
        Alert.alert('Erreur', 'Impossible de mettre à jour le paiement');
    } finally {
        setSavingAdvance(false);
    }
  };

  const handleCall = () => { if (q.clientPhone) { let phone = q.clientPhone.replace(/\D/g, ''); if (phone.startsWith('0')) phone = '213' + phone.substring(1); Linking.openURL(`tel:${phone}`); }};
  
  const copyCCP = () => {
      const dynamicCCP = getAgencyVal(['ccp', 'compte', 'rib']) || AGENCY_CCP_DEFAULT;
      Alert.alert('CCP Agence', `Compte: ${dynamicCCP}\n(Copié dans le presse-papier)`);
  };
  
  const shareToWhatsApp = () => {
    const refText = derivedReference ? `🔖 Ref: *${derivedReference}*\n` : '';
    const text = `*🕋 عرض عمرة: ${q.destination}*\n${refText}👤 العميل: ${q.clientName} (${totals.totalPax} أشخاص)\n📅 الفترة: ${q.period}\n----------------\n🏨 *الإقامة:*\n📍 المدينة: ${q.hotelMedina || '---'}\n📍 مكة: ${q.hotelMakkah || '---'}${q.hotelJeddah ? `\n📍 جدة: ${q.hotelJeddah}` : ''}\n----------------\n✈️ الطيران: ${q.transport}\n💰 *المبلغ الإجمالي: ${totals.grandTotal.toLocaleString()} د.ج*\n✅ المدفوع: ${totals.advance.toLocaleString()} د.ج\n🔴 المتبقي: ${totals.remaining.toLocaleString()} د.ج${q.notes ? `\n----------------\n📝 ${q.notes}` : ''}`;
    let phoneParam = '';
    if (q.clientPhone) { let cleanPhone = q.clientPhone.replace(/\D/g, ''); if (cleanPhone.startsWith('0')) cleanPhone = '213' + cleanPhone.substring(1); phoneParam = `&phone=${cleanPhone}`; }
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}${phoneParam}`);
  };

  // --- PDF GENERATION ENGINE ---
  const generatePDF = async (mode) => {
    setLoadingPdf(true);
    try {
      const isClient = mode === 'client';
      
      const agencyLogo = getAgencyVal(['logo', 'icon']);
      const agencyName = getAgencyVal(['nom', 'name', 'agence']) || 'وكالة السفر';
      const agencyPhone = getAgencyVal(['tél', 'phone', 'hatif']) || '';
      const agencyAddress = getAgencyVal(['adresse', 'siège', 'address']) || '';
      const agencyCachet = getAgencyVal(['cachet', 'tampon']);

      // --- HTML ROWS ---
      let roomRows = '';
      const addRoomRow = (label, qty, price) => { if (!qty || qty === '0') return; roomRows += `<tr><td>${label}</td><td class="text-center">${qty}</td>${!isClient ? `<td class="text-left">${parseInt(price).toLocaleString()}</td>` : ''}</tr>`; };
      
      addRoomRow('غرفة ثنائية', quantities.double, prices.double); 
      addRoomRow('غرفة ثلاثية', quantities.triple, prices.triple); 
      addRoomRow('غرفة رباعية', quantities.quad, prices.quad); 
      addRoomRow('غرفة خماسية', quantities.penta, prices.penta); 
      addRoomRow('جناح', quantities.suite, prices.suite); 
      addRoomRow('غرفة فردية', quantities.single, prices.single);

      // --- INTERNAL BREAKDOWN BLOCK ---
      const internalDetails = !isClient ? `
      <div class="box mt-4">
        <div class="box-title">تحليل التكاليف (Internal Cost Breakdown)</div>
        <table class="cost-table">
          <tr><th>البند</th><th>التفاصيل</th><th>التكلفة الإجمالية</th></tr>
          <tr><td>تذاكر الطيران</td><td>${totals.numAdults} بالغ / ${totals.numChildren} أطفال</td><td>${totals.flightCost.toLocaleString()}</td></tr>
          <tr><td>النقل والتأشيرة</td><td>شامل التنقلات والرسوم</td><td>${(totals.transportCost + totals.visaCost).toLocaleString()}</td></tr>
          <tr><td>الفنادق</td><td>الإجمالي للإقامة</td><td>${totals.hotelTotal.toLocaleString()}</td></tr>
          <tr><td>مصاريف إضافية</td><td>${q.extraCosts || 0}</td><td>${totals.extraCosts.toLocaleString()}</td></tr>
          <tr class="total-row-internal"><td>الإجمالي (Coût)</td><td></td><td>${totals.expenses.toLocaleString()}</td></tr>
          <tr class="margin-row"><td>الربح الصافي (Marge)</td><td>${totals.marginPercent}%</td><td>${totals.margin.toLocaleString()}</td></tr>
        </table>
      </div>
      ` : '';

      // --- CSS STYLES (Single Page Optimized) ---
      const htmlContent = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <style>
          @page { margin: 20px; }
          body { font-family: 'Helvetica', sans-serif; color: #333; direction: rtl; margin: 0; padding: 0; font-size: 11px; }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #F3C764; padding-bottom: 10px; margin-bottom: 15px; }
          .logo { max-height: 60px; max-width: 120px; }
          .agency-name { font-size: 18px; font-weight: bold; color: #000; margin-bottom: 2px; }
          .agency-contact { font-size: 10px; color: #555; }
          .doc-title { font-size: 24px; font-weight: bold; color: #F3C764; text-transform: uppercase; }
          .ref-badge { background: #000; color: #F3C764; padding: 3px 8px; border-radius: 4px; font-weight: bold; font-size: 10px; display: inline-block; margin-top: 5px; }
          
          .grid-container { display: flex; gap: 15px; margin-bottom: 15px; }
          .box { flex: 1; border: 1px solid #ddd; border-radius: 6px; padding: 10px; background: #fcfcfc; }
          .box-title { font-size: 12px; font-weight: bold; color: #F3C764; border-bottom: 1px solid #eee; padding-bottom: 4px; margin-bottom: 6px; text-transform: uppercase; }
          .info-row { display: flex; justify-content: space-between; margin-bottom: 4px; border-bottom: 1px dotted #eee; padding-bottom: 2px; }
          .info-label { color: #777; font-weight: bold; }
          .info-val { font-weight: bold; color: #000; }
          
          table { width: 100%; border-collapse: collapse; font-size: 11px; }
          th { background: #eee; padding: 6px; text-align: right; color: #444; border-bottom: 2px solid #ddd; }
          td { padding: 6px; border-bottom: 1px solid #eee; }
          .text-center { text-align: center; }
          .text-left { text-align: left; }
          
          .total-section { display: flex; justify-content: flex-end; margin-top: 15px; }
          .total-box { width: 200px; background: #000; color: #fff; padding: 10px; border-radius: 6px; }
          .total-row { display: flex; justify-content: space-between; margin-bottom: 4px; font-size: 11px; }
          .grand-total { border-top: 1px solid #555; padding-top: 4px; margin-top: 4px; font-size: 14px; color: #F3C764; font-weight: bold; }
          
          .footer-section { margin-top: 30px; display: flex; justify-content: space-between; align-items: flex-end; font-size: 10px; color: #777; }
          .stamp-box { width: 100px; height: 80px; border: 1px dashed #ccc; display: flex; align-items: center; justify-content: center; color: #ccc; }
          .stamp-img { width: 90px; opacity: 0.8; transform: rotate(-5deg); }
          
          /* Internal Report Specifics */
          .cost-table th { background: #e0e0e0; }
          .margin-row { background: #e8f5e9; font-weight: bold; color: #2e7d32; }
          .total-row-internal { font-weight: bold; background: #fff3e0; }
          
          .mt-4 { margin-top: 10px; }
        </style>
      </head>
      <body>
        
        <!-- HEADER -->
        <div class="header">
          <div>
            ${agencyLogo ? `<img src="${agencyLogo}" class="logo" />` : ''}
            <div class="agency-name">${agencyName}</div>
            <div class="agency-contact">${agencyAddress}</div>
            <div class="agency-contact">📞 ${agencyPhone}</div>
          </div>
          <div style="text-align: left;">
            <div class="doc-title">${isClient ? 'عرض أسعار (Devis)' : 'تقرير (Rapport)'}</div>
            <div class="ref-badge">${derivedReference}</div>
            <div style="font-size: 10px; color: #777; margin-top: 4px;">Date: ${new Date().toLocaleDateString('fr-FR')}</div>
          </div>
        </div>

        <!-- CLIENT & TRIP INFO GRID -->
        <div class="grid-container">
          <div class="box">
            <div class="box-title">معلومات العميل (Client)</div>
            <div class="info-row"><span class="info-label">الاسم:</span><span class="info-val">${q.clientName}</span></div>
            <div class="info-row"><span class="info-label">الهاتف:</span><span class="info-val">${q.clientPhone}</span></div>
            <div class="info-row"><span class="info-label">عدد الأشخاص:</span><span class="info-val">${totals.totalPax} (Ad: ${totals.numAdults}, Ch: ${totals.numChildren})</span></div>
          </div>
          <div class="box">
            <div class="box-title">تفاصيل الرحلة (Voyage)</div>
            <div class="info-row"><span class="info-label">الوجهة:</span><span class="info-val">${q.destination}</span></div>
            <div class="info-row"><span class="info-label">الفترة:</span><span class="info-val">${q.period}</span></div>
            <div class="info-row"><span class="info-label">الطيران:</span><span class="info-val">${q.transport}</span></div>
          </div>
        </div>

        <!-- HOTELS -->
        <div class="box" style="margin-bottom: 15px;">
           <div class="box-title">الإقامة (Hôtels)</div>
           <table style="margin:0;">
             <tr><th>المدينة</th><th>الفندق</th></tr>
             <tr><td>المدينة المنورة</td><td>${q.hotelMedina || '-'}</td></tr>
             <tr><td>مكة المكرمة</td><td>${q.hotelMakkah || '-'}</td></tr>
             ${q.hotelJeddah ? `<tr><td>جدة</td><td>${q.hotelJeddah}</td></tr>` : ''}
           </table>
        </div>

        <!-- ROOMS TABLE -->
        <div class="box">
           <div class="box-title">توزيع الغرف (Chambres)</div>
           <table>
             <thead><tr><th>نوع الغرفة</th><th class="text-center">العدد</th>${!isClient ? '<th class="text-left">السعر</th>' : ''}</tr></thead>
             <tbody>${roomRows || '<tr><td colspan="3" class="text-center">-</td></tr>'}</tbody>
           </table>
        </div>

        <!-- INTERNAL DETAILS (IF ADMIN) -->
        ${internalDetails}

        <!-- FINANCIALS -->
        <div class="total-section">
           <div class="total-box">
              <div class="total-row"><span>المبلغ الإجمالي</span><span>${totals.grandTotal.toLocaleString()} DA</span></div>
              <div class="total-row" style="color: #2ECC71;"><span>المدفوع (Avance)</span><span>- ${totals.advance.toLocaleString()} DA</span></div>
              <div class="total-row grand-total"><span>المتبقي (Reste)</span><span>${totals.remaining.toLocaleString()} DA</span></div>
           </div>
        </div>

        <!-- NOTES -->
        ${q.notes ? `<div style="margin-top:15px; font-size:10px; color:#555; background:#eee; padding:8px; border-radius:4px;"><strong>ملاحظات:</strong> ${q.notes}</div>` : ''}

        <!-- FOOTER & STAMP -->
        <div class="footer-section">
           <div>
              <div>توقيع العميل</div>
              <div style="margin-top:40px; border-top:1px solid #ccc; width:120px;"></div>
           </div>
           <div>
              ${agencyCachet ? `<img src="${agencyCachet}" class="stamp-img" />` : '<div class="stamp-box">Cachet Agence</div>'}
           </div>
        </div>

      </body>
      </html>
      `;
      
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) { 
        console.error(error);
        Alert.alert('Erreur', 'Impossible de générer le PDF'); 
    } finally { setLoadingPdf(false); }
  };

  const isPaid = totals.grandTotal > 0 && totals.remaining <= 0;
  const statusConfig = useMemo(() => {
    switch (q.status) {
      case 'confirmed': return { label: 'مؤكد', color: COLORS.success, bg: COLORS.success + '30', icon: 'check-circle' };
      case 'cancelled': return { label: 'ملغى', color: COLORS.danger, bg: COLORS.danger + '30', icon: 'x-circle' };
      default: return { label: 'في الانتظار', color: COLORS.primary, bg: COLORS.primary + '30', icon: 'clock' };
    }
  }, [q.status]);

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bgDark} />
      
      {/* HEADER */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.iconButton}>
          <Feather name="arrow-right" size={24} color={COLORS.primary} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>تفاصيل العرض</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleEdit} style={styles.iconButton}>
            <Feather name="edit-2" size={20} color={COLORS.textLight} />
          </TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={[styles.iconButton, { marginLeft: SPACING.s }]}>
            <Feather name="trash-2" size={20} color={COLORS.danger} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        
        {/* --- ACTIONS RAPIDES --- */}
        {q.status === 'pending' && (
            <View style={styles.quickActionContainer}>
                <TouchableOpacity style={[styles.quickActionBtn, {backgroundColor: COLORS.success}]} onPress={() => updateStatus('confirmed')}>
                    {updatingStatus ? <ActivityIndicator color="#FFF" /> : <><Feather name="check" size={18} color="#FFF" /><Text style={styles.quickActionText}>CONFIRMER</Text></>}
                </TouchableOpacity>
                <TouchableOpacity style={[styles.quickActionBtn, {backgroundColor: COLORS.danger, marginLeft: 10}]} onPress={() => updateStatus('cancelled')}>
                    {updatingStatus ? <ActivityIndicator color="#FFF" /> : <><Feather name="x" size={18} color="#FFF" /><Text style={styles.quickActionText}>ANNULER</Text></>}
                </TouchableOpacity>
            </View>
        )}

        {/* CARTE CLIENT */}
        <View style={[styles.clientCard, { backgroundColor: COLORS.primary }]}>
          <View style={styles.clientCardHeader}>
            <View style={styles.avatarContainer}>
              <Text style={styles.avatarText}>{q.clientName ? q.clientName.charAt(0).toUpperCase() : '?'}</Text>
            </View>
            <View style={styles.clientInfo}>
              
              {/* --- AJOUT AFFICHAGE REF (Utilisation de derivedReference) --- */}
              {derivedReference ? (
                  <View style={styles.refBadge}>
                     <Feather name="hash" size={10} color={COLORS.bgDark} style={{marginRight: 4}} />
                     <Text style={styles.refText}>{derivedReference}</Text>
                  </View>
              ) : null}

              <Text style={styles.clientLabel}>العميل (Client)</Text>
              <Text style={styles.clientName} numberOfLines={1}>{q.clientName}</Text>
              <TouchableOpacity onPress={handleCall} style={styles.phoneButton}>
                <Feather name="phone-call" size={14} color={COLORS.bgDark} />
                <Text style={styles.phoneText}>{q.clientPhone}</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.statusContainer}>
              <StatusChip label={statusConfig.label} icon={statusConfig.icon} color={statusConfig.color} bgColor={COLORS.bgDark} />
            </View>
          </View>
          
          <View style={styles.clientCardFooter}>
            <View>
              <Text style={styles.clientLabelDark}>الإجمالي (Total)</Text>
              <Text style={styles.grandTotalText}>{totals.grandTotal.toLocaleString()} <Text style={{fontSize: 14}}>DA</Text></Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.clientLabelDark}>الأشخاص (Pax)</Text>
              <Text style={styles.paxText}><Feather name="users" size={16} /> {totals.totalPax}</Text>
            </View>
          </View>

          {q.passportImage && (
            <View style={styles.passportContainer}>
              <Text style={styles.passportLabel}>صورة الجواز (Passport)</Text>
              <Image source={{ uri: q.passportImage }} style={styles.passportImage} resizeMode="cover" />
            </View>
          )}
        </View>

        {/* CARTE PAIEMENT */}
        <DetailCard title="الوضع المالي (Paiement)" icon="dollar-sign" sideColor={isPaid ? COLORS.success : COLORS.danger}>
          <InfoRow label="المبلغ الإجمالي (Total)" value={`${totals.grandTotal.toLocaleString()} DA`} size="l" bold />
          
          {/* LIGNE VERSÉ MODIFIABLE RAPIDEMENT */}
          <View style={styles.infoRow}>
             <TouchableOpacity style={styles.editRowBtn} onPress={openAdvanceModal}>
                 <Feather name="edit-2" size={14} color={COLORS.textLight} />
                 <Text style={{color:COLORS.textLight, fontSize:10, marginLeft:5}}>Modifier</Text>
             </TouchableOpacity>
             <View style={{alignItems:'flex-end'}}>
                 <Text style={styles.label}>المدفوع (Versé)</Text>
                 <Text style={[styles.value, {color: COLORS.success, fontSize: 16, fontWeight: '800'}]}>- {totals.advance.toLocaleString()} DA</Text>
             </View>
          </View>
          
          <ProgressBar total={totals.grandTotal} current={totals.advance} />

          <View style={styles.divider} />
          <View style={styles.remainingContainer}>
            <View>
              <Text style={styles.label}>المتبقي (Reste)</Text>
              <Text style={[styles.remainingValue, { color: isPaid ? COLORS.success : COLORS.danger }]}>
                {totals.remaining.toLocaleString()} DA
              </Text>
            </View>
            <StatusChip 
              label={isPaid ? 'Payé (مدفوع)' : 'Non soldé (غير خالص)'} 
              icon={isPaid ? 'check-circle' : 'alert-circle'}
              color={isPaid ? COLORS.success : COLORS.danger}
              bgColor={isPaid ? COLORS.success + '30' : COLORS.danger + '30'}
            />
          </View>
          <TouchableOpacity onPress={copyCCP} style={styles.ccpButton}>
             <MaterialCommunityIcons name="bank-transfer" size={20} color={COLORS.primary} />
             <Text style={styles.ccpButtonText}>Copier le CCP de l'agence</Text>
          </TouchableOpacity>
        </DetailCard>

        {/* DETAILS VOYAGE */}
        <DetailCard title="تفاصيل الرحلة (Voyage)" icon="map" sideColor={COLORS.info}>
          <View style={styles.tripRoute}>
            <View style={styles.tripNode}>
              <Feather name="map-pin" size={16} color={COLORS.info} />
              <Text style={styles.tripText}>الجزائر</Text>
            </View>
            <View style={styles.tripLine} />
            <View style={styles.tripNode}>
              <FontAwesome5 name="kaaba" size={16} color={COLORS.primary} />
              <Text style={[styles.tripText, { fontWeight: 'bold', color: COLORS.primary }]}>{q.destination}</Text>
            </View>
          </View>
          <View style={styles.divider} />
          <InfoRow label="الفترة" value={q.period} icon="calendar" />
          <InfoRow label="الطيران" value={q.transport} icon="send" />
          <InfoRow label="التأشيرة" value={totals.visaCost > 0 ? 'Incluse' : 'Non incluse'} icon="file-text" />
        </DetailCard>

        {/* DETAILS HÔTELS */}
        <DetailCard title="الإقامة (Hôtels)" icon="home" sideColor={COLORS.primary}>
          <Text style={styles.subHeader}>🏨 المدينة المنورة</Text>
          <InfoRow label="الفندق" value={q.hotelMedina} icon="map-pin" />
          <InfoRow label="التواريخ" value={`${dates.medinaCheckIn} ➝ ${dates.medinaCheckOut}`} icon="calendar" size="s" color={COLORS.primary} />
          
          <View style={styles.divider} />
          
          <Text style={styles.subHeader}>🕋 مكة المكرمة</Text>
          <InfoRow label="الفندق" value={q.hotelMakkah} icon="map-pin" />
          <InfoRow label="التواريخ" value={`${dates.makkahCheckIn} ➝ ${dates.makkahCheckOut}`} icon="calendar" size="s" color={COLORS.primary} />

          {q.hotelJeddah && (
            <>
              <View style={styles.divider} />
              <Text style={styles.subHeader}>🏙️ جدة</Text>
              <InfoRow label="الفندق" value={q.hotelJeddah} icon="map-pin" />
              <InfoRow label="التواريخ" value={`${dates.jeddahCheckIn} ➝ ${dates.jeddahCheckOut}`} icon="calendar" size="s" color={COLORS.primary} />
            </>
          )}
        </DetailCard>

        {q.notes && (
          <DetailCard title="ملاحظات (Notes)" icon="file-text">
            <Text style={styles.notesText}>{q.notes}</Text>
          </DetailCard>
        )}

        {/* CARTE RENTABILITÉ (Admin Only) */}
        {userRole === 'admin' && (
          <DetailCard 
            title={totals.margin < 0 ? 'ALERTE : PERTE' : 'الربحية (Rentabilité)'} 
            icon="trending-up" 
            sideColor={totals.margin < 0 ? COLORS.danger : COLORS.success}
          >
             <InfoRow label="Coût de revient Total" value={`${totals.expenses.toLocaleString()} DA`} icon="shopping-cart" />
             {totals.extraCosts > 0 && <InfoRow label="Frais supplémentaires" value={`${totals.extraCosts.toLocaleString()} DA`} icon="plus-circle" color={COLORS.danger} />}
             <View style={styles.divider} />
             <View style={styles.marginContainer}>
               <View>
                 <Text style={styles.label}>Marge Nette</Text>
                 <Text style={[styles.marginValue, { color: totals.margin < 0 ? COLORS.danger : COLORS.success }]}>
                   {totals.margin.toLocaleString()} DA
                 </Text>
               </View>
               <View style={[styles.marginPercentBadge, { backgroundColor: totals.margin < 0 ? COLORS.danger : COLORS.success }]}>
                 <Text style={styles.marginPercentText}>{totals.marginPercent}%</Text>
               </View>
             </View>
          </DetailCard>
        )}

      </ScrollView>

      {/* FOOTER */}
      <View style={styles.footerOverlay}>
        <View style={styles.footerContent}>
          <TouchableOpacity style={[styles.actionButton, { backgroundColor: '#25D366' }]} onPress={shareToWhatsApp}>
            <FontAwesome5 name="whatsapp" size={24} color="#FFF" />
          </TouchableOpacity>
          
          <TouchableOpacity style={[styles.pdfButton, { backgroundColor: COLORS.info }]} onPress={() => generatePDF('client')} disabled={loadingPdf}>
            <Text style={styles.pdfButtonText}>Devis Client</Text>
            {loadingPdf ? <ActivityIndicator size="small" color="#FFF" style={{ marginLeft: 8 }} /> : <Feather name="file-text" size={18} color="#FFF" style={{ marginLeft: 8 }} />}
          </TouchableOpacity>
          
          {userRole === 'admin' && (
            <TouchableOpacity style={[styles.pdfButton, { backgroundColor: COLORS.bgCardLight, borderWidth: 1, borderColor: COLORS.primary }]} onPress={() => generatePDF('detailed')} disabled={loadingPdf}>
              <Text style={[styles.pdfButtonText, { color: COLORS.primary }]}>Rapport</Text>
              {loadingPdf ? <ActivityIndicator size="small" color={COLORS.primary} style={{ marginLeft: 8 }} /> : <Feather name="eye" size={18} color={COLORS.primary} style={{ marginLeft: 8 }} />}
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* --- MODAL DE PAIEMENT RAPIDE --- */}
      <Modal visible={editAdvanceVisible} animationType="slide" transparent={true} onRequestClose={() => setEditAdvanceVisible(false)}>
         <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
               <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>Mise à jour du paiement</Text>
                  <TouchableOpacity onPress={() => setEditAdvanceVisible(false)}>
                      <Feather name="x" size={24} color={COLORS.textLight} />
                  </TouchableOpacity>
               </View>
               <Text style={styles.modalLabel}>Nouveau montant versé (Total Avance) :</Text>
               <TextInput 
                  style={styles.modalInput}
                  value={newAdvanceAmount}
                  onChangeText={setNewAdvanceAmount}
                  keyboardType="numeric"
                  placeholder="Ex: 50000"
                  placeholderTextColor={COLORS.textGrey}
               />
               <TouchableOpacity style={styles.saveBtn} onPress={saveNewAdvance} disabled={savingAdvance}>
                  {savingAdvance ? <ActivityIndicator color={COLORS.bgDark} /> : <Text style={styles.saveBtnText}>Enregistrer</Text>}
               </TouchableOpacity>
            </View>
         </View>
      </Modal>

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bgDark, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: SPACING.l, paddingVertical: SPACING.m, backgroundColor: COLORS.bgDark, borderBottomWidth: 1, borderBottomColor: COLORS.bgCardLight },
  headerTitle: { flex: 1, color: COLORS.primary, fontSize: FONT_SIZE.xl, fontWeight: '700', textAlign: 'center' },
  iconButton: { padding: SPACING.s, backgroundColor: COLORS.bgCardLight, borderRadius: 12 },
  headerActions: { flexDirection: 'row' },
  scrollContent: { padding: SPACING.l, paddingBottom: 140 },
  clientCard: { borderRadius: 24, padding: SPACING.l, marginBottom: SPACING.l, overflow: 'hidden' },
  clientCardHeader: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: SPACING.m },
  avatarContainer: { width: 50, height: 50, borderRadius: 25, backgroundColor: COLORS.bgDark, alignItems: 'center', justifyContent: 'center', marginLeft: SPACING.m },
  avatarText: { color: COLORS.primary, fontSize: 24, fontWeight: 'bold' },
  
  clientInfo: { flex: 1, alignItems: 'flex-end' },
  // Nouveau style pour la REF dans la carte client
  refBadge: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, marginBottom: 4 },
  refText: { color: COLORS.bgDark, fontSize: 10, fontWeight: 'bold', fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace' },

  clientLabel: { color: COLORS.bgDark, fontSize: FONT_SIZE.s, opacity: 0.8 },
  clientName: { color: COLORS.bgDark, fontSize: 22, fontWeight: '900' },
  phoneButton: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.1)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12, marginTop: 4 },
  phoneText: { color: COLORS.bgDark, marginLeft: 4, fontWeight: '600' },
  statusContainer: { alignSelf: 'flex-start' },
  clientCardFooter: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-end' },
  clientLabelDark: { color: COLORS.bgDark, fontSize: FONT_SIZE.s, opacity: 0.8, textAlign: 'right' },
  grandTotalText: { color: COLORS.bgDark, fontSize: 28, fontWeight: '900' },
  paxText: { color: COLORS.bgDark, fontSize: 18, fontWeight: '700' },
  passportContainer: { marginTop: SPACING.m, paddingTop: SPACING.m, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)' },
  passportLabel: { color: COLORS.bgDark, fontSize: FONT_SIZE.s, marginBottom: SPACING.s, textAlign: 'right', opacity: 0.8 },
  passportImage: { width: '100%', height: 200, borderRadius: 12, backgroundColor: 'rgba(0,0,0,0.1)' },
  cardContainer: { borderRadius: 16, marginBottom: SPACING.m, overflow: 'hidden', flexDirection: 'row' },
  cardSideBorder: { width: 6 },
  cardContent: { flex: 1, padding: SPACING.m },
  cardHeaderRow: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: SPACING.s },
  cardIcon: { marginLeft: SPACING.s },
  cardTitle: { color: COLORS.textLight, fontSize: FONT_SIZE.l, fontWeight: '700' },
  divider: { height: 1, backgroundColor: COLORS.bgCardLight, marginVertical: SPACING.m },
  infoRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: SPACING.s },
  infoLabelContainer: { flexDirection: 'row-reverse', alignItems: 'center' },
  label: { color: COLORS.textGrey, fontSize: FONT_SIZE.m, fontWeight: '500' },
  value: { color: COLORS.textLight, fontWeight: '600', textAlign: 'left' },
  statusChip: { flexDirection: 'row-reverse', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statusChipText: { fontSize: 10, fontWeight: 'bold' },
  subHeader: { color: COLORS.primary, fontSize: FONT_SIZE.m, fontWeight: 'bold', textAlign: 'right', marginBottom: SPACING.s, marginTop: SPACING.s },
  remainingContainer: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  remainingValue: { fontSize: 22, fontWeight: '900' },
  ccpButton: { marginTop: SPACING.m, padding: SPACING.m, backgroundColor: COLORS.bgCardLight, borderRadius: 12, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: COLORS.primaryLight },
  ccpButtonText: { color: COLORS.primary, fontWeight: '600', marginRight: SPACING.s },
  tripRoute: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.s },
  tripNode: { alignItems: 'center' },
  tripText: { color: COLORS.textGrey, fontSize: 12, marginTop: 4 },
  tripLine: { flex: 1, height: 2, backgroundColor: COLORS.bgCardLight, marginHorizontal: SPACING.s },
  notesText: { color: COLORS.textLight, fontStyle: 'italic', textAlign: 'right', lineHeight: 22 },
  marginContainer: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  marginValue: { fontSize: 22, fontWeight: '900' },
  marginPercentBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12 },
  marginPercentText: { color: COLORS.textLight, fontWeight: 'bold' },
  footerOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0 },
  footerContent: { flexDirection: 'row-reverse', padding: SPACING.l, paddingTop: 0, backgroundColor: COLORS.bgDark, gap: SPACING.m },
  actionButton: { width: 50, height: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  pdfButton: { flex: 1, borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50, elevation: 5, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4 },
  pdfButtonText: { color: COLORS.textLight, fontSize: FONT_SIZE.m, fontWeight: '700' },
  quickActionContainer: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: SPACING.m },
  quickActionBtn: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', padding: 12, borderRadius: 12 },
  quickActionText: { color: '#FFF', fontWeight: 'bold', marginLeft: 8 },
  progressContainer: { marginTop: 10, marginBottom: 10 },
  progressTrack: { height: 6, backgroundColor: COLORS.bgCardLight, borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 3 },
  progressText: { color: COLORS.textGrey, fontSize: 10, marginTop: 4, textAlign: 'right' },
  
  // Styles Modal Avance
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'center', padding: 20 },
  modalContent: { backgroundColor: COLORS.bgCard, borderRadius: 16, padding: 20 },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 20 },
  modalTitle: { color: COLORS.textLight, fontSize: 18, fontWeight: 'bold' },
  modalLabel: { color: COLORS.textGrey, marginBottom: 10, textAlign: 'right' },
  modalInput: { backgroundColor: COLORS.bgDark, color: COLORS.textLight, padding: 15, borderRadius: 10, fontSize: 18, textAlign: 'center', marginBottom: 20, borderWidth: 1, borderColor: COLORS.primary },
  saveBtn: { backgroundColor: COLORS.primary, padding: 15, borderRadius: 10, alignItems: 'center' },
  saveBtnText: { color: COLORS.bgDark, fontWeight: 'bold', fontSize: 16 },
  editRowBtn: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.bgCardLight, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
});