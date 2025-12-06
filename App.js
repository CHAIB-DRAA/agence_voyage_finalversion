import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

// --- IMPORTS DES ÉCRANS ---
// Partie Client (Vendeurs)
import HomeScreen from './src/screens/HomeScreen';
import AddEditQuote from './src/screens/AddEditQuote';
import QuotesList from './src/screens/QuotesList';
import QuoteDetails from './src/screens/QuoteDetails';

// Partie Admin (Back-office)
import LoginScreen from './src/screens/LoginScreen';
import AdminDashboard from './src/screens/AdminDashboard'; // Menu principal Admin
import AdminHotels from './src/screens/AdminHotels';       // Gestion Hôtels
import AdminSettings from './src/screens/AdminSettings';   // Gestion Paramètres
import AdminUsers from './src/screens/AdminUsers';         // Gestion Utilisateurs

const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator 
        initialRouteName="Login"
        screenOptions={{
          headerShown: false,
          animation: 'slide_from_right'
        }}
      >
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="AddEdit" component={AddEditQuote} />
        <Stack.Screen name="List" component={QuotesList} />
        <Stack.Screen name="Details" component={QuoteDetails} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="AdminMenu" component={AdminDashboard} />
        <Stack.Screen name="AdminHotels" component={AdminHotels} />
        <Stack.Screen name="AdminSettings" component={AdminSettings} />
        <Stack.Screen name="AdminUsers" component={AdminUsers} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}