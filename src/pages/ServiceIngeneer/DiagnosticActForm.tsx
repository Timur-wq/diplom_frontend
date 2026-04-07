import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { authService } from '../../services/authService';
import { hasSQLInjection } from '../../utils/sqlInjection';
import styles from './DiagnosticActForm.module.scss';
import {
  DiagnosticAct,
  SpareItem,
  SpareOption,
  DiagnosticErrors,
  WorkItem
} from '../../types/diagnostic';
import { diagnosticActService, CreateActRequest } from '../../services/diagnosticActService';

// Моковые данные ЗИП
const MOCK_SPARE_OPTIONS: SpareOption[] = [
  { spareCode: 1, spareName: 'Жёсткий диск HDD 500GB', amount: 45, unit: 'шт' },
  { spareCode: 2, spareName: 'Жёсткий диск SSD 256GB', amount: 32, unit: 'шт' },
  { spareCode: 3, spareName: 'Оперативная память DDR4 8GB', amount: 67, unit: 'шт' },
  { spareCode: 4, spareName: 'Блок питания 400W', amount: 23, unit: 'шт' },
  { spareCode: 5, spareName: 'Кулер процессора', amount: 18, unit: 'шт' },
  { spareCode: 6, spareName: 'Термопаста Arctic MX-4', amount: 12, unit: 'г' },
];

// Моковые данные работ
const MOCK_WORK_OPTIONS: WorkItem[] = [
  { workCode: 1, workName: 'Диагностика устройства', description: 'Полная аппаратная и программная диагностика', estimatedTime: '30 мин', estimatedCost: 500 },
  { workCode: 2, workName: 'Замена термопасты', description: 'Замена термопасты процессора и видеокарты', estimatedTime: '1 час', estimatedCost: 800 },
  { workCode: 3, workName: 'Чистка от пыли', description: 'Полная чистка системы охлаждения', estimatedTime: '1.5 часа', estimatedCost: 1200 },
  { workCode: 4, workName: 'Замена жесткого диска', description: 'Установка и настройка нового HDD/SSD', estimatedTime: '2 часа', estimatedCost: 1500 },
  { workCode: 5, workName: 'Установка операционной системы', description: 'Установка Windows/Linux с драйверами', estimatedTime: '3 часа', estimatedCost: 2000 },
  { workCode: 6, workName: 'Замена матрицы', description: 'Замена экрана ноутбука/монитора', estimatedTime: '2 часа', estimatedCost: 2500 },
  { workCode: 7, workName: 'Ремонт блока питания', description: 'Диагностика и ремонт БП', estimatedTime: '2 часа', estimatedCost: 1800 },
  { workCode: 8, workName: 'Замена оперативной памяти', description: 'Установка новых модулей RAM', estimatedTime: '30 мин', estimatedCost: 500 },
];

