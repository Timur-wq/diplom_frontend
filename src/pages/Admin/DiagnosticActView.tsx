// src/pages/Dispatcher/DiagnosticActView.tsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import {
  DiagnosticActDto,
  DiagnosticActWorkItemDto,
  DiagnosticActSpareItemDto,
  ProcurementResultDto,
  ProcurementItemDto,
  SupplierSummaryDto
} from '../../types/diagnostic';
import { diagnosticActService } from '../../services/diagnosticActService';
import styles from './DiagnosticActView.module.scss';

const DiagnosticActView: React.FC = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();

  const [act, setAct] = useState<DiagnosticActDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Состояния для отправки клиенту
  const [dispatcherComment, setDispatcherComment] = useState('');
  const [sendingToClient, setSendingToClient] = useState(false);

  // 🔥 Состояния для оптимизации закупок
  const [optimizing, setOptimizing] = useState(false);
  const [procurementResult, setProcurementResult] = useState<ProcurementResultDto | null>(null);
  const [showProcurement, setShowProcurement] = useState(false);

  useEffect(() => {
    console.log('🔍 requestId из URL:', requestId);
    loadAct();
  }, [requestId]);

  const loadAct = async () => {
    console.log('📥 Загрузка акта, requestId:', requestId);  // 🔥

    if (!requestId) {
      console.error('❌ requestId не определён!');  // 🔥
      setError('requestId не указан');
      return;
    }

    try {
      console.log('🌐 Запрос к API:', `https://localhost:7053/api/dispatcher/DiagnosticAct/by-request/${requestId}`);

      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/dispatcher/DiagnosticAct/by-request/${requestId}`
      );

      console.log('📥 Ответ:', response.status);  // 🔥

      if (!response.ok) throw new Error('Акт не найден');

      const data = await response.json();
      setAct(data);
    } catch (err: any) {
      console.error('❌ Ошибка:', err);  // 🔥
      setError(err.message || 'Ошибка загрузки акта');
    } finally {
      setLoading(false);
    }
  };

  const handleSendToClient = async () => {
    if (!act) return;

    if (!window.confirm('Отправить акт клиенту на согласование?')) return;

    setSendingToClient(true);
    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/dispatcher/DiagnosticAct/${act.actCode}/send-to-client`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment: dispatcherComment })
        }
      );

      if (!response.ok) throw new Error('Не удалось отправить акт');

      alert('✅ Акт отправлен клиенту на согласование');
      navigate('/dispatcher/requests');
    } catch (err: any) {
      alert(err.message || 'Ошибка при отправке акта');
    } finally {
      setSendingToClient(false);
    }
  };

  // 🔥 Запуск жадного алгоритма оптимизации
  const handleOptimizeProcurement = async () => {
    if (!act) return;

    setOptimizing(true);
    setProcurementResult(null);

    try {
      const result = await diagnosticActService.optimizeProcurement(Number(act.actCode));
      setProcurementResult(result);
      setShowProcurement(true);

      // Прокрутка к результатам
      setTimeout(() => {
        document.getElementById('procurement-results')?.scrollIntoView({ behavior: 'smooth' });
      }, 100);

    } catch (err: any) {
      alert(err.message || 'Ошибка при оптимизации закупок');
    } finally {
      setOptimizing(false);
    }
  };

  if (loading) return <div className={styles.loading}>Загрузка акта...</div>;
  if (error) return <div className={styles.error}>Ошибка: {error}</div>;
  if (!act) return <div className={styles.error}>Акт не найден</div>;

  const normalizedStatus = normalizeStatus(act.status);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/dispatcher/requests')}>
          ← Назад к заявкам
        </button>
        <h1 className={styles.title}>Акт диагностики #{act.actCode}</h1>
      </div>

      {/* Информация о заявке */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Информация о заявке</h2>
        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <label>Заявка №:</label>
            <span>{act.requestId}</span>
          </div>
          <div className={styles.infoItem}>
            <label>Клиент:</label>
            <span>{act.clientFio}</span>
          </div>
          <div className={styles.infoItem}>
            <label>Телефон:</label>
            <span>{act.clientPhone}</span>
          </div>
          <div className={styles.infoItem}>
            <label>Инженер:</label>
            <span>{act.engineerFio} (таб. №{act.engineerTabNum})</span>
          </div>
          <div className={styles.infoItem}>
            <label>Дата диагностики:</label>
            <span>{act.diagnosticDate} {act.diagnosticTime}</span>
          </div>
          <div className={styles.infoItem}>
            <label>Статус:</label>
            <span className={`${styles.statusBadge} ${getStatusClass(normalizedStatus)}`}>
              {getStatusLabel(normalizedStatus)}
            </span>
          </div>
        </div>
      </section>

      {/* Результаты диагностики */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Результаты диагностики</h2>

        <div className={styles.detailItem}>
          <label>Внешнее состояние:</label>
          <p className={styles.textBlock}>{act.externalCondition}</p>
        </div>

        <div className={styles.detailItem}>
          <label>Выявленные неисправности:</label>
          <p className={styles.textBlock}>{act.identifiedIssues}</p>
        </div>

        <div className={styles.detailItem}>
          <label>Результаты тестов:</label>
          <p className={styles.textBlock}>{act.testResults}</p>
        </div>

        <div className={styles.detailItem}>
          <label>Рекомендации:</label>
          <p className={styles.textBlock}>{act.recommendations}</p>
        </div>

        {act.estimatedCost && (
          <div className={styles.detailItem}>
            <label>Примерная стоимость:</label>
            <span className={styles.cost}>{act.estimatedCost?.toLocaleString('ru-RU')} ₽</span>
          </div>
        )}
      </section>

      {/* Работы с привязанными ЗИП */}
      {act.works.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Рекомендуемые работы</h2>
          <div className={styles.worksList}>
            {act.works.map((work: DiagnosticActWorkItemDto) => (
              <div key={work.recordId} className={styles.workCard}>
                <div className={styles.workHeader}>
                  <span className={styles.workName}>{work.workName}</span>
                  {work.estimatedCost && (
                    <span className={styles.workCost}>{work.estimatedCost?.toLocaleString('ru-RU')} ₽</span>
                  )}
                </div>
                {work.description && <p className={styles.workDesc}>{work.description}</p>}

                {/* 🔥 Привязанные ЗИП */}
                {work.requiredSpares && work.requiredSpares.length > 0 && (
                  <div className={styles.workSpares}>
                    <span className={styles.spareLabel}>Требуемые запчасти:</span>
                    {work.requiredSpares.map(spare => (
                      <span key={spare.recordId} className={styles.spareTag}>
                        {spare.spareName} × {spare.quantity} {spare.unit}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Общие ЗИП (не привязанные к работам) */}
      {act.spares.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Дополнительные запчасти</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Запчасть</th>
                <th>Количество</th>
                <th>Ед. изм.</th>
              </tr>
            </thead>
            <tbody>
              {act.spares.map((spare: DiagnosticActSpareItemDto) => (
                <tr key={spare.recordId}>
                  <td>{spare.spareName}</td>
                  <td>{spare.quantity}</td>
                  <td>{spare.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* 🔥 Кнопка оптимизации закупок */}
      {normalizedStatus === 'Submitted' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Управление закупками</h2>

          <div className={styles.procurementActions}>
            <button
              className={`${styles.optimizeBtn} ${optimizing ? styles.loading : ''}`}
              onClick={handleOptimizeProcurement}
              disabled={optimizing || act.works.length === 0}
              title={act.works.length === 0 ? "Нет работ для оптимизации" : "Запустить алгоритм назначения поставщиков"}
            >
              {optimizing ? (
                <>
                  <span className={styles.spinner}></span>
                  Расчёт оптимальных закупок...
                </>
              ) : (
                '🤖 Рассчитать оптимальные закупки'
              )}
            </button>

            {act.works.length === 0 && (
              <p className={styles.hint}>Добавьте работы в акт для расчёта закупок</p>
            )}
          </div>
        </section>
      )}

      {/* 🔥 Результаты оптимизации */}
      {showProcurement && procurementResult && (
        <section id="procurement-results" className={styles.section}>
          <div className={styles.procurementHeader}>
            <h2 className={styles.sectionTitle}>📋 Матрица закупок</h2>
            <button
              className={styles.closeBtn}
              onClick={() => setShowProcurement(false)}
            >
              ✕
            </button>
          </div>

          {/* Сообщение алгоритма */}
          <div className={`${styles.procurementMessage} ${procurementResult.isFullySatisfied ? styles.success : styles.warning}`}>
            {procurementResult.message}
          </div>

          {/* Общая стоимость */}
          <div className={styles.totalCost}>
            <strong>Общая стоимость закупки:</strong>{' '}
            <span className={styles.cost}>{procurementResult.totalCost?.toLocaleString('ru-RU')} ₽</span>
          </div>

          {/* Статус удовлетворения */}
          {!procurementResult.isFullySatisfied && procurementResult.unmetDemands.length > 0 && (
            <div className={styles.unmetDemands}>
              <h4>⚠️ Невыполненные потребности:</h4>
              <ul>
                {procurementResult.unmetDemands.map(demand => (
                  <li key={demand.spareCode}>
                    {demand.spareName}: требуется {demand.required}, закуплено {demand.procured}
                    (не хватает {demand.shortage})
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Матрица закупок по запчастям */}
          <h3 className={styles.subTitle}>Детализация по запчастям</h3>
          <div className={styles.procurementTable}>
            <table>
              <thead>
                <tr>
                  <th>Запчасть</th>
                  <th>Требуется</th>
                  <th>Закуплено</th>
                  <th>Поставщики</th>
                </tr>
              </thead>
              <tbody>
                {procurementResult.procurementItems.map(item => (
                  <tr key={item.spareCode}>
                    <td>
                      <strong>{item.spareName}</strong>
                      {item.requiredQuantity > item.procuredQuantity && (
                        <span className={styles.shortage}>⚠️ не хватает {item.requiredQuantity - item.procuredQuantity}</span>
                      )}
                    </td>
                    <td>{item.requiredQuantity}</td>
                    <td>{item.procuredQuantity}</td>
                    <td>
                      {item.supplierAllocations.map(alloc => (
                        <div key={alloc.supplierId} className={styles.allocation}>
                          <span className={styles.supplierName}>{alloc.supplierName}</span>
                          <span className={styles.allocationDetails}>
                            {alloc.quantity} шт. × {alloc.unitPrice?.toLocaleString('ru-RU')} ₽ = {alloc.totalPrice?.toLocaleString('ru-RU')} ₽
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

          {/* Сводка по поставщикам */}
          <h3 className={styles.subTitle}>Сводка по поставщикам</h3>
          <div className={styles.supplierSummary}>
            {procurementResult.supplierSummaries.map(summary => (
              <div key={summary.supplierId} className={styles.supplierCard}>
                <h4>{summary.supplierName}</h4>
                <div className={styles.supplierStats}>
                  <span>📦 {summary.totalQuantity} шт.</span>
                  <span>🔢 {summary.totalItems} позиций</span>
                  <span>💰 {summary.totalCost?.toLocaleString('ru-RU')} ₽</span>
                  <span>🚚 до {summary.maxDeliveryDays} дн.</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Действия диспетчера: отправка клиенту */}
      {normalizedStatus === 'Submitted' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Отправка клиенту</h2>

          <div className={styles.dispatcherActions}>
            <div className={styles.commentField}>
              <label>
                Комментарий для клиента:
                <textarea
                  value={dispatcherComment}
                  onChange={e => setDispatcherComment(e.target.value)}
                  rows={3}
                  placeholder="Дополнительная информация для клиента..."
                />
              </label>
            </div>

            <div className={styles.actionButtons}>
              <button
                className={styles.sendBtn}
                onClick={handleSendToClient}
                disabled={sendingToClient}
              >
                {sendingToClient ? 'Отправка...' : '📤 Отправить клиенту на согласование'}
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Статусы после отправки */}
      {['SentToClient', 'ApprovedByClient', 'RejectedByClient'].includes(normalizedStatus) && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Статус согласования</h2>

          {normalizedStatus === 'SentToClient' && (
            <div className={styles.info}>
              <p>✅ Акт отправлен клиенту на согласование</p>
              {act.dispatcherComment && <p><strong>Комментарий:</strong> {act.dispatcherComment}</p>}
              {act.sentToClientAt && (
                <p><strong>Отправлен:</strong> {new Date(act.sentToClientAt).toLocaleString('ru-RU')}</p>
              )}
            </div>
          )}

          {normalizedStatus === 'ApprovedByClient' && (
            <div className={styles.success}>
              <p>✅ Клиент согласовал работы</p>
              {act.approvedByClientAt && (
                <p><strong>Согласован:</strong> {new Date(act.approvedByClientAt).toLocaleString('ru-RU')}</p>
              )}
            </div>
          )}

          {normalizedStatus === 'RejectedByClient' && (
            <div className={styles.error}>
              <p>❌ Клиент отклонил акт</p>
              {act.clientComment && <p><strong>Комментарий клиента:</strong> {act.clientComment}</p>}
            </div>
          )}
        </section>
      )}
    </div>
  );
};

// Вспомогательные функции
const normalizeStatus = (status: string | number): string => {
  const key = typeof status === 'number' ? status.toString() : status;
  const statusMap: Record<string, string> = {
    '0': 'Draft', '1': 'Submitted', '2': 'SentToClient',
    '3': 'ApprovedByClient', '4': 'RejectedByClient', '5': 'Completed',
    'Draft': 'Draft', 'Submitted': 'Submitted', 'SentToClient': 'SentToClient',
    'ApprovedByClient': 'ApprovedByClient', 'RejectedByClient': 'RejectedByClient', 'Completed': 'Completed'
  };
  return statusMap[key] || key;
};

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    'Draft': 'Черновик', 'Submitted': 'Отправлен диспетчеру',
    'SentToClient': 'Отправлен клиенту', 'ApprovedByClient': 'Согласован',
    'RejectedByClient': 'Отклонён', 'Completed': 'Завершён'
  };
  return labels[status] || status;
};

const getStatusClass = (status: string): string => {
  const classes: Record<string, string> = {
    'Draft': styles.statusDraft, 'Submitted': styles.statusSubmitted,
    'SentToClient': styles.statusSent, 'ApprovedByClient': styles.statusApproved,
    'RejectedByClient': styles.statusRejected, 'Completed': styles.statusCompleted
  };
  return classes[status] || '';
};

export default DiagnosticActView;