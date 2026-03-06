import React, { useState, useMemo, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { authService } from '../../services/authService';
import { hasSQLInjection } from '../../utils/sqlInjection';
import styles from './DiagnosticActForm.module.scss';
import { 
  DiagnosticAct, 
  SpareItem, 
  SpareOption, 
  DiagnosticErrors 
} from '../../types/diagnostic';

// Моковые данные ЗИП (заменить на запрос к API)
const MOCK_SPARE_OPTIONS: SpareOption[] = [
  { spareCode: 1, spareName: 'Жёсткий диск HDD 500GB', amount: 45, unit: 'шт' },
  { spareCode: 2, spareName: 'Жёсткий диск SSD 256GB', amount: 32, unit: 'шт' },
  { spareCode: 3, spareName: 'Оперативная память DDR4 8GB', amount: 67, unit: 'шт' },
  { spareCode: 4, spareName: 'Блок питания 400W', amount: 23, unit: 'шт' },
  { spareCode: 5, spareName: 'Кулер процессора', amount: 18, unit: 'шт' },
  { spareCode: 6, spareName: 'Термопаста Arctic MX-4', amount: 12, unit: 'г' },
  { spareCode: 7, spareName: 'Кабель питания', amount: 89, unit: 'шт' },
  { spareCode: 8, spareName: 'Материнская плата ASUS', amount: 5, unit: 'шт' },
];

const DiagnosticActForm: React.FC = () => {
  const navigate = useNavigate();
  const { requestId } = useParams<{ requestId: string }>();

  // Данные заявки (загрузить с бэкенда)
  const [requestData, setRequestData] = useState({
    clientFio: 'Иванов Иван Иванович',
    clientPhone: '+7 (999) 123-45-67',
    svtType: 'Ноутбук',
    model: 'ASUS X515',
    serialNumber: 'AAA000000',
    description: 'Не включается, черный экран при нажатии кнопки питания',
    requestDate: '2026-02-25',
    requestTime: '01:31:05'
  });

  // Состояние формы
  const [formData, setFormData] = useState<DiagnosticAct>({
    requestId: Number(requestId) || 0,
    diagnosticDate: new Date().toISOString().split('T')[0],
    diagnosticTime: new Date().toTimeString().split(' ')[0].substring(0, 5),
    technicianFio: authService.getUserFio() || '',
    technicianTabNum: '',
    externalCondition: '',
    identifiedIssues: '',
    testResults: '',
    requiredSpares: [],
    recommendations: '',
    estimatedCost: undefined,
    estimatedTime: '',
    status: 'pending',
    rejectionReason: '',
  });

  const [errors, setErrors] = useState<DiagnosticErrors>({});
  const [touched, setTouched] = useState<Record<string, boolean>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [spareSearch, setSpareSearch] = useState('');

  // Валидация полей
  // Измените тип параметра value в validateField
const validateField = useCallback((name: string, value: string | number | SpareItem[] | undefined): string | undefined => {
  switch (name) {
    case 'technicianFio':
      if (!value) return 'Укажите ФИО техника';
      if (String(value).trim().length < 3) return 'Минимум 3 символа';
      if (hasSQLInjection(String(value))) return 'Подозрительные символы';
      return undefined;
      
    case 'technicianTabNum':
      if (!value) return 'Укажите табельный номер';
      if (!/^\d+$/.test(String(value))) return 'Только цифры';
      return undefined;
      
    case 'externalCondition':
      if (!value) return 'Опишите внешнее состояние';
      if (String(value).trim().length < 10) return 'Минимум 10 символов';
      return undefined;
      
    case 'identifiedIssues':
      if (!value) return 'Укажите выявленные неисправности';
      if (String(value).trim().length < 10) return 'Минимум 10 символов';
      return undefined;
      
    case 'testResults':
      if (!value) return 'Введите результаты тестов';
      if (String(value).trim().length < 10) return 'Минимум 10 символов';
      return undefined;
      
    case 'recommendations':
      if (!value) return 'Дайте рекомендации';
      if (String(value).trim().length < 10) return 'Минимум 10 символов';
      return undefined;
      
    case 'requiredSpares':
      if (formData.status === 'accepted' && (!value || (value as SpareItem[]).length === 0)) {
        return 'Добавьте хотя бы один ЗИП или выберите "Запчасти не требуются"';
      }
      return undefined;
      
    case 'status':
      if (!value) return 'Выберите статус';
      if (value === 'rejected' && !formData.rejectionReason?.trim()) {
        return 'Укажите причину отклонения';
      }
      return undefined;
      
    default:
      return undefined;
  }
}, [formData.status, formData.rejectionReason]);

  // Проверка валидности формы
  const isFormValid = useMemo(() => {
    const requiredFields = [
      'technicianFio', 'technicianTabNum', 'externalCondition',
      'identifiedIssues', 'testResults', 'recommendations', 'status'
    ];
    
    return requiredFields.every(field => {
      const error = validateField(field, formData[field as keyof DiagnosticAct]);
      return !error;
    }) && (formData.status !== 'rejected' || !!formData.rejectionReason?.trim());
  }, [formData, validateField]);

  // Обработчик изменений
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setTouched(prev => ({ ...prev, [name]: true }));
    
    if (touched[name]) {
      const error = validateField(name, value);
      setErrors(prev => ({ ...prev, [name]: error }));
    }
  };

  // Добавление ЗИП
  const handleAddSpare = (spareOption: SpareOption) => {
    const existing = formData.requiredSpares.find(s => s.spareCode === spareOption.spareCode);
    
    if (existing) {
      // Увеличиваем количество
      setFormData(prev => ({
        ...prev,
        requiredSpares: prev.requiredSpares.map(s =>
          s.spareCode === spareOption.spareCode
            ? { ...s, quantity: s.quantity + 1 }
            : s
        )
      }));
    } else {
      // Добавляем новый
      setFormData(prev => ({
        ...prev,
        requiredSpares: [...prev.requiredSpares, {
          spareCode: spareOption.spareCode,
          spareName: spareOption.spareName,
          quantity: 1,
          unit: spareOption.unit
        }]
      }));
    }
    setSpareSearch('');
  };

  // Удаление ЗИП
  const handleRemoveSpare = (spareCode: number) => {
    setFormData(prev => ({
      ...prev,
      requiredSpares: prev.requiredSpares.filter(s => s.spareCode !== spareCode)
    }));
  };

  // Изменение количества ЗИП
  const handleSpareQuantityChange = (spareCode: number, quantity: number) => {
    if (quantity < 1) return;
    setFormData(prev => ({
      ...prev,
      requiredSpares: prev.requiredSpares.map(s =>
        s.spareCode === spareCode ? { ...s, quantity } : s
      )
    }));
  };

  // Фильтрация ЗИП по поиску
  const filteredSpares = useMemo(() => {
    if (!spareSearch.trim()) return MOCK_SPARE_OPTIONS;
    const query = spareSearch.toLowerCase();
    return MOCK_SPARE_OPTIONS.filter(spare =>
      spare.spareName.toLowerCase().includes(query)
    );
  }, [spareSearch]);

  // Отправка формы
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Валидация всех полей
    const newErrors: DiagnosticErrors = {};
    Object.keys(formData).forEach(key => {
      const error = validateField(key, formData[key as keyof DiagnosticAct]);
      if (error) newErrors[key as keyof DiagnosticErrors] = error;
    });
    
    setErrors(newErrors);
    setTouched(Object.keys(formData).reduce((acc, key) => ({ ...acc, [key]: true }), {}));
    
    if (!isFormValid) return;
    
    setIsLoading(true);
    
    try {
      // TODO: Заменить на реальный API вызов
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      console.log('Отправка акта диагностики:', formData);
      
      alert('✅ Акт диагностики успешно сохранён!');
      navigate(`/admin/requests`);
      
    } catch (error: any) {
      console.error('Ошибка сохранения:', error);
      alert(error.message || 'Не удалось сохранить акт');
    } finally {
      setIsLoading(false);
    }
  };

  // Форматирование статуса для отображения
  const getStatusLabel = (status: string): string => {
    const labels: Record<string, string> = {
      pending: 'На рассмотрении',
      accepted: 'Принято в работу',
      rejected: 'Отклонено'
    };
    return labels[status] || status;
  };

  // ... импорты и начало компонента остаются без изменений ...

  return (
    <div className={styles.container}>
      <form className={styles.form} onSubmit={handleSubmit}>
        {/* Заголовок */}
        <div className={styles.header}>
          <h1 className={styles.title}>Акт диагностики №{requestId}</h1>
          <span className={styles.requestDate}>
            Заявка от {requestData.requestDate} {requestData.requestTime}
          </span>
        </div>

        {/* Информация о заявке (только чтение) */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Информация о заявке</h2>
          <div className={styles.infoGrid}>
            <div className={styles.infoItem}>
              <label>Клиент</label>
              <span>{requestData.clientFio}</span>
            </div>
            <div className={styles.infoItem}>
              <label>Телефон</label>
              <span>{requestData.clientPhone}</span>
            </div>
            <div className={styles.infoItem}>
              <label>Тип СВТ</label>
              <span>{requestData.svtType}</span>
            </div>
            <div className={styles.infoItem}>
              <label>Модель</label>
              <span>{requestData.model}</span>
            </div>
            <div className={styles.infoItem}>
              <label>Серийный номер</label>
              <span>{requestData.serialNumber}</span>
            </div>
            <div className={styles.infoItem}>
              <label>Описание проблемы</label>
              <p className={styles.description}>{requestData.description}</p>
            </div>
          </div>
        </section>

        {/* Данные техника */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Данные техника</h2>
          <div className={styles.fieldsRow}>
            <div className={styles.field}>
              <label className={styles.label}>
                ФИО техника <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                name="technicianFio"
                value={formData.technicianFio}
                onChange={handleChange}
                onBlur={() => {
                  setTouched(prev => ({ ...prev, technicianFio: true }));
                  const error = validateField('technicianFio', formData.technicianFio);
                  setErrors(prev => ({ ...prev, technicianFio: error }));
                }}
                className={`${styles.input} ${errors.technicianFio && touched.technicianFio ? styles.inputError : ''}`}
                placeholder="Иванов Иван Иванович"
                disabled={isLoading}
              />
              {errors.technicianFio && touched.technicianFio && (
                <span className={styles.errorMessage}>{errors.technicianFio}</span>
              )}
            </div>
            
            <div className={styles.field}>
              <label className={styles.label}>
                Табельный номер <span className={styles.required}>*</span>
              </label>
              <input
                type="text"
                name="technicianTabNum"
                value={formData.technicianTabNum}
                onChange={handleChange}
                onBlur={() => {
                  setTouched(prev => ({ ...prev, technicianTabNum: true }));
                  const error = validateField('technicianTabNum', formData.technicianTabNum);
                  setErrors(prev => ({ ...prev, technicianTabNum: error }));
                }}
                className={`${styles.input} ${errors.technicianTabNum && touched.technicianTabNum ? styles.inputError : ''}`}
                placeholder="12345"
                maxLength={10}
                disabled={isLoading}
              />
              {errors.technicianTabNum && touched.technicianTabNum && (
                <span className={styles.errorMessage}>{errors.technicianTabNum}</span>
              )}
            </div>
          </div>
          
          <div className={styles.fieldsRow}>
            <div className={styles.field}>
              <label className={styles.label}>
                Дата диагностики <span className={styles.required}>*</span>
              </label>
              <input
                type="date"
                name="diagnosticDate"
                value={formData.diagnosticDate}
                onChange={handleChange}
                className={styles.input}
                disabled={isLoading}
              />
            </div>
            
            <div className={styles.field}>
              <label className={styles.label}>
                Время диагностики <span className={styles.required}>*</span>
              </label>
              <input
                type="time"
                name="diagnosticTime"
                value={formData.diagnosticTime}
                onChange={handleChange}
                className={styles.input}
                disabled={isLoading}
              />
            </div>
          </div>
        </section>

        {/* Результаты диагностики */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Результаты диагностики</h2>
          
          <div className={styles.field}>
            <label className={styles.label}>
              Внешнее состояние устройства <span className={styles.required}>*</span>
            </label>
            <textarea
              name="externalCondition"
              value={formData.externalCondition}
              onChange={handleChange}
              onBlur={() => {
                setTouched(prev => ({ ...prev, externalCondition: true }));
                const error = validateField('externalCondition', formData.externalCondition);
                setErrors(prev => ({ ...prev, externalCondition: error }));
              }}
              className={`${styles.textarea} ${errors.externalCondition && touched.externalCondition ? styles.inputError : ''}`}
              placeholder="Опишите внешние повреждения, следы эксплуатации, комплектацию..."
              rows={4}
              disabled={isLoading}
            />
            <div className={styles.charCount}>
              {formData.externalCondition.length}/2000
            </div>
            {errors.externalCondition && touched.externalCondition && (
              <span className={styles.errorMessage}>{errors.externalCondition}</span>
            )}
          </div>
          
          <div className={styles.field}>
            <label className={styles.label}>
              Выявленные неисправности <span className={styles.required}>*</span>
            </label>
            <textarea
              name="identifiedIssues"
              value={formData.identifiedIssues}
              onChange={handleChange}
              onBlur={() => {
                setTouched(prev => ({ ...prev, identifiedIssues: true }));
                const error = validateField('identifiedIssues', formData.identifiedIssues);
                setErrors(prev => ({ ...prev, identifiedIssues: error }));
              }}
              className={`${styles.textarea} ${errors.identifiedIssues && touched.identifiedIssues ? styles.inputError : ''}`}
              placeholder="Перечислите обнаруженные проблемы..."
              rows={5}
              disabled={isLoading}
            />
            <div className={styles.charCount}>
              {formData.identifiedIssues.length}/2000
            </div>
            {errors.identifiedIssues && touched.identifiedIssues && (
              <span className={styles.errorMessage}>{errors.identifiedIssues}</span>
            )}
          </div>
          
          <div className={styles.field}>
            <label className={styles.label}>
              Результаты тестов <span className={styles.required}>*</span>
            </label>
            <textarea
              name="testResults"
              value={formData.testResults}
              onChange={handleChange}
              onBlur={() => {
                setTouched(prev => ({ ...prev, testResults: true }));
                const error = validateField('testResults', formData.testResults);
                setErrors(prev => ({ ...prev, testResults: error }));
              }}
              className={`${styles.textarea} ${errors.testResults && touched.testResults ? styles.inputError : ''}`}
              placeholder="Результаты аппаратных и программных тестов..."
              rows={4}
              disabled={isLoading}
            />
            <div className={styles.charCount}>
              {formData.testResults.length}/2000
            </div>
            {errors.testResults && touched.testResults && (
              <span className={styles.errorMessage}>{errors.testResults}</span>
            )}
          </div>
        </section>

        {/* Требуемые ЗИП */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Требуемые ЗИП</h2>
          
          {/* Поиск и добавление */}
          <div className={styles.spareSearch}>
            <input
              type="text"
              className={styles.spareSearchInput}
              placeholder="Поиск запчасти..."
              value={spareSearch}
              onChange={(e) => setSpareSearch(e.target.value)}
              disabled={isLoading}
              list="spare-options"
            />
            <datalist id="spare-options">
              {MOCK_SPARE_OPTIONS.map(spare => (
                <option key={spare.spareCode} value={spare.spareName} />
              ))}
            </datalist>
            <button
              type="button"
              className={styles.addSpareBtn}
              onClick={() => {
                const spare = MOCK_SPARE_OPTIONS.find(s => s.spareName === spareSearch);
                if (spare) handleAddSpare(spare);
              }}
              disabled={isLoading || !spareSearch.trim()}
            >
              + Добавить
            </button>
          </div>
          
          {/* Список добавленных ЗИП */}
          {formData.requiredSpares.length > 0 && (
            <div className={styles.spareList}>
              {formData.requiredSpares.map(spare => (
                <div key={spare.spareCode} className={styles.spareItem}>
                  <span className={styles.spareName}>{spare.spareName}</span>
                  <div className={styles.spareControls}>
                    <button
                      type="button"
                      className={styles.quantityBtn}
                      onClick={() => handleSpareQuantityChange(spare.spareCode, spare.quantity - 1)}
                      disabled={isLoading || spare.quantity <= 1}
                    >
                      −
                    </button>
                    <span className={styles.quantity}>{spare.quantity} {spare.unit}</span>
                    <button
                      type="button"
                      className={styles.quantityBtn}
                      onClick={() => handleSpareQuantityChange(spare.spareCode, spare.quantity + 1)}
                      disabled={isLoading}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      className={styles.removeSpareBtn}
                      onClick={() => handleRemoveSpare(spare.spareCode)}
                      disabled={isLoading}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {errors.requiredSpares && touched.requiredSpares && (
            <span className={styles.errorMessage}>{errors.requiredSpares}</span>
          )}
        </section>

        {/* Подписи */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Подписи</h2>
          <div className={styles.signatures}>
            <div className={styles.signature}>
              <div className={styles.signatureLine}>
                <span>Техник:</span>
                <span className={styles.signatureValue}>{formData.technicianFio || '________________'}</span>
              </div>
              <span className={styles.signatureHint}>Электронная подпись</span>
            </div>
            <div className={styles.signature}>
              <div className={styles.signatureLine}>
                <span>Клиент:</span>
                <span className={styles.signatureValue}>________________</span>
              </div>
              <span className={styles.signatureHint}>Подпись при получении</span>
            </div>
          </div>
        </section>

        {/* Кнопки действий */}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => navigate('/admin/requests')}
            disabled={isLoading}
          >
            Отмена
          </button>
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={!isFormValid || isLoading}
          >
            {isLoading ? (
              <span className={styles.loading}>
                <span className={styles.spinner}></span>
                Сохранение...
              </span>
            ) : (
              'Сохранить акт'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};


export default DiagnosticActForm;