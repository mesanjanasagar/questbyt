import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { loyaltyAPI } from '../api/loyalty';
import { Campaign } from '../types';
import { formatDistanceToNow, isPast } from 'date-fns';

export const CampaignsScreen: React.FC = () => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  const load = async () => {
    try {
      const data = await loyaltyAPI.getCampaigns();
      setCampaigns(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  const onRefresh = () => { setRefreshing(true); load(); };

  const handleRedeem = async (campaign: Campaign) => {
    if (campaign.redeemed) return;
    Alert.alert(
      'Redeem Offer',
      `Redeem "${campaign.name}"? This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redeem',
          onPress: async () => {
            setRedeeming(campaign.id);
            try {
              await loyaltyAPI.redeemOffer(campaign.id);
              setCampaigns((prev) =>
                prev.map((c) => (c.id === campaign.id ? { ...c, redeemed: true } : c))
              );
            } catch {
              Alert.alert('Error', 'Failed to redeem offer. Please try again.');
            } finally {
              setRedeeming(null);
            }
          },
        },
      ]
    );
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
      data={campaigns}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={
        <View style={styles.center}>
          <Text style={styles.emptyIcon}>🎁</Text>
          <Text style={styles.emptyText}>No offers right now</Text>
          <Text style={styles.emptySubtext}>Check back later for exclusive deals</Text>
        </View>
      }
      renderItem={({ item }) => {
        const expired = item.expiresAt ? isPast(new Date(item.expiresAt)) : false;
        const isRedeeming = redeeming === item.id;
        return (
          <View style={[styles.card, (item.redeemed || expired) && styles.cardMuted]}>
            <View style={styles.cardTop}>
              <View style={styles.iconBox}>
                <Text style={styles.icon}>
                  {item.channel === 'sms' ? '💬' : item.channel === 'email' ? '✉️' : '🔔'}
                </Text>
              </View>
              <View style={styles.cardContent}>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.message} numberOfLines={2}>{item.message}</Text>
              </View>
            </View>

            <View style={styles.footer}>
              <Text style={styles.date}>
                {formatDistanceToNow(new Date(item.sentAt), { addSuffix: true })}
                {item.expiresAt && !expired && (
                  ` • Expires ${formatDistanceToNow(new Date(item.expiresAt), { addSuffix: true })}`
                )}
                {expired && ' • Expired'}
              </Text>

              {!item.redeemed && !expired ? (
                <TouchableOpacity
                  style={styles.redeemBtn}
                  onPress={() => handleRedeem(item)}
                  disabled={isRedeeming}
                >
                  {isRedeeming ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.redeemText}>Redeem</Text>
                  )}
                </TouchableOpacity>
              ) : (
                <View style={[styles.redeemBtn, styles.redeemBtnMuted]}>
                  <Text style={styles.redeemTextMuted}>
                    {item.redeemed ? 'Redeemed ✓' : 'Expired'}
                  </Text>
                </View>
              )}
            </View>
          </View>
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
    gap: 8,
  },
  emptyIcon: { fontSize: 48 },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#374151',
  },
  emptySubtext: {
    fontSize: 14,
    color: '#94a3b8',
    textAlign: 'center',
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardMuted: {
    opacity: 0.6,
  },
  cardTop: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
  },
  iconBox: {
    width: 44,
    height: 44,
    backgroundColor: '#eff6ff',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  icon: { fontSize: 22 },
  cardContent: {
    flex: 1,
    gap: 4,
  },
  name: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  message: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    paddingTop: 10,
  },
  date: {
    fontSize: 12,
    color: '#94a3b8',
    flex: 1,
  },
  redeemBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 7,
    minWidth: 80,
    alignItems: 'center',
  },
  redeemBtnMuted: {
    backgroundColor: '#e2e8f0',
  },
  redeemText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
  },
  redeemTextMuted: {
    color: '#94a3b8',
    fontWeight: '600',
    fontSize: 13,
  },
});