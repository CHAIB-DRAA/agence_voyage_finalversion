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
  Dimensions,
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
const AGENCY_CCP = "0000000000 00"; 

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

  useEffect(() => {
    if(route.params?.quote) setQ(route.params.quote);
  }, [route.params?.quote]);

  // Calculateur sécurisé
  const totals = useMemo(() => {
    if (!q) return { hotelTotal: 0, fixedTotal: 0, grandTotal: 0, numPeople: 1, flight: 0, transport: 0, visa: 0, advance: 0, remaining: 0, expenses: 0, margin: 0, extraCosts: 0, marginPercent: 0 };
    
    const safeParse = (val) => { const parsed = parseInt(val); return isNaN(parsed) ? 0 : parsed; };

    const p = q.prices || {};
    const qt = q.quantities || {};
    const hotelTotal = (safeParse(p.single) * safeParse(qt.single)) + 
                       (safeParse(p.double) * safeParse(qt.double)) + 
                       (safeParse(p.triple) * safeParse(qt.triple)) + 
                       (safeParse(p.quad) * safeParse(qt.quad)) + 
                       (safeParse(p.penta) * safeParse(qt.penta)) + 
                       (safeParse(p.suite) * safeParse(qt.suite));

    const numPeople = safeParse(q.numberOfPeople) || 1;
    const flight = safeParse(q.flightPrice);
    const transport = safeParse(q.transportPrice);
    const visa = safeParse(q.visaPrice);
    const fixedTotal = (flight + transport + visa) * numPeople;
    
    const grandTotal = safeParse(q.totalAmount);
    const advance = safeParse(q.advanceAmount);
    const remaining = grandTotal - advance;
    const expenses = safeParse(q.expenses);
    const margin = safeParse(q.margin);
    const extraCosts = safeParse(q.extraCosts);
    const marginPercent = grandTotal > 0 ? ((margin / grandTotal) * 100).toFixed(1) : 0;

    return { hotelTotal: safeParse(q.hotelTotal) || hotelTotal, fixedTotal, grandTotal, numPeople, flight, transport, visa, advance, remaining, expenses, margin, marginPercent, extraCosts };
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

  // --- NOUVEAU : MISE À JOUR RAPIDE DE L'AVANCE ---
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

        // On prépare l'objet complet mis à jour
        const updatedQuote = { 
            ...q, 
            advanceAmount: String(safeAdvance),
            remainingAmount: String(newRemaining)
        };

        // Sauvegarde API
        await api.saveQuote(updatedQuote);
        
        // Mise à jour UI locale
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
  const copyCCP = () => Alert.alert('CCP Agence', `Compte: ${AGENCY_CCP}\n(Copié dans le presse-papier)`);
  
  const shareToWhatsApp = () => {
    const text = `*🕋 عرض عمرة: ${q.destination}*\n👤 العميل: ${q.clientName} (${totals.numPeople} أشخاص)\n📅 الفترة: ${q.period}\n----------------\n🏨 *الإقامة:*\n📍 المدينة: ${q.hotelMedina || '---'}\n📍 مكة: ${q.hotelMakkah || '---'}${q.hotelJeddah ? `\n📍 جدة: ${q.hotelJeddah}` : ''}\n----------------\n✈️ الطيران: ${q.transport}\n💰 *المبلغ الإجمالي: ${totals.grandTotal.toLocaleString()} د.ج*\n✅ المدفوع: ${totals.advance.toLocaleString()} د.ج\n🔴 المتبقي: ${totals.remaining.toLocaleString()} د.ج${q.notes ? `\n----------------\n📝 ${q.notes}` : ''}`;
    let phoneParam = '';
    if (q.clientPhone) { let cleanPhone = q.clientPhone.replace(/\D/g, ''); if (cleanPhone.startsWith('0')) cleanPhone = '213' + cleanPhone.substring(1); phoneParam = `&phone=${cleanPhone}`; }
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}${phoneParam}`);
  };

  const generatePDF = async (mode) => {
    setLoadingPdf(true);
    try {
      const isClient = mode === 'client';
      let tableRows = '';
      const addRow = (label, qty, price) => { if (!qty || qty === '0') return; tableRows += `<tr><td>${label}</td><td style="text-align:center">${qty}</td>${!isClient ? `<td class="price-col">${price} DA</td>` : ''}</tr>`; };
      
      addRow('غرفة ثنائية (Double)', quantities.double, prices.double); 
      addRow('غرفة ثلاثية (Triple)', quantities.triple, prices.triple); 
      addRow('غرفة رباعية (Quad)', quantities.quad, prices.quad); 
      addRow('غرفة خماسية (Penta)', quantities.penta, prices.penta); 
      addRow('جناح (Suite)', quantities.suite, prices.suite); 
      addRow('غرفة فردية (Single)', quantities.single, prices.single);

      const costSummaryBlock = !isClient ? `<div class="section-title">تحليل الربحية (Interne)</div><div class="cost-summary"><div class="cost-row"><span>المبيعات (Total Vente)</span><strong>${totals.grandTotal.toLocaleString()} DA</strong></div><div class="cost-row"><span>التكلفة (Total Coût)</span><strong>${totals.expenses.toLocaleString()} DA</strong></div>${totals.extraCosts > 0 ? `<div class="cost-row"><span>مصاريف إضافية (Extra)</span><strong>${totals.extraCosts.toLocaleString()} DA</strong></div>` : ''}<div class="cost-row" style="border-top:1px solid #ccc; margin-top:5px; padding-top:5px;"><span>الربح الصافي (Marge)</span><strong style="color:${totals.margin >= 0 ? '#27ae60' : '#c0392b'}; font-size: 16px;">${totals.margin.toLocaleString()} DA (${totals.marginPercent}%)</strong></div></div>` : '';
      
      const htmlContent = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><style>body{font-family:'Helvetica',sans-serif;padding:40px;color:#333;direction:rtl;text-align:right}.header-container{border-bottom:3px solid #F3C764;padding-bottom:20px;margin-bottom:30px;display:flex;justify-content:space-between;align-items:center}.invoice-title{font-size:32px;color:#F3C764;font-weight:bold;margin:0}.agency-name{font-size:20px;font-weight:bold;color:#050B14;text-transform:uppercase}.client-box{background:#f8f9fa;padding:20px;border-radius:8px;margin-bottom:30px;border-right:5px solid #F3C764}.client-name{font-size:24px;font-weight:bold;color:#050B14}.section-title{font-size:18px;color:#050B14;font-weight:bold;margin-top:30px;margin-bottom:15px;border-bottom:1px solid #eee;padding-bottom:5px}table{width:100%;border-collapse:collapse;margin-bottom:20px;font-size:15px}th{background:#eee;padding:12px;text-align:right;font-weight:bold;color:#555}td{padding:15px 12px;border-bottom:1px solid #ddd}.total-box{margin-top:40px;background:#f9f9f9;padding:20px;border-radius:10px;border:1px solid #eee}.total-row{display:flex;justify-content:space-between;margin-bottom:10px;font-size:16px}.grand-total{font-size:24px;font-weight:900;color:#050B14;border-top:2px solid #F3C764;padding-top:10px}.passport-img{max-width:200px;max-height:150px;border:1px solid #ccc;margin-top:10px;display:block}.cost-summary{width:100%;background:#fffbe6;padding:15px;border-radius:8px;border:1px solid #eee}.cost-row{display:flex;justify-content:space-between;margin-bottom:5px}</style></head><body><div class="header-container"><div class="agency-name">وكالة السفر</div><h1 class="invoice-title">${isClient?'عرض سعر':'تقرير داخلي'}</h1></div><div class="client-box"><div style="color:#888;font-size:12px">العميل</div><div class="client-name">${q.clientName} (${totals.numPeople} أشخاص)</div><div>📞 ${q.clientPhone}</div>${!isClient&&q.passportImage?`<br/><strong>صورة الجواز:</strong><br/><img src="${q.passportImage}" class="passport-img"/>`:''}</div><div class="section-title">تفاصيل الرحلة</div><table><tr><td>الوجهة: <strong>${q.destination}</strong></td><td>الفترة: <strong>${q.period}</strong></td></tr><tr><td>الطيران: <strong>${q.transport}</strong></td><td>تأشيرة: <strong>${totals.visa>0?'نعم':'لا'}</strong></td></tr></table><div class="section-title">الإقامة</div><table><tr><td>المدينة: ${q.hotelMedina||'-'}</td><td>مكة: ${q.hotelMakkah||'-'}</td></tr>${q.hotelJeddah?`<tr><td colspan="2">جدة: ${q.hotelJeddah}</td></tr>`:''}</table><div class="section-title">الغرف</div><table><thead><tr><th>النوع</th><th style="text-align:center">العدد</th>${!isClient?'<th>S/Total</th>':''}</tr></thead><tbody>${tableRows}</tbody></table>${costSummaryBlock}<div class="total-box"><div class="total-row"><span>المبلغ الإجمالي (Total)</span><strong>${totals.grandTotal.toLocaleString()} DA</strong></div><div class="total-row" style="color:#27ae60"><span>المدفوع (Avance)</span><strong>- ${totals.advance.toLocaleString()} DA</strong></div><div class="total-row grand-total" style="color:#c0392b"><span>المتبقي (Reste)</span><span>${totals.remaining.toLocaleString()} DA</span></div></div>${q.notes?`<div style="margin-top:20px;color:#666;"><strong>ملاحظات:</strong> ${q.notes}</div>`:''}</body></html>`;
      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) { Alert.alert('Erreur', 'Impossible de générer le PDF'); } finally { setLoadingPdf(false); }
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
              <Text style={styles.paxText}><Feather name="users" size={16} /> {totals.numPeople}</Text>
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
          <InfoRow label="التأشيرة" value={totals.visa > 0 ? 'Incluse' : 'Non incluse'} icon="file-text" />
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