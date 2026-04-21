import React, { useState, useMemo } from 'react';
import '../Login/login.module.scss';
import { hasSQLInjection } from '../../utils/sqlInjection'; // если используете
import { InputFieldMessages } from '../../utils/constants';
import { useNavigate } from 'react-router-dom';
import { Button } from '../../components/UI';

interface RegistrationFormState {
  phone: string;
  userName: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  phone?: string;
  userName?: string;
  password?: string;
  confirmPassword?: string;
}

const Registration: React.FC = () => {

  const navigate = useNavigate();

  const [formData, setFormData] = useState<RegistrationFormState>({
    phone: '',
    userName: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  const formatPhoneValue = (value: string): string => {
    const digits = value.replace(/\D/g, '');
    const normalized = digits.startsWith('8') ? '7' + digits.slice(1) : digits;
    const trimmed = normalized.slice(0, 11);

    if (!trimmed) return '';
    if (!trimmed.startsWith('7')) return trimmed;

    const part1 = trimmed.slice(1, 4);
    const part2 = trimmed.slice(4, 7);
    const part3 = trimmed.slice(7, 9);
    const part4 = trimmed.slice(9, 11);

    let formatted = '+7';
    if (part1) formatted += ` (${part1}`;
    if (part1.length === 3) formatted += ')';
    if (part2) formatted += ` ${part2}`;
    if (part3) formatted += `-${part3}`;
    if (part4) formatted += `-${part4}`;

    return formatted;
  };

  const validatePhone = (phone: string): string | undefined => {
    if (!phone) return 'Телефон обязателен';
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 11 || !digits.startsWith('7')) return 'Введите корректный номер +7 (900) 000-00-00';
    if (hasSQLInjection(phone)) return 'Некорректный телефон';
    return undefined;
  };

  // Валидация username
  const validateUserName = (userName: string): string | undefined => {
    if (!userName) return InputFieldMessages.RequireUserName;
    if (userName.length < 3) return InputFieldMessages.RequireMinUserNamne;
    if (!/^[a-zA-Z0-9]+$/.test(userName)) return InputFieldMessages.RequireLatLettersAndDigits;
    if (hasSQLInjection(userName)) return InputFieldMessages.UserNameSqlInj;
    return undefined;
  };

  // Валидация пароля (со всеми требованиями)
  const validatePassword = (password: string): string | undefined => {
    if (!password) return InputFieldMessages.RequirePass;
    if (password.length < 8) return InputFieldMessages.RequireMinPass;
    if (!/[A-Z]/.test(password)) return InputFieldMessages.RequireBigLetPass;
    if (!/[a-z]/.test(password)) return InputFieldMessages.RequireSmallLetPass;
    if (!/\d/.test(password)) return InputFieldMessages.RequireDigitsPass;
    const specialCharRegex = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/;
    if (!specialCharRegex.test(password)) {
      return InputFieldMessages.RequireSpecPass;
    }
    return undefined;
  };

  // Валидация подтверждения пароля
  const validateConfirmPassword = (confirm: string, password: string): string | undefined => {
    if (!confirm) return InputFieldMessages.ConfirmPass;
    if (confirm !== password) return InputFieldMessages.PassAreNotSimilar;
    return undefined;
  };

  // Проверка, можно ли разблокировать кнопку
  const isFormValid = useMemo(() => {
    // Все поля должны быть заполнены
    const allFilled = 
      formData.phone.trim() !== '' &&
      formData.userName.trim() !== '' &&
      formData.password.trim() !== '' &&
      formData.confirmPassword.trim() !== '';
    
    // Все ошибки должны отсутствовать
    const noErrors = 
      !errors.phone &&
      !errors.userName &&
      !errors.password &&
      !errors.confirmPassword;

    return allFilled && noErrors;
  }, [formData, errors]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;

    // Валидация поля
    let error: string | undefined;
    const fieldValue = name === 'phone' ? formatPhoneValue(value) : value;
    setFormData(prev => ({ ...prev, [name]: fieldValue }));

    switch (name) {
      case 'phone':
        error = validatePhone(fieldValue);
        setErrors(prev => ({ ...prev, phone: error }));
        break;
      case 'userName':
        error = validateUserName(value);
        setErrors(prev => ({ ...prev, userName: error }));
        break;
      case 'password':
        error = validatePassword(value);
        setErrors(prev => ({ ...prev, password: error }));
        // Если пароль меняется, перепроверяем подтверждение
        if (formData.confirmPassword) {
          const confirmError = validateConfirmPassword(formData.confirmPassword, value);
          setErrors(prev => ({ ...prev, confirmPassword: confirmError }));
        }
        break;
      case 'confirmPassword':
        error = validateConfirmPassword(value, formData.password);
        setErrors(prev => ({ ...prev, confirmPassword: error }));
        break;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Финальная проверка всех полей (на случай, если пользователь как-то обошёл интерфейс)
    const phoneError = validatePhone(formData.phone);
    const userNameError = validateUserName(formData.userName);
    const passwordError = validatePassword(formData.password);
    const confirmError = validateConfirmPassword(formData.confirmPassword, formData.password);

    const newErrors = {
      phone: phoneError,
      userName: userNameError,
      password: passwordError,
      confirmPassword: confirmError,
    };

    setErrors(newErrors);

    // Если есть ошибки, не отправляем
    if (phoneError || userNameError || passwordError || confirmError) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: formData.phone,
          username: formData.userName,
          password: formData.password,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Ошибка регистрации');
      }

      alert('Регистрация прошла успешно!');
      navigate('/login')
    } catch (error: any) {
      console.error('Ошибка:', error);
      alert(error.message || 'Не удалось зарегистрироваться');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="container">
      <form className="form" onSubmit={handleSubmit}>
        <h2 className="title">Регистрация</h2>

        {/* Телефон */}
        <div className="field">
          <label htmlFor="phone" className="label">Телефон</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            className={`input ${errors.phone ? 'inputError' : ''}`}
            value={formData.phone}
            onChange={handleChange}
            disabled={isLoading}
            required
            placeholder="+7 (900) 000-00-00"
          />
          {errors.phone && <div className="errorMessage">{errors.phone}</div>}
        </div>

        {/* Имя пользователя */}
        <div className="field">
          <label htmlFor="userName" className="label">Имя пользователя</label>
          <input
            type="text"
            id="userName"
            name="userName"
            className={`input ${errors.userName ? 'inputError' : ''}`}
            value={formData.userName}
            onChange={handleChange}
            disabled={isLoading}
            required
          />
          {errors.userName && <div className="errorMessage">{errors.userName}</div>}
        </div>

        {/* Пароль */}
        <div className="field">
          <label htmlFor="password" className="label">Пароль</label>
          <input
            type="password"
            id="password"
            name="password"
            className={`input ${errors.password ? 'inputError' : ''}`}
            value={formData.password}
            onChange={handleChange}
            disabled={isLoading}
            required
          />
          {errors.password && <div className="errorMessage">{errors.password}</div>}
        </div>

        {/* Подтверждение пароля */}
        <div className="field">
          <label htmlFor="confirmPassword" className="label">Подтверждение пароля</label>
          <input
            type="password"
            id="confirmPassword"
            name="confirmPassword"
            className={`input ${errors.confirmPassword ? 'inputError' : ''}`}
            value={formData.confirmPassword}
            onChange={handleChange}
            disabled={isLoading}
            required
          />
          {errors.confirmPassword && <div className="errorMessage">{errors.confirmPassword}</div>}
        </div>

        <Button
          type="submit"
          className="button"
          disabled={!isFormValid || isLoading}
          isLoading={isLoading}
        >
          {isLoading ? 'Отправка...' : 'Зарегистрироваться'}
        </Button>
      </form>
    </div>
  );
};

export default Registration;