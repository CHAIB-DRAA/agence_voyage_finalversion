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

  // --- CALCULATEUR DE LECTURE ---
  const totals = useMemo(() => {
    if (!q) return { hotelTotal: 0, fixedTotal: 0, grandTotal: 0, numPeople: 1, flight: 0, transport: 0, visa: 0, advance: 0, remaining: 0 };

    // 1. Hôtels
    const p = q.prices || {};
    const hotelTotal = (parseInt(p.single) || 0) + 
                       (parseInt(p.double) || 0) + 
                       (parseInt(p.triple) || 0) + 
                       (parseInt(p.quad) || 0);

    // 2. Frais Fixes
    const numPeople = parseInt(q.numberOfPeople) || 1;
    const flight = parseInt(q.flightPrice) || 0;
    const transport = parseInt(q.transportPrice) || 0;
    const visa = parseInt(q.visaPrice) || 0;
    
    const fixedTotal = (flight + transport + visa) * numPeople;

    // 3. Grand Total & Paiements
    const grandTotal = q.totalAmount ? parseInt(q.totalAmount) : (hotelTotal + fixedTotal);
    const advance = parseInt(q.advanceAmount) || 0;
    const remaining = grandTotal - advance;

    return { hotelTotal, fixedTotal, grandTotal, numPeople, flight, transport, visa, advance, remaining };
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
      `👤 العميل: ${q.clientName || '---'}`,
      `📅 الفترة: ${q.period}`,
      `----------------`,
      `🏨 *الإقامة:*`,
      `📍 المدينة: ${q.hotelMedina || '---'}`,
      `📍 مكة: ${q.hotelMakkah || '---'}`,
      `----------------`,
      `✈️ الطيران: ${q.transport}`,
      `💰 *المبلغ الإجمالي: ${totals.grandTotal} د.ج*`,
      `✅ المدفوع: ${totals.advance} د.ج`,
      `🔴 المتبقي: ${totals.remaining} د.ج`, // Ajout du reste à payer
      q.notes ? `----------------\n📝 ${q.notes}` : ''
    ].join('\n');

    let phoneParam = '';
    if (q.clientPhone) {
      let cleanPhone = q.clientPhone.replace(/\D/g, ''); 
      if (cleanPhone.startsWith('0')) cleanPhone = '213' + cleanPhone.substring(1);
      phoneParam = `&phone=${cleanPhone}`;
    }

    const url = `whatsapp://send?text=${encodeURIComponent(text)}${phoneParam}`;
    Linking.openURL(url).catch(() => Alert.alert('Erreur', 'WhatsApp non installé'));
  };

  // --- GÉNÉRATEUR DE PDF ---
  const generatePDF = async (mode) => {
    setLoadingPdf(true);
    try {
      const isClient = mode === 'client';
      let tableRows = '';
      const addRow = (label, qty, price) => {
        if (!qty || qty === '0') return;
        tableRows += `<tr><td>${label}</td><td style="text-align:center">${qty}</td>${!isClient ? `<td class="price-col">${price} DA</td>` : ''}</tr>`;
      };

      addRow('غرفة ثنائية (Double)', quantities.double, prices.double);
      addRow('غرفة ثلاثية (Triple)', quantities.triple, prices.triple);
      addRow('غرفة رباعية (Quad)', quantities.quad, prices.quad);
      addRow('غرفة فردية (Single)', quantities.single, prices.single);

      // Bloc Résumé Financier Interne
      const costSummaryBlock = !isClient ? `
        <div class="section-title">تفاصيل التكاليف (Interne)</div>
        <div class="cost-summary">
          <div class="cost-row"><span>إجمالي الغرف</span><strong>${totals.hotelTotal} DA</strong></div>
          <div class="cost-row"><span>تذاكر طيران (${totals.flight} x ${totals.numPeople})</span><strong>${totals.flight * totals.numPeople} DA</strong></div>
          <div class="cost-row"><span>نقل داخلي (${totals.transport} x ${totals.numPeople})</span><strong>${totals.transport * totals.numPeople} DA</strong></div>
          <div class="cost-row"><span>تأشيرة (${totals.visa} x ${totals.numPeople})</span><strong>${totals.visa * totals.numPeople} DA</strong></div>
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
            
            .total-box { margin-top: 40px; background: #f8f9fa; border: 1px solid #eee; border-radius: 8px; padding: 20px; }
            .total-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 16px; }
            .grand-total { font-size: 24px; font-weight: 900; color: #050B14; border-top: 2px solid #F3C764; padding-top: 10px; margin-top: 10px; }
            
            .footer { clear: both; margin-top: 100px; text-align: center; color: #aaa; font-size: 12px; border-top: 1px solid #eee; padding-top: 20px; }
            .badge { background: #eee; padding: 2px 8px; border-radius: 4px; font-size: 12px; }
            .cost-summary { width: 100%; margin-top: 10px; font-size: 14px; border: 1px solid #eee; padding: 15px; border-radius: 8px; background: #fffbe6; }
            .cost-row { display: flex; justify-content: space-between; padding: 5px 0; border-bottom: 1px dashed #ccc; }
            .trip-summary { background: #050B14; color: #fff; padding: 15px; border-radius: 8px; margin-bottom: 20px; display: flex; justify-content: space-between; }
            .trip-item { text-align: center; flex: 1; border-left: 1px solid #333; }
            .trip-item:last-child { border: none; }
            .trip-lbl { font-size: 10px; color: #F3C764; text-transform: uppercase; letter-spacing: 1px; }
            .trip-val { font-size: 16px; font-weight: bold; margin-top: 5px; }
            .passport-img { max-width: 200px; max-height: 150px; border: 1px solid #ccc; margin-top: 10px; display: block; }
          </style>
        </head>
        <body>
          <div class="header-container">
            <div class="agency-name">وكالة السفر</div>
            <h1 class="invoice-title">${isClient ? 'فاتورة العميل' : 'تفاصيل العرض'}</h1>
          </div>

          <div class="client-box">
            <div style="color:#888; font-size:12px">معلومات العميل</div>
            <div class="client-name">${q.clientName || '---'} (${totals.numPeople} أشخاص)</div>
            <div>📞 ${q.clientPhone || '---'}</div>
            ${!isClient && q.passportImage ? `<img src="${q.passportImage}" class="passport-img" />` : ''}
          </div>

          <div class="trip-summary">
            <div class="trip-item"><div class="trip-lbl">الوجهة</div><div class="trip-val">${q.destination}</div></div>
            <div class="trip-item"><div class="trip-lbl">الفترة</div><div class="trip-val">${q.period}</div></div>
            <div class="trip-item"><div class="trip-lbl">الطيران</div><div class="trip-val">${q.transport}</div></div>
          </div>

          <div class="section-title">تفاصيل الإقامة</div>
          <table>
            <tr>
              <td width="50%">
                <strong>📍 المدينة المنورة (${q.nightsMedina} ليالي)</strong><br/>
                فندق: ${q.hotelMedina || '---'}<br/>
                <span class="badge">${dates.medinaCheckIn || '--'} ➝ ${dates.medinaCheckOut || '--'}</span>
              </td>
              <td width="50%">
                <strong>📍 مكة المكرمة (${q.nightsMakkah} ليالي)</strong><br/>
                فندق: ${q.hotelMakkah || '---'}<br/>
                <span class="badge">${dates.makkahCheckIn || '--'} ➝ ${dates.makkahCheckOut || '--'}</span>
              </td>
            </tr>
          </table>

          <div class="section-title">توزيع الغرف</div>
          <table>
            <thead>
              <tr>
                <th>نوع الغرفة</th>
                <th style="text-align:center">العدد</th>
                ${!isClient ? '<th>الكلفة (Hôtels)</th>' : ''}
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>

          ${costSummaryBlock}

          <div class="total-box">
            <div class="total-row">
              <span>المبلغ الإجمالي (Total)</span>
              <strong>${totals.grandTotal} DA</strong>
            </div>
            <div class="total-row" style="color: #2ECC71;">
              <span>المدفوع (Avance)</span>
              <strong>- ${totals.advance} DA</strong>
            </div>
            <div class="total-row grand-total" style="color: #E74C3C;">
              <span>المتبقي للدفع (Reste)</span>
              <span>${totals.remaining} DA</span>
            </div>
          </div>

          ${q.notes ? `<div style="clear:both; padding-top:20px; color:#666;"><br/><strong>ملاحظات:</strong> ${q.notes}</div>` : ''}

          <div class="footer">
            <p>شكراً لثقتكم بخدماتنا.</p>
          </div>
        </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html: htmlContent });
      await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) {
      Alert.alert('Erreur', 'Impossible de générer le PDF');
    } finally {
      setLoadingPdf(false);
    }
  };

  // Helpers UI
  const InfoRow = ({ label, value, color }) => (
    <View style={styles.infoRow}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.value, color && {color: color}]}>{value || '-'}</Text>
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
        
        <View style={styles.clientCard}>
           <View style={styles.rowReverse}>
              <View style={styles.avatarIcon}><Feather name="user" size={24} color="#050B14" /></View>
              <View style={{flex:1}}>
                <Text style={styles.clientLabel}>العميل</Text>
                <Text style={styles.clientName}>{q.clientName}</Text>
                <Text style={styles.clientLabel}>{totals.numPeople} أشخاص</Text>
              </View>
              {/* Badge Total Simplifié */}
              <View style={styles.totalBadge}>
                <Text style={styles.totalLabel}>الإجمالي</Text>
                <Text style={styles.totalValue}>{totals.grandTotal} DA</Text>
              </View>
           </View>
           {q.passportImage && (
             <View style={styles.passportPreview}>
                <Text style={[styles.label, {textAlign: 'right', marginBottom: 5}]}>صورة الجواز:</Text>
                <Image source={{ uri: q.passportImage }} style={styles.passportImage} />
             </View>
           )}
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}><Feather name="dollar-sign" size={20} color="#F3C764" /><Text style={styles.cardTitle}>الوضع المالي</Text></View>
          <View style={styles.divider} />
          
          <InfoRow label="إجمالي الفنادق" value={`${totals.hotelTotal} DA`} />
          <InfoRow label={`طيران + نقل + تأشيرة (${totals.numPeople} pax)`} value={`${totals.fixedTotal} DA`} />
          
          <View style={[styles.divider, {backgroundColor:'#F3C764', opacity:0.3}]} />
          
          {/* --- NOUVELLE SECTION PAIEMENT --- */}
          <InfoRow label="المبلغ الإجمالي" value={`${totals.grandTotal} DA`} />
          <InfoRow label="المدفوع (Avance)" value={`- ${totals.advance} DA`} color="#2ECC71" />
          
          <View style={[styles.divider, {backgroundColor:'#F3C764', height:2}]} />
          
          <View style={styles.infoRow}>
             <Text style={styles.label}>المتبقي للدفع (Reste)</Text>
             <Text style={[styles.value, {color: '#E74C3C', fontSize: 20, fontWeight: 'bold'}]}>{totals.remaining} DA</Text>
          </View>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeaderRow}><Feather name="map" size={20} color="#F3C764" /><Text style={styles.cardTitle}>تفاصيل الرحلة</Text></View>
          <View style={styles.divider} />
          <InfoRow label="الوجهة" value={q.destination} />
          <InfoRow label="الفترة" value={q.period} />
          <InfoRow label="الطيران" value={q.transport} />
          <InfoRow label="نقل داخلي" value={q.transportMakkahMedina} />
          <View style={styles.divider} />
          <Text style={styles.subHeader}>🏨 الإقامة</Text>
          <View style={styles.hotelRow}><Text style={styles.hotelName}>المدينة: {q.hotelMedina || '---'}</Text><Text style={styles.hotelDates}>{dates.medinaCheckIn} ➝ {dates.medinaCheckOut}</Text></View>
          <View style={styles.hotelRow}><Text style={styles.hotelName}>مكة: {q.hotelMakkah || '---'}</Text><Text style={styles.hotelDates}>{dates.makkahCheckIn} ➝ {dates.makkahCheckOut}</Text></View>
        </View>
      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={[styles.actionBtn, {backgroundColor:'#25D366'}]} onPress={shareToWhatsApp}><Feather name="message-circle" size={24} color="#FFF" /></TouchableOpacity>
        <TouchableOpacity style={[styles.pdfButton, {backgroundColor: '#3498DB'}]} onPress={() => generatePDF('client')} disabled={loadingPdf}><Text style={styles.pdfButtonText}>فاتورة عميل</Text><Feather name="file-text" size={18} color="#FFF" style={{marginLeft:8}} /></TouchableOpacity>
        <TouchableOpacity style={[styles.pdfButton, {backgroundColor: '#E74C3C'}]} onPress={() => generatePDF('detailed')} disabled={loadingPdf}><Text style={styles.pdfButtonText}>تقرير الوكالة</Text><Feather name="eye" size={18} color="#FFF" style={{marginLeft:8}} /></TouchableOpacity>
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