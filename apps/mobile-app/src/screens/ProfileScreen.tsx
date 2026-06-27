import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useAuthStore } from '../store/authStore';

export const ProfileScreen: React.FC = () => {
  const { user, logout } = useAuthStore();

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: logout,
        },
      ]
    );
  };

  if (!user) return null;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{user.name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={styles.name}>{user.name}</Text>
        <Text style={styles.contact}>{user.email ?? user.phone ?? '—'}</Text>
      </View>

      {/* Info Cards */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account Details</Text>
        {[
          { label: 'Member ID', value: user.id.slice(0, 8).toUpperCase() },
          { label: 'Loyalty Tier', value: user.loyaltyTier },
          { label: 'Segment', value: user.segment },
          { label: 'Total Spend', value: `$${user.totalSpend.toFixed(2)}` },
        ].map((row) => (
          <View key={row.label} style={styles.infoRow}>
            <Text style={styles.infoLabel}>{row.label}</Text>
            <Text style={styles.infoValue}>{row.value}</Text>
          </View>
        ))}
      </View>

      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 20,
    gap: 24,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2563eb',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: 36,
    fontWeight: '700',
    color: '#fff',
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0f172a',
  },
  contact: {
    fontSize: 14,
    color: '#64748b',
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 4,
    elevation: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  infoLabel: {
    fontSize: 14,
    color: '#64748b',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#0f172a',
  },
  logoutBtn: {
    backgroundColor: '#fee2e2',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
  },
  logoutText: {
    color: '#dc2626',
    fontWeight: '700',
    fontSize: 16,
  },
});