import React from 'react';
import { 
  View, 
  Text, 
  TouchableOpacity, 
  StyleSheet, 
  Platform, 
  StatusBar, 
  SafeAreaView 
} from 'react-native';
import { Feather } from '@expo/vector-icons'; 

export default function HomeScreen({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#050B14" />
      
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.title}>لوحة التحكم</Text> 
          <Text style={styles.subtitle}>إدارة مشاريعك وعملائك بسهولة</Text>
        </View>

        <TouchableOpacity 
          style={styles.button} 
          onPress={() => navigation.navigate('AddEdit')}
          activeOpacity={0.8}
        >
          <View style={styles.iconContainer}>
            <Feather name="plus-circle" size={24} color="#050B14" />
          </View>
          <Text style={styles.buttonText}>إنشاء عرض سعر جديد</Text>
        </TouchableOpacity>

        <TouchableOpacity 
          style={[styles.button, styles.buttonSecondary]} 
          onPress={() => navigation.navigate('List')}
          activeOpacity={0.8}
        >
          <View style={styles.iconContainer}>
            <Feather name="list" size={24} color="#050B14" />
          </View>
          <Text style={styles.buttonText}>قائمة عروض الأسعار</Text>
        </TouchableOpacity>

        {/* Bouton Admin Discret & Sécurisé */}
        {/* Redirige vers 'Login' qui redirigera ensuite vers 'AdminMenu' */}
        <TouchableOpacity 
          onPress={() => navigation.navigate('Login')}
          style={styles.adminLink}
          activeOpacity={0.6}
        >
          <Feather name="lock" size={12} color="rgba(255,255,255,0.3)" style={{marginRight: 6}} />
          <Text style={styles.adminText}>Accès Administration</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#050B14',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    paddingTop: 60,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
    marginBottom: 60,
  },
  title: {
    color: '#F3C764',
    fontSize: 40,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'center',
    textShadowColor: 'rgba(243, 199, 100, 0.25)',
    textShadowOffset: { width: 0, height: 4 },
    textShadowRadius: 10,
  },
  subtitle: {
    color: '#8A95A5',
    fontSize: 16,
    textAlign: 'center',
    fontWeight: '500',
  },
  button: {
    width: '100%',
    backgroundColor: '#F3C764',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
    marginTop: 20,
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#F3C764',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },
  buttonSecondary: {
    backgroundColor: '#FFF',
    shadowColor: '#FFF',
  },
  iconContainer: {
    marginLeft: 12,
  },
  buttonText: {
    color: '#050B14',
    textAlign: 'center',
    fontSize: 18,
    fontWeight: '700',
  },
  // Style "Discret" pour l'admin
  adminLink: {
    marginTop: 60,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    opacity: 0.8,
  },
  adminText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 12,
    fontWeight: '500',
    letterSpacing: 0.5,
  }
});