const DiagnosticActForm: React.FC = () => {
  const navigate = useNavigate();
  const { requestId } = useParams<{ requestId: string }>();
  const formRef = useRef<HTMLFormElement>(null);

  const [spareOptions, setSpareOptions] = useState<SpareOption[]>([]);
  const [workOptions, setWorkOptions] = useState<WorkItem[]>([]);
  const [dataLoading, setDataLoading] = useState(true);

  useEffect(() => {
    const loadOptions = async () => {
      try {
        const [spares, works] = await Promise.all([
          authService.getSpares(),
          authService.getWorks()
        ]);

        setSpareOptions(spares);
        setWorkOptions(works);
      } catch (err) {
        console.error('Ошибка загрузки данных:', err);
        // 🔥 Фолбэк на моковые данные при ошибке
        setSpareOptions(MOCK_SPARE_OPTIONS);
        setWorkOptions(MOCK_WORK_OPTIONS);
      } finally {
        setDataLoading(false);
      }
    };

    loadOptions();
  }, []);

  // Данные заявки
  const [requestData, setRequestData] = useState({
    clientFio: 'Иванов Иван Иванович',
    clientPhone: '+7 (000) 000-00-00',
    svtType: 'Ноутбук',
    model: 'ASUS X515',
    serialNumber: '000000000',
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
    requiredWorks: [],
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
  const [workSearch, setWorkSearch] = useState('');

  // 🔥 Фильтрация ЗИП (используем spareOptions из стейта)
  const filteredSpares = useMemo(() => {
    const source = spareOptions.length > 0 ? spareOptions : MOCK_SPARE_OPTIONS;

    if (!spareSearch.trim()) return source;
    const query = spareSearch.toLowerCase();
    return source.filter(spare =>
      spare.spareName.toLowerCase().includes(query)
    );
  }, [spareSearch, spareOptions]);

  // 🔥 Фильтрация работ (используем workOptions из стейта)
  const filteredWorks = useMemo(() => {
    const source = workOptions.length > 0 ? workOptions : MOCK_WORK_OPTIONS;

    if (!workSearch.trim()) return source;
    const query = workSearch.toLowerCase();
    return source.filter(work =>
      work.workName.toLowerCase().includes(query) ||
      work.description?.toLowerCase().includes(query)
    );
  }, [workSearch, workOptions]);

  // ✅ Обработчик изменений
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

  // Валидация полей
  const validateField = useCallback((name: string, value: string | number | SpareItem[] | WorkItem[] | undefined): string | undefined => {
    switch (name) {
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

      case 'requiredWorks':
        if (formData.status === 'accepted' && (!value || (value as WorkItem[]).length === 0)) {
          return 'Добавьте хотя бы одну работу';
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
      'externalCondition',
      'identifiedIssues',
      'testResults',
      'recommendations',
      'status'
    ];

    return requiredFields.every(field => {
      const error = validateField(field, formData[field as keyof DiagnosticAct]);
      return !error;
    }) && (formData.status !== 'rejected' || !!formData.rejectionReason?.trim());
  }, [formData, validateField]);

  // ✅ Добавление работы
  const handleAddWork = (workItem: WorkItem) => {
    const existing = formData.requiredWorks.find(w => w.workCode === workItem.workCode);

    if (existing) {
      return;
    }

    setFormData(prev => ({
      ...prev,
      requiredWorks: [...prev.requiredWorks, {
        workCode: workItem.workCode,
        workName: workItem.workName,
        description: workItem.description,
        estimatedTime: workItem.estimatedTime,
        estimatedCost: workItem.estimatedCost
      }]
    }));
    setWorkSearch('');
    console.log('➕ Работа добавлена:', workItem.workName);
    console.log('📋 formData.requiredWorks:', formData.requiredWorks);
  };

  // ✅ Удаление работы
  const handleRemoveWork = (workCode: number) => {
    setFormData(prev => ({
      ...prev,
      requiredWorks: prev.requiredWorks.filter(w => w.workCode !== workCode)
    }));
  };

  // ✅ Добавление ЗИП
  const handleAddSpare = (spareOption: SpareOption) => {
    const existing = formData.requiredSpares.find(s => s.spareCode === spareOption.spareCode);

    if (existing) {
      setFormData(prev => ({
        ...prev,
        requiredSpares: prev.requiredSpares.map(s =>
          s.spareCode === spareOption.spareCode
            ? { ...s, quantity: s.quantity + 1 }
            : s
        )
      }));
    } else {
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

    console.log('➕ ЗИП добавлен:', spareOption.spareName);
    console.log('📋 formData.requiredSpares:', formData.requiredSpares);
  };

  // ✅ Удаление ЗИП
  const handleRemoveSpare = (spareCode: number) => {
    setFormData(prev => ({
      ...prev,
      requiredSpares: prev.requiredSpares.filter(s => s.spareCode !== spareCode)
    }));
  };

  // ✅ Изменение количества ЗИП
  const handleSpareQuantityChange = (spareCode: number, quantity: number) => {
    if (quantity < 1) return;
    setFormData(prev => ({
      ...prev,
      requiredSpares: prev.requiredSpares.map(s =>
        s.spareCode === spareCode ? { ...s, quantity } : s
      )
    }));
  };

  // ✅ Отправка формы
  // ✅ Отправка формы (с детальным логированием)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('🔍 НАЧАЛО ОТПРАВКИ ФОРМЫ');
    console.log('📋 requestId из URL:', requestId);
    console.log('📋 formData:', formData);

    // Валидация
    const newErrors: DiagnosticErrors = {};
    ['externalCondition', 'identifiedIssues', 'testResults', 'recommendations'].forEach(key => {
      const value = formData[key as keyof DiagnosticAct];
      const error = validateField(key, value);
      if (error) newErrors[key as keyof DiagnosticErrors] = error;
    });

    setErrors(newErrors);
    setTouched({
      externalCondition: true,
      identifiedIssues: true,
      testResults: true,
      recommendations: true
    });

    if (!isFormValid) {
      console.error('❌ Валидация не пройдена:', newErrors);
      alert('Заполните все обязательные поля');
      return;
    }

    // Проверка taskId
    const taskId = Number(requestId);
    if (!taskId || isNaN(taskId)) {
      console.error('❌ Неверный taskId:', requestId);
      alert('Ошибка: некорректный ID наряда');
      return;
    }

    setIsLoading(true);

    // ✅ Правильный код в handleSubmit:

    try {
      // 🔥 Формируем запрос в формате бэкенда
      const actRequest: CreateActRequest = {
        taskId: taskId,
        diagnosticDate: formData.diagnosticDate,
        externalCondition: formData.externalCondition,
        identifiedIssues: formData.identifiedIssues,
        testResults: formData.testResults,
        recommendations: formData.recommendations,
        estimatedCost: formData.estimatedCost,
        estimatedTime: formData.estimatedTime || '',
        requiredSpares: formData.requiredSpares.map(s => ({
          spareCode: s.spareCode,
          quantity: s.quantity
        })),
        requiredWorks: formData.requiredWorks.map(w => ({
          workCode: w.workCode
        }))
      };

      console.log('📦 Отправляем запрос:', JSON.stringify(actRequest, null, 2));

      // 🔥 1. Создаём акт (он сам завершит наряд!)
      const actResult = await diagnosticActService.createAct(actRequest);

      console.log('✅ Акт создан:', actResult);

      // 🔥 НЕ вызываем completeTask() - акт уже завершил наряд!

      alert('✅ Акт сохранён, наряд завершён!');
      navigate('/engineer');  // Возврат в личный кабинет

    } catch (error: any) {
      console.error('========== ОШИБКА ==========');
      console.error('Message:', error.message);
      console.error('Stack:', error.stack);
      alert(error.message || 'Не удалось создать акт');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <form className={styles.form} onSubmit={handleSubmit} ref={formRef}>
        {/* Заголовок */}
        <div className={styles.header}>
          <h1 className={styles.title}>Акт диагностики №{requestId}</h1>
          <span className={styles.requestDate}>
            Заявка от {requestData.requestDate} {requestData.requestTime}
          </span>
        </div>

        {/* Информация о заявке */}
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

        {/* Результаты диагностики */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Результаты диагностики</h2>

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

          <div className={styles.field}>
            <label className={styles.label}>
              Рекомендации <span className={styles.required}>*</span>
            </label>
            <textarea
              name="recommendations"
              value={formData.recommendations}
              onChange={handleChange}
              onBlur={() => {
                setTouched(prev => ({ ...prev, recommendations: true }));
                const error = validateField('recommendations', formData.recommendations);
                setErrors(prev => ({ ...prev, recommendations: error }));
              }}
              className={`${styles.textarea} ${errors.recommendations && touched.recommendations ? styles.inputError : ''}`}
              placeholder="Рекомендуемые действия по устранению неисправностей..."
              rows={4}
              disabled={isLoading}
            />
            <div className={styles.charCount}>
              {formData.recommendations.length}/2000
            </div>
            {errors.recommendations && touched.recommendations && (
              <span className={styles.errorMessage}>{errors.recommendations}</span>
            )}
          </div>
        </section>

        {/* Перечень необходимых работ */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Перечень необходимых работ</h2>

          {/* Поиск и добавление работ */}
          <div className={styles.workSearch}>
            <input
              type="text"
              className={styles.workSearchInput}
              placeholder="Поиск работы..."
              value={workSearch}
              onChange={(e) => setWorkSearch(e.target.value)}
              disabled={isLoading}
              list="work-options"
            />
            <datalist id="work-options">
              {filteredWorks.map(work => (
                <option key={work.workCode} value={work.workName} />
              ))}
            </datalist>
            <button
              type="button"
              className={styles.addWorkBtn}
              onClick={() => {
                const work = filteredWorks.find(w => w.workName === workSearch);
                if (work) handleAddWork(work);
              }}
              disabled={isLoading || !workSearch.trim()}
            >
              + Добавить работу
            </button>
          </div>

          {/* Список добавленных работ */}
          {formData.requiredWorks.length > 0 && (
            <div className={styles.workList}>
              {formData.requiredWorks.map((work: WorkItem) => (
                <div key={work.workCode} className={styles.workItem}>
                  <div className={styles.workInfo}>
                    <span className={styles.workName}>{work.workName}</span>
                    {work.description && (
                      <span className={styles.workDescription}>{work.description}</span>
                    )}
                    {(work.estimatedTime || work.estimatedCost) && (
                      <div className={styles.workMeta}>
                        {work.estimatedTime && (
                          <span className={styles.workTime}>{work.estimatedTime}</span>
                        )}
                        {work.estimatedCost && (
                          <span className={styles.workCost}>{work.estimatedCost} ₽</span>
                        )}
                      </div>
                    )}
                  </div>
                  <button
                    type="button"
                    className={styles.removeWorkBtn}
                    onClick={() => handleRemoveWork(work.workCode)}
                    disabled={isLoading}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}

          {errors.requiredWorks && touched.requiredWorks && (
            <span className={styles.errorMessage}>{errors.requiredWorks}</span>
          )}
        </section>

        {/* Требуемые ЗИП */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Требуемые ЗИП</h2>

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
              {filteredSpares.map(spare => (
                <option key={spare.spareCode} value={spare.spareName} />
              ))}
            </datalist>
            <button
              type="button"
              className={styles.addSpareBtn}
              onClick={() => {
                const spare = filteredSpares.find(s => s.spareName === spareSearch);
                if (spare) handleAddSpare(spare);
              }}
              disabled={isLoading || !spareSearch.trim()}
            >
              + Добавить
            </button>
          </div>

          {formData.requiredSpares.length > 0 && (
            <div className={styles.spareList}>
              {formData.requiredSpares.map((spare: SpareItem) => (
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
        {/* <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Подписи</h2>
          <div className={styles.signatures}>
            <div className={styles.signature}>
              <div className={styles.signatureLine}>
                <span>Техник:</span>
                <span className={styles.signatureValue}>{formData.technicianFio || '________________'}</span>
              </div>
              <span className={styles.signatureHint}>Электронная подпись (автоматически)</span>
            </div>
            <div className={styles.signature}>
              <div className={styles.signatureLine}>
                <span>Клиент:</span>
                <span className={styles.signatureValue}>________________</span>
              </div>
              <span className={styles.signatureHint}>Подпись при получении</span>
            </div>
          </div>
        </section> */}

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