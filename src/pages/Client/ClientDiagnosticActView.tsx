// src/pages/Client/ClientDiagnosticActView.tsx

import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { authService } from '../../services/authService';
import { DiagnosticActDto, DiagnosticActWorkItemDto, DiagnosticActSpareItemDto } from '../../types/diagnostic';
import styles from './ClientDiagnosticActView.module.scss';

// 🔥 Используем recordId вместо индекса для надёжности
interface ApprovedItem {
  recordId: number;
  isApproved: boolean;
}

const ClientDiagnosticActView: React.FC = () => {
  const { actCode } = useParams<{ actCode: string }>();
  const navigate = useNavigate();
  
  const [act, setAct] = useState<DiagnosticActDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  
  // Состояние для решений клиента
  const [approvedWorks, setApprovedWorks] = useState<ApprovedItem[]>([]);
  const [approvedSpares, setApprovedSpares] = useState<ApprovedItem[]>([]);
  const [clientComment, setClientComment] = useState('');

  useEffect(() => {
    loadAct();
  }, [actCode]);

  const loadAct = async () => {
    if (!actCode) return;
    
    try {
      let response = await authService.fetchWithAuth(
        `https://localhost:7053/api/client/DiagnosticAct/${actCode}`
      );
      
      let data: DiagnosticActDto;
      if (response.ok) {
        data = await response.json();
      } else if (response.status === 404) {
        const numericRequestId = Number(actCode);
        if (!Number.isInteger(numericRequestId)) {
          throw new Error('Акт не найден или недоступен');
        }

        const fallbackResponse = await authService.fetchWithAuth(
          'https://localhost:7053/api/client/DiagnosticAct/pending'
        );

        if (!fallbackResponse.ok) {
          if (fallbackResponse.status === 403) throw new Error('Доступ запрещён');
          throw new Error('Акт не найден или недоступен');
        }

        const pendingActs: DiagnosticActDto[] = await fallbackResponse.json();
        const fallbackAct = pendingActs.find(a => a.requestId === numericRequestId);

        if (!fallbackAct) {
          throw new Error('Акт не найден или недоступен');
        }

        data = fallbackAct;
      } else {
        if (response.status === 403) throw new Error('Доступ запрещён');
        throw new Error('Ошибка загрузки акта');
      }

      console.log('ClientDiagnosticActView: loaded act', data);
      console.log('ClientDiagnosticActView: works with linked spares', data.works.map(w => ({
        recordId: w.recordId,
        workName: w.workName,
        requiredSparesCount: w.requiredSpares?.length ?? 0,
        requiredSpares: w.requiredSpares
      })));
      console.log('ClientDiagnosticActView: base spares', data.spares);

      setAct(data);
      
      // 🔥 Инициализируем состояния согласования по recordId
      const initialWorks = data.works.map(w => ({
        recordId: w.recordId,
        isApproved: w.isApprovedByClient ?? true
      }));

      const rawSpares = [
        ...data.spares,
        ...data.works.flatMap(w => w.requiredSpares || [])
      ];

      const uniqueSpares = rawSpares.reduce<ApprovedItem[]>((acc, spare) => {
        if (!acc.some(item => item.recordId === spare.recordId)) {
          acc.push({
            recordId: spare.recordId,
            isApproved: spare.isApprovedByClient ?? true
          });
        }
        return acc;
      }, []);
      
      setApprovedWorks(initialWorks);
      setApprovedSpares(uniqueSpares);
      
    } catch (err: any) {
      setError(err.message || 'Ошибка загрузки акта');
    } finally {
      setLoading(false);
    }
  };

  // 🔥 Обработчик: клиент меняет решение по работе
  const handleWorkToggle = (work: DiagnosticActWorkItemDto, checked: boolean) => {
    // 1. Обновляем решение по работе
    setApprovedWorks(prev => 
      prev.map(w => w.recordId === work.recordId ? { ...w, isApproved: checked } : w)
    );
    
    // 🔥 2. Если работа отклонена — автоматически отклоняем связанные ЗИП
    const linkedSpares = work.requiredSpares || [];
    if (linkedSpares.length) {
      setApprovedSpares(prev => 
        prev.map(spare => {
          const isLinked = linkedSpares.some(
            linkedSpare => linkedSpare.recordId === spare.recordId
          );
          if (!isLinked) return spare;
          return { ...spare, isApproved: checked };
        })
      );
    }
  };

  // 🔥 Обработчик: клиент явно меняет решение по ЗИП
  const handleSpareToggle = (recordId: number, checked: boolean) => {
    setApprovedSpares(prev => 
      prev.map(s => s.recordId === recordId ? { ...s, isApproved: checked } : s)
    );
  };

  // 🔥 Отправка решения на сервер
  const handleSubmitDecision = async () => {
    if (!act || !actCode) return;
    
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
      await loadAct();
      
    } catch (err: any) {
      alert(err.message || 'Ошибка при отправке решения');
    } finally {
      setSubmitting(false);
    }
  };

  // 🔥 Расчёт итоговой стоимости
  const calculateTotalCost = () => {
    // Стоимость согласованных работ
    const worksCost = act?.works
      .filter(w => approvedWorks.find(aw => aw.recordId === w.recordId)?.isApproved)
      .reduce((sum, w) => sum + (w.estimatedCost ?? 0), 0) ?? 0;

    // Стоимость ЗИП в работах
    const linkedSparesCost = act?.works
      .filter(w => approvedWorks.find(aw => aw.recordId === w.recordId)?.isApproved)
      .flatMap(w => w.requiredSpares || [])
      .filter(spare => approvedSpares.find(as => as.recordId === spare.recordId)?.isApproved)
      .reduce((sum, s) => sum + ((s.unitPrice ?? 0) * s.quantity), 0) ?? 0;

    // Стоимость общих ЗИП
    const additionalSparesCost = additionalSpares
      .filter(s => approvedSpares.find(as => as.recordId === s.recordId)?.isApproved)
      .reduce((sum, s) => sum + ((s.unitPrice ?? 0) * s.quantity), 0);

    return worksCost + linkedSparesCost + additionalSparesCost;
  };

  const normalizeStatus = (status: string | number): string => {
    if (status === 2 || status === '2') return 'SentToClient';
    if (status === 3 || status === '3') return 'ApprovedByClient';
    if (status === 4 || status === '4') return 'RejectedByClient';
    return typeof status === 'number' ? status.toString() : status;
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

  const normalizedStatus = normalizeStatus(act.status);
  const statusInfo = getStatusBadge(normalizedStatus);
  const linkedSpareIds = new Set<number>(
    act.works.flatMap(work => work.requiredSpares?.map(spare => spare.recordId) || [])
  );
  const additionalSpares = act.spares.filter(spare => !linkedSpareIds.has(spare.recordId));

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
            <span className={styles.cost}>{act.estimatedCost?.toLocaleString('ru-RU')} ₽</span>
          </div>
        )}

        {act.estimatedTime && (
          <div className={styles.detailItem}>
            <label>Примерное время:</label>
            <span>{act.estimatedTime}</span>
          </div>
        )}
      </section>

      {/* 🔥 Работы с чекбоксами, ценами и привязанными ЗИП */}
      {act.works.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Рекомендуемые работы
            {normalizedStatus === 'SentToClient' && (
              <span className={styles.hint}>
                Чтобы отказаться от работы, нажмите крестик. 
                Отказанная работа автоматически скрывает связанные запчасти.
              </span>
            )}
          </h2>
          
          <div className={styles.worksList}>
            {act.works.map((work) => {
              const isChecked = approvedWorks.find(w => w.recordId === work.recordId)?.isApproved ?? true;
              const isDisabled = normalizedStatus !== 'SentToClient';
              const linkedSpares = work.requiredSpares || [];
              
              return (
                <div 
                  key={`work-${work.recordId}`} 
                  className={`${styles.workItem} ${!isChecked ? styles.rejected : ''}`}
                >
                  <input
                    type="checkbox"
                    checked={isChecked}
                    disabled
                    className={styles.checkbox}
                  />
                  <div className={styles.workDetails}>
                    <div className={styles.workHeader}>
                      <span className={styles.workName}>{work.workName}</span>
                      <div className={styles.workPrice}>
                        {work.estimatedCost && (
                          <span className={styles.price}>
                            {work.estimatedCost?.toLocaleString('ru-RU')} ₽
                          </span>
                        )}
                        {normalizedStatus === 'SentToClient' && (
                          <button
                            type="button"
                            className={`${styles.workActionBtn} ${isChecked ? styles.rejectBtn : styles.restoreBtn}`}
                            onClick={() => handleWorkToggle(work, !isChecked)}
                          >
                            {isChecked ? '✕ Отменить' : '↺ Вернуть'}
                          </button>
                        )}
                      </div>
                    </div>
                    {work.description && <span className={styles.workDesc}>{work.description}</span>}
                    
                    {/* 🔥 Отображаем привязанные ЗИП с ценами */}
                    {isChecked && linkedSpares.length > 0 && (
                      <div className={styles.linkedSpares}>
                        <span className={styles.spareLabel}>Требуемые запчасти:</span>
                        {linkedSpares.map(spare => (
                          <div key={`linked-spare-${spare.recordId}`} className={styles.linkedSpareItem}>
                            <span className={styles.spareName}>
                              {spare.spareName} × {spare.quantity} {spare.unit}
                            </span>
                            {spare.unitPrice && (
                              <span className={styles.sparePrice}>
                                {(spare.unitPrice * spare.quantity).toLocaleString('ru-RU')} ₽
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    {!isChecked && linkedSpares.length > 0 && (
                      <div className={styles.linkedSpares}>
                        <span className={styles.spareLabel}>
                          Связанные запчасти удалены, так как работа отклонена.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* 🔥 Общие ЗИП (не привязанные к работам) с ценами */}
      {additionalSpares.length > 0 && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Дополнительные запчасти</h2>
          <div className={styles.sparesList}>
            {additionalSpares.map((spare) => {
              const isChecked = approvedSpares.find(s => s.recordId === spare.recordId)?.isApproved ?? true;
              const isDisabled = normalizedStatus !== 'SentToClient';
              
              return (
                <label key={`spare-${spare.recordId}`} className={`${styles.spareItem} ${!isChecked ? styles.rejected : ''}`}>
                  <input
                    type="checkbox"
                    checked={isChecked}
                    onChange={(e) => handleSpareToggle(spare.recordId, e.target.checked)}
                    disabled={isDisabled}
                    className={styles.checkbox}
                  />
                  <div className={styles.spareDetails}>
                    <span className={styles.spareName}>{spare.spareName}</span>
                    <span className={styles.spareQty}>
                      {spare.quantity} {spare.unit}
                      {spare.unitPrice && (
                        <span className={styles.sparePrice}>
                          {' '}— {(spare.unitPrice * spare.quantity).toLocaleString('ru-RU')} ₽
                        </span>
                      )}
                    </span>
                  </div>
                </label>
              );
            })}
          </div>
        </section>
      )}

      {/* 🔥 Итоговая стоимость */}
      {normalizedStatus === 'SentToClient' && (
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>💰 Стоимость работ и запчастей</h2>
          
          <div className={styles.costSummary}>
            {/* Стоимость работ */}
            {act.works.filter(w => approvedWorks.find(aw => aw.recordId === w.recordId)?.isApproved).length > 0 && (
              <div className={styles.costItem}>
                <span>Работы:</span>
                <span className={styles.costValue}>
                  {act.works
                    .filter(w => approvedWorks.find(aw => aw.recordId === w.recordId)?.isApproved)
                    .reduce((sum, w) => sum + (w.estimatedCost ?? 0), 0)
                    .toLocaleString('ru-RU')} ₽
                </span>
              </div>
            )}
            
            {/* Стоимость ЗИП в работах */}
            {act.works
              .filter(w => approvedWorks.find(aw => aw.recordId === w.recordId)?.isApproved)
              .flatMap(w => w.requiredSpares || [])
              .filter(spare => approvedSpares.find(as => as.recordId === spare.recordId)?.isApproved)
              .length > 0 && (
              <div className={styles.costItem}>
                <span>Запчасти в работах:</span>
                <span className={styles.costValue}>
                  {act.works
                    .filter(w => approvedWorks.find(aw => aw.recordId === w.recordId)?.isApproved)
                    .flatMap(w => w.requiredSpares || [])
                    .filter(spare => approvedSpares.find(as => as.recordId === spare.recordId)?.isApproved)
                    .reduce((sum, s) => sum + ((s.unitPrice ?? 0) * s.quantity), 0)
                    .toLocaleString('ru-RU')} ₽
                </span>
              </div>
            )}
            
            {/* Стоимость общих ЗИП */}
            {additionalSpares.filter(s => approvedSpares.find(as => as.recordId === s.recordId)?.isApproved).length > 0 && (
              <div className={styles.costItem}>
                <span>Дополнительные запчасти:</span>
                <span className={styles.costValue}>
                  {additionalSpares
                    .filter(s => approvedSpares.find(as => as.recordId === s.recordId)?.isApproved)
                    .reduce((sum, s) => sum + ((s.unitPrice ?? 0) * s.quantity), 0)
                    .toLocaleString('ru-RU')} ₽
                </span>
              </div>
            )}
            
            {/* 🔥 ИТОГО */}
            <div className={styles.costTotal}>
              <span><strong>Итого к оплате:</strong></span>
              <span className={styles.costValue}>
                {calculateTotalCost().toLocaleString('ru-RU')} ₽
              </span>
            </div>
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