import React, { useState, useEffect } from 'react';
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
  Image
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import * as ImagePicker from 'expo-image-picker';
import * as Print from 'expo-print'; 
import * as Sharing from 'expo-sharing';
import api from '../utils/api'; 

const emptyQuote = {
  id: null,
  status: 'pending',
  clientName: '',
  clientPhone: '',
  createdBy: '', 
  passportImage: null, 
  destination: '',
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
  flightPrice: '0',
  transportMakkahMedina: '', 
  transportPrice: '0',
  visaPrice: '0', 
  numberOfPeople: '1', 
  quantities: { single: '0', double: '0', triple: '0', quad: '0' },
  prices: { single: '0', double: '0', triple: '0', quad: '0' },
  totalAmount: '0',
  hotelTotal: '0',
  advanceAmount: '0', 
  remainingAmount: '0',
  notes: ''
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

  const isEditMode = !!route.params?.edit;

  useEffect(() => {
    loadInitialData();
  }, [route.params]);

  useEffect(() => {
    if (hotels.length > 0) calculateAutoPrices();
  }, [
    quote.hotelMakkah, quote.hotelMedina, quote.hotelJeddah,
    quote.nightsMakkah, quote.nightsMedina, quote.nightsJeddah,
    quote.quantities, quote.flightPrice, quote.transportPrice, quote.visaPrice, 
    quote.numberOfPeople, quote.advanceAmount,
    quote.meals, hotels, tripOptions
  ]);

  const calculateAutoPrices = () => {
    const hotelM = hotels.find(h => h.name === quote.hotelMakkah);
    const hotelMed = hotels.find(h => h.name === quote.hotelMedina);
    const hotelJed = hotels.find(h => h.name === quote.hotelJeddah);

    const safeParse = (val) => {
      const parsed = parseInt(val);
      return isNaN(parsed) ? 0 : parsed;
    };
    
    const nightsM = safeParse(quote.nightsMakkah);
    const nightsMed = safeParse(quote.nightsMedina);
    const nightsJed = safeParse(quote.nightsJeddah);
    const numPeople = safeParse(quote.numberOfPeople);
    
    const flightCost = safeParse(quote.flightPrice);
    const transportInterCost = safeParse(quote.transportPrice);
    const visaCost = safeParse(quote.visaPrice);
    
    let mealsCostPerPerson = 0;
    if (quote.meals && quote.meals.length > 0) {
      quote.meals.forEach(mealLabel => {
        const mealOption = tripOptions.meals.find(m => m.label === mealLabel);
        if (mealOption) {
          mealsCostPerPerson += safeParse(mealOption.price);
        }
      });
    }

    const totalFixedCosts = (flightCost + transportInterCost + visaCost + mealsCostPerPerson) * numPeople;

    const getRate = (hotel, type) => safeParse(hotel?.prices?.[type]);
    const getQty = (type) => safeParse(quote.quantities?.[type]);

    let totalHotelsOnly = 0;
    const newDisplayPrices = {};

    ['single', 'double', 'triple', 'quad'].forEach(type => {
      const qty = getQty(type);
      const costMakkah = getRate(hotelM, type) * nightsM;
      const costMedina = getRate(hotelMed, type) * nightsMed;
      const costJeddah = getRate(hotelJed, type) * nightsJed;
      
      const hotelStayPrice = costMakkah + costMedina + costJeddah;
      const lineHotelTotal = hotelStayPrice * qty;
      
      newDisplayPrices[type] = String(lineHotelTotal);
      totalHotelsOnly += lineHotelTotal;
    });

    const grandTotal = totalHotelsOnly + totalFixedCosts;
    const advance = safeParse(quote.advanceAmount);
    const remaining = grandTotal - advance;

    if (quote.totalAmount !== String(grandTotal) || quote.hotelTotal !== String(totalHotelsOnly) || quote.remainingAmount !== String(remaining)) {
        setQuote(prev => ({
          ...prev,
          prices: newDisplayPrices,
          hotelTotal: String(totalHotelsOnly),
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
      setQuote({
        ...emptyQuote, 
        ...incoming,
        dates: { ...emptyQuote.dates, ...(incoming.dates || {}) },
        meals: Array.isArray(incoming.meals) ? incoming.meals : [], 
        prices: { ...emptyQuote.prices, ...(incoming.prices || {}) },
        quantities: { ...emptyQuote.quantities, ...(incoming.quantities || {}) },
        hotelTotal: incoming.hotelTotal || '0',
        totalAmount: incoming.totalAmount || '0',
        numberOfPeople: incoming.numberOfPeople || '1',
        visaPrice: incoming.visaPrice || '0',
        passportImage: incoming.passportImage || null,
        status: incoming.status || 'pending',
        nightsJeddah: incoming.nightsJeddah || '0',
        hotelJeddah: incoming.hotelJeddah || '',
        advanceAmount: incoming.advanceAmount || '0',
        remainingAmount: incoming.remainingAmount || '0',
        id: incoming.id || incoming._id,
        createdBy: incoming.createdBy || ''
      });
    } else if (creatorUsername) {
      setQuote(prev => ({ ...prev, createdBy: creatorUsername }));
    }
  };

  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Erreur', 'Permission requise');
      return;
    }
    try {
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaType.Images,
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.2, // Compression forte pour éviter l'erreur PayloadTooLarge
        base64: true,
      });
      if (!result.canceled) {
        const base64Img = `data:image/jpeg;base64,${result.assets[0].base64}`;
        setQuote(prev => ({ ...prev, passportImage: base64Img }));
      }
    } catch (error) {
      console.error("Erreur ImagePicker:", error);
    }
  };

  const generateReceipt = async () => {
    if (!quote.clientName || parseInt(quote.advanceAmount) <= 0) {
        Alert.alert('تنبيه', 'Veuillez saisir un nom de client et un montant d\'avance > 0.');
        return;
    }
    try {
        const html = `
            <!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><style>body{font-family:'Helvetica',sans-serif;padding:30px;color:#333;direction:rtl;text-align:right;border:2px solid #F3C764;margin:10px}.header{text-align:center;margin-bottom:20px;border-bottom:1px solid #eee;padding-bottom:10px}.title{font-size:24px;font-weight:bold;color:#050B14;margin:0}.amount-box{background:#F3C764;color:#050B14;padding:20px;text-align:center;font-size:28px;font-weight:900;margin:30px 0;border-radius:8px;border:2px solid #050B14}.info-row{margin-bottom:15px;font-size:16px}</style></head><body><div class="header"><h1 class="title">إيصال استلام</h1><p>BON DE VERSEMENT</p></div><div class="info-row"><strong>استلمنا من:</strong> ${quote.clientName}</div><div class="amount-box">${parseInt(quote.advanceAmount).toLocaleString()} DA</div></body></html>
        `;
        const { uri } = await Print.printToFileAsync({ html });
        await Sharing.shareAsync(uri, { UTI: '.pdf', mimeType: 'application/pdf' });
    } catch (error) { Alert.alert('Erreur', 'Impossible de générer le reçu'); }
  };

  const save = async () => {
    if (!quote.clientName || !quote.destination) {
      Alert.alert('Manquant', 'Veuillez renseigner le Client et la Destination');
      return;
    }
    try {
      const finalPayload = {
        ...quote,
        createdBy: isEditMode ? (quote.createdBy || creatorUsername || 'Admin') : (creatorUsername || 'Admin')
      };
      await api.saveQuote(finalPayload);
      Alert.alert('Succès', 'Dossier enregistré');
      navigation.navigate('List', { filterUser: creatorUsername, userRole });
    } catch (e) {
      Alert.alert('Erreur', 'Connexion serveur impossible ou image trop lourde.');
    }
  };

  const toggleMeal = (label) => setQuote(prev => { const m = prev.meals || []; return m.includes(label) ? { ...prev, meals: m.filter(x => x !== label) } : { ...prev, meals: [...m, label] }; });
  const setStatus = (s) => setQuote(prev => ({ ...prev, status: s }));
  const updateQuantity = (key, value) => setQuote(prev => ({ ...prev, quantities: { ...prev.quantities, [key]: value } }));
  const setTransportInterCity = (type) => setQuote(prev => ({ ...prev, transportMakkahMedina: type }));
  
  const openHotelPicker = (city) => { setTargetCityForHotel(city); setHotelModalVisible(true); };
  const selectHotel = (hotel) => { 
    if (targetCityForHotel === 'Makkah') setQuote(prev => ({ ...prev, hotelMakkah: hotel.name })); 
    else if (targetCityForHotel === 'Medina') setQuote(prev => ({ ...prev, hotelMedina: hotel.name })); 
    else if (targetCityForHotel === 'Jeddah') setQuote(prev => ({ ...prev, hotelJeddah: hotel.name })); 
    setHotelModalVisible(false); 
  };
  
  const openGenericPicker = (field) => { setTargetFieldForGeneric(field); setGenericModalVisible(true); };
  const selectGenericOption = (value) => { setQuote(prev => ({ ...prev, [targetFieldForGeneric]: value })); setGenericModalVisible(false); };
  const getOptionsList = () => { if (targetFieldForGeneric === 'destination') return tripOptions.destinations; if (targetFieldForGeneric === 'period') return tripOptions.periods; if (targetFieldForGeneric === 'transport') return tripOptions.transports; return []; };
  const getModalTitle = () => targetFieldForGeneric === 'destination' ? 'الوجهة' : targetFieldForGeneric === 'period' ? 'الفترة' : 'الطيران';
  const filteredHotels = hotels.filter(h => h.city === targetCityForHotel);
  const parseDateString = (d) => d ? new Date(d.split('/')[2], d.split('/')[1] - 1, d.split('/')[0]) : new Date();
  
  const onDateChange = (event, selectedDate) => { 
    const currentKey = activeDatePicker;
    if (Platform.OS === 'android') setActiveDatePicker(null); 
    
    if (selectedDate && event.type === 'set') { 
        const d = selectedDate.getDate().toString().padStart(2,'0');
        const m = (selectedDate.getMonth()+1).toString().padStart(2,'0');
        const y = selectedDate.getFullYear();
        const newDateStr = `${d}/${m}/${y}`;
        
        setQuote(prev => {
            const nextDates = { ...prev.dates, [currentKey]: newDateStr };
            const updates = { dates: nextDates };

            const calculateNights = (d1, d2) => {
                if(!d1 || !d2) return '0';
                const [day1, m1, y1] = d1.split('/').map(Number);
                const [day2, m2, y2] = d2.split('/').map(Number);
                const date1 = new Date(y1, m1-1, day1);
                const date2 = new Date(y2, m2-1, day2);
                if(isNaN(date1) || isNaN(date2)) return '0';
                const diff = Math.ceil((date2 - date1) / (1000 * 60 * 60 * 24));
                return diff > 0 ? String(diff) : '0';
            };

            if (currentKey.includes('makkah')) {
                updates.nightsMakkah = calculateNights(nextDates.makkahCheckIn, nextDates.makkahCheckOut);
            } else if (currentKey.includes('medina')) {
                updates.nightsMedina = calculateNights(nextDates.medinaCheckIn, nextDates.medinaCheckOut);
            } else if (currentKey.includes('jeddah')) {
                updates.nightsJeddah = calculateNights(nextDates.jeddahCheckIn, nextDates.jeddahCheckOut);
            }
            
            return { ...prev, ...updates };
        });
    } 
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#050B14" />
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={{ flex: 1 }}>
        
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
            <Feather name="arrow-right" size={24} color="#FFF" />
          </TouchableOpacity>
          <View>
            <Text style={styles.headerTitle}>{isEditMode ? 'Modifier Dossier' : 'Nouveau Dossier'}</Text>
            <Text style={styles.headerSub}>{quote.createdBy || creatorUsername}</Text>
          </View>
        </View>

        <ScrollView contentContainerStyle={styles.scrollContent}>
          
          <View style={styles.statusContainer}>
            <TouchableOpacity style={[styles.statusBtn, quote.status === 'cancelled' && styles.statusCancelled]} onPress={() => setStatus('cancelled')}>
              <Text style={[styles.statusText, quote.status === 'cancelled' && {color:'#FFF'}]}>ملغى</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.statusBtn, quote.status === 'pending' && styles.statusPending]} onPress={() => setStatus('pending')}>
              <Text style={[styles.statusText, quote.status === 'pending' && {color:'#FFF'}]}>في الانتظار</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.statusBtn, quote.status === 'confirmed' && styles.statusConfirmed]} onPress={() => setStatus('confirmed')}>
              <Text style={[styles.statusText, quote.status === 'confirmed' && {color:'#FFF'}]}>مؤكد</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <SectionHeader title="معلومات العميل (Client)" icon="user" />
            <View style={styles.rowReverse}>
              <TouchableOpacity style={styles.passportBox} onPress={pickImage}>
                {quote.passportImage ? (
                  <Image source={{ uri: quote.passportImage }} style={styles.passportImg} />
                ) : (
                  <View style={styles.passportPlaceholder}>
                    <Feather name="camera" size={24} color="#F3C764" />
                    <Text style={styles.passportTxt}>Passeport</Text>
                  </View>
                )}
              </TouchableOpacity>
              <View style={{flex: 1, marginRight: 10}}>
                <InputField label="الاسم الكامل" value={quote.clientName} onChangeText={t => setQuote({...quote, clientName: t})} placeholder="Nom du client" />
                <InputField label="رقم الهاتف" value={quote.clientPhone} onChangeText={t => setQuote({...quote, clientPhone: t})} placeholder="05 XX XX XX XX" keyboardType="phone-pad" />
                <InputField label="عدد الأشخاص (Pax)" value={quote.numberOfPeople} onChangeText={t => setQuote({...quote, numberOfPeople: t})} placeholder="1" keyboardType="numeric" />
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <SectionHeader title="الرحلة و الطيران (Vol & Transport)" icon="map" />
            <View style={styles.rowReverse}>
              <View style={{flex:1, marginLeft:5}}>
                <SelectField label="الوجهة" value={quote.destination} onPress={() => openGenericPicker('destination')} placeholder="Destination" />
              </View>
              <View style={{flex:1, marginRight:5}}>
                <SelectField label="الموسم" value={quote.period} onPress={() => openGenericPicker('period')} placeholder="Période" />
              </View>
            </View>
            <View style={styles.rowReverse}>
              <View style={{flex:1, marginLeft:5}}>
                <SelectField label="شركة الطيران" value={quote.transport} onPress={() => openGenericPicker('transport')} placeholder="Compagnie" />
              </View>
              <View style={{flex:1, marginRight:5}}>
                <InputField label="سعر التذكرة (DA)" value={quote.flightPrice} onChangeText={t => setQuote({...quote, flightPrice: t})} keyboardType="numeric" placeholder="0" />
              </View>
            </View>
            <View style={styles.divider} />
            <View style={styles.rowReverse}>
              <View style={{flex:1, marginLeft:5}}>
                <Text style={styles.label}>نقل داخلي</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{flexDirection:'row-reverse'}}>
                   {tripOptions.intercity.length > 0 ? tripOptions.intercity.map(t => (
                     <SmallChip key={t._id} label={t.label} active={quote.transportMakkahMedina === t.label} onPress={() => setTransportInterCity(t.label)} />
                   )) : <Text style={{color:'#666'}}>...</Text>}
                </ScrollView>
              </View>
              <View style={{flex:0.6}}>
                <InputField label="سعر النقل (DA)" value={quote.transportPrice} onChangeText={t => setQuote({...quote, transportPrice: t})} keyboardType="numeric" placeholder="0" />
              </View>
            </View>
            <InputField label="سعر التأشيرة (Visa) - للفرد" value={quote.visaPrice} onChangeText={t => setQuote({...quote, visaPrice: t})} keyboardType="numeric" placeholder="0" />
          </View>

          <View style={styles.card}>
            <SectionHeader title="الإقامة (Hébergement)" icon="moon" />
            <View style={styles.hotelBlock}>
              <Text style={styles.cityTitle}>المدينة المنورة</Text>
              <SelectField label="" value={quote.hotelMedina} onPress={() => openHotelPicker('Medina')} placeholder="choisir hôtel..." />
              <View style={styles.rowReverse}>
                 <View style={{flex:1}}>
                    <InputField label="الليالي" value={quote.nightsMedina} onChangeText={t => setQuote({...quote, nightsMedina: t})} keyboardType="numeric" />
                 </View>
                 <View style={{flex:2, marginHorizontal:5}}>
                    <DateButton label="Check-In" value={quote.dates.medinaCheckIn} onPress={() => setActiveDatePicker('medinaCheckIn')} />
                 </View>
                 <View style={{flex:2}}>
                    <DateButton label="Check-Out" value={quote.dates.medinaCheckOut} onPress={() => setActiveDatePicker('medinaCheckOut')} />
                 </View>
              </View>
            </View>
            <View style={styles.hotelBlock}>
              <Text style={styles.cityTitle}>مكة المكرمة</Text>
              <SelectField label="" value={quote.hotelMakkah} onPress={() => openHotelPicker('Makkah')} placeholder="choisir hôtel..." />
              <View style={styles.rowReverse}>
                 <View style={{flex:1}}>
                    <InputField label="الليالي" value={quote.nightsMakkah} onChangeText={t => setQuote({...quote, nightsMakkah: t})} keyboardType="numeric" />
                 </View>
                 <View style={{flex:2, marginHorizontal:5}}>
                    <DateButton label="Check-In" value={quote.dates.makkahCheckIn} onPress={() => setActiveDatePicker('makkahCheckIn')} />
                 </View>
                 <View style={{flex:2}}>
                    <DateButton label="Check-Out" value={quote.dates.makkahCheckOut} onPress={() => setActiveDatePicker('makkahCheckOut')} />
                 </View>
              </View>
            </View>
             <View style={styles.hotelBlock}>
              <Text style={styles.cityTitle}>جدة (Jeddah)</Text>
              <SelectField label="" value={quote.hotelJeddah} onPress={() => openHotelPicker('Jeddah')} placeholder="choisir hôtel..." />
              <View style={styles.rowReverse}>
                 <View style={{flex:1}}>
                    <InputField label="الليالي" value={quote.nightsJeddah} onChangeText={t => setQuote({...quote, nightsJeddah: t})} keyboardType="numeric" />
                 </View>
                 <View style={{flex:2, marginHorizontal:5}}>
                    <DateButton label="Check-In" value={quote.dates.jeddahCheckIn} onPress={() => setActiveDatePicker('jeddahCheckIn')} />
                 </View>
                 <View style={{flex:2}}>
                    <DateButton label="Check-Out" value={quote.dates.jeddahCheckOut} onPress={() => setActiveDatePicker('jeddahCheckOut')} />
                 </View>
              </View>
            </View>
          </View>

          <View style={styles.card}>
            <SectionHeader title="الغرف والإعاشة" icon="grid" />
            <Text style={styles.infoText}>Saisissez le nombre de chambres. Le prix affiché est celui de l'hôtel uniquement.</Text>
            <RoomInput label="Single (1)" qty={quote.quantities.single} price={quote.prices.single} onChange={v => updateQuantity('single', v)} />
            <RoomInput label="Double (2)" qty={quote.quantities.double} price={quote.prices.double} onChange={v => updateQuantity('double', v)} />
            <RoomInput label="Triple (3)" qty={quote.quantities.triple} price={quote.prices.triple} onChange={v => updateQuantity('triple', v)} />
            <RoomInput label="Quad (4)" qty={quote.quantities.quad} price={quote.prices.quad} onChange={v => updateQuantity('quad', v)} />
            <View style={styles.divider} />
            <Text style={styles.label}>Repas (الإعاشة)</Text>
            <View style={styles.mealsContainer}>
              {tripOptions.meals.length > 0 ? tripOptions.meals.map(m => (
                <MealChip key={m._id} label={`${m.label} (${m.price}DA)`} active={quote.meals.includes(m.label)} onPress={() => toggleMeal(m.label)} />
              )) : <Text style={{color:'#666'}}>Ajouter options dans Admin</Text>}
            </View>
          </View>

          <View style={[styles.card, {borderColor: '#F3C764', borderWidth:1}]}>
            <SectionHeader title="المدفوعات (Paiement)" icon="dollar-sign" />
            <View style={styles.rowReverse}>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <InputField label="المبلغ المدفوع (Avance)" value={quote.advanceAmount} onChangeText={t => setQuote({...quote, advanceAmount: t})} keyboardType="numeric" placeholder="0" />
              </View>
              <View style={{ flex: 1 }}>
                 <View style={{ marginBottom: 12, width: '100%' }}>
                    <Text style={styles.label}>المتبقي (Reste)</Text>
                    <View style={[styles.input, {backgroundColor: '#F3C764', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center'}]}>
                        <Text style={{color: '#050B14', fontWeight: 'bold', textAlign: 'center', flex: 1}}>{quote.remainingAmount} DA</Text>
                    </View>
                 </View>
              </View>
            </View>
            <TouchableOpacity style={styles.receiptBtn} onPress={generateReceipt}>
               <Feather name="printer" size={16} color="#050B14" />
               <Text style={styles.receiptBtnText}>طباعة وصل استلام (Reçu)</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.card}>
            <InputField label="ملاحظات (Notes)" value={quote.notes} onChangeText={t => setQuote({...quote, notes: t})} multiline />
          </View>

          <View style={styles.stickyFooter}>
            <View>
              <Text style={styles.footerLabel}>TOTAL PACKAGE</Text>
              <Text style={styles.footerAmount}>{quote.totalAmount} DA</Text>
            </View>
            <TouchableOpacity style={styles.saveBtn} onPress={save}>
              <Text style={styles.saveText}>ENREGISTRER</Text>
              <Feather name="check" size={20} color="#050B14" />
            </TouchableOpacity>
          </View>

        </ScrollView>

        {/* MODALS */}
        <Modal visible={hotelModalVisible} animationType="slide" transparent={true}><View style={styles.modalOverlay}><View style={styles.modalContent}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Sélection Hôtel ({targetCityForHotel})</Text><TouchableOpacity onPress={() => setHotelModalVisible(false)}><Feather name="x" size={24} color="#FFF" /></TouchableOpacity></View><FlatList data={hotels.filter(h => h.city === targetCityForHotel)} keyExtractor={item => item.id} renderItem={({ item }) => (<TouchableOpacity style={styles.hotelItem} onPress={() => { if (targetCityForHotel === 'Makkah') setQuote(prev => ({ ...prev, hotelMakkah: item.name })); else if (targetCityForHotel === 'Medina') setQuote(prev => ({ ...prev, hotelMedina: item.name })); else if (targetCityForHotel === 'Jeddah') setQuote(prev => ({ ...prev, hotelJeddah: item.name })); setHotelModalVisible(false); }}><Text style={styles.hotelItemName}>{item.name}</Text><Feather name="chevron-left" size={20} color="#F3C764" /></TouchableOpacity>)} /></View></View></Modal>
        <Modal visible={genericModalVisible} animationType="slide" transparent={true}><View style={styles.modalOverlay}><View style={styles.modalContent}><View style={styles.modalHeader}><Text style={styles.modalTitle}>Sélection</Text><TouchableOpacity onPress={() => setGenericModalVisible(false)}><Feather name="x" size={24} color="#FFF" /></TouchableOpacity></View><FlatList data={targetFieldForGeneric === 'destination' ? tripOptions.destinations : targetFieldForGeneric === 'period' ? tripOptions.periods : tripOptions.transports} keyExtractor={item => item._id} renderItem={({ item }) => (<TouchableOpacity style={styles.hotelItem} onPress={() => { setQuote(prev => ({ ...prev, [targetFieldForGeneric]: item.label })); setGenericModalVisible(false); }}><Text style={styles.hotelItemName}>{item.label}</Text><Feather name="check" size={20} color={quote[targetFieldForGeneric] === item.label ? "#F3C764" : "transparent"} /></TouchableOpacity>)} /></View></View></Modal>
        {activeDatePicker && <DateTimePicker value={parseDateString(quote.dates?.[activeDatePicker])} mode="date" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onDateChange} textColor="#FFF" />}

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// --- UI COMPONENTS CORRIGÉS (MULTI-LIGNES) ---
const SectionHeader = ({ title, icon }) => (
  <View style={styles.sectionHeader}>
    <Text style={styles.sectionTitle}>{title}</Text>
    <Feather name={icon} size={18} color="#F3C764" style={{ marginLeft: 8 }} />
  </View>
);

const RoomInput = ({ label, qty, price, onChange }) => (
  <View style={{ marginBottom: 10 }}>
    <View style={{ flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' }}>
      <Text style={{ color: '#FFF', fontSize: 14, width: 80, textAlign: 'right' }}>{label}</Text>
      <TextInput 
        value={String(qty || '')} 
        onChangeText={onChange} 
        keyboardType="numeric" 
        style={styles.qtyInput} 
        placeholder="0" 
        placeholderTextColor="#555" 
      />
      <Text style={{ color: '#F3C764', fontSize: 12, width: 100, textAlign: 'left' }}>
        {price && price !== '0' ? `${price} DA` : '-'}
      </Text>
    </View>
  </View>
);

const InputField = ({ label, value, onChangeText, placeholder, keyboardType, multiline }) => (
  <View style={{ marginBottom: 12, width: '100%' }}>
    <Text style={styles.label}>{label}</Text>
    <TextInput 
      value={String(value || '')} 
      onChangeText={onChangeText} 
      style={[styles.input, multiline && {height: 80, textAlignVertical: 'top'}]} 
      placeholder={placeholder} 
      placeholderTextColor="#444" 
      textAlign="right" 
      keyboardType={keyboardType}
      multiline={multiline}
    />
  </View>
);

const SelectField = ({ label, value, onPress, placeholder }) => (
  <View style={{ marginBottom: 12, width: '100%' }}>
    <Text style={styles.label}>{label}</Text>
    <TouchableOpacity onPress={onPress} style={styles.hotelSelectBtn}>
      <Text style={[styles.hotelSelectText, !value && { color: 'rgba(255,255,255,0.3)' }]}>
        {value || placeholder}
      </Text>
      <Feather name="chevron-down" size={18} color="#F3C764" />
    </TouchableOpacity>
  </View>
);

const DateButton = ({ label, value, onPress }) => (
  <View style={{ marginBottom: 12 }}>
    <Text style={styles.label}>{label}</Text>
    <TouchableOpacity onPress={onPress} style={styles.dateBtn}>
      <Text style={[styles.dateBtnText, !value && { color: 'rgba(255,255,255,0.2)' }]}>
        {value || 'JJ/MM/AAAA'}
      </Text>
      <Feather name="calendar" size={14} color="#F3C764" />
    </TouchableOpacity>
  </View>
);

const MealChip = ({ label, active, onPress }) => (
  <TouchableOpacity onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
    <Text style={[styles.chipText, active && {color: '#050B14', fontWeight:'bold'}]}>{label}</Text>
  </TouchableOpacity>
);

const SmallChip = ({ label, active, onPress }) => (
  <TouchableOpacity onPress={onPress} style={[styles.smallChip, active && {backgroundColor: '#F3C764', borderColor: '#F3C764'}]}>
    <Text style={[styles.smallChipText, active && {color: '#050B14'}]}>{label}</Text>
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050B14', paddingTop: Platform.OS === "android" ? StatusBar.currentHeight : 0 },
  header: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', padding: 20, backgroundColor: '#050B14', borderBottomWidth: 1, borderColor: '#222' },
  headerTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  headerSub: { color: '#F3C764', fontSize: 12 },
  backButton: { padding: 5 },
  scrollContent: { padding: 15, paddingBottom: 150 },
  card: { backgroundColor: '#101A2D', borderRadius: 12, padding: 15, marginBottom: 15, borderWidth: 1, borderColor: '#222' },
  statusContainer: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginBottom: 15, gap: 10 },
  statusBtn: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, borderColor: '#444', alignItems: 'center' },
  statusConfirmed: { backgroundColor: '#2ECC71', borderColor: '#2ECC71' },
  statusPending: { backgroundColor: '#F39C12', borderColor: '#F39C12' },
  statusCancelled: { backgroundColor: '#E74C3C', borderColor: '#E74C3C' },
  statusText: { color: '#888', fontSize: 12, fontWeight: 'bold' },
  label: { color: '#888', fontSize: 12, marginBottom: 5, textAlign: 'right' },
  input: { backgroundColor: '#09121F', color: '#FFF', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#333', fontSize: 14 },
  selectBtn: { backgroundColor: '#09121F', borderRadius: 8, padding: 12, borderWidth: 1, borderColor: '#333', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  qtyInput: { backgroundColor: '#09121F', color: '#FFF', borderRadius: 8, padding: 8, width: 60, textAlign: 'center', borderWidth: 1, borderColor: '#333' },
  rowReverse: { flexDirection: 'row-reverse' },
  passportBox: { width: 80, height: 80, borderRadius: 10, borderStyle: 'dashed', borderWidth: 1, borderColor: '#F3C764', alignItems: 'center', justifyContent: 'center', marginLeft: 10 },
  passportImg: { width: '100%', height: '100%', borderRadius: 10 },
  passportPlaceholder: { alignItems: 'center' },
  passportText: { color: '#F3C764', fontSize: 10, textAlign: 'center', marginTop: 4 },
  mealsContainer: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: 8 },
  chip: { paddingVertical: 8, paddingHorizontal: 12, borderRadius: 20, borderWidth: 1, borderColor: '#444' },
  chipActive: { backgroundColor: '#F3C764', borderColor: '#F3C764' },
  chipText: { color: '#CCC', fontSize: 12 },
  smallChip: { paddingVertical: 6, paddingHorizontal: 10, borderRadius: 6, borderWidth: 1, borderColor: '#333', marginRight: 8 },
  smallChipText: { color: '#AAA', fontSize: 11 },
  hotelBlock: { marginBottom: 15, paddingBottom: 15, borderBottomWidth: 1, borderBottomColor: '#222' },
  cityTitle: { color: '#FFF', fontSize: 14, fontWeight: 'bold', marginBottom: 8, textAlign: 'right' },
  infoText: { color: '#666', fontSize: 11, textAlign: 'right', marginBottom: 10, fontStyle: 'italic' },
  divider: { height: 1, backgroundColor: '#333', marginVertical: 15 },
  stickyFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: '#101A2D', padding: 20, borderTopWidth: 1, borderTopColor: '#F3C764', flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  footerLabel: { color: '#888', fontSize: 12 },
  footerAmount: { color: '#FFF', fontSize: 24, fontWeight: 'bold' },
  saveBtn: { backgroundColor: '#F3C764', flexDirection: 'row-reverse', paddingHorizontal: 20, paddingVertical: 12, borderRadius: 10, alignItems: 'center', gap: 8 },
  saveText: { color: '#050B14', fontWeight: 'bold' },
  hotelSelectBtn: { backgroundColor: '#050B14', padding: 12, borderRadius: 10, borderWidth: 1, borderColor: '#F3C764', marginBottom: 15, flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  hotelSelectText: { color: '#FFF', fontSize: 15, fontWeight: '600' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' },
  modalContent: { backgroundColor: '#101A2D', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: '70%' },
  modalHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  modalTitle: { color: '#FFF', fontSize: 18, fontWeight: 'bold' },
  hotelItem: { padding: 15, borderBottomWidth: 1, borderColor: '#333', flexDirection: 'row-reverse', justifyContent: 'space-between' },
  hotelItemName: { color: '#FFF', fontSize: 16, textAlign: 'right' },
  hotelItemSub: { color: '#8A95A5', fontSize: 13, marginTop: 4, textAlign: 'right' },
  creatorBadge: { flexDirection: 'row-reverse', alignItems: 'center', backgroundColor: '#F3C764', alignSelf: 'flex-end', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 10, marginBottom: 10 },
  creatorText: { color: '#050B14', fontSize: 12, fontWeight: 'bold', marginLeft: 5 },
  sectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', marginBottom: 16, borderBottomWidth: 1, borderBottomColor: 'rgba(243, 199, 100, 0.1)', paddingBottom: 8 },
  sectionTitle: { color: '#F3C764', fontSize: 16, fontWeight: '600', marginRight: 10 },
  // Nouveau Style pour le bouton Reçu
  receiptBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: '#E67E22', padding: 10, borderRadius: 8, marginTop: 10, alignSelf: 'center' },
  receiptBtnText: { color: '#050B14', fontSize: 12, fontWeight: 'bold', marginLeft: 8 }
});