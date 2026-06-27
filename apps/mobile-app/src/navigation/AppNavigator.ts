import React, { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text } from 'react-native';
import { useAuthStore } from '../store/authStore';
import { LoginScreen } from '../screens/LoginScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { TransactionsScreen } from '../screens/TransactionsScreen';
import { CampaignsScreen } from '../screens/CampaignsScreen';
import { ReservationsScreen } from '../screens/ReservationsScreen';
import { PointsScreen } from '../screens/PointsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

const TAB_ICONS: Record<string, string> = {
  Home: '🏠',
  Orders: '🧾',
  Offers: '🎁',
  Reserve: '🍽️',
  Profile: '👤',
};

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: () => (
          <Text style={{ fontSize: 20 }}>{TAB_ICONS[route.name] ?? '●'}</Text>
        ),
        tabBarActiveTintColor: '#2563eb',
        tabBarInactiveTintColor: '#94a3b8',
        tabBarStyle: { paddingBottom: 4, height: 60 },
        headerStyle: { backgroundColor: '#fff', shadowColor: 'transparent' },
        headerTitleStyle: { fontWeight: '700', fontSize: 18, color: '#0f172a' },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreenWrapper} options={{ title: 'Dashboard' }} />
      <Tab.Screen name="Orders" component={TransactionsScreen} options={{ title: 'My Orders' }} />
      <Tab.Screen name="Offers" component={CampaignsScreen} options={{ title: 'Offers' }} />
      <Tab.Screen name="Reserve" component={ReservationsScreen} options={{ title: 'Reservations' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}

// HomeScreen needs navigation helper – wrap it to pass tab navigation
function HomeScreenWrapper({ navigation }: any) {
  const navigate = (screen: string) => {
    const map: Record<string, string> = {
      Transactions: 'Orders',
      Campaigns: 'Offers',
      Reservations: 'Reserve',
      Points: 'Home', // Points is shown on home via PointsScreen – navigate to it inline
    };
    navigation.navigate(map[screen] ?? screen);
  };
  return <HomeScreen onNavigate={navigate} />;
}

export function AppNavigator() {
  const { isAuthenticated, isLoading, initialize } = useAuthStore();

  useEffect(() => {
    initialize();
  }, []);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainTabs} />
        ) : (
          <Stack.Screen name="Login" component={LoginScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#eff6ff',
  },
});