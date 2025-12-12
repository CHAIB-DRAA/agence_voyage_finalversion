import React, { useState, useEffect, useMemo } from 'react';
import { 
  View, 
  Text, 
  TextInput, 
  TouchableOpacity, 
  StyleSheet, 
  ScrollView, 
  Alert, 
  SafeAreaView, 
  KeyboardAvoidingView, 
  Platform, 
  StatusBar, 
  Modal, 
  FlatList, 
  Image,
  ActivityIndicator
} from 'react-native';
import { Feather, FontAwesome5 } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print'; 
import * as Sharing from 'expo-sharing';
import api from '../utils/api'; 

// --- CONSTANTES & STYLES ---
const COLORS = {
  bg: '#050B14',
  card: '#101A2D',
  inputBg: '#09121F',
  primary: '#F3C764',
  success: '#2ECC71',
  danger: '#E74C3C',
  text: '#FFFFFF',
  textDim: '#8A95A5',
  border: '#2A3B55',
};

const emptyQuote = {
  id: null,
  reference: '', // Référence Unique
  status: 'pending',
  clientName: '',
  clientPhone: '',
  createdBy: '', 
  passportImage: null, 
  destination: '',
  
  // Séjour
  nightsMakkah: '0',
  nightsMedina: '0',
  nightsJeddah: '0',
  hotelMakkah: '', 
  hotelMedina: '',
  hotelJeddah: '',
  dates: { makkahCheckIn: '', makkahCheckOut: '', medinaCheckIn: '', medinaCheckOut: '', jeddahCheckIn: '', jeddahCheckOut: '' },
  period: '',
  meals: [],
  transport: '', 
  
  // Pax & Tarifs Différenciés
  numberOfAdults: '1',
  numberOfChildren: '0',
  
  flightPrice: '0',      // Adulte
  flightPriceChild: '0', // Enfant
  
  transportMakkahMedina: '', 
  transportPrice: '0',      // Adulte
  transportPriceChild: '0', // Enfant
  
  visaPrice: '0',      // Adulte
  visaPriceChild: '0', // Enfant

  // Chambres
  quantities: { single: '0', double: '0', triple: '0', quad: '0', penta: '0', suite: '0' },
  prices: { single: '0', double: '0', triple: '0', quad: '0', penta: '0', suite: '0' },
  
  // Totaux
  totalAmount: '0',
  hotelTotal: '0',
  advanceAmount: '0', 
  remainingAmount: '0',
  expenses: '0',
  extraCosts: '0',
  margin: '0',
  notes: ''
};

// --- HELPERS ---
const parseDate = (dateStr) => {
  if (!dateStr) return null;
  const parts = dateStr.split('/');
  return new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
};

const formatDate = (date) => {
  return `${String(date.getDate()).padStart(2,'0')}/${String(date.getMonth()+1).padStart(2,'0')}/${date.getFullYear()}`;
};

const calculateNights = (d1Str, d2Str) => {
  if(!d1Str || !d2Str) return 0;
  const d1 = parseDate(d1Str);
  const d2 = parseDate(d2Str);
  if(!d1 || !d2) return 0;
  const diff = Math.ceil((d2 - d1) / (1000*60*60*24));
  return diff > 0 ? diff : 0;
};

// Générateur de Référence (Ex: QT-20251212-4829)
const generateReference = () => {
  const now = new Date();
  const datePart = `${now.getFullYear()}${String(now.getMonth()+1).padStart(2,'0')}${String(now.getDate()).padStart(2,'0')}`;
  const randomPart = Math.floor(1000 + Math.random() * 9000);
  return `QT-${datePart}-${randomPart}`;
};

