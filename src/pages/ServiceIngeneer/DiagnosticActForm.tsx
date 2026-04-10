// src/pages/ServiceEngineer/DiagnosticActForm.tsx

import React, { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { authService } from '../../services/authService';
import styles from './DiagnosticActForm.module.scss';
import {
  DiagnosticAct,
  DiagnosticErrors,
  WorkItem,
  WorkSpareLink,
  SpareOption
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
        setSpareOptions(MOCK_SPARE_OPTIONS);
        setWorkOptions(MOCK_WORK_OPTIONS);
      } finally {
        setDataLoading(false);
      }
    };
    loadOptions();
  }, []);

  // Данные заявки
  const [requestData] = useState({
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
    requiredSpares: [],  // 🔥 Теперь пусто - все ЗИП привязаны к работам
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
  const [workSearch, setWorkSearch] = useState('');

  // 🔥 Состояние для модального окна выбора ЗИП для работы
  const [showSpareModal, setShowSpareModal] = useState(false);
  const [currentWork, setCurrentWork] = useState<WorkItem | null>(null);
  const [workSpares, setWorkSpares] = useState<WorkSpareLink[]>([]);
  const [spareModalSearch, setSpareModalSearch] = useState('');

  // 🔥 Фильтрация работ
  const filteredWorks = useMemo(() => {
    const source = workOptions.length > 0 ? workOptions : MOCK_WORK_OPTIONS;
    if (!workSearch.trim()) return source;
    const query = workSearch.toLowerCase();
    return source.filter(work =>
      work.workName.toLowerCase().includes(query) ||
      work.description?.toLowerCase().includes(query)
    );
  }, [workSearch, workOptions]);

  // 🔥 Фильтрация ЗИП в модальном окне
  const filteredModalSpares = useMemo(() => {
    const source = spareOptions.length > 0 ? spareOptions : MOCK_SPARE_OPTIONS;
    if (!spareModalSearch.trim()) return source;
    const query = spareModalSearch.toLowerCase();
    return source.filter(spare =>
      spare.spareName.toLowerCase().includes(query)
    );
  }, [spareModalSearch, spareOptions]);

  // ✅ Обработчик изменений
  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
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
  const validateField = useCallback((name: string, value: string | undefined): string | undefined => {
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
      default:
        return undefined;
    }
  }, []);

  // Проверка валидности формы
  const isFormValid = useMemo(() => {
    const requiredFields = ['externalCondition', 'identifiedIssues', 'testResults', 'recommendations'];

    return requiredFields.every(field => {
      const value = formData[field as keyof DiagnosticAct];
      // 🔥 Проверяем, что значение - строка
      const error = validateField(field, typeof value === 'string' ? value : undefined);
      return !error;
    });
  }, [formData, validateField]);

  // 🔥 Открытие модального окна для добавления работы с ЗИП
  const handleAddWorkWithSpares = (workItem: WorkItem) => {
    const existing = formData.requiredWorks.find(w => w.workCode === workItem.workCode);
    if (existing) {
      alert('Эта работа уже добавлена');
      return;
    }
    setCurrentWork(workItem);
    setWorkSpares([]);
    setSpareModalSearch('');
    setShowSpareModal(true);
  };

  // 🔥 Добавление ЗИП в модальном окне
  const handleAddSpareToWork = (spareOption: SpareOption) => {
    const existing = workSpares.find(s => s.spareCode === spareOption.spareCode);
    if (existing) {
      setWorkSpares(prev =>
        prev.map(s =>
          s.spareCode === spareOption.spareCode
            ? { ...s, quantity: s.quantity + 1 }
            : s
        )
      );
    } else {
      setWorkSpares(prev => [
        ...prev,
        {
          spareCode: spareOption.spareCode,
          spareName: spareOption.spareName,
          quantity: 1,
          isRequired: true,
          unit: spareOption.unit
        }
      ]);
    }
  };

  // 🔥 Удаление ЗИП из работы
  const handleRemoveSpareFromWork = (spareCode: number) => {
    setWorkSpares(prev => prev.filter(s => s.spareCode !== spareCode));
  };

  // 🔥 Изменение количества ЗИП в работе
  const handleWorkSpareQuantityChange = (spareCode: number, quantity: number) => {
    if (quantity < 1) return;
    setWorkSpares(prev =>
      prev.map(s =>
        s.spareCode === spareCode ? { ...s, quantity } : s
      )
    );
  };

  // 🔥 Подтверждение добавления работы с ЗИП
  const handleConfirmWorkWithSpares = () => {
    if (!currentWork) return;
    const workWithSpares: WorkItem = {
      ...currentWork,
      requiredSpares: [...workSpares]
    };
    setFormData(prev => ({
      ...prev,
      requiredWorks: [...prev.requiredWorks, workWithSpares]
    }));
    setShowSpareModal(false);
    setCurrentWork(null);
    setWorkSpares([]);
    setWorkSearch('');
  };

  // ✅ Удаление работы
  const handleRemoveWork = (workCode: number) => {
    setFormData(prev => ({
      ...prev,
      requiredWorks: prev.requiredWorks.filter(w => w.workCode !== workCode)
    }));
  };

  // ✅ Отправка формы
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    console.log('🔍 НАЧАЛО ОТПРАВКИ ФОРМЫ');
    console.log('📋 formData:', formData);

    // Валидация
    const newErrors: DiagnosticErrors = {};
    ['externalCondition', 'identifiedIssues', 'testResults', 'recommendations'].forEach(key => {
      const value = formData[key as keyof DiagnosticAct];
      const error = validateField(key, value as string);
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

    const taskId = Number(requestId);
    if (!taskId || isNaN(taskId)) {
      console.error('❌ Неверный taskId:', requestId);
      alert('Ошибка: некорректный ID наряда');
      return;
    }

    setIsLoading(true);

    try {
      // 🔥 Формируем запрос: ЗИП только внутри работ
      const actRequest: CreateActRequest = {
        taskId: taskId,
        diagnosticDate: formData.diagnosticDate,
        externalCondition: formData.externalCondition,
        identifiedIssues: formData.identifiedIssues,
        testResults: formData.testResults,
        recommendations: formData.recommendations,
        estimatedCost: formData.estimatedCost,
        estimatedTime: formData.estimatedTime || '',
        requiredSpares: [],  // 🔥 Пусто - все ЗИП внутри requiredWorks
        requiredWorks: formData.requiredWorks.map(w => ({
          workCode: w.workCode,
          requiredSpares: w.requiredSpares?.map(s => ({
            spareCode: s.spareCode,
            quantity: s.quantity,
            isRequired: s.isRequired
          })) || []
        }))
      };

      console.log('📦 Отправляем запрос:', JSON.stringify(actRequest, null, 2));

      const actResult = await diagnosticActService.createAct(actRequest);
      console.log('✅ Акт создан:', actResult);

      alert('✅ Акт сохранён, наряд завершён!');
      navigate('/engineer');

    } catch (error: any) {
      console.error('========== ОШИБКА ==========');
      console.error('Message:', error.message);
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
              placeholder="Опишите внешние повреждения..."
              rows={4}
              disabled={isLoading}
            />
            <div className={styles.charCount}>{formData.externalCondition.length}/2000</div>
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
            <div className={styles.charCount}>{formData.identifiedIssues.length}/2000</div>
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
            <div className={styles.charCount}>{formData.testResults.length}/2000</div>
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
            <div className={styles.charCount}>{formData.recommendations.length}/2000</div>
            {errors.recommendations && touched.recommendations && (
              <span className={styles.errorMessage}>{errors.recommendations}</span>
            )}
          </div>
        </section>

        {/* 🔥 Перечень работ с привязанными ЗИП */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>
            Работы и требуемые запчасти
            <span className={styles.hint}>Добавляйте работы и указывайте запчасти для каждой</span>
          </h2>

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
                if (work) handleAddWorkWithSpares(work);
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
                        {work.estimatedTime && <span className={styles.workTime}>{work.estimatedTime}</span>}
                        {work.estimatedCost && <span className={styles.workCost}>{work.estimatedCost} ₽</span>}
                      </div>
                    )}

                    {/* 🔥 Привязанные ЗИП */}
                    {work.requiredSpares && work.requiredSpares.length > 0 && (
                      <div className={styles.workSpares}>
                        <span className={styles.spareLabel}>Запчасти:</span>
                        {work.requiredSpares.map(spare => (
                          <span key={spare.spareCode} className={styles.spareTag}>
                            {spare.spareName} × {spare.quantity} {spare.unit}
                          </span>
                        ))}
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
        </section>

        {/* Кнопки действий */}
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.cancelBtn}
            onClick={() => navigate('/engineer')}
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

      {/* 🔥 Модальное окно для выбора ЗИП для работы */}
      {showSpareModal && currentWork && (
        <div className={styles.modal}>
          <div className={styles.modalContent}>
            <h3 className={styles.modalTitle}>
              Запчасти для работы: {currentWork.workName}
            </h3>

            <div className={styles.spareSelector}>
              <input
                type="text"
                className={styles.spareSearchInput}
                placeholder="Поиск запчасти..."
                value={spareModalSearch}
                onChange={(e) => setSpareModalSearch(e.target.value)}
                list="modal-spare-options"
              />
              <datalist id="modal-spare-options">
                {filteredModalSpares.map(spare => (
                  <option key={spare.spareCode} value={spare.spareName} />
                ))}
              </datalist>
              <button
                type="button"
                className={styles.addSpareBtn}
                onClick={() => {
                  const spare = filteredModalSpares.find(s => s.spareName === spareModalSearch);
                  if (spare) handleAddSpareToWork(spare);
                }}
                disabled={!spareModalSearch.trim()}
              >
                + Добавить ЗИП
              </button>
            </div>

            {/* Выбранные ЗИП для работы */}
            {workSpares.length > 0 && (
              <div className={styles.selectedSpares}>
                <h4>Выбрано:</h4>
                {workSpares.map(spare => (
                  <div key={spare.spareCode} className={styles.selectedSpareItem}>
                    <span className={styles.spareName}>{spare.spareName}</span>
                    <div className={styles.spareControls}>
                      <button
                        type="button"
                        className={styles.quantityBtn}
                        onClick={() => handleWorkSpareQuantityChange(spare.spareCode, spare.quantity - 1)}
                        disabled={spare.quantity <= 1}
                      >
                        −
                      </button>
                      <span className={styles.quantity}>{spare.quantity} {spare.unit}</span>
                      <button
                        type="button"
                        className={styles.quantityBtn}
                        onClick={() => handleWorkSpareQuantityChange(spare.spareCode, spare.quantity + 1)}
                      >
                        +
                      </button>
                      <button
                        type="button"
                        className={styles.removeSpareBtn}
                        onClick={() => handleRemoveSpareFromWork(spare.spareCode)}
                      >
                        ✕
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.cancelBtn}
                onClick={() => {
                  setShowSpareModal(false);
                  setCurrentWork(null);
                  setWorkSpares([]);
                }}
              >
                Отмена
              </button>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={handleConfirmWorkWithSpares}
              >
                Добавить работу {workSpares.length > 0 && `(${workSpares.length} ЗИП)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiagnosticActForm;