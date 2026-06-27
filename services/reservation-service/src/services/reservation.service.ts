import { v4 as uuidv4 } from 'uuid';
import axios from 'axios';
import { config } from '../config';
import { executeQuery, executeQuerySingle, executeTransaction } from '../db/client';
import { PoolClient } from 'pg';

export interface Reservation {
  id: string;
  storeId: string;
  customerId: string | null;
  tableId: string | null;
  customerName: string;
  customerPhone: string | null;
  customerEmail: string | null;
  partySize: number;
  reservedDate: string;
  reservedTime: string;
  status: 'confirmed' | 'arrived' | 'seated' | 'completed' | 'cancelled' | 'no_show';
  notes: string | null;
  orderId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface RestaurantTable {
  id: string;
  storeId: string;
  tableNumber: string;
  capacity: number;
  location: string | null;
  status: 'available' | 'reserved' | 'occupied' | 'cleaning';
  createdAt: string;
  updatedAt: string;
}

export async function createReservation(
  storeId: string,
  customerId: string | null,
  customerName: string,
  customerPhone: string | null,
  customerEmail: string | null,
  partySize: number,
  reservedDate: string,
  reservedTime: string,
  notes: string | null = null
): Promise<Reservation> {
  return executeTransaction<Reservation>(async (client: PoolClient) => {
    const id = uuidv4();

    // Find available table matching party size
    const availableTable = await client.query(
      `SELECT id FROM restaurant_tables
       WHERE store_id = $1 AND capacity >= $2 AND status = 'available'
       LIMIT 1`,
      [storeId, partySize]
    );

    const tableId = availableTable.rows[0]?.id || null;

    // Create reservation
    await client.query(
      `INSERT INTO reservations
       (id, store_id, customer_id, table_id, customer_name, customer_phone, customer_email, party_size, reserved_date, reserved_time, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'confirmed', $11)`,
      [id, storeId, customerId, tableId, customerName, customerPhone, customerEmail, partySize, reservedDate, reservedTime, notes]
    );

    // Update table status if assigned
    if (tableId) {
      await client.query(
        `UPDATE restaurant_tables SET status = 'reserved', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [tableId]
      );
    }

    const reservation = await client.query(
      `SELECT * FROM reservations WHERE id = $1`,
      [id]
    );

    // Send notification
    try {
      await axios.post(
        `${config.NOTIFICATION_SERVICE_URL}/api/v1/notifications`,
        {
          type: 'reservation_confirmed',
          customerId,
          storeId,
          data: { reservationId: id, customerName, reservedDate, reservedTime },
        },
        { headers: { 'x-internal-service': 'reservation-service' } }
      );
    } catch (err) {
      console.warn('[Reservation] Notification failed:', err);
    }

    return reservation.rows[0];
  });
}

export async function getReservations(
  storeId: string,
  date?: string,
  status?: string
): Promise<Reservation[]> {
  let query = `SELECT * FROM reservations WHERE store_id = $1`;
  const params: unknown[] = [storeId];

  if (date) {
    query += ` AND reserved_date = $${params.length + 1}`;
    params.push(date);
  }

  if (status) {
    query += ` AND status = $${params.length + 1}`;
    params.push(status);
  }

  query += ` ORDER BY reserved_time ASC`;

  return executeQuery<Reservation>(query, params);
}

export async function checkIn(reservationId: string, storeId: string): Promise<Reservation> {
  return executeTransaction<Reservation>(async (client: PoolClient) => {
    const reservation = await client.query(
      `SELECT * FROM reservations WHERE id = $1 AND store_id = $2`,
      [reservationId, storeId]
    );

    if (!reservation.rows[0]) {
      throw new Error('Reservation not found');
    }

    await client.query(
      `UPDATE reservations SET status = 'arrived', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [reservationId]
    );

    const updated = await client.query(
      `SELECT * FROM reservations WHERE id = $1`,
      [reservationId]
    );

    return updated.rows[0];
  });
}

export async function seat(reservationId: string, storeId: string, tableId: string): Promise<Reservation> {
  return executeTransaction<Reservation>(async (client: PoolClient) => {
    await client.query(
      `UPDATE reservations SET status = 'seated', table_id = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND store_id = $3`,
      [tableId, reservationId, storeId]
    );

    await client.query(
      `UPDATE restaurant_tables SET status = 'occupied', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [tableId]
    );

    const updated = await client.query(
      `SELECT * FROM reservations WHERE id = $1`,
      [reservationId]
    );

    return updated.rows[0];
  });
}

export async function cancel(
  reservationId: string,
  storeId: string,
  reason: string,
  cancelledBy: 'customer' | 'staff' | 'system'
): Promise<void> {
  return executeTransaction<void>(async (client: PoolClient) => {
    const reservation = await client.query(
      `SELECT * FROM reservations WHERE id = $1 AND store_id = $2`,
      [reservationId, storeId]
    );

    if (!reservation.rows[0]) {
      throw new Error('Reservation not found');
    }

    const res = reservation.rows[0];

    // Record cancellation
    await client.query(
      `INSERT INTO reservation_cancellations (reservation_id, reason, cancelled_by)
       VALUES ($1, $2, $3)`,
      [reservationId, reason, cancelledBy]
    );

    // Update reservation status
    await client.query(
      `UPDATE reservations SET status = 'cancelled', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [reservationId]
    );

    // Free table
    if (res.table_id) {
      await client.query(
        `UPDATE restaurant_tables SET status = 'available', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [res.table_id]
      );
    }
  });
}

export async function getTables(storeId: string): Promise<RestaurantTable[]> {
  return executeQuery<RestaurantTable>(
    `SELECT * FROM restaurant_tables WHERE store_id = $1 ORDER BY table_number ASC`,
    [storeId]
  );
}

export async function getAvailableTables(
  storeId: string,
  partySize: number,
  date: string,
  time: string
): Promise<RestaurantTable[]> {
  return executeQuery<RestaurantTable>(
    `SELECT DISTINCT t.* FROM restaurant_tables t
     WHERE t.store_id = $1 AND t.capacity >= $2 AND t.status = 'available'
     AND NOT EXISTS (
       SELECT 1 FROM reservations r
       WHERE r.table_id = t.id AND r.reserved_date = $3 AND r.reserved_time = $4 AND r.status != 'cancelled'
     )
     ORDER BY t.capacity ASC`,
    [storeId, partySize, date, time]
  );
}