export default function AddEditQuote({ navigation, route }) {
  const creatorUsername = route.params?.username; 
  const userRole = route.params?.userRole;

  const [quote, setQuote] = useState(emptyQuote);
  const [hotels, setHotels] = useState([]); 
  const [tripOptions, setTripOptions] = useState({ destinations: [], periods: [], transports: [], intercity: [], meals: [] });

  const [activeDatePicker, setActiveDatePicker] = useState(null); 
  const [hotelModalVisible, setHotelModalVisible] = useState(false);
  const [genericModalVisible, setGenericModalVisible] = useState(false);
  const [targetCityForHotel, setTargetCityForHotel] = useState(null); 
  const [targetFieldForGeneric, setTargetFieldForGeneric] = useState(null);
  const [isAdvanceEnabled, setIsAdvanceEnabled] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const isEditMode = !!route.params?.edit;

  useEffect(() => { loadInitialData(); }, [route.params]);

  useEffect(() => {
    if (hotels.length > 0) calculateAutoPrices();
  }, [
    quote.hotelMakkah, quote.hotelMedina, quote.hotelJeddah,
    quote.nightsMakkah, quote.nightsMedina, quote.nightsJeddah,
    quote.quantities, 
    quote.flightPrice, quote.flightPriceChild,
    quote.transportPrice, quote.transportPriceChild,
    quote.visaPrice, quote.visaPriceChild,
    quote.numberOfAdults, quote.numberOfChildren, 
    quote.advanceAmount,
    quote.meals, quote.extraCosts, quote.margin, quote.period,
    hotels, tripOptions
  ]);

  // --- LOGIQUE MÉTIER ---

  const getSmartRate = (hotelName, type) => {
    const hotel = hotels.find(h => h.name === hotelName);
    if (!hotel) return 0;
    const safeParse = (val) => parseInt(val) || 0;
    const specialSeason = hotel.seasonalPrices?.find(s => s.periodName === quote.period);
    if (specialSeason?.prices?.[type] && specialSeason.prices[type] !== '0') {
      return safeParse(specialSeason.prices[type]);
    }
    return safeParse(hotel.prices?.[type]);
  };

  const checkAvailability = (type) => {
    if (!quote.hotelMakkah && !quote.hotelMedina && !quote.hotelJeddah) return true;
    let isAvailable = true;
    if (quote.hotelMakkah && getSmartRate(quote.hotelMakkah, type) === 0) isAvailable = false;
    if (quote.hotelMedina && isAvailable && getSmartRate(quote.hotelMedina, type) === 0) isAvailable = false;
    if (quote.hotelJeddah && isAvailable && getSmartRate(quote.hotelJeddah, type) === 0) isAvailable = false;
    return isAvailable;
  };

  const calculateAutoPrices = () => {
    const safeParse = (val) => parseInt(val) || 0;
    
    const numAdults = safeParse(quote.numberOfAdults);
    const numChildren = safeParse(quote.numberOfChildren);
    const totalPax = numAdults + numChildren; 
    
    // Coûts Pondérés
    const flightCostTotal = (safeParse(quote.flightPrice) * numAdults) + (safeParse(quote.flightPriceChild) * numChildren);
    const transportCostTotal = (safeParse(quote.transportPrice) * numAdults) + (safeParse(quote.transportPriceChild) * numChildren);
    const visaCostTotal = (safeParse(quote.visaPrice) * numAdults) + (safeParse(quote.visaPriceChild) * numChildren);
    
    // Repas (pour tous les pax)
    let mealsCostPerPerson = 0;
    if (quote.meals?.length > 0) {
      quote.meals.forEach(mealLabel => {
        const mealOption = tripOptions.meals.find(m => m.label === mealLabel);
        if (mealOption) mealsCostPerPerson += safeParse(mealOption.price);
      });
    }
    const mealsTotal = mealsCostPerPerson * totalPax;

    const totalFixedCosts = flightCostTotal + transportCostTotal + visaCostTotal + mealsTotal;

    const nightsM = safeParse(quote.nightsMakkah);
    const nightsMed = safeParse(quote.nightsMedina);
    const nightsJed = safeParse(quote.nightsJeddah);

    let totalHotelsOnly = 0;
    const newDisplayPrices = {};

    ['single', 'double', 'triple', 'quad', 'penta', 'suite'].forEach(type => {
      const qty = safeParse(quote.quantities?.[type]);
      const costMakkah = getSmartRate(quote.hotelMakkah, type) * nightsM;
      const costMedina = getSmartRate(quote.hotelMedina, type) * nightsMed;
      const costJeddah = getSmartRate(quote.hotelJeddah, type) * nightsJed;
      
      const hotelStayPrice = costMakkah + costMedina + costJeddah;
      const lineHotelTotal = hotelStayPrice * qty;
      
      newDisplayPrices[type] = String(lineHotelTotal);
      totalHotelsOnly += lineHotelTotal;
    });

    const extra = safeParse(quote.extraCosts);
    const totalExpenses = totalHotelsOnly + totalFixedCosts + extra; 
    const margin = safeParse(quote.margin);
    const grandTotal = totalExpenses + margin; 
    const advance = safeParse(quote.advanceAmount);
    const remaining = grandTotal - advance;

    if (quote.totalAmount !== String(grandTotal) || quote.hotelTotal !== String(totalHotelsOnly) || 
        quote.remainingAmount !== String(remaining) || quote.expenses !== String(totalExpenses)) {
        
        setQuote(prev => ({
          ...prev,
          prices: newDisplayPrices,
          hotelTotal: String(totalHotelsOnly),
          expenses: String(totalExpenses),
          totalAmount: String(grandTotal),
          remainingAmount: String(remaining)
        }));
    }
  };

  const loadInitialData = async () => {
    try {
      const [hotelsData, settingsData] = await Promise.all([api.getHotels(), api.getSettings()]);
      setHotels(hotelsData);
      setTripOptions(settingsData);
    } catch (error) {
      console.error("Erreur chargement données:", error);
    }

    if (isEditMode && route.params?.quote) {
      const incoming = route.params.quote;
      const initialAdvance = parseInt(incoming.advanceAmount || '0');
      if (initialAdvance > 0) setIsAdvanceEnabled(true);

      const defaultAdults = incoming.numberOfAdults || incoming.numberOfPeople || '1';

      setQuote({
        ...emptyQuote, 
        ...incoming,
        // Gestion de la référence existante ou création d'une nouvelle
        reference: incoming.reference || generateReference(), 
        numberOfAdults: defaultAdults,
        numberOfChildren: incoming.numberOfChildren || '0',
        flightPriceChild: incoming.flightPriceChild || '0',
        transportPriceChild: incoming.transportPriceChild || '0',
        visaPriceChild: incoming.visaPriceChild || '0',
        
        dates: { ...emptyQuote.dates, ...(incoming.dates || {}) },
        meals: Array.isArray(incoming.meals) ? incoming.meals : [], 
        prices: { ...emptyQuote.prices, ...(incoming.prices || {}) },
        quantities: { ...emptyQuote.quantities, ...(incoming.quantities || {}) },
        
        hotelTotal: incoming.hotelTotal || '0',
        totalAmount: incoming.totalAmount || '0',
        extraCosts: incoming.extraCosts || '0',
        expenses: incoming.expenses || '0',
        margin: incoming.margin || '0',
        flightPrice: incoming.flightPrice || '0',
        transportPrice: incoming.transportPrice || '0',
        visaPrice: incoming.visaPrice || '0',
        
        passportImage: incoming.passportImage || null,
        status: incoming.status || 'pending',
        id: incoming.id || incoming._id,
        createdBy: incoming.createdBy || ''
      });
    } else {
      // NOUVEAU DOSSIER : Génération immédiate de la référence
      setQuote(prev => ({ 
          ...prev, 
          createdBy: creatorUsername, 
          reference: generateReference() 
      }));
    }
  };

  const onDateChange = (event, selectedDate) => { 
    const currentKey = activeDatePicker;
    if (Platform.OS === 'android') setActiveDatePicker(null); 
    
    if (selectedDate && event.type === 'set') { 
        const newDateStr = formatDate(selectedDate);
        const newDateObj = selectedDate; 
        newDateObj.setHours(0,0,0,0);

        setQuote(prev => {
            const nextDates = { ...prev.dates, [currentKey]: newDateStr };
            let updates = { dates: nextDates };

            if (currentKey.includes('CheckIn')) {
                const cityPrefix = currentKey.replace('CheckIn', ''); 
                const checkOutKey = `${cityPrefix}CheckOut`;
                const currentCheckOut = parseDate(prev.dates[checkOutKey]);
                
                if (currentCheckOut) {
                    const oldCheckIn = parseDate(prev.dates[currentKey]);
                    let stayDuration = 1;
                    if (oldCheckIn) {
                        const diffTime = Math.abs(currentCheckOut - oldCheckIn);
                        stayDuration = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
                    }
                    if (currentCheckOut <= newDateObj) {
                        const nextDay = new Date(newDateObj);
                        nextDay.setDate(newDateObj.getDate() + (stayDuration > 0 ? stayDuration : 1));
                        updates.dates[checkOutKey] = formatDate(nextDay);
                    }
                } else {
                    const nextDay = new Date(newDateObj);
                    nextDay.setDate(newDateObj.getDate() + 1);
                    updates.dates[checkOutKey] = formatDate(nextDay);
                }
            } 
            else if (currentKey.includes('CheckOut')) {
                const cityPrefix = currentKey.replace('CheckOut', '');
                const checkInKey = `${cityPrefix}CheckIn`;
                const currentCheckIn = parseDate(prev.dates[checkInKey]);

                if (currentCheckIn && newDateObj <= currentCheckIn) {
                    Alert.alert('تاريخ غير صالح', 'يجب أن يكون تاريخ المغادرة بعد تاريخ الوصول.');
                    return prev;
                }
            }

            updates.nightsMakkah = String(calculateNights(updates.dates.makkahCheckIn, updates.dates.makkahCheckOut));
            updates.nightsMedina = String(calculateNights(updates.dates.medinaCheckIn, updates.dates.medinaCheckOut));
            updates.nightsJeddah = String(calculateNights(updates.dates.jeddahCheckIn, updates.dates.jeddahCheckOut));

            return { ...prev, ...updates };
        });
    } 
  };

  const getInitialDateForPicker = (key) => {
      if (quote.dates[key]) return parseDate(quote.dates[key]);
      const today = new Date();
      if (key.includes('CheckIn')) {
          const allCheckOuts = [
              parseDate(quote.dates.medinaCheckOut),
              parseDate(quote.dates.makkahCheckOut),
              parseDate(quote.dates.jeddahCheckOut)
          ].filter(d => d !== null).sort((a,b) => b - a);
          if (allCheckOuts.length > 0) return allCheckOuts[0];
      }
      return today;
  };

  const getMinimumDateForPicker = (key) => {
      const today = new Date();
      if (key.includes('CheckOut')) {
          const checkInKey = key.replace('CheckOut', 'CheckIn');
          const checkInDate = parseDate(quote.dates[checkInKey]);
          if (checkInDate) {
              const nextDay = new Date(checkInDate);
              nextDay.setDate(checkInDate.getDate() + 1);
              return nextDay;
          }
      }
      return today;
  };

  const save = async () => {
    if (!quote.clientName || !quote.destination) {
      Alert.alert('حقول ناقصة', 'يرجى إدخال اسم العميل والوجهة.');
      return;
    }
    setSaving(true);
    try {
      const totalPax = (parseInt(quote.numberOfAdults) || 0) + (parseInt(quote.numberOfChildren) || 0);
      
      const finalPayload = {
        ...quote,
        reference: quote.reference || generateReference(), // Sécurité doublon
        numberOfPeople: String(totalPax),
        createdBy: isEditMode ? (quote.createdBy || creatorUsername || 'Admin') : (creatorUsername || 'Admin')
      };
      await api.saveQuote(finalPayload);
      Alert.alert('تم بنجاح', 'تم حفظ الملف بنجاح.');
      navigation.navigate('List', { filterUser: creatorUsername, userRole });
    } catch (e) {
      Alert.alert('خطأ', 'تعذر حفظ الملف.');
    } finally {
        setSaving(false);
    }
  };

  const generateReceipt = async () => {
    if (!quote.clientName) { Alert.alert('تنبيه', 'اسم العميل مفقود.'); return; }
    try {
        const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><style>body{font-family:sans-serif;padding:40px;color:#333;text-align:right;border:3px solid #F3C764;margin:20px;border-radius:10px}.header{text-align:center;margin-bottom:30px;border-bottom:2px solid #eee;padding-bottom:20px}.title{font-size:32px;font-weight:bold;color:#050B14;margin:0}.subtitle{color:#666;font-size:14px;margin-top:5px}.amount-box{background:#fffbe6;border:2px dashed #F3C764;padding:30px;text-align:center;font-size:36px;font-weight:900;margin:40px 0;border-radius:15px;color:#050B14}.row{display:flex;justify-content:space-between;margin-bottom:15px;font-size:18px;border-bottom:1px solid #f0f0f0;padding-bottom:10px}.footer{margin-top:60px;text-align:center;font-size:12px;color:#999}.signatures{margin-top:60px;display:flex;justify-content:space-between;padding:0 40px}.sig-block{text-align:center;width:40%;border-top:1px solid #333;padding-top:10px;font-weight:bold}</style></head><body><div class="header"><h1 class="title">إيصال استلام نقدية</h1><div class="subtitle">BON DE VERSEMENT ESPÈCES</div><div style="margin-top:10px">REF: ${quote.reference || '---'}</div><div style="margin-top:5px">${new Date().toLocaleString('fr-FR')}</div></div><div class="row"><span>استلمنا من السيد(ة):</span><strong>${quote.clientName}</strong></div><div class="row"><span>بخصوص ملف:</span><strong>${quote.destination}</strong></div><div class="amount-box">${parseInt(quote.advanceAmount).toLocaleString()} د.ج</div><div class="row" style="color:#27ae60"><span>المبلغ الإجمالي (Total):</span><strong>${parseInt(quote.totalAmount).toLocaleString()} د.ج</strong></div><div class="row" style="color:#c0392b"><span>المتبقي للدفع (Reste):</span><strong>${parseInt(quote.remainingAmount).toLocaleString()} د.ج</strong></div><div class="signatures"><div class="sig-block">توقيع العميل</div><div class="sig-block">ختم وتوقيع الوكالة</div></div><div class="footer">هذا الإيصال يثبت سداد المبلغ المذكور أعلاه نقداً.</div></body></html>`;
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) { Alert.alert('خطأ', 'فشل إنشاء ملف PDF'); }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('خطأ', 'يرجى منح صلاحية الوصول للصور'); return; }
    let result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, allowsEditing: true, aspect: [4, 3], quality: 0.3, base64: true });
    if (!result.canceled) setQuote(prev => ({ ...prev, passportImage: `data:image/jpeg;base64,${result.assets[0].base64}` }));
  };

  // --- UI HELPERS ---
  const toggleMeal = (label) => setQuote(prev => { const m = prev.meals || []; return m.includes(label) ? { ...prev, meals: m.filter(x => x !== label) } : { ...prev, meals: [...m, label] }; });
  const setStatus = (s) => setQuote(prev => ({ ...prev, status: s }));
  const updateQuantity = (key, value) => setQuote(prev => ({ ...prev, quantities: { ...prev.quantities, [key]: value } }));
  const toggleAdvance = () => { const next = !isAdvanceEnabled; setIsAdvanceEnabled(next); if (!next) setQuote(p => ({ ...p, advanceAmount: '0' })); };
  
  const openHotelPicker = (city) => { setSearchQuery(''); setTargetCityForHotel(city); setHotelModalVisible(true); };
  const openGenericPicker = (field) => { setSearchQuery(''); setTargetFieldForGeneric(field); setGenericModalVisible(true); };
  
  const filteredHotels = hotels.filter(h => h.city === targetCityForHotel && h.name.toLowerCase().includes(searchQuery.toLowerCase()));
  const getOptionsList = () => { 
      const list = targetFieldForGeneric === 'destination' ? tripOptions.destinations : targetFieldForGeneric === 'period' ? tripOptions.periods : tripOptions.transports; 
      return list.filter(i => i.label.toLowerCase().includes(searchQuery.toLowerCase())); 
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={COLORS.bg} />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        
        {/* HEADER */}
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}><Feather name="arrow-right" size={24} color="#FFF" /></TouchableOpacity>
          <View><Text style={styles.headerTitle}>{isEditMode ? 'تعديل الملف' : 'ملف جديد'}</Text><Text style={styles.headerSub}>{quote.reference || 'Nouveau'}</Text></View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          {/* STATUT */}
          <View style={styles.statusContainer}>
            {['pending', 'confirmed', 'cancelled'].map(s => (
                <TouchableOpacity key={s} style={[styles.statusBtn, quote.status === s && styles[`status${s.charAt(0).toUpperCase() + s.slice(1)}`]]} onPress={() => setStatus(s)}>
                    <Text style={[styles.statusText, quote.status === s && {color:'#FFF'}]}>{s === 'pending' ? 'في الانتظار' : s === 'confirmed' ? 'مؤكد' : 'ملغى'}</Text>
                </TouchableOpacity>
            ))}
          </View>

          {/* CLIENT - AVEC RÉFÉRENCE */}
          <View style={styles.card}>
            <SectionHeader title="معلومات العميل" icon="user" />
            <View style={styles.rowReverse}>
              <TouchableOpacity style={styles.passportBox} onPress={pickImage}>
                {quote.passportImage ? <Image source={{ uri: quote.passportImage }} style={styles.passportImg} /> : <View style={styles.passportPlaceholder}><Feather name="camera" size={24} color={COLORS.primary} /><Text style={styles.passportTxt}>صورة الجواز</Text></View>}
              </TouchableOpacity>
              <View style={{flex: 1, marginRight: 15}}>
                
                {/* CHAMP RÉFÉRENCE AUTOMATIQUE */}
                <View style={{marginBottom: 10}}>
                    <Text style={styles.label}>رقم الملف (Reference)</Text>
                    <View style={[styles.inputContainer, {backgroundColor: '#1A273E', borderColor: COLORS.primary}]}>
                        <Feather name="hash" size={16} color={COLORS.primary} style={{marginRight: 10}} />
                        <TextInput value={quote.reference} editable={false} style={[styles.input, {color: COLORS.primary, fontWeight:'bold'}]} />
                    </View>
                </View>

                <InputField label="الاسم الكامل" value={quote.clientName} onChangeText={t => setQuote({...quote, clientName: t})} placeholder="اسم العميل" icon="user" />
                <InputField label="رقم الهاتف" value={quote.clientPhone} onChangeText={t => setQuote({...quote, clientPhone: t})} placeholder="05 XX XX XX XX" keyboardType="phone-pad" icon="phone" />
                
                {/* SAISIE PAX ADULTES / ENFANTS */}
                <View style={[styles.rowReverse, {marginTop: 5}]}>
                    <View style={{flex:1, marginLeft: 5}}>
                        <InputField label="عدد البالغين" value={quote.numberOfAdults} onChangeText={t => setQuote({...quote, numberOfAdults: t})} placeholder="1" keyboardType="numeric" icon="user" />
                    </View>
                    <View style={{flex:1, marginRight: 5}}>
                        <InputField label="عدد الأطفال" value={quote.numberOfChildren} onChangeText={t => setQuote({...quote, numberOfChildren: t})} placeholder="0" keyboardType="numeric" icon="users" />
                    </View>
                </View>
              </View>
            </View>
          </View>

          {/* VOYAGE - PRIX DIFFÉRENCIÉS */}
          <View style={styles.card}>
            <SectionHeader title="تفاصيل الرحلة" icon="map" />
            
            <View style={styles.rowReverse}>
              <View style={{flex:1, marginLeft:5}}><SelectField label="الوجهة" value={quote.destination} onPress={() => openGenericPicker('destination')} placeholder="اختر الوجهة..." /></View>
              <View style={{flex:1, marginRight:5}}><SelectField label="الموسم" value={quote.period} onPress={() => openGenericPicker('period')} placeholder="اختر الفترة..." /></View>
            </View>
            
            <SelectField label="شركة الطيران" value={quote.transport} onPress={() => openGenericPicker('transport')} placeholder="اختر..." />
            
            {/* VOL : ADULTE vs ENFANT */}
            <View style={styles.rowReverse}>
              <View style={{flex:1, marginLeft:5}}>
                  <InputField label="سعر التذكرة (بالغ)" value={quote.flightPrice} onChangeText={t => setQuote({...quote, flightPrice: t})} keyboardType="numeric" placeholder="0" />
              </View>
              <View style={{flex:1, marginRight:5}}>
                  <InputField label="سعر التذكرة (طفل)" value={quote.flightPriceChild} onChangeText={t => setQuote({...quote, flightPriceChild: t})} keyboardType="numeric" placeholder="0" />
              </View>
            </View>

            <View style={styles.divider} />
            
            {/* TRANSPORT INTERNE */}
            <Text style={styles.label}>النقل الداخلي</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{flexDirection:'row-reverse', marginBottom: 10}}>
                {tripOptions.intercity.map(t => (<MealChip key={t._id} label={t.label} active={quote.transportMakkahMedina === t.label} onPress={() => setQuote(prev => ({ ...prev, transportMakkahMedina: t.label }))} />))}
            </ScrollView>
            
            <View style={styles.rowReverse}>
              <View style={{flex:1, marginLeft:5}}>
                  <InputField label="تكلفة النقل (بالغ)" value={quote.transportPrice} onChangeText={t => setQuote({...quote, transportPrice: t})} keyboardType="numeric" placeholder="0" />
              </View>
              <View style={{flex:1, marginRight:5}}>
                  <InputField label="تكلفة النقل (طفل)" value={quote.transportPriceChild} onChangeText={t => setQuote({...quote, transportPriceChild: t})} keyboardType="numeric" placeholder="0" />
              </View>
            </View>

            {/* VISA */}
            <View style={styles.rowReverse}>
              <View style={{flex:1, marginLeft:5}}>
                  <InputField label="تأشيرة (بالغ)" value={quote.visaPrice} onChangeText={t => setQuote({...quote, visaPrice: t})} keyboardType="numeric" placeholder="0" />
              </View>
              <View style={{flex:1, marginRight:5}}>
                  <InputField label="تأشيرة (طفل)" value={quote.visaPriceChild} onChangeText={t => setQuote({...quote, visaPriceChild: t})} keyboardType="numeric" placeholder="0" />
              </View>
            </View>
          </View>

          {/* HOTELS & DATES */}
          <View style={styles.card}>
            <SectionHeader title="الإقامة" icon="moon" />
            <HotelRow city="Medina" title="المدينة المنورة" quote={quote} setQuote={setQuote} openHotelPicker={openHotelPicker} openDatePicker={setActiveDatePicker} />
            <View style={styles.divider} />
            <HotelRow city="Makkah" title="مكة المكرمة" quote={quote} setQuote={setQuote} openHotelPicker={openHotelPicker} openDatePicker={setActiveDatePicker} />
            <View style={styles.divider} />
            <HotelRow city="Jeddah" title="جدة (اختياري)" quote={quote} setQuote={setQuote} openHotelPicker={openHotelPicker} openDatePicker={setActiveDatePicker} />
          </View>

          {/* CHAMBRES */}
          <View style={styles.card}>
            <SectionHeader title="الغرف" icon="grid" />
            <Text style={styles.infoText}>* السعر يظهر "غير متوفر" إذا لم يتم تحديد سعر الفندق</Text>
            
            <RoomInput label="غرفة فردية" qty={quote.quantities.single} price={quote.prices.single} onChange={v => updateQuantity('single', v)} disabled={!checkAvailability('single')} />
            <RoomInput label="غرفة ثنائية" qty={quote.quantities.double} price={quote.prices.double} onChange={v => updateQuantity('double', v)} disabled={!checkAvailability('double')} />
            <RoomInput label="غرفة ثلاثية" qty={quote.quantities.triple} price={quote.prices.triple} onChange={v => updateQuantity('triple', v)} disabled={!checkAvailability('triple')} />
            <RoomInput label="غرفة رباعية" qty={quote.quantities.quad} price={quote.prices.quad} onChange={v => updateQuantity('quad', v)} disabled={!checkAvailability('quad')} />
            <RoomInput label="غرفة خماسية" qty={quote.quantities.penta} price={quote.prices.penta} onChange={v => updateQuantity('penta', v)} disabled={!checkAvailability('penta')} />
            <RoomInput label="جناح" qty={quote.quantities.suite} price={quote.prices.suite} onChange={v => updateQuantity('suite', v)} disabled={!checkAvailability('suite')} />

            <View style={styles.divider} />
            <Text style={styles.label}>خيارات الإعاشة (للفرد)</Text>
            <View style={styles.mealsContainer}>{tripOptions.meals.map(m => <MealChip key={m._id} label={`${m.label} (${m.price})`} active={quote.meals.includes(m.label)} onPress={() => toggleMeal(m.label)} />)}</View>
          </View>

          {/* RENTABILITÉ (Interne) */}
          <View style={[styles.card, {borderColor: COLORS.border, borderWidth: 1}]}>
             <SectionHeader title="الربحية (داخلي)" icon="trending-up" color={COLORS.textDim} />
             <View style={styles.rowReverse}><View style={{flex: 1, marginLeft: 10}}><InputField label="التكلفة (تلقائي)" value={quote.expenses} onChangeText={t => setQuote({...quote, expenses: t})} keyboardType="numeric" /></View><View style={{flex: 1}}><InputField label="مصاريف إضافية" value={quote.extraCosts} onChangeText={t => setQuote({...quote, extraCosts: t})} keyboardType="numeric" /></View></View>
             <View style={styles.rowReverse}>
                 <View style={{flex: 1, marginLeft: 10}}><InputField label="الربح الصافي" value={quote.margin} onChangeText={t => setQuote({...quote, margin: t})} keyboardType="numeric" /></View>
                 <View style={styles.totalDisplayBox}><Text style={styles.totalLabel}>إجمالي البيع</Text><Text style={styles.totalValue}>{parseInt(quote.totalAmount).toLocaleString()} د.ج</Text></View>
             </View>
          </View>

          {/* PAIEMENT */}
          <View style={[styles.card, {borderColor: COLORS.primary, borderWidth:1}]}>
            <SectionHeader title="المدفوعات" icon="dollar-sign" color={COLORS.primary} />
            <TouchableOpacity style={styles.checkboxRow} onPress={toggleAdvance}>
                <Feather name={isAdvanceEnabled ? "check-square" : "square"} size={22} color={isAdvanceEnabled ? COLORS.primary : COLORS.textDim} />
                <Text style={{color: COLORS.text, marginLeft: 10, fontWeight: '600'}}>تسجيل دفعة مقدمة (Avance)</Text>
            </TouchableOpacity>
            
            {isAdvanceEnabled && (
                <View style={[styles.rowReverse, {marginTop: 10}]}>
                    <View style={{ flex: 1, marginLeft: 10 }}><InputField label="المبلغ المدفوع" value={quote.advanceAmount} onChangeText={t => setQuote({...quote, advanceAmount: t})} keyboardType="numeric" placeholder="0" /></View>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.label}>المتبقي</Text>
                        <View style={styles.remainingBox}><Text style={styles.remainingText}>{parseInt(quote.remainingAmount).toLocaleString()} د.ج</Text></View>
                    </View>
                </View>
            )}
            
            {parseInt(quote.advanceAmount) > 0 && (
                <TouchableOpacity style={styles.receiptBtn} onPress={generateReceipt}>
                   <Feather name="printer" size={16} color={COLORS.bg} /><Text style={styles.receiptBtnText}>طباعة إيصال</Text>
                </TouchableOpacity>
            )}
          </View>

          <View style={styles.card}><InputField label="ملاحظات داخلية" value={quote.notes} onChangeText={t => setQuote({...quote, notes: t})} multiline /></View>
          
          <View style={{height: 100}} /> 
        </ScrollView>

        {/* FOOTER FIXE */}
        <View style={styles.stickyFooter}>
            <View>
                <Text style={styles.footerLabel}>المبلغ الإجمالي</Text>
                <Text style={styles.footerAmount}>{parseInt(quote.totalAmount).toLocaleString()} د.ج</Text>
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={save} disabled={saving}>
                {saving ? <ActivityIndicator color={COLORS.bg} /> : <><Text style={styles.saveText}>حفظ الملف</Text><Feather name="check" size={20} color={COLORS.bg} /></>}
            </TouchableOpacity>
        </View>

        {/* MODALS */}
        <SelectionModal visible={hotelModalVisible} onClose={() => setHotelModalVisible(false)} title={`فنادق - ${targetCityForHotel === 'Makkah' ? 'مكة' : targetCityForHotel === 'Medina' ? 'المدينة' : 'جدة'}`} data={filteredHotels} onSelect={(item) => { if (targetCityForHotel === 'Makkah') setQuote(prev => ({ ...prev, hotelMakkah: item.name })); else if (targetCityForHotel === 'Medina') setQuote(prev => ({ ...prev, hotelMedina: item.name })); else if (targetCityForHotel === 'Jeddah') setQuote(prev => ({ ...prev, hotelJeddah: item.name })); setHotelModalVisible(false); }} field="name" searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
        <SelectionModal visible={genericModalVisible} onClose={() => setGenericModalVisible(false)} title="اختر من القائمة" data={getOptionsList()} onSelect={(item) => { setQuote(prev => ({ ...prev, [targetFieldForGeneric]: item.label })); setGenericModalVisible(false); }} field="label" searchQuery={searchQuery} setSearchQuery={setSearchQuery} />
        
        {activeDatePicker && (
            <DateTimePicker 
                value={getInitialDateForPicker(activeDatePicker)} 
                mode="date" 
                display={Platform.OS === 'ios' ? 'spinner' : 'default'} 
                onChange={onDateChange}
                minimumDate={getMinimumDateForPicker(activeDatePicker)} 
                textColor="#FFF" 
            />
        )}

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// --- SOUS-COMPOSANTS ---

