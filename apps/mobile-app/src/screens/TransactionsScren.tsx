import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { loyaltyAPI } from '../api/loyalty';
import { Transaction } from '../types';
import { formatDistanceToNow } from 'date-fns';

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  completed: { bg: '#dcfce7', text: '#16a34a' },
  cancelled: { bg: '#fee2e2', text: '#dc2626' },
  refunded: { bg: '#fef9c3', text: '#ca8a04' },
};

export const TransactionsScreen: React.FC = () => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async (p = 1, refresh = false) => {
    try {
      const result = await loyaltyAPI.getTransactions(p);
      setTransactions((prev) => (refresh || p === 1 ? result.data : [...prev, ...result.data]));
      setTotal(result.total);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load(1);
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    setPage(1);
    load(1, true);
  };

  const loadMore = () => {
    if (transactions.length < total) {
      const next = page + 1;
      setPage(next);
      load(next);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2563eb" />
      </View>
    );
  }

  return (
    <FlatList
      data={transactions}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      onEndReached={loadMore}
      onEndReachedThreshold={0.3}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyText}>No orders yet</Text>
        </View>
      }
      renderItem={({ item }) => {
        const isOpen = expanded === item.id;
        const status = STATUS_STYLE[item.status] ?? { bg: '#f1f5f9', text: '#475569' };
        return (
          <TouchableOpacity
            style={styles.card}
            onPress={() => setExpanded(isOpen ? null : item.id)}
            activeOpacity={0.7}
          >
            <View style={styles.cardHeader}>
              <View>
                <Text style={styles.orderNum}>Order #{item.orderNumber}</Text>
                <Text style={styles.date}>
                  {formatDistanceToNow(new Date(item.createdAt), { addSuffix: true })}
                </Text>
              </View>
              <View style={styles.right}>
                <Text style={styles.amount}>${item.totalAmount.toFixed(2)}</Text>
                <View style={[styles.badge, { backgroundColor: status.bg }]}>
                  <Text style={[styles.badgeText, { color: status.text }]}>{item.status}</Text>
                </View>
              </View>
            </View>

            {item.status === 'completed' && (
              <View style={styles.points}>
                <Text style={styles.pointsText}>+{item.pointsEarned} pts earned</Text>
              </View>
            )}

            {isOpen && (
              <View style={styles.items}>
                {item.items.map((i, idx) => (
                  <View key={idx} style={styles.item}>
                    <Text style={styles.itemName}>{i.name} x{i.quantity}</Text>
                    <Text style={styles.itemPrice}>${(i.price * i.quantity).toFixed(2)}</Text>
                  </View>
                ))}
              </View>
            )}
          </TouchableOpacity>
        );
      }}
    />
  );
};

const styles = StyleSheet.create({
  list: {
    padding: 16,
    gap: 12,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyText: {
    color: '#94a3b8',
    fontSize: 16,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    gap: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  orderNum: {
    fontWeight: '700',
    fontSize: 15,
    color: '#0f172a',
  },
  date: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  right: {
    alignItems: 'flex-end',
    gap: 4,
  },
  amount: {
    fontWeight: '700',
    fontSize: 16,
    color: '#0f172a',
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  points: {
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  pointsText: {
    fontSize: 12,
    color: '#2563eb',
    fontWeight: '600',
  },
  items: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 8,
    gap: 6,
  },
  item: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  itemName: {
    fontSize: 13,
    color: '#374151',
  },
  itemPrice: {
    fontSize: 13,
    color: '#374151',
    fontWeight: '500',
  },
});