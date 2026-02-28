import React, { useState, useMemo } from 'react';
import '../Login/login.module.scss';
import { hasSQLInjection } from '../../utils/sqlInjection'; // если используете
import { InputFieldMessages } from '../../utils/constants';
import { useNavigate } from 'react-router-dom';

interface RegistrationFormState {
  email: string;
  userName: string;
  password: string;
  confirmPassword: string;
}

interface FormErrors {
  email?: string;
  userName?: string;
  password?: string;
  confirmPassword?: string;
}

const Registration: React.FC = () => {

  const navigate = useNavigate();

  const [formData, setFormData] = useState<RegistrationFormState>({
    email: '',
    userName: '',
    password: '',
    confirmPassword: '',
  });

  const [errors, setErrors] = useState<FormErrors>({});
  const [isLoading, setIsLoading] = useState(false);

  // Валидация email
  const validateEmail = (email: string): string | undefined => {
    if (!email) return InputFieldMessages.RequireEmail;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return InputFieldMessages.IncorrectEmail;
    if (hasSQLInjection(email)) return InputFieldMessages.IncorrectEmail;
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
      formData.email.trim() !== '' &&
      formData.userName.trim() !== '' &&
      formData.password.trim() !== '' &&
      formData.confirmPassword.trim() !== '';
    
    // Все ошибки должны отсутствовать
    const noErrors = 
      !errors.email &&
      !errors.userName &&
      !errors.password &&
      !errors.confirmPassword;

    return allFilled && noErrors;
  }, [formData, errors]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));

    // Валидация поля
    let error: string | undefined;
    switch (name) {
      case 'email':
        error = validateEmail(value);
        setErrors(prev => ({ ...prev, email: error }));
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
    const emailError = validateEmail(formData.email);
    const userNameError = validateUserName(formData.userName);
    const passwordError = validatePassword(formData.password);
    const confirmError = validateConfirmPassword(formData.confirmPassword, formData.password);

    const newErrors = {
      email: emailError,
      userName: userNameError,
      password: passwordError,
      confirmPassword: confirmError,
    };

    setErrors(newErrors);

    // Если есть ошибки, не отправляем
    if (emailError || userNameError || passwordError || confirmError) {
      return;
    }

    setIsLoading(true);

    try {
      const response = await fetch('http://localhost:8000/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
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

        {/* Email */}
        <div className="field">
          <label htmlFor="email" className="label">Email</label>
          <input
            type="email"
            id="email"
            name="email"
            className={`input ${errors.email ? 'inputError' : ''}`}
            value={formData.email}
            onChange={handleChange}
            disabled={isLoading}
            required
          />
          {errors.email && <div className="errorMessage">{errors.email}</div>}
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

        <button 
          type="submit" 
          className="button" 
          disabled={!isFormValid || isLoading}
        >
          {isLoading ? 'Отправка...' : 'Зарегистрироваться'}
        </button>
      </form>
    </div>
  );
};

export default Registration;