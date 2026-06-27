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
  Modal,
  TextInput,
  Platform,
} from 'react-native';
import { loyaltyAPI } from '../api/loyalty';
import { Reservation } from '../types';
import { format, parseISO } from 'date-fns';

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  pending: { bg: '#fef9c3', text: '#ca8a04' },
  confirmed: { bg: '#dbeafe', text: '#1d4ed8' },
  arrived: { bg: '#dcfce7', text: '#16a34a' },
  seated: { bg: '#f0fdf4', text: '#15803d' },
  cancelled: { bg: '#fee2e2', text: '#dc2626' },
};

const STORE_ID = 'default-store'; // would come from config in production

export const ReservationsScreen: React.FC = () => {
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    time: '19:00',
    partySize: '2',
    notes: '',
  });

  const load = async () => {
    try {
      const data = await loyaltyAPI.getReservations();
      setReservations(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);
  const onRefresh = () => { setRefreshing(true); load(); };

  const handleCreate = async () => {
    const partySize = parseInt(form.partySize, 10);
    if (!form.date || !form.time || isNaN(partySize) || partySize < 1) {
      Alert.alert('Error', 'Please fill in all required fields with valid values');
      return;
    }
    setCreating(true);
    try {
      const res = await loyaltyAPI.createReservation({
        date: form.date,
        time: form.time,
        partySize,
        notes: form.notes || undefined,
        storeId: STORE_ID,
      });
      setReservations((prev) => [res, ...prev]);
      setShowCreate(false);
      setForm({ date: format(new Date(), 'yyyy-MM-dd'), time: '19:00', partySize: '2', notes: '' });
    } catch {
      Alert.alert('Error', 'Failed to create reservation. The time slot may be unavailable.');
    } finally {
      setCreating(false);
    }
  };

  const handleCancel = (reservation: Reservation) => {
    Alert.alert(
      'Cancel Reservation',
      'Are you sure you want to cancel this reservation?',
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Cancel Reservation',
          style: 'destructive',
          onPress: async () => {
            try {
              await loyaltyAPI.cancelReservation(reservation.id, 'Customer cancelled via app');
              setReservations((prev) =>
                prev.map((r) => (r.id === reservation.id ? { ...r, status: 'cancelled' } : r))
              );
            } catch {
              Alert.alert('Error', 'Failed to cancel reservation');
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
    <>
      <FlatList
        data={reservations}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListHeaderComponent={
          <TouchableOpacity style={styles.createBtn} onPress={() => setShowCreate(true)}>
            <Text style={styles.createBtnText}>+ New Reservation</Text>
          </TouchableOpacity>
        }
        ListEmptyComponent={
          <View style={styles.center}>
            <Text style={styles.emptyIcon}>[emoji not clearly legible in photo]</Text>
            <Text style={styles.emptyText}>No reservations yet</Text>
          </View>
        }
        renderItem={({ item }) => {
          const status = STATUS_STYLE[item.status] ?? { bg: '#f1f5f9', text: '#475569' };
          const canCancel = ['pending', 'confirmed'].includes(item.status);
          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.date}>
                    {format(parseISO(item.reservedDate), 'EEEE, MMMM d')}
                  </Text>
                  <Text style={styles.time}>{item.reservedTime.slice(0, 5)} • Party of {item.partySize}</Text>
                  {item.tableNumber && (
                    <Text style={styles.table}>Table {item.tableNumber}</Text>
                  )}
                </View>
                <View style={[styles.badge, { backgroundColor: status.bg }]}>
                  <Text style={[styles.badgeText, { color: status.text }]}>
                    {item.status.charAt(0).toUpperCase() + item.status.slice(1)}
                  </Text>
                </View>
              </View>
              {item.notes && (
                <Text style={styles.notes}>{item.notes}</Text>
              )}
              {canCancel && (
                <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(item)}>
                  <Text style={styles.cancelBtnText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        }}
      />

      {/* Create Reservation Modal */}
      <Modal visible={showCreate} animationType="slide" presentationStyle="pageSheet">
        <View style={styles.modal}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>New Reservation</Text>
            <TouchableOpacity onPress={() => setShowCreate(false)}>
              <Text style={styles.modalClose}>X</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.form}>
            <View style={styles.field}>
              <Text style={styles.label}>Date</Text>
              <TextInput
                style={styles.input}
                value={form.date}
                onChangeText={(v) => setForm((f) => ({ ...f, date: v }))}
                placeholder="YYYY-MM-DD"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Time</Text>
              <TextInput
                style={styles.input}
                value={form.time}
                onChangeText={(v) => setForm((f) => ({ ...f, time: v }))}
                placeholder="HH:MM"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Party Size</Text>
              <TextInput
                style={styles.input}
                value={form.partySize}
                onChangeText={(v) => setForm((f) => ({ ...f, partySize: v }))}
                keyboardType="number-pad"
                placeholder="Number of guests"
              />
            </View>
            <View style={styles.field}>
              <Text style={styles.label}>Notes (optional)</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={form.notes}
                onChangeText={(v) => setForm((f) => ({ ...f, notes: v }))}
                placeholder="Special requests, allergies..."
                multiline
                numberOfLines={3}
              />
            </View>

            <TouchableOpacity
              style={styles.submitBtn}
              onPress={handleCreate}
              disabled={creating}
            >
              {creating ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={styles.submitBtnText}>Book Table</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </>
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
  emptyText: { fontSize: 16, color: '#94a3b8' },
  createBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginBottom: 4,
  },
  createBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 15,
  },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    gap: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  date: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  time: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  table: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  notes: {
    fontSize: 13,
    color: '#64748b',
    fontStyle: 'italic',
  },
  cancelBtn: {
    borderWidth: 1,
    borderColor: '#fca5a5',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  cancelBtnText: {
    color: '#dc2626',
    fontWeight: '600',
    fontSize: 13,
  },
  modal: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e2e8f0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#0f172a',
  },
  modalClose: {
    fontSize: 18,
    color: '#94a3b8',
    fontWeight: '600',
  },
  form: {
    padding: 20,
    gap: 16,
  },
  field: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#0f172a',
    backgroundColor: '#fff',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  submitBtn: {
    backgroundColor: '#2563eb',
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  submitBtnText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
});