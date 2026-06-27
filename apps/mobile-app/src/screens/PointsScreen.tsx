import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { loyaltyAPI } from '../api/loyalty';
import { PointsHistory } from '../types';
import { useAuthStore } from '../store/authStore';
import { formatDistanceToNow } from 'date-fns';

const TYPE_STYLE: Record<string, { color: string; sign: string; icon: string }> = {
  earned: { color: '#16a34a', sign: '+', icon: '✅' },
  redeemed: { color: '#2563eb', sign: '-', icon: '🎁' },
  expired: { color: '#dc2626', sign: '-', icon: '⏰' },
  bonus: { color: '#9333ea', sign: '+', icon: '⭐' },
};

export const PointsScreen: React.FC = () => {
  const { user } = useAuthStore();
  const [history, setHistory] = useState<PointsHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await loyaltyAPI.getPointsHistory();
      setHistory(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);
  const onRefresh = () => { setRefreshing(true); load(); };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <FlatList
      data={history}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListHeaderComponent={
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Current Balance</Text>
          <Text style={styles.balanceValue}>
            {user?.loyaltyPoints.toLocaleString() ?? '−'} pts
          </Text>
          <Text style={styles.balanceTier}>{user?.loyaltyTier} Member</Text>
        </View>
      }
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyText}>No points history yet</Text>
        </View>
      }
      renderItem={({ item }) => {
        const style = TYPE_STYLE[item.type] ?? { color: '#374151', sign: '', icon: '📌' };
        return (
          <View style={styles.row}>
            <Text style={styles.rowIcon}>{style.icon}</Text>
            <View style={styles.rowContent}>
              <Text style={styles.rowDesc}>{item.description}</Text>
              <Text style={styles.rowDate}>
                {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
              </Text>
            </View>
            <Text style={[styles.rowPoints, { color: style.color }]}>
              {style.sign}{item.points}
            </Text>
          </View>
        );
      }}
    />
  );
};

const styles = StyleSheet.create({
  list: {
    padding: 16,
    gap: 8,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: { color: '#94a3b8', fontSize: 16 },
  balanceCard: {
    backgroundColor: '#2563eb',
    borderRadius: 20,
    padding: 24,
    alignItems: 'center',
    marginBottom: 8,
    gap: 4,
  },
  balanceLabel: {
    color: '#bfdbfe',
    fontSize: 14,
    fontWeight: '500',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  balanceValue: {
    color: '#fff',
    fontSize: 44,
    fontWeight: '800',
  },
  balanceTier: {
    color: '#bfdbfe',
    fontSize: 14,
    fontWeight: '500',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 14,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    elevation: 1,
  },
  rowIcon: { fontSize: 20 },
  rowContent: { flex: 1, gap: 2 },
  rowDesc: {
    fontSize: 14,
    fontWeight: '500',
    color: '#0f172a',
  },
  rowDate: {
    fontSize: 12,
    color: '#94a3b8',
  },
  rowPoints: {
    fontSize: 16,
    fontWeight: '700',
  },
});