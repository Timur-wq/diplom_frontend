// src/pages/Client/ClientDiagnosticActView.tsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { DiagnosticActDto } from '../../types/diagnostic';
import styles from './ClientDiagnosticActView.module.scss';

interface ApprovedWorkItem {
  index: number;
  isApproved: boolean;
}

interface ApprovedSpareItem {
  index: number;
  isApproved: boolean;
}

const ClientDiagnosticActView: React.FC = () => {
  const { actCode } = useParams<{ actCode: string }>();
  const navigate = useNavigate();
  
  const [act, setAct] = useState<DiagnosticActDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Состояние для выбранных работ и ЗИП
  const [approvedWorks, setApprovedWorks] = useState<ApprovedWorkItem[]>([]);
  const [approvedSpares, setApprovedSpares] = useState<ApprovedSpareItem[]>([]);
  const [clientComment, setClientComment] = useState('');

  useEffect(() => {
    loadAct();
  }, [actCode]);

  const loadAct = async () => {
    if (!actCode) return;
    
    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/client/DiagnosticAct/${actCode}`
      );
      
      if (!response.ok) {
        if (response.status === 404) throw new Error('Акт не найден или недоступен');
        if (response.status === 403) throw new Error('Доступ запрещён');
        throw new Error('Ошибка загрузки акта');
      }
      
      const data: DiagnosticActDto = await response.json();
      setAct(data);
      
      // Инициализируем состояния согласования
      const initialWorks = data.works.map((w, index) => ({
        index,
        isApproved: true
      }));
      const initialSpares = data.spares.map((s, index) => ({
        index,
        isApproved: true
      }));
      
      setApprovedWorks(initialWorks);
      setApprovedSpares(initialSpares);
      
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки акта');
    } finally {
      setLoading(false);
    }
  };

  const handleWorkToggle = (index: number) => {
    setApprovedWorks(prev => 
      prev.map(w => w.index === index ? { ...w, isApproved: !w.isApproved } : w)
    );
  };

  const handleSpareToggle = (index: number) => {
    setApprovedSpares(prev => 
      prev.map(s => s.index === index ? { ...s, isApproved: !s.isApproved } : s)
    );
  };

  const handleSubmitDecision = async () => {
    if (!act || !actCode) return;
    
    // Проверка: хотя бы один элемент согласован или есть комментарий при полном отказе
    const hasApprovedWorks = approvedWorks.some(w => w.isApproved);
    const hasApprovedSpares = approvedSpares.some(s => s.isApproved);
    
    if (!hasApprovedWorks && !hasApprovedSpares && !clientComment.trim()) {
      alert('Пожалуйста, согласуйте хотя бы одну работу/запчасть или укажите причину отказа');
      return;
    }
    
    if (!window.confirm('Отправить ваше решение? Это действие нельзя отменить.')) return;

    setSubmitting(true);
    
    try {
      const response = await authService.fetchWithAuth(
        `https://localhost:7053/api/client/DiagnosticAct/${actCode}/decision`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            comment: clientComment.trim() || undefined,
            approvedWorks: approvedWorks,
            approvedSpares: approvedSpares
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Ошибка отправки решения');
      }

      const result = await response.json();
      
      alert(result.message || 'Ваше решение отправлено!');
      
      // Перенаправление в зависимости от статуса
      if (result.newStatus === 'RejectedByClient') {
        navigate('/client/requests');
      } else {
        // Обновляем локальное состояние
        setAct(prev => prev ? { ...prev, status: result.newStatus } : null);
      }
      
    } catch (err: any) {
      alert(err.message || 'Ошибка при отправке решения');
    } finally {
      setSubmitting(false);
    }
  };

  const getStatusBadge = (status: string | number) => {
    const key = typeof status === 'number' ? status.toString() : status;
    const labels: Record<string, { text: string; class: string }> = {
      'SentToClient': { text: 'Ожидает согласования', class: styles.statusPending },
      'ApprovedByClient': { text: 'Согласовано', class: styles.statusApproved },
      'RejectedByClient': { text: 'Отклонено', class: styles.statusRejected }
    };
    return labels[key] || { text: key, class: '' };
  };

  if (loading) return <div className={styles.loading}>Загрузка акта...</div>;
  if (error) return <div className={styles.error}>Ошибка: {error}</div>;
  if (!act) return <div className={styles.error}>Акт не найден</div>;

  const normalizedStatus = typeof act.status === 'number' ? act.status.toString() : act.status;
  const statusInfo = getStatusBadge(normalizedStatus);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => navigate('/client/requests')}>
          ← Назад к заявкам
        </button>
        <h1 className={styles.title}>Акт диагностики #{act.actCode}</h1>
        <span className={`${styles.statusBadge} ${statusInfo.class}`}>
          {statusInfo.text}
        </span>
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
            <span>{act.engineerFio}</span>
          </div>
          <div className={styles.infoItem}>
            <label>Дата диагностики:</label>
            <span>{act.diagnosticDate} {act.diagnosticTime}</span>
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
            <span className={styles.cost}>{act.estimatedCost} ₽</span>
          </div>
        )}

        {act.estimatedTime && (
          <div className={styles.detailItem}>
            <label>Примерное время:</label>
            <span>{act.estimatedTime}</span>
          </div>
        )}
      </section>

      {/* Работы с чекбоксами */}
      {act.works.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Рекомендуемые работы
            {normalizedStatus === 'SentToClient' && <span className={styles.hint}>Отметьте галочкой работы, которые вы согласны выполнить</span>}
          </h2>
          
          <div className={styles.worksList}>
            {act.works.map((work, index) => {
              const isChecked = approvedWorks.find(w => w.index === index)?.isApproved ?? true;
              const isDisabled = normalizedStatus !== 'SentToClient';
              
              return (
                <label key={`work-${index}`} className={`${styles.workItem} ${!isChecked ? styles.rejected : ''}`}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleWorkToggle(index)}
                    disabled={isDisabled}
                    className={styles.checkbox}
                  />
                  <div className={styles.workDetails}>
                    <span className={styles.workName}>{work.workName}</span>
                    {work.description && <span className={styles.workDesc}>{work.description}</span>}
                    {work.estimatedCost && <span className={styles.workCost}>{work.estimatedCost} ₽</span>}
                  </div>
                </label>
              );
            })}
          </div>
        </section>
      )}

      {/* ЗИП с чекбоксами */}
      {act.spares.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Необходимые запчасти
            {normalizedStatus === 'SentToClient' && <span className={styles.hint}>Отметьте галочкой запчасти, которые вы согласны приобрести</span>}
          </h2>
          
          <div className={styles.sparesList}>
            {act.spares.map((spare, index) => {
              const isChecked = approvedSpares.find(s => s.index === index)?.isApproved ?? true;
              const isDisabled = normalizedStatus !== 'SentToClient';
              
              return (
                <label key={`spare-${index}`} className={`${styles.spareItem} ${!isChecked ? styles.rejected : ''}`}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={() => handleSpareToggle(index)}
                    disabled={isDisabled}
                    className={styles.checkbox}
                  />
                  <div className={styles.spareDetails}>
                    <span className={styles.spareName}>{spare.spareName}</span>
                    <span className={styles.spareQty}>{spare.quantity} {spare.unit}</span>
                  </div>
                </label>
              );
            })}
          </div>
        </section>
      )}

      {/* Комментарий клиента */}
      {normalizedStatus === 'SentToClient' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Ваш комментарий</h2>
          <textarea
            className={styles.commentInput}
            value={clientComment}
            onChange={(e) => setClientComment(e.target.value)}
            rows={4}
            placeholder="Дополнительные комментарии или причина отказа..."
          />
        </section>
      )}

      {/* Статус и действия */}
      {normalizedStatus !== 'SentToClient' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Статус согласования</h2>
          
          {normalizedStatus === 'ApprovedByClient' && (
            <div className={styles.success}>
              ✅ Вы согласовали работы. Ожидайте выполнения.
            </div>
          )}
          
          {normalizedStatus === 'RejectedByClient' && (
            <div className={styles.rejected}>
              ❌ Вы отклонили акт.
              {act.clientComment && <p><strong>Ваш комментарий:</strong> {act.clientComment}</p>}
            </div>
          )}
          
          {act.approvedByClientAt && (
            <p className={styles.timestamp}>
              Статус изменён: {new Date(act.approvedByClientAt).toLocaleString('ru-RU')}
            </p>
          )}
        </section>
      )}

      {/* Кнопка отправки решения */}
      {normalizedStatus === 'SentToClient' && (
        <div className={styles.actions}>
          <button
            className={styles.submitBtn}
            onClick={handleSubmitDecision}
            disabled={submitting}
          >
            {submitting ? (
              <span className={styles.loading}>
                <span className={styles.spinner}></span>
                Отправка...
              </span>
            ) : (
              '✅ Отправить решение'
            )}
          </button>
        </div>
      )}

      {/* Комментарий диспетчера */}
      {act.dispatcherComment && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Комментарий диспетчера</h2>
          <p className={styles.dispatcherComment}>{act.dispatcherComment}</p>
        </section>
      )}
    </div>
  );
};

export default ClientDiagnosticActView;