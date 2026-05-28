// src/pages/Dispatcher/ProcurementOptimizationPage.tsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import styles from './ProcurementOptimizationPage.module.scss';

// 🔥 Типы для матрицы закупок (дублируем или импортируем из shared/types)
interface ProcurementItem {
  spareCode: number;
  spareName: string;
  requiredQuantity: number;
  procuredQuantity: number;
  supplierAllocations: Array<{
    supplierId: number;
    supplierName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    deliveryDays: number;
  }>;
}

interface ProcurementResult {
  actCode: number;
  totalCost: number;
  isFullySatisfied: boolean;
  message: string;
  procurementItems: ProcurementItem[];
  supplierSummaries: Array<{
    supplierId: number;
    supplierName: string;
    totalQuantity: number;
    totalCost: number;
  }>;
  unmetDemands: Array<{
    spareCode: number;
    spareName: string;
    required: number;
    procured: number;
    shortage: number;
  }>;
}

const ProcurementOptimizationPage: React.FC = () => {
  const { actCode } = useParams<{ actCode: string }>();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [optimizing, setOptimizing] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<ProcurementResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // 🔥 Запуск алгоритма оптимизации
  const runOptimization = async () => {
    if (!actCode) return;

    setOptimizing(true);
    setError(null);

    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/dispatcher/DiagnosticAct/${actCode}/optimize-procurement`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Не удалось рассчитать закупки');
      }

      const data: ProcurementResult = await response.json();
      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Ошибка при расчёте');
    } finally {
      setOptimizing(false);
      setLoading(false);
    }
  };

  // 🔥 Формирование заявки на закупку
  const handleSubmitOrder = async () => {
    if (!actCode || !result) return;

    if (!window.confirm('Сформировать заявки на закупку ЗИП у выбранных поставщиков?')) return;

    setSubmitting(true);

    try {
      // 🔥 Вызываем эндпоинт создания заявок (нужно реализовать на бэкенде)
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/dispatcher/Procurement/${actCode}/create-orders`,
        { method: 'POST' }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Не удалось создать заявки');
      }

      alert('✅ Заявки на закупку успешно сформированы!');
      navigate('/dispatcher/requests'); // Возврат к списку заявок
    } catch (err: any) {
      alert(err.message || 'Ошибка при формировании заявок');
    } finally {
      setSubmitting(false);
    }
  };

  // 🔥 Запускаем оптимизацию при загрузке страницы
  useEffect(() => {
    if (actCode) {
      runOptimization();
    }
  }, [actCode]);

  if (loading) return <div className={styles.loading}>🔄 Расчёт оптимальных закупок...</div>;
  if (error) return <div className={styles.error}>❌ {error}</div>;
  if (!result) return <div className={styles.empty}>Нет данных для расчёта</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate(-1)}>
          ← Назад
        </button>
        <h1 className={styles.title}>📦 Оптимизация закупок ЗИП</h1>
        <span className={styles.actBadge}>Акт #{actCode}</span>
      </div>

      {/* 🔥 Сообщение алгоритма */}
      <div className={`${styles.message} ${result.isFullySatisfied ? styles.success : styles.warning}`}>
        {result.message}
      </div>

      {/* 🔥 Общая стоимость */}
      <div className={styles.totalCost}>
        <strong>💰 Общая стоимость закупки:</strong>{' '}
        <span className={styles.cost}>{result.totalCost.toLocaleString('ru-RU')} ₽</span>
      </div>

      {/* 🔥 Невыполненные потребности (если есть) */}
      {!result.isFullySatisfied && result.unmetDemands.length > 0 && (
        <div className={styles.unmetDemands}>
          <h3>⚠️ Невыполненные потребности:</h3>
          <ul>
            {result.unmetDemands.map(demand => (
              <li key={demand.spareCode}>
                <strong>{demand.spareName}</strong>: требуется {demand.required}, 
                закуплено {demand.procured} (❌ не хватает {demand.shortage})
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 🔥 Матрица закупок по запчастям */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>📋 Матрица закупок</h2>
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Запчасть</th>
                <th>Требуется</th>
                <th>Закуплено</th>
                <th>Поставщики</th>
              </tr>
            </thead>
            <tbody>
              {result.procurementItems.map(item => (
                <tr key={item.spareCode}>
                  <td>
                    <strong>{item.spareName}</strong>
                    {item.procuredQuantity < item.requiredQuantity && (
                      <span className={styles.shortage}>⚠️ -{item.requiredQuantity - item.procuredQuantity}</span>
                    )}
                  </td>
                  <td>{item.requiredQuantity}</td>
                  <td>{item.procuredQuantity}</td>
                  <td>
                    {item.supplierAllocations.map(alloc => (
                      <div key={alloc.supplierId} className={styles.allocation}>
                        <span className={styles.supplierName}>{alloc.supplierName}</span>
                        <span className={styles.allocationDetails}>
                          {alloc.quantity} шт. × {alloc.unitPrice.toLocaleString('ru-RU')} ₽ = {alloc.totalPrice.toLocaleString('ru-RU')} ₽
                          {alloc.deliveryDays > 1 && <span className={styles.delivery}>📦 {alloc.deliveryDays} дн.</span>}
                        </span>
                      </div>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* 🔥 Сводка по поставщикам */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>🏪 Поставщики</h2>
        <div className={styles.supplierGrid}>
          {result.supplierSummaries.map(summary => (
            <div key={summary.supplierId} className={styles.supplierCard}>
              <h3>{summary.supplierName}</h3>
              <div className={styles.supplierStats}>
                <span>📦 {summary.totalQuantity} шт.</span>
                <span>💰 {summary.totalCost.toLocaleString('ru-RU')} ₽</span>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 🔥 Кнопки действий */}
      <div className={styles.actions}>
        <button
          className={styles.secondaryBtn}
          onClick={() => navigate(-1)}
          disabled={submitting}
        >
          Отмена
        </button>
        <button
          className={`${styles.primaryBtn} ${!result.isFullySatisfied ? styles.warningBtn : ''}`}
          onClick={handleSubmitOrder}
          disabled={submitting || result.procurementItems.length === 0}
        >
          {submitting ? (
            <>
              <span className={styles.spinner}></span>
              Формирование...
            </>
          ) : (
            '✅ Сформировать заявки на закупку'
          )}
        </button>
      </div>
    </div>
  );
};

export default ProcurementOptimizationPage;