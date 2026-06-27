import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { useAuthStore } from '../store/authStore';
import { LoyaltyTier } from '../types';

const TIER_COLORS: Record<LoyaltyTier, { bg: string; text: string; label: string }> = {
  Bronze: { bg: '#fef3c7', text: '#b45309', label: '[emoji — medal-style icon, exact glyph not certain from photo]' },
  Silver: { bg: '#f1f5f9', text: '#475569', label: '[emoji — medal-style icon, exact glyph not certain from photo]' },
  Gold: { bg: '#fefce8', text: '#ca8a04', label: '[emoji — medal-style icon, exact glyph not certain from photo]' },
  Platinum: { bg: '#f5f3ff', text: '#7c3aed', label: '[emoji — gem-style icon, exact glyph not certain from photo]' },
};

const TIER_NEXT_THRESHOLD: Record<LoyaltyTier, number | null> = {
  Bronze: 500,
  Silver: 2000,
  Gold: 5000,
  Platinum: null,
};

interface HomeScreenProps {
  onNavigate: (screen: string) => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({ onNavigate }) => {
  const { user, refreshProfile } = useAuthStore();
  const [refreshing, setRefreshing] = React.useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshProfile();
    } finally {
      setRefreshing(false);
    }
  };

  if (!user) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }
  // file continues — photo cuts off here