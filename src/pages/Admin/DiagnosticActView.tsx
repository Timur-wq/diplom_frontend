// src/pages/Dispatcher/DiagnosticActView.tsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { DiagnosticActDto, Work, Spare } from '../../types/diagnostic';
import styles from './DiagnosticActView.module.scss';

const DiagnosticActView: React.FC = () => {
  const { requestId } = useParams<{ requestId: string }>();
  const navigate = useNavigate();
  const [act, setAct] = useState<DiagnosticActDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dispatcherComment, setDispatcherComment] = useState('');
  const [sendingToClient, setSendingToClient] = useState(false);

  useEffect(() => {
    loadAct();
  }, [requestId]);

  const loadAct = async () => {
    if (!requestId) return;
    
    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/dispatcher/DiagnosticAct/by-request/${requestId}`
      );
      
      if (!response.ok) throw new Error('Акт не найден');
      
      const data = await response.json();
      setAct(data);
    } catch (err: any) {
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
      navigate('/dispatcher/requests');  // Возврат к списку заявок
    } catch (err: any) {
      alert(err.message || 'Ошибка при отправке акта');
    } finally {
      setSendingToClient(false);
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
            <span className={styles.statusBadge}>{getStatusLabel(normalizedStatus)}</span>
          </div>
        </div>
      </section>

      {/* Результаты диагностики */}
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Результаты диагностики</h2>
        
        <div className={styles.detailItem}>
          <label>Внешнее состояние:</label>
          <p>{act.externalCondition}</p>
        </div>
        
        <div className={styles.detailItem}>
          <label>Выявленные неисправности:</label>
          <p>{act.identifiedIssues}</p>
        </div>
        
        <div className={styles.detailItem}>
          <label>Результаты тестов:</label>
          <p>{act.testResults}</p>
        </div>
        
        <div className={styles.detailItem}>
          <label>Рекомендации:</label>
          <p>{act.recommendations}</p>
        </div>

        {act.estimatedCost && (
          <div className={styles.detailItem}>
            <label>Примерная стоимость:</label>
            <span>{act.estimatedCost} ₽</span>
          </div>
        )}

        {act.estimatedTime && (
          <div className={styles.detailItem}>
            <label>Примерное время:</label>
            <span>{act.estimatedTime}</span>
          </div>
        )}
      </section>

      {/* Работы */}
      {act.works.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Рекомендуемые работы</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Работа</th>
                <th>Описание</th>
                <th>Стоимость</th>
              </tr>
            </thead>
            <tbody>
              {act.works.map((work: Work, index: number) => (
                <tr key={index}>
                  <td>{work.workName}</td>
                  <td>{work.description}</td>
                  <td>{work.estimatedCost} ₽</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* ЗИП */}
      {act.spares.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Необходимые запчасти</h2>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Запчасть</th>
                <th>Количество</th>
                <th>Ед. изм.</th>
              </tr>
            </thead>
            <tbody>
              {act.spares.map((spare: Spare, index: number) => (
                <tr key={index}>
                  <td>{spare.spareName}</td>
                  <td>{spare.quantity}</td>
                  <td>{spare.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* Действия диспетчера */}
      {normalizedStatus === 'Submitted' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Действия</h2>
          
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

      {normalizedStatus === 'SentToClient' && (
        <div className={styles.info}>
          <p>✅ Акт отправлен клиенту на согласование</p>
          {act.dispatcherComment && (
            <p><strong>Комментарий:</strong> {act.dispatcherComment}</p>
          )}
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
          {act.clientComment && (
            <p><strong>Комментарий клиента:</strong> {act.clientComment}</p>
          )}
        </div>
      )}
    </div>
  );
};

// Приводим статус к строковому значению, чтобы одинаково обрабатывать текстовые и числовые коды
const normalizeStatus = (status: string | number): string => {
  const key = typeof status === 'number' ? status.toString() : status;

  const statusMap: Record<string, string> = {
    '0': 'Draft',
    '1': 'Submitted',
    '2': 'SentToClient',
    '3': 'ApprovedByClient',
    '4': 'RejectedByClient',
    '5': 'Completed',
    'Draft': 'Draft',
    'Submitted': 'Submitted',
    'SentToClient': 'SentToClient',
    'ApprovedByClient': 'ApprovedByClient',
    'RejectedByClient': 'RejectedByClient',
    'Completed': 'Completed'
  };

  return statusMap[key] || key;
};

// Вспомогательная функция для отображения статуса
const getStatusLabel = (status: string | number): string => {
  const labels: Record<string, string> = {
    'Draft': 'Черновик',
    'Submitted': 'Отправлен диспетчеру',
    'SentToClient': 'Отправлен клиенту',
    'ApprovedByClient': 'Согласован клиентом',
    'RejectedByClient': 'Отклонён клиентом',
    'Completed': 'Завершён'
  };
  const normalized = typeof status === 'number' ? status.toString() : status;
  return labels[normalized] || normalized;
};

export default DiagnosticActView;