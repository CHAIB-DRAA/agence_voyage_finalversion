import React, { useState, useMemo } from 'react';
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
  Image
} from 'react-native';
import { Feather } from '@expo/vector-icons'; 
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import api from '../utils/api'; 

export default function QuoteDetails({ route, navigation }) {
  const q = route.params?.quote;
  const { userRole, username } = route.params || {};
  
  const [loadingPdf, setLoadingPdf] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // --- CALCULATEUR DE LECTURE (Identique à AddEditQuote) ---
  const totals = useMemo(() => {
    // Initialisation sécurisée
    if (!q) return { 
        hotelTotal: 0, fixedTotal: 0, grandTotal: 0, numPeople: 1, 
        flight: 0, transport: 0, visa: 0, advance: 0, remaining: 0, 
        expenses: 0, margin: 0, extraCosts: 0 
    };

    const safeParse = (val) => {
      const parsed = parseInt(val);
      return isNaN(parsed) ? 0 : parsed;
    };

    const prices = q.prices || {};
    const quantities = q.quantities || {};

    // 1. Total Hôtels (incluant Penta & Suite)
    const hotelTotal = (safeParse(prices.single) * safeParse(quantities.single)) + 
                       (safeParse(prices.double) * safeParse(quantities.double)) + 
                       (safeParse(prices.triple) * safeParse(quantities.triple)) + 
                       (safeParse(prices.quad) * safeParse(quantities.quad)) +
                       (safeParse(prices.penta) * safeParse(quantities.penta)) +
                       (safeParse(prices.suite) * safeParse(quantities.suite));

    // 2. Frais Fixes
    const numPeople = safeParse(q.numberOfPeople) || 1;
    const flight = safeParse(q.flightPrice);
    const transport = safeParse(q.transportPrice);
    const visa = safeParse(q.visaPrice); // <--- Nouveau
    
    const fixedTotal = (flight + transport + visa) * numPeople;

    // Récupération des données stockées
    const grandTotal = safeParse(q.totalAmount);
    const advance = safeParse(q.advanceAmount);
    const remaining = grandTotal - advance;
    
    // Données de rentabilité (si disponibles)
    const expenses = safeParse(q.expenses);
    const margin = safeParse(q.margin);
    const extraCosts = safeParse(q.extraCosts);

    return { 
      hotelTotal: safeParse(q.hotelTotal) || hotelTotal, 
      fixedTotal, 
      grandTotal, 
      numPeople, 
      flight, 
      transport, 
      visa, 
      advance, 
      remaining,
      expenses,
      margin,
      extraCosts
    };
  }, [q]);

  if (!q) return null;

  const dates = q.dates || {}; 
  const quantities = q.quantities || {};
  const prices = q.prices || {};

  // --- ACTIONS ---
  const handleEdit = () => {
    navigation.navigate('AddEdit', { 
      edit: true, 
      quote: q,
      username: username, 
      userRole: userRole 
    });
  };

  const handleDelete = () => {
    Alert.alert("Supprimer ?", "Action définitive", [{ text: "Annuler" }, { text: "Supprimer", onPress: async () => { await api.deleteQuote(q.id || q._id); navigation.goBack(); }}]);
  };

  // --- PARTAGE WHATSAPP ---
  const shareToWhatsApp = () => {
    const text = [
      `*🕋 عرض عمرة: ${q.destination}*`,
      `👤 العميل: ${q.clientName} (${totals.numPeople} أشخاص)`,
      `📅 الفترة: ${q.period}`,
      `----------------`,
      `🏨 *الإقامة:*`,
      `📍 المدينة: ${q.hotelMedina || '---'}`,
      `📍 مكة: ${q.hotelMakkah || '---'}`,
      q.hotelJeddah ? `📍 جدة: ${q.hotelJeddah}` : '',
      `----------------`,
      `✈️ الطيران: ${q.transport}`,
      `📄 التأشيرة: ${totals.visa > 0 ? 'متضمنة' : 'غير متضمنة'}`,
      `----------------`,
      `💰 *المبلغ الإجمالي: ${totals.grandTotal.toLocaleString()} د.ج*`,
      `✅ المدفوع: ${totals.advance.toLocaleString()} د.ج`,
      `🔴 المتبقي: ${totals.remaining.toLocaleString()} د.ج`,
      q.notes ? `📝 ملاحظات: ${q.notes}` : ''
    ].filter(Boolean).join('\n'); // Filtre les lignes vides (ex: Jeddah si vide)

    let phoneParam = '';
    if (q.clientPhone) {
      let cleanPhone = q.clientPhone.replace(/\D/g, ''); 
      if (cleanPhone.startsWith('0')) cleanPhone = '213' + cleanPhone.substring(1);
      phoneParam = `&phone=${cleanPhone}`;
    }
    Linking.openURL(`whatsapp://send?text=${encodeURIComponent(text)}${phoneParam}`);
  };

  // --- GÉNÉRATEUR DE PDF (Devis/Facture) ---
  const generatePDF = async (mode) => {
    setLoadingPdf(true);
    try {
      const isClient = mode === 'client';
      
      let tableRows = '';
      const addRow = (label, qty, price) => {
        // On n'affiche la ligne que si la quantité est > 0
        if (!qty || qty === '0') return;
        // On affiche le prix unitaire chambre SEULEMENT si ce n'est pas le client (ou selon votre politique)
        // Ici, je garde la logique : Client voit qté, Agence voit prix.
        tableRows += `
          <tr>
            <td>${label}</td>
            <td style="text-align:center">${qty}</td>
            ${!isClient ? `<td class="price-col">${price} DA</td>` : ''}
          </tr>
        `;
      };

      addRow('غرفة ثنائية (Double)', quantities.double, prices.double);
      addRow('غرفة ثلاثية (Triple)', quantities.triple, prices.triple);
      addRow('غرفة رباعية (Quad)', quantities.quad, prices.quad);
      addRow('غرفة خماسية (Penta)', quantities.penta, prices.penta); // <--- NOUVEAU
      addRow('جناح (Suite)', quantities.suite, prices.suite);       // <--- NOUVEAU
      addRow('غرفة فردية (Single)', quantities.single, prices.single);

      // Bloc Rentabilité (Interne) - Visible uniquement si PDF Agence
      const internalBlock = !isClient ? `
        <div class="section-title">تحليل الربحية (Interne)</div>
        <div class="cost-summary">
            <div class="cost-row"><span>المبيعات (Total Vente)</span><strong>${totals.grandTotal.toLocaleString()} DA</strong></div>
            <div class="cost-row"><span>التكلفة (Total Coût)</span><strong>${totals.expenses.toLocaleString()} DA</strong></div>
            ${totals.extraCosts > 0 ? `<div class="cost-row"><span>مصاريف إضافية (Extra)</span><strong>${totals.extraCosts.toLocaleString()} DA</strong></div>` : ''}
            <div class="cost-row" style="border-top:1px solid #ccc; margin-top:5px; padding-top:5px;">
                <span>الربح الصافي (Marge)</span><strong style="color:#27ae60; font-size: 16px;">${totals.margin.toLocaleString()} DA</strong>
            </div>
        </div>
      ` : '';

      const htmlContent = `
        <!DOCTYPE html>
        <html lang="ar" dir="rtl">
        <head>
          <meta charset="UTF-8">
          <style>
            body { font-family: 'Helvetica', sans-serif; padding: 40px; color: #333; direction: rtl; text-align: right; }
            .header-container { border-bottom: 3px solid #F3C764; padding-bottom: 20px; margin-bottom: 30px; display: flex; justify-content: space-between; align-items: center; }
            .invoice-title { font-size: 32px; color: #F3C764; font-weight: bold; margin: 0; }
            .agency-name { font-size: 20px; font-weight: bold; color: #050B14; text-transform: uppercase; }
            .client-box { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 30px; border-right: 5px solid #F3C764; }
            .client-name { font-size: 24px; font-weight: bold; color: #050B14; }
            .section-title { font-size: 18px; color: #050B14; font-weight: bold; margin-top: 30px; margin-bottom: 15px; border-bottom: 1px solid #eee; padding-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 15px; }
            th { background: #eee; padding: 12px; text-align: right; font-weight: bold; color: #555; }
            td { padding: 15px 12px; border-bottom: 1px solid #ddd; }
            .total-box { margin-top: 40px; background: #f9f9f9; padding: 20px; border-radius: 10px; border: 1px solid #eee; }
            .total-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 16px; }
            .grand-total { font-size: 24px; font-weight: 900; color: #050B14; border-top: 2px solid #F3C764; padding-top: 10px; }
            .passport-img { max-width: 200px; max-height: 150px; border: 1px solid #ccc; margin-top: 10px; display: block; }
            .cost-summary { width: 100%; background: #fffbe6; padding: 15px; border-radius: 8px; border: 1px solid #eee; }
            .cost-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div class="agency-name">وكالة السفر</div>
            <h1 class="invoice-title">${isClient ? 'عرض سعر' : 'تقرير داخلي'}</h1>
          </div>

          <div class="client-box">
            <div style="color:#888; font-size:12px">العميل</div>
            <div class="client-name">${q.clientName} (${totals.numPeople} أشخاص)</div>
            <div>📞 ${q.clientPhone}</div>
            ${!isClient && q.passportImage ? `<br/><strong>صورة الجواز:</strong><br/><img src="${q.passportImage}" class="passport-img" />` : ''}
          </div>

          <div class="section-title">تفاصيل الرحلة</div>
          <table>
            <tr><td>الوجهة: <strong>${q.destination}</strong></td><td>الفترة: <strong>${q.period}</strong></td></tr>
            <tr><td>الطيران: <strong>${q.transport}</strong></td><td>تأشيرة: <strong>${totals.visa > 0 ? 'نعم' : 'لا'}</strong></td></tr>
          </table>

          <div class="section-title">الإقامة</div>
          <table>
            <tr><td>المدينة: ${q.hotelMedina || '-'}</td><td>مكة: ${q.hotelMakkah || '-'}</td></tr>
            ${q.hotelJeddah ? `<tr><td colspan="2">جدة: ${q.hotelJeddah}</td></tr>` : ''}
          </table>

          <div class="section-title">الغرف</div>
          <table>
            <thead><tr><th>النوع</th><th style="text-align:center">العدد</th>${!isClient ? '<th>S/Total</th>' : ''}</tr></thead>
            <tbody>${tableRows}</tbody>
          </table>

          ${internalBlock}

          <div class="total-box">
             <div class="total-row"><span>المبلغ الإجمالي (Total)</span><strong>${totals.grandTotal.toLocaleString()} DA</strong></div>
             <div class="total-row" style="color:#27ae60"><span>المدفوع (Avance)</span><strong>- ${totals.advance.toLocaleString()} DA</strong></div>
             <div class="total-row grand-total" style="color:#c0392b"><span>المتبقي (Reste)</span><span>${totals.remaining.toLocaleString()} DA</span></div>
          </div>

          ${q.notes ? `<div style="margin-top:20px; color:#666;"><strong>ملاحظات:</strong> ${q.notes}</div>` : ''}
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) { Alert.alert('Erreur', 'PDF'); } finally { setLoadingPdf(false); }
  };

  // UI Helpers
  const InfoRow = ({ label, value, color, bold }) => (
    <View style={styles.infoRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[
          styles.value, 
          color && {color: color},
          bold && {fontWeight: '900', fontSize: 18}
      ]}>{value || '-'}</Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#050B14" />
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Feather name="arrow-right" size={24} color="#F3C764" /></TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={handleEdit} style={styles.headerActionBtn}><Feather name="edit-2" size={20} color="#FFF" /></TouchableOpacity>
          <TouchableOpacity onPress={handleDelete} style={[styles.headerActionBtn, {marginLeft: 10}]}><Feather name="trash-2" size={20} color="#E74C3C" /></TouchableOpacity>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        
        {/* CARTE CLIENT */}
        <View style={styles.clientCard}>
           <View style={styles.rowReverse}>
              <View style={styles.avatarIcon}><Feather name="user" size={24} color="#050B14" /></View>
              <View style={{flex:1}}>
                <Text style={styles.clientLabel}>العميل</Text>
                <Text style={styles.clientName}>{q.clientName}</Text>
                <Text style={styles.clientLabel}>{totals.numPeople} أشخاص</Text>
              </View>
              <View style={styles.totalBadge}><Text style={styles.totalLabel}>الإجمالي</Text><Text style={styles.totalValue}>{totals.grandTotal.toLocaleString()} DA</Text></View>
           </View>
           
           {/* APERÇU PASSEPORT */}
           {q.passportImage && (
             <View style={styles.passportPreview}>
                <Text style={[styles.label, {textAlign: 'right', marginBottom: 5, color: '#050B14'}]}>صورة الجواز:</Text>
                <Image source={{ uri: q.passportImage }} style={styles.passportImage} />
             </View>
           )}
        </View>

        {/* --- CARTE PAIEMENT (Visible en premier pour l'info critique) --- */}
        <View style={[styles.card, {borderLeftWidth: 4, borderLeftColor: '#F3C764'}]}>
          <View style={styles.cardHeaderRow}><Feather name="dollar-sign" size={20} color="#F3C764" /><Text style={styles.cardTitle}>الوضع المالي (Paiement)</Text></View>
          <View style={styles.divider} />
          
          <InfoRow label="المبلغ الإجمالي (Total)" value={`${totals.grandTotal.toLocaleString()} DA`} />
          <InfoRow label="المدفوع (Versé)" value={`- ${totals.advance.toLocaleString()} DA`} color="#2ECC71" />
          
          <View style={[styles.divider, {backgroundColor:'#F3C764', height:1}]} />
          
          <InfoRow label="المتبقي (Reste)" value={`${totals.remaining.toLocaleString()} DA`} color="#E74C3C" bold />
        </View>

        {/* DETAILS VOYAGE */}
        <View style={styles.card}>
          <View style={styles.cardHeaderRow}><Feather name="map" size={20} color="#F3C764" /><Text style={styles.cardTitle}>تفاصيل الرحلة</Text></View>
          <View style={styles.divider} />
          <InfoRow label="الوجهة" value={q.destination} />
          <InfoRow label="الفترة" value={q.period} />
          <InfoRow label="الطيران" value={q.transport} />
          <InfoRow label="التأشيرة" value={totals.visa > 0 ? 'Oui' : 'Non'} />
          
          <View style={styles.divider} />
          <Text style={styles.subHeader}>🏨 الإقامة</Text>
          <View style={styles.hotelRow}><Text style={styles.hotelName}>المدينة: {q.hotelMedina || '---'}</Text><Text style={styles.hotelDates}>{dates.medinaCheckIn} ➝ {dates.medinaCheckOut}</Text></View>
          <View style={styles.hotelRow}><Text style={styles.hotelName}>مكة: {q.hotelMakkah || '---'}</Text><Text style={styles.hotelDates}>{dates.makkahCheckIn} ➝ {dates.makkahCheckOut}</Text></View>
          {q.hotelJeddah ? <View style={styles.hotelRow}><Text style={styles.hotelName}>جدة: {q.hotelJeddah}</Text><Text style={styles.hotelDates}>{dates.jeddahCheckIn} ➝ {dates.jeddahCheckOut}</Text></View> : null}
        </View>

        {/* CARTE RENTABILITÉ (Admin Only - Visuel) */}
        {userRole === 'admin' && (
          <View style={[styles.card, {borderColor: '#3498DB', borderWidth: 1}]}>
             <View style={styles.cardHeaderRow}><Feather name="trending-up" size={20} color="#3498DB" /><Text style={[styles.cardTitle, {color: '#3498DB'}]}>الربحية (Admin)</Text></View>
             <View style={styles.divider} />
             <InfoRow label="Coût de revient" value={`${totals.expenses.toLocaleString()} DA`} />
             <InfoRow label="Extra" value={`${totals.extraCosts.toLocaleString()} DA`} />
             <InfoRow label="Marge nette" value={`${totals.margin.toLocaleString()} DA`} color="#2ECC71" bold />
          </View>
        )}

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.actionBtn, {backgroundColor:'#25D366'}]} onPress={shareToWhatsApp}><Feather name="message-circle" size={24} color="#FFF" /></TouchableOpacity>
        <TouchableOpacity style={[styles.pdfButton, {backgroundColor: '#3498DB'}]} onPress={() => generatePDF('client')} disabled={loadingPdf}><Text style={styles.pdfButtonText}>فاتورة عميل</Text><Feather name="file-text" size={18} color="#FFF" style={{marginLeft:8}} /></TouchableOpacity>
        {userRole === 'admin' && (
             <TouchableOpacity style={[styles.pdfButton, {backgroundColor: '#E74C3C'}]} onPress={() => generatePDF('detailed')} disabled={loadingPdf}><Text style={styles.pdfButtonText}>تقرير داخلي</Text><Feather name="eye" size={18} color="#FFF" style={{marginLeft:8}} /></TouchableOpacity>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050B14', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  scrollContent: { padding: 20, paddingBottom: 120 },
  header: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 15, backgroundColor: '#050B14' },
  headerTitle: { flex: 1, color: '#F3C764', fontSize: 20, fontWeight: '700', textAlign: 'center' },
  backButton: { padding: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 8 },
  headerActions: { flexDirection: 'row' },
  headerActionBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 8 },
  
  clientCard: { backgroundColor: '#F3C764', borderRadius: 16, padding: 16, marginBottom: 20 },
  rowReverse: { flexDirection: 'row-reverse', alignItems: 'center' },
  avatarIcon: { backgroundColor: 'rgba(255,255,255,0.3)', width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  clientLabel: { color: '#050B14', fontSize: 12, opacity: 0.7, textAlign: 'right' },
  clientName: { color: '#050B14', fontSize: 20, fontWeight: '800', textAlign: 'right' },
  totalBadge: { backgroundColor: '#050B14', padding: 8, borderRadius: 8, alignItems: 'center', minWidth: 80 },
  totalLabel: { color: '#8A95A5', fontSize: 10 },
  totalValue: { color: '#FFF', fontWeight: 'bold', fontSize: 14 },
  
  passportPreview: { marginTop: 15, borderTopWidth: 1, borderTopColor: 'rgba(0,0,0,0.1)', paddingTop: 10 },
  passportImage: { width: '100%', height: 200, borderRadius: 8, backgroundColor: '#FFF' },

  card: { backgroundColor: '#101A2D', borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: 'rgba(255,255,255,0.03)' },
  cardHeaderRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: 10 },
  cardTitle: { color: '#F3C764', fontSize: 18, fontWeight: '700' },
  divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.1)', marginVertical: 12 },
  infoRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 12 },
  label: { color: '#8A95A5', fontSize: 14, fontWeight: '500' },
  value: { color: '#FFFFFF', fontSize: 15, fontWeight: '600' },
  subHeader: { color: '#AAA', fontSize: 14, fontWeight:'bold', textAlign: 'right', marginBottom: 8, marginTop: 5 },
  hotelRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 6 },
  hotelName: { color: '#FFF', fontSize: 14 },
  hotelDates: { color: '#F3C764', fontSize: 12, fontWeight: 'bold' },
  footer: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: 20, backgroundColor: '#050B14', borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', flexDirection: 'row-reverse', gap: 10, justifyContent: 'space-between' },
  pdfButton: { flex: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', height: 50 },
  pdfButtonText: { color: '#FFF', fontSize: 14, fontWeight: '700' },
  actionBtn: { width: 50, height: 50, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
});