// src/pages/Auth/Register.tsx

import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authService } from '../../services/authService';
import styles from './Register.module.scss';

const Register: React.FC = () => {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    fio: '',
    login: '',
    password: '',
    confirmPassword: '',
    phone: ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [loginAvailable, setLoginAvailable] = useState<boolean | null>(null);
  const [phoneAvailable, setPhoneAvailable] = useState<boolean | null>(null);

  // 🔥 Валидация полей
  const validateField = (name: string, value: string): string => {
    switch (name) {
      case 'fio':
        if (!value.trim()) return 'ФИО обязательно';
        if (value.trim().length < 3) return 'ФИО должно быть не менее 3 символов';
        return '';

      case 'login':
        if (!value.trim()) return 'Логин обязателен';
        if (value.length < 3) return 'Логин должен быть не менее 3 символов';
        if (value.length > 50) return 'Логин должен быть не более 50 символов';
        if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Логин может содержать только буквы, цифры и _';
        return '';

      case 'password':
        if (!value) return 'Пароль обязателен';
        if (value.length < 8) return 'Пароль должен быть не менее 8 символов';

        // 🔥 Проверяем: есть ли хотя бы одна латинская буква
        const hasLatinLetter = /[A-Za-z]/.test(value);
        // 🔥 Проверяем: есть ли хотя бы одна цифра
        const hasDigit = /\d/.test(value);
        // 🔥 Проверяем: нет ли кириллицы
        const hasCyrillic = /[А-Яа-яЁё]/.test(value);
        // 🔥 Проверяем: только разрешённые символы
        const allowedChars = /^[A-Za-z0-9!@#$%^&*()_+\-=\[\]{}|;:',.<>?\\/~`]+$/.test(value);

        if (hasCyrillic) {
          return 'Пароль не должен содержать кириллицу';
        }

        if (!allowedChars) {
          return 'Пароль может содержать только латинские буквы, цифры и спецсимволы: !@#$%^&*()_+-=[]{}|;:\'",.<>?\\/~`';
        }

        if (!hasLatinLetter || !hasDigit) {
          return 'Пароль должен содержать латинские буквы и цифры';
        }

        return '';

      case 'confirmPassword':
        if (value !== formData.password) return 'Пароли не совпадают';
        return '';

      case 'phone':
        if (!value.trim()) return 'Телефон обязателен';
        const digits = value.replace(/\D/g, '');
        if (digits.length !== 11 || !digits.startsWith('7'))
          return 'Введите телефон в формате +7 (999) 000-00-00';
        return '';

      default:
        return '';
    }
  };

  const formatPhoneValue = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    let normalized = digits;
    if (normalized.startsWith('8')) {
      normalized = '7' + normalized.slice(1);
    }
    normalized = normalized.slice(0, 11);

    if (!normalized) return '';
    if (!normalized.startsWith('7')) return '+' + normalized;

    const code = normalized.slice(1, 4);
    const part1 = normalized.slice(4, 7);
    const part2 = normalized.slice(7, 9);
    const part3 = normalized.slice(9, 11);

    let formatted = '+7';
    if (code) formatted += ` (${code}`;
    if (code.length === 3) formatted += ')';
    if (part1) formatted += ` ${part1}`;
    if (part2) formatted += `-${part2}`;
    if (part3) formatted += `-${part3}`;

    return formatted;
  };

  // 🔥 Проверка уникальности логина (debounce)
  const checkLoginUnique = async (login: string) => {
    if (login.length < 3) {
      setLoginAvailable(null);
      return;
    }

    try {
      const isUnique = await authService.checkLoginUnique(login);
      setLoginAvailable(isUnique);
    } catch {
      setLoginAvailable(null);
    }
  };

  // 🔥 Проверка уникальности телефона
  const checkPhoneUnique = async (phone: string) => {
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 11) {
      setPhoneAvailable(null);
      return;
    }

    try {
      const isUnique = await authService.checkPhoneUnique(phone);
      setPhoneAvailable(isUnique);
    } catch {
      setPhoneAvailable(null);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const fieldValue = name === 'phone' ? formatPhoneValue(value) : value;

    setFormData(prev => ({ ...prev, [name]: fieldValue }));

    // Валидация в реальном времени
    const error = validateField(name, fieldValue);
    setErrors(prev => ({ ...prev, [name]: error }));

    // Проверка уникальности
    if (name === 'login') {
      setLoginAvailable(null);
      const timeout = setTimeout(() => checkLoginUnique(value), 500);
      return () => clearTimeout(timeout);
    }

    if (name === 'phone') {
      setPhoneAvailable(null);
      const timeout = setTimeout(() => checkPhoneUnique(value), 500);
      return () => clearTimeout(timeout);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Финальная валидация
    const newErrors: Record<string, string> = {};
    Object.keys(formData).forEach(key => {
      const error = validateField(key, formData[key as keyof typeof formData]);
      if (error) newErrors[key] = error;
    });

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    if (loginAvailable === false) {
      setErrors(prev => ({ ...prev, login: 'Этот логин уже занят' }));
      return;
    }

    if (phoneAvailable === false) {
      setErrors(prev => ({ ...prev, phone: 'Этот телефон уже зарегистрирован' }));
      return;
    }

    setLoading(true);

    try {
      const response = await authService.register({
        fio: formData.fio,
        login: formData.login,
        password: formData.password,
        phone: formData.phone,
      });

      if (response.success) {
        alert('✅ Регистрация успешна! Теперь вы можете войти.');
        navigate('/login');
      } else {
        setErrors({ submit: response.message });
      }
    } catch (error: any) {
      setErrors({ submit: error.message || 'Ошибка при регистрации' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <h1 className={styles.title}>Регистрация клиента</h1>
        <p className={styles.subtitle}>Создайте аккаунт для подачи заявок</p>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* ФИО */}
          <div className={styles.formGroup}>
            <label className={styles.label}>ФИО *</label>
            <input
              type="text"
              name="fio"
              value={formData.fio}
              onChange={handleChange}
              className={`${styles.input} ${errors.fio ? styles.error : ''}`}
              placeholder="Иванов Иван Иванович"
              disabled={loading}
            />
            {errors.fio && <span className={styles.errorText}>{errors.fio}</span>}
          </div>

          {/* Логин */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Логин *</label>
            <input
              type="text"
              name="login"
              value={formData.login}
              onChange={handleChange}
              className={`${styles.input} ${errors.login ? styles.error : ''}`}
              placeholder="ivanov"
              disabled={loading}
            />
            {loginAvailable === true && (
              <span className={styles.successText}>✓ Логин доступен</span>
            )}
            {loginAvailable === false && (
              <span className={styles.errorText}>✗ Логин занят</span>
            )}
            {errors.login && <span className={styles.errorText}>{errors.login}</span>}
          </div>

          {/* Пароль */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Пароль *</label>
            <input
              type="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              className={`${styles.input} ${errors.password ? styles.error : ''}`}
              placeholder="••••••••"
              disabled={loading}
            />
            {errors.password && <span className={styles.errorText}>{errors.password}</span>}
          </div>

          {/* Подтверждение пароля */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Подтверждение пароля *</label>
            <input
              type="password"
              name="confirmPassword"
              value={formData.confirmPassword}
              onChange={handleChange}
              className={`${styles.input} ${errors.confirmPassword ? styles.error : ''}`}
              placeholder="••••••••"
              disabled={loading}
            />
            {errors.confirmPassword && (
              <span className={styles.errorText}>{errors.confirmPassword}</span>
            )}
          </div>

          {/* Телефон */}
          <div className={styles.formGroup}>
            <label className={styles.label}>Телефон *</label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              className={`${styles.input} ${errors.phone ? styles.error : ''}`}
              placeholder="+7 (999) 000-00-00"
              disabled={loading}
            />
            {phoneAvailable === true && (
              <span className={styles.successText}>✓ Телефон доступен</span>
            )}
            {phoneAvailable === false && (
              <span className={styles.errorText}>✗ Телефон уже зарегистрирован</span>
            )}
            {errors.phone && <span className={styles.errorText}>{errors.phone}</span>}
          </div>

          {/* Ошибка формы */}
          {errors.submit && (
            <div className={styles.formError}>{errors.submit}</div>
          )}

          {/* Кнопка */}
          <button
            type="submit"
            className={styles.submitBtn}
            disabled={loading}
          >
            {loading ? (
              <span className={styles.loading}>
                <span className={styles.spinner}></span>
                Регистрация...
              </span>
            ) : (
              'Зарегистрироваться'
            )}
          </button>

          {/* Ссылка на вход */}
          <p className={styles.loginLink}>
            Уже есть аккаунт? <Link to="/login">Войти</Link>
          </p>
        </form>
      </div>
    </div>
  );
};

export default Register;