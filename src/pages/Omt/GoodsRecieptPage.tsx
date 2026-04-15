// src/pages/Mts/GoodsReceiptPage.tsx

import React, { useState, useEffect } from 'react';
import { authService } from '../../services/authService';
import styles from './GoodsRecieptPage.module.scss';

interface PendingOrder {
  spareOrderId: number;
  orderedQuantity: number;
  spareName: string;
  supplierName: string;
}

const GoodsReceiptPage: React.FC = () => {
  const [pendingOrders, setPendingOrders] = useState<PendingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<PendingOrder | null>(null);
  const [receivedQty, setReceivedQty] = useState(0);
  const [goodQty, setGoodQty] = useState(0);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    loadPendingOrders();
  }, []);

  // 🔥 Загрузка заявок, ожидающих приёмки
  const loadPendingOrders = async () => {
    try {
      const response = await authService.fetchWithAuth(
        'https://localhost:7053/api/OmtEmployee/GoodsReceipt/pending'  // ✅ Правильный URL
      );
      if (response.ok) {
        const data = await response.json();
        setPendingOrders(data);
      }
    } catch (error) {
      console.error('Ошибка загрузки:', error);
    } finally {
      setLoading(false);
    }
  };

  // 🔥 Приёмка товара
  const handleAccept = async () => {
    if (!selectedOrder) return;

    setSubmitting(true);
    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/OmtEmployee/GoodsReceipt/${selectedOrder.spareOrderId}/accept`,  // ✅ Правильный URL
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            receivedQuantity: receivedQty,
            goodQuantity: goodQty,
            comment: comment
          })
        }
      );

      if (!response.ok) throw new Error('Ошибка при приёмке');

      alert('✅ Товар принят!');
      setSelectedOrder(null);
      loadPendingOrders();
    } catch (error: any) {
      alert(error.message || 'Ошибка при приёмке');
    } finally {
      setSubmitting(false);
    }
  };

  // 🔥 Отклонение заказа
  const handleReject = async () => {
    if (!selectedOrder) return;

    setSubmitting(true);
    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/OmtEmployee/GoodsReceipt/${selectedOrder.spareOrderId}/reject`,  // ✅ Правильный URL
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment })
        }
      );

      if (!response.ok) throw new Error('Ошибка при отклонении');

      alert('❌ Заказ отклонён');
      setSelectedOrder(null);
      loadPendingOrders();
    } catch (error: any) {
      alert(error.message || 'Ошибка при отклонении');
    } finally {
      setSubmitting(false);
    }
  };

  

  if (loading) return <div className={styles.loading}>Загрузка...</div>;

  return (
    <div className={styles.container}>
      <h1 className={styles.title}>Приёмка ЗИП от поставщиков</h1>

      {pendingOrders.length === 0 ? (
        <div className={styles.empty}>Нет заявок, ожидающих приёмки</div>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>№ заявки</th>
              <th>ЗИП</th>
              <th>Поставщик</th>
              <th>Заказано</th>
              <th>Действие</th>
            </tr>
          </thead>
          <tbody>
            {pendingOrders.map(order => (
              <tr key={order.spareOrderId}>
                <td>#{order.spareOrderId}</td>
                <td>{order.spareName}</td>
                <td>{order.supplierName}</td>
                <td>{order.orderedQuantity} шт.</td>
                <td>
                  <button
                    className={styles.acceptBtn}
                    onClick={() => {
                      setSelectedOrder(order);
                      setReceivedQty(order.orderedQuantity);
                      setGoodQty(order.orderedQuantity);
                    }}
                  >
                    Принять
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Модальное окно приёмки */}
      {selectedOrder && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h2>Приёмка заявки #{selectedOrder.spareOrderId}</h2>

            <div className={styles.formGroup}>
              <label>Заказано:</label>
              <span>{selectedOrder.orderedQuantity} шт.</span>
            </div>

            <div className={styles.formGroup}>
              <label>Фактически получено:</label>
              <input
                type="number"
                value={receivedQty}
                onChange={(e) => {
                  setReceivedQty(Number(e.target.value));
                  setGoodQty(Number(e.target.value));
                }}
                min="0"
                max={selectedOrder.orderedQuantity * 2}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Из них годных:</label>
              <input
                type="number"
                value={goodQty}
                onChange={(e) => setGoodQty(Number(e.target.value))}
                min="0"
                max={receivedQty}
              />
            </div>

            <div className={styles.formGroup}>
              <label>Брак:</label>
              <span className={styles.defectCount}>
                {receivedQty - goodQty} шт.
              </span>
            </div>

            <div className={styles.formGroup}>
              <label>Комментарий:</label>
              <textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                placeholder="Причина брака или примечания..."
              />
            </div>

            <div className={styles.actions}>
              <button
                className={styles.rejectBtn}
                onClick={handleReject}
                disabled={submitting}
              >
                ❌ Отклонить всё
              </button>
              <button
                className={styles.acceptBtn}
                onClick={handleAccept}
                disabled={submitting || goodQty === 0}
              >
                {submitting ? 'Сохранение...' : '✅ Принять'}
              </button>
              <button
                className={styles.cancelBtn}
                onClick={() => setSelectedOrder(null)}
                disabled={submitting}
              >
                Отмена
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GoodsReceiptPage;