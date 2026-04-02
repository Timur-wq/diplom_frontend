import React, { useState, ChangeEvent, FormEvent, useMemo } from 'react';
import { IMaskInput } from 'react-imask';
import styles from '../Login/login.module.scss';
import { hasSQLInjection } from '../../utils/sqlInjection';
import { DEVICE_TYPES, DeviceTypeValue } from '../../utils/constants';

// API URL (замените на ваш адрес)
const API_URL = 'https://localhost:7053/api';

// Типы данных формы
interface FormData {
  fullName: string;
  phone: string;
  deviceType: DeviceTypeValue | '';
  model: string;
  serialNumber: string;
  issueDate: string;  // "YYYY-MM-DD"
  issueTime: string;  // "HH:mm:ss"
  description: string;
}

// Типы ошибок валидации ✅ Добавлены issueDate и issueTime
interface FormErrors {
  fullName?: string;
  phone?: string;
  deviceType?: string; 
  model?: string;
  serialNumber?: string;
  description?: string;
  issueDate?: string;  // ✅ Добавлено
  issueTime?: string;  // ✅ Добавлено
}

const RequestForm: React.FC = () => {
  // ✅ Функция для получения текущей даты в формате YYYY-MM-DD
  const getCurrentDate = () => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  };

  // ✅ Функция для получения текущего времени в формате HH:mm:ss
  const getCurrentTime = () => {
    const now = new Date();
    return now.toTimeString().split(' ')[0];
  };

  const [formData, setFormData] = useState<FormData>({
    fullName: '',
    phone: '',
    deviceType: '',
    model: '',
    serialNumber: '',
    issueDate: getCurrentDate(),  // ✅ Автозаполнение
    issueTime: getCurrentTime(),  // ✅ Автозаполнение
    description: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [touched, setTouched] = useState<Record<keyof FormData, boolean>>({
    fullName: false,
    phone: false,
    deviceType: false,
    model: false,
    serialNumber: false,
    issueDate: false,
    issueTime: false,
    description: false,
  });

  // Валидация отдельного поля
  const validateField = (name: keyof FormData, value: string): string | undefined => {
    // ✅ Авто-поля не валидируем
    if (name === 'issueDate' || name === 'issueTime') {
      return undefined;
    }

    switch (name) {
      case 'fullName': {
         const words = value.trim().split(/\s+/).filter(word => word.length > 0);
         const nameRegex = /^[a-zA-Zа-яА-ЯёЁ\s-]+$/;
         
         if (!value.trim()) return 'ФИО обязательно для заполнения';
         if (!nameRegex.test(value)) return 'ФИО может содержать только буквы, пробелы и дефисы';
         if (words.length < 3) return 'Введите фамилию, имя и отчество (три слова)';
         if (words.length > 3) return 'ФИО должно содержать ровно три слова';
         if (words.some(word => word.length < 2)) {
          return 'Каждое слово в ФИО должно содержать минимум 2 буквы';
         }
         if (hasSQLInjection(value.trim())) return 'Обнаружены подозрительные символы';
         return undefined;
      }
      case 'phone': {
        const cleanPhone = value.replace(/\D/g, '');
        if (cleanPhone.length < 11) return 'Введите полный номер телефона';
        return undefined;
      }
      case 'deviceType': {
        if (!value) return 'Выберите тип СВТ';
        return undefined;
      }
      case 'model': {
        if (!value.trim()) return 'Укажите модель СВТ';
        if (value.trim().length < 2) return 'Модель должна содержать минимум 2 символа';
        if (value.length > 100) return 'Модель не должна превышать 100 символов';
        if (hasSQLInjection(value.trim())) return 'Обнаружены подозрительные символы';
        return undefined;
      }
      case 'serialNumber': {
        if (!value.trim()) return 'Серийный номер обязателен';
        if (hasSQLInjection(value.trim())) return 'Обнаружены подозрительные символы';
        return undefined;
      }
      case 'description': {
        if (!value.trim()) return 'Опишите неисправность';
        if (value.trim().length < 10) return 'Описание должно содержать минимум 10 символов';
        if (value.length > 2000) return 'Описание не должно превышать 2000 символов';
        if (hasSQLInjection(value.trim())) return 'Обнаружены подозрительные символы';
        return undefined;
      }
      default:
        return undefined;
    }
  };

  // Обработчик изменения полей
  const handleChange = (
    e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    const fieldName = name as keyof FormData;
    
    setFormData((prev) => ({ ...prev, [fieldName]: value }));
    setTouched((prev) => ({ ...prev, [fieldName]: true }));
    
    if (touched[fieldName] || value.length > 0) {
      const error = validateField(fieldName, value);
      setErrors((prev) => ({ ...prev, [fieldName]: error }));
    }
  };

  // Обработчик для телефона (IMask)
  const handlePhoneAccept = (value: string) => {
    setFormData((prev) => ({ ...prev, phone: value }));
    setTouched((prev) => ({ ...prev, phone: true }));
    const error = validateField('phone', value);
    setErrors((prev) => ({ ...prev, phone: error }));
  };

  // Обработчик для ФИО (IMask)
  const handleFullNameAccept = (value: string) => {
    setFormData((prev) => ({ ...prev, fullName: value }));
    setTouched((prev) => ({ ...prev, fullName: true }));
    const error = validateField('fullName', value);
    setErrors((prev) => ({ ...prev, fullName: error }));
  };

  // Обработчик blur
  const handleBlur = (fieldName: keyof FormData) => {
    setTouched((prev) => ({ ...prev, [fieldName]: true }));
    const error = validateField(fieldName, formData[fieldName]);
    setErrors((prev) => ({ ...prev, [fieldName]: error }));
  };

  // Проверка валидности формы ✅ Исключены авто-поля
  const isFormValid = useMemo(() => {
    const fields: (keyof FormData)[] = [
      'fullName', 'phone', 'deviceType', 'model', 'serialNumber', 'description'
    ];
    return fields.every((field) => {
      const error = validateField(field, formData[field]);
      return !error;
    });
  }, [formData]);

  // ✅ Отправка формы с POST-запросом
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    
    // Поля для валидации
    const fieldsToValidate: (keyof FormData)[] = [
      'fullName', 'phone', 'deviceType', 'model', 'serialNumber', 'description'
    ];
    
    const newErrors: FormErrors = {};
    fieldsToValidate.forEach((field) => {
      const error = validateField(field, formData[field]);
      if (error) newErrors[field] = error;
    });
    
    setErrors(newErrors);
    
    const newTouched = { ...touched };
    fieldsToValidate.forEach(field => { newTouched[field] = true; });
    setTouched(newTouched);

    // Если есть ошибки — не отправляем
    if (Object.keys(newErrors).length > 0) return;

    try {
      // ✅ Формируем данные для отправки (включая авто-дату/время)
      const requestData = {
        fio: formData.fullName,
        phone: formData.phone.replace(/\D/g, ''), // только цифры
        svtType: formData.deviceType,
        model: formData.model,
        serialNumber: formData.serialNumber,
        dateOnly: formData.issueDate,  // ✅ "YYYY-MM-DD"
        timeOnly: formData.issueTime,  // ✅ "HH:mm:ss"
        description: formData.description
      };

      console.log('Отправка данных:', requestData);

      const response = await fetch(`${API_URL}/createRequest`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestData),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `Ошибка: ${response.status}`);
      }

      const requestId = await response.json();
      
      alert(`✅ Заявка успешно отправлена! ID: ${requestId}`);
      
      // ✅ Сброс формы с новыми авто-значениями
      setFormData({
        fullName: '',
        phone: '',
        deviceType: '',
        model: '',
        serialNumber: '',
        issueDate: getCurrentDate(),
        issueTime: getCurrentTime(),
        description: '',
      });
      setErrors({});
      setTouched({
        fullName: false,
        phone: false,
        deviceType: false,
        model: false,
        serialNumber: false,
        issueDate: false,
        issueTime: false,
        description: false,
      });

    } catch (error) {
      console.error('Ошибка отправки:', error);
      alert(`❌ Не удалось отправить заявку: ${error instanceof Error ? error.message : 'Неизвестная ошибка'}`);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.form}>
        <h1 className={styles.title}>Подать заявку на ремонт СВТ</h1>
        
        <form onSubmit={handleSubmit}>
          {/* Поле ФИО с маской */}
          <div className={styles.field}>
            <label className={styles.label}>
              ФИО клиента <span className={styles.required}>*</span>
            </label>
            <IMaskInput
              mask={/^[a-zA-Zа-яА-ЯёЁ\s-]*$/}
              value={formData.fullName}
              onAccept={handleFullNameAccept}
              onBlur={() => handleBlur('fullName')}
              className={`${styles.input} ${errors.fullName && touched.fullName ? styles.inputError : ''}`}
              placeholder="Иванов Иван Иванович"
            />
            {errors.fullName && touched.fullName && (
              <div className={styles.errorMessage}>{errors.fullName}</div>
            )}
          </div>

          {/* Поле телефона с маской */}
          <div className={styles.field}>
            <label className={styles.label}>
              Контактные данные <span className={styles.required}>*</span>
            </label>
            <IMaskInput
              mask="+{7} (000) 000-00-00"
              value={formData.phone}
              onAccept={handlePhoneAccept}
              onBlur={() => handleBlur('phone')}
              className={`${styles.input} ${errors.phone && touched.phone ? styles.inputError : ''}`}
              placeholder="+7 (___) ___-__-__"
              unmask={true}
            />
            {errors.phone && touched.phone && (
              <div className={styles.errorMessage}>{errors.phone}</div>
            )}
          </div>

          {/* Выпадающий список типа СВТ */}
          <div className={styles.field}>
            <label className={styles.label}>
              Тип СВТ <span className={styles.required}>*</span>
            </label>
            <select
              name="deviceType"
              value={formData.deviceType}
              onChange={handleChange}
              onBlur={() => handleBlur('deviceType')}
              className={`${styles.input} ${errors.deviceType && touched.deviceType ? styles.inputError : ''}`}
            >
              <option value="">-- Выберите тип устройства --</option>
              {DEVICE_TYPES.map((device) => (
                <option key={device.value} value={device.value}>
                  {device.label}
                </option>
              ))}
            </select>
            {errors.deviceType && touched.deviceType && (
              <div className={styles.errorMessage}>{errors.deviceType}</div>
            )}
          </div>

          {/* Поле ввода модели СВТ */}
          <div className={styles.field}>
            <label className={styles.label}>
              Модель СВТ <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              name="model"
              value={formData.model}
              onChange={handleChange}
              onBlur={() => handleBlur('model')}
              className={`${styles.input} ${errors.model && touched.model ? styles.inputError : ''}`}
              placeholder="Например: ASUS X515, Lenovo IdeaPad 3, HP Pavilion"
              maxLength={100}
            />
            {errors.model && touched.model && (
              <div className={styles.errorMessage}>{errors.model}</div>
            )}
          </div>

          {/* Серийный номер */}
          <div className={styles.field}>
            <label className={styles.label}>
              Серийный номер <span className={styles.required}>*</span>
            </label>
            <input
              type="text"
              name="serialNumber"
              value={formData.serialNumber}
              onChange={handleChange}
              onBlur={() => handleBlur('serialNumber')}
              className={`${styles.input} ${errors.serialNumber && touched.serialNumber ? styles.inputError : ''}`}
              placeholder="AAA000000"
              maxLength={50}
            />
            {errors.serialNumber && touched.serialNumber && (
              <div className={styles.errorMessage}>{errors.serialNumber}</div>
            )}
          </div>

          {/* ✅ Дата и время (авто, readonly) */}
          <div className={styles.dateTimeGroup}>
            <h3 className={styles.sectionTitle}>Дата и время поступления</h3>
            <div className={styles.dateTimeRow}>
              <div className={styles.field}>
                <label className={styles.label}>Дата</label>
                <input
                  type="date"
                  name="issueDate"
                  value={formData.issueDate}
                  readOnly
                  className={`${styles.input} ${styles.readonlyInput}`}
                />
              </div>
              <div className={styles.field}>
                <label className={styles.label}>Время</label>
                <input
                  type="time"
                  name="issueTime"
                  value={formData.issueTime}
                  readOnly
                  className={`${styles.input} ${styles.readonlyInput}`}
                />
              </div>
            </div>
          </div>

          {/* Описание неисправности */}
          <div className={styles.field}>
            <label className={styles.label}>
              Описание неисправности <span className={styles.required}>*</span>
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              onBlur={() => handleBlur('description')}
              className={`${styles.input} ${styles.textarea} ${errors.description && touched.description ? styles.inputError : ''}`}
              placeholder="Опишите проблему: что не работает, когда появилась неисправность и т.д."
              rows={8}
              maxLength={2000}
            />
            <div className={styles.charCount}>
              {formData.description.length}/2000
            </div>
            {errors.description && touched.description && (
              <div className={styles.errorMessage}>{errors.description}</div>
            )}
          </div>

          {/* Кнопка отправки */}
          <button 
            type="submit" 
            className={styles.button}
            disabled={!isFormValid}
          >
            Отправить заявку
          </button>
        </form>
      </div>
    </div>
  );
};

export default RequestForm;