const HotelRow = ({ city, title, quote, setQuote, openHotelPicker, openDatePicker }) => {
    const nightsKey = `nights${city === 'Medina' ? 'Medina' : city === 'Makkah' ? 'Makkah' : 'Jeddah'}`;
    const checkInKey = `${city.toLowerCase()}CheckIn`;
    const checkOutKey = `${city.toLowerCase()}CheckOut`;
    const hotelKey = `hotel${city}`;

    return (
        <View style={{marginBottom: 10}}>
            <Text style={styles.cityTitle}>{title}</Text>
            <SelectField label="" value={quote[hotelKey]} onPress={() => openHotelPicker(city)} placeholder="اختر الفندق..." />
            <View style={styles.rowReverse}>
                <View style={{flex: 1}}><InputField label="الليالي" value={quote[nightsKey]} onChangeText={t => setQuote({...quote, [nightsKey]: t})} keyboardType="numeric" align="center" /></View>
                <View style={{flex: 2, marginHorizontal: 5}}><DateButton label="دخول" value={quote.dates[checkInKey]} onPress={() => openDatePicker(checkInKey)} /></View>
                <View style={{flex: 2}}><DateButton label="خروج" value={quote.dates[checkOutKey]} onPress={() => openDatePicker(checkOutKey)} /></View>
            </View>
        </View>
    );
};

const SelectionModal = ({ visible, onClose, title, data, onSelect, field, searchQuery, setSearchQuery }) => (
    <Modal visible={visible} animationType="slide" transparent={true}>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
                <View style={styles.modalHeader}>
                    <Text style={styles.modalTitle}>{title}</Text>
                    <TouchableOpacity onPress={onClose}><Feather name="x" size={24} color="#FFF" /></TouchableOpacity>
                </View>
                <TextInput style={styles.searchInput} placeholder="بحث..." placeholderTextColor="#8A95A5" value={searchQuery} onChangeText={setSearchQuery} />
                <FlatList 
                    data={data} 
                    keyExtractor={item => item.id || item._id || Math.random().toString()} 
                    renderItem={({ item }) => (
                        <TouchableOpacity style={styles.listItem} onPress={() => onSelect(item)}>
                            <Text style={styles.listItemText}>{item[field]}</Text>
                            <Feather name="chevron-right" size={18} color={COLORS.primary} />
                        </TouchableOpacity>
                    )} 
                />
            </View>
        </View>
    </Modal>
);

const RoomInput = ({ label, qty, price, onChange, disabled }) => (
  <View style={[styles.roomRow, disabled && { opacity: 0.4 }]}>
    <Text style={styles.roomLabel}>{label}</Text>
    <TextInput 
      value={disabled ? '0' : String(qty || '')} 
      onChangeText={onChange} 
      keyboardType="numeric" 
      editable={!disabled}
      style={[styles.qtyInput, disabled && {backgroundColor: '#222', color: '#555'}]} 
      placeholder="0" 
      placeholderTextColor="#555" 
    />
    <Text style={[styles.roomPrice, disabled && {color: '#555'}]}>
      {disabled ? 'غير متوفر' : (price && price !== '0' ? `${parseInt(price).toLocaleString()} د.ج` : '-')}
    </Text>
  </View>
);

const SectionHeader = ({ title, icon, color }) => (
  <View style={styles.sectionHeader}>
    <Text style={[styles.sectionTitle, color && {color}]}>{title}</Text>
    <Feather name={icon} size={18} color={color || COLORS.primary} style={{ marginLeft: 8 }} />
  </View>
);

const InputField = ({ label, value, onChangeText, placeholder, keyboardType, multiline, icon, align }) => (
  <View style={{ marginBottom: 15, width: '100%' }}>
    <Text style={styles.label}>{label}</Text>
    <View style={[styles.inputContainer, multiline && {height: 80, alignItems: 'flex-start'}]}>
        {icon && <Feather name={icon} size={16} color={COLORS.textDim} style={{marginRight: 10}} />}
        <TextInput 
          value={String(value || '')} 
          onChangeText={onChangeText} 
          style={[styles.input, multiline && {height: '100%', paddingTop: 10}, align && {textAlign: align}]} 
          placeholder={placeholder} 
          placeholderTextColor="#444" 
          textAlign={align || "right"} 
          keyboardType={keyboardType}
          multiline={multiline}
        />
    </View>
  </View>
);

const SelectField = ({ label, value, onPress, placeholder }) => (
  <View style={{ marginBottom: 15, width: '100%' }}>
    {label ? <Text style={styles.label}>{label}</Text> : null}
    <TouchableOpacity onPress={onPress} style={styles.selectBtn}>
      <Feather name="chevron-down" size={18} color={COLORS.primary} />
      <Text style={[styles.selectText, !value && { color: '#666' }]}>{value || placeholder}</Text>
    </TouchableOpacity>
  </View>
);

const DateButton = ({ label, value, onPress }) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={styles.label}>{label}</Text>
    <TouchableOpacity onPress={onPress} style={styles.dateBtn}>
      <Feather name="calendar" size={14} color={COLORS.primary} />
      <Text style={[styles.dateBtnText, !value && { color: '#666' }]}>{value || '--/--'}</Text>
    </TouchableOpacity>
  </View>
);

const MealChip = ({ label, active, onPress }) => (
  <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
    <Text style={[styles.chipText, active && {color: COLORS.bg, fontWeight:'bold'}]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: COLORS.bg, borderBottomWidth: 1, borderColor: COLORS.border },
  headerTitle: { color: COLORS.text, fontSize: 18, fontWeight: 'bold' },
  headerSub: { color: COLORS.primary, fontSize: 12 },
  backButton: { padding: 5 },
  scrollContent: { padding: 20 },
  card: { backgroundColor: COLORS.card, borderRadius: 16, padding: 20, marginBottom: 20, borderWidth: 1, borderColor: COLORS.border },
  
  // Status
  statusContainer: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 20, gap: 10 },
  statusBtn: { flex: 1, paddingVertical: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, alignItems: 'center', backgroundColor: COLORS.card },
  statusConfirmed: { backgroundColor: COLORS.success, borderColor: COLORS.success },
  statusPending: { backgroundColor: '#F39C12', borderColor: '#F39C12' },
  statusCancelled: { backgroundColor: COLORS.danger, borderColor: COLORS.danger },
  statusText: { color: COLORS.textDim, fontSize: 12, fontWeight: 'bold' },

  // Inputs
  label: { color: COLORS.textDim, fontSize: 12, marginBottom: 6, textAlign: 'right', fontWeight: '600' },
  inputContainer: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: COLORS.inputBg, borderRadius: 10, paddingHorizontal: 12, borderWidth: 1, borderColor: COLORS.border },
  input: { flex: 1, color: COLORS.text, fontSize: 15, paddingVertical: 12 },
  selectBtn: { backgroundColor: COLORS.inputBg, borderRadius: 10, padding: 12, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectText: { color: COLORS.text, fontSize: 15, textAlign: 'right', flex: 1 },
  dateBtn: { backgroundColor: COLORS.inputBg, padding: 12, borderRadius: 10, borderWidth: 1, borderColor: COLORS.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dateBtnText: { color: COLORS.text, fontSize: 14 },
  
  // Rooms
  roomRow: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  roomLabel: { color: COLORS.text, fontSize: 14, width: 80, textAlign: 'right' },
  qtyInput: { backgroundColor: COLORS.inputBg, color: COLORS.text, borderRadius: 8, padding: 8, width: 60, textAlign: 'center', borderWidth: 1, borderColor: COLORS.border, fontWeight: 'bold' },
  roomPrice: { color: COLORS.primary, fontSize: 12, width: 100, textAlign: 'left' },

  // Layout
  rowReverse: { flexDirection: 'row-reverse' },
  passportBox: { width: 90, height: 90, borderRadius: 12, borderStyle: 'dashed', borderWidth: 1, borderColor: COLORS.primary, alignItems: 'center', justifyContent: 'center', marginLeft: 15, backgroundColor: 'rgba(243, 199, 100, 0.05)' },
  passportImg: { width: '100%', height: '100%', borderRadius: 12 },
  passportPlaceholder: { alignItems: 'center' },
  passportTxt: { color: COLORS.primary, fontSize: 10, marginTop: 5 },
  mealsContainer: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 20, borderWidth: 1, borderColor: COLORS.border, backgroundColor: COLORS.inputBg },
  chipActive: { backgroundColor: COLORS.primary, borderColor: COLORS.primary },
  chipText: { color: COLORS.textDim, fontSize: 12 },
  
  cityTitle: { color: COLORS.text, fontSize: 15, fontWeight: 'bold', marginBottom: 10, textAlign: 'right', borderRightWidth: 3, borderRightColor: COLORS.primary, paddingRight: 10 },
  infoText: { color: COLORS.textDim, fontSize: 11, textAlign: 'right', marginBottom: 15, fontStyle: 'italic' },
  divider: { height: 1, backgroundColor: COLORS.border, marginVertical: 20 },
  
  // Footer
  stickyFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: COLORS.card, padding: 20, borderTopWidth: 1, borderTopColor: COLORS.border, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', shadowColor: "#000", shadowOffset: {height: -4}, shadowOpacity: 0.3, shadowRadius: 4, elevation: 10 },
  footerLabel: { color: COLORS.textDim, fontSize: 12, textAlign: 'right' },
  footerAmount: { color: COLORS.primary, fontSize: 24, fontWeight: '900' },
  saveBtn: { backgroundColor: COLORS.primary, flexDirection: 'row-reverse', paddingHorizontal: 24, paddingVertical: 14, borderRadius: 12, alignItems: 'center', gap: 10 },
  saveText: { color: COLORS.bg, fontWeight: 'bold', fontSize: 16 },

  // Modals
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.9)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: COLORS.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '80%' },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: COLORS.text, fontSize: 20, fontWeight: 'bold' },
  searchInput: { backgroundColor: COLORS.inputBg, color: COLORS.text, borderRadius: 12, padding: 14, borderWidth: 1, borderColor: COLORS.border, fontSize: 16, marginBottom: 15, textAlign: 'right' },
  listItem: { padding: 16, borderBottomWidth: 1, borderColor: COLORS.border, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  listItemText: { color: COLORS.text, fontSize: 16 },

  sectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { color: COLORS.primary, fontSize: 16, fontWeight: '700', marginRight: 10 },
  
  // Payment specifics
  checkboxRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 15 },
  remainingBox: { backgroundColor: COLORS.primary, padding: 12, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
  remainingText: { color: COLORS.bg, fontWeight: 'bold', fontSize: 16 },
  receiptBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.success, padding: 12, borderRadius: 10, marginTop: 15 },
  receiptBtnText: { color: COLORS.bg, fontWeight: 'bold', marginLeft: 8 },
  totalDisplayBox: { flex: 1, justifyContent:'center', alignItems:'center', backgroundColor: 'rgba(243, 199, 100, 0.1)', borderRadius: 10 },
  totalLabel: { color: COLORS.textDim, fontSize: 10 },
  totalValue: { color: COLORS.primary, fontSize: 18, fontWeight: 'bold' },
});