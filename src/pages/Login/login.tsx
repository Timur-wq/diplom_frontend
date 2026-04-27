import React, { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authService } from '../../services/authService';
import { hasSQLInjection } from '../../utils/sqlInjection';
import { Button } from '../../components/UI';
import styles from './login.module.scss';

interface LoginFormState {
  login: string;
  password: string;
  rememberMe: boolean;
}

interface LoginErrors {
  login?: string;
  password?: string;
}

const Login: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState<LoginFormState>({
    login: '',
    password: '',
    rememberMe: false,
  });

  const [errors, setErrors] = useState<LoginErrors>({});
  const [isLoading, setIsLoading] = useState(false);
  const [serverError, setServerError] = useState<string>('');

  // Проверка на expired session из URL
  const isExpired = new URLSearchParams(location.search).get('expired') === '1';

  // Валидация логина
  const validateLogin = (login: string): string | undefined => {
    if (!login.trim()) return 'Логин обязателен';
    if (login.trim().length < 3) return 'Минимум 3 символа';
    if (!/^[a-zA-Z0-9._-]+$/.test(login)) return 'Только буквы, цифры, . _ -';
    if (hasSQLInjection(login)) return 'Подозрительные символы';
    return undefined;
  };

  // Валидация пароля
  const validatePassword = (password: string): string | undefined => {
    if (!password) return 'Пароль обязателен';
    if (password.length < 8) return 'Минимум 8 символов';
    return undefined;
  };

  // Проверка валидности формы
  const isFormValid = useMemo(() => {
    return (
      formData.login.trim() !== '' &&
      formData.password.trim() !== '' &&
      !errors.login &&
      !errors.password
    );
  }, [formData, errors]);

  // Обработчик изменений
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    // Валидация в реальном времени
    if (name === 'login') {
      const error = validateLogin(value);
      setErrors(prev => ({ ...prev, login: error }));
    } else if (name === 'password') {
      const error = validatePassword(value);
      setErrors(prev => ({ ...prev, password: error }));
    }
    
    if (serverError) setServerError('');
  };

  // Отправка формы
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setServerError('');

    const loginError = validateLogin(formData.login);
    const passwordError = validatePassword(formData.password);

    if (loginError || passwordError) {
      setErrors({ login: loginError, password: passwordError });
      return;
    }

    setIsLoading(true);

    try {
      const authData = await authService.login({
        login: formData.login.trim(),
        password: formData.password,
        rememberMe: formData.rememberMe,
      });

      console.log(authData.role)
      switch (authData.role) {
        case 'Dispatcher':
          navigate('/admin/requests', { replace: true });
          break;
        case 'Accountant':
          navigate('/accountant/reports', { replace: true });
          break;
        case 'OmtEmployee':
          navigate('/omt/requests', { replace: true });
          break;
        case 'ServiceEngineer':
          navigate('/engineer', { replace: true });
          break;
        case 'Client':
          navigate('/client', {replace: true});
          break;
        default:
          navigate('/', { replace: true });
      }

    } catch (error: any) {
      console.error('Ошибка входа:', error);
      setServerError(error.message || 'Не удалось войти. Проверьте данные.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <h2 className={styles.title}>Авторизация</h2>

        {isExpired && (
          <div className={styles.warning}>
            ⚠️ Сессия истекла. Пожалуйста, войдите снова.
          </div>
        )}

        {serverError && (
          <div className={styles.serverError}>{serverError}</div>
        )}

        {/* Логин */}
        <div className={styles.field}>
          <label htmlFor="login" className={styles.label}>
            Логин
          </label>
          <input
            type="text"
            id="login"
            name="login"
            className={`${styles.input} ${errors.login ? styles.inputError : ''}`}
            value={formData.login}
            onChange={handleChange}
            disabled={isLoading}
            placeholder="admin"
            autoComplete="username"
            aria-invalid={!!errors.login}
            aria-describedby={errors.login ? 'login-error' : undefined}
          />
          {errors.login && (
            <div id="login-error" className={styles.errorMessage} role="alert">
              {errors.login}
            </div>
          )}
        </div>

        {/* Пароль */}
        <div className={styles.field}>
          <label htmlFor="password" className={styles.label}>
            Пароль
          </label>
          <input
            type="password"
            id="password"
            name="password"
            className={`${styles.input} ${errors.password ? styles.inputError : ''}`}
            value={formData.password}
            onChange={handleChange}
            disabled={isLoading}
            placeholder="••••••••"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            aria-describedby={errors.password ? 'password-error' : undefined}
          />
          {errors.password && (
            <div id="password-error" className={styles.errorMessage} role="alert">
              {errors.password}
            </div>
          )}
        </div>

        {/* Запомнить меня */}
        <div className={styles.checkboxContainer}>
          <input
            type="checkbox"
            id="rememberMe"
            name="rememberMe"
            className={styles.checkbox}
            checked={formData.rememberMe}
            onChange={handleChange}
            disabled={isLoading}
          />
          <label htmlFor="rememberMe" className={styles.checkboxLabel}>
            Запомнить меня
          </label>
        </div>

        {/* Забыли пароль */}
        {/* <div className={styles.forgotPassword}>
          <a href="/forgot-password">Забыли пароль?</a>
        </div> */}

        {/* Кнопка входа */}
        <Button
          type="submit"
          className={styles.button}
          disabled={!isFormValid || isLoading}
          isLoading={isLoading}
        >
          {isLoading ? 'Вход...' : 'Войти'}
        </Button>
      </form>
    </div>
  );
};

export default Login;