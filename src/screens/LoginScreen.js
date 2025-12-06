import React, { useState } from 'react';
import { 
  View, Text, TextInput, TouchableOpacity, StyleSheet, 
  SafeAreaView, StatusBar, Alert, ActivityIndicator, 
  KeyboardAvoidingView, Platform
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import api from '../utils/api';

export default function LoginScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!username || !password) {
      Alert.alert('Erreur', 'Champs obligatoires');
      return;
    }

    setLoading(true);
    try {
      const response = await api.login(username, password);
      
      navigation.replace('AdminMenu', { 
        userRole: response.role, 
        username: response.username 
      }); 
      
    } catch (error) {
      Alert.alert('Accès refusé', 'Nom d\'utilisateur ou mot de passe incorrect.');
    } finally {
      setLoading(false);
    }
  };

  // Fonction de secours pour créer le premier admin
  const handleSeed = async () => {
    try {
      const msg = await api.seed();
      Alert.alert('Initialisation', msg);
      // Pré-remplit les champs pour faciliter la vie
      setUsername('admin');
      setPassword('123');
    } catch (e) {
      Alert.alert('Erreur', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#050B14" />
      
    

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.content}>
        
        <View style={styles.logoContainer}>
          <View style={styles.iconCircle}>
            <Feather name="shield" size={40} color="#F3C764" />
          </View>
          <Text style={styles.title}>Espace Sécurisé</Text>
          <Text style={styles.subtitle}>المنطقة الإدارية</Text>
        </View>

        <View style={styles.form}>
          <View style={styles.inputContainer}>
            <TextInput 
              style={styles.input}
              placeholder="Nom d'utilisateur"
              placeholderTextColor="#556"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              textAlign="right"
            />
            <Feather name="user" size={20} color="#8A95A5" style={styles.inputIcon} />
          </View>

          <View style={styles.inputContainer}>
            <TextInput 
              style={styles.input}
              placeholder="Mot de passe"
              placeholderTextColor="#556"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textAlign="right"
            />
            <Feather name="lock" size={20} color="#8A95A5" style={styles.inputIcon} />
          </View>

          <TouchableOpacity style={styles.loginBtn} onPress={handleLogin} disabled={loading}>
            {loading ? (
              <ActivityIndicator color="#050B14" />
            ) : (
              <Text style={styles.loginBtnText}>Connexion</Text>
            )}
          </TouchableOpacity>
        </View>
        
        {/* BOUTON DE SECOURS POUR CRÉER L'ADMIN */}
        <TouchableOpacity onPress={handleSeed} style={{marginTop: 40}}>
          <Text style={{color: '#666', fontSize: 12, textDecorationLine: 'underline'}}>Initialiser Admin (Première fois)</Text>
        </TouchableOpacity>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#050B14', paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight : 0 },
  header: { padding: 20, alignItems: 'flex-end' },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 12 },
  content: { flex: 1, padding: 24, justifyContent: 'center', marginTop: -50 },
  logoContainer: { alignItems: 'center', marginBottom: 50 },
  iconCircle: { width: 80, height: 80, borderRadius: 40, backgroundColor: 'rgba(243, 199, 100, 0.1)', justifyContent: 'center', alignItems: 'center', marginBottom: 20, borderWidth: 1, borderColor: '#F3C764' },
  title: { fontSize: 28, fontWeight: 'bold', color: '#FFF', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#8A95A5' },
  form: { width: '100%' },
  inputContainer: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#101A2D', borderRadius: 16, marginBottom: 16, paddingHorizontal: 16, height: 60, borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)' },
  inputIcon: { marginLeft: 12 },
  input: { flex: 1, color: '#FFF', fontSize: 16 },
  loginBtn: { backgroundColor: '#F3C764', width: '100%', height: 60, borderRadius: 16, justifyContent: 'center', alignItems: 'center', marginTop: 24, shadowColor: '#F3C764', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 },
  loginBtnText: { color: '#050B14', fontSize: 18, fontWeight: 'bold' }
});