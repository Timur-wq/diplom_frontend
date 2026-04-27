import React, { useState, useEffect } from 'react';
import { staffService } from '../../services/staffService';
import { StaffDto, CreateStaffDto } from '../../types/staff';
import styles from './StaffManagement.module.scss';

const StaffManagement: React.FC = () => {
   const [staff, setStaff] = useState<StaffDto[]>([]);
   const [loading, setLoading] = useState(true);
   const [error, setError] = useState<string | null>(null);
   const [showCreateForm, setShowCreateForm] = useState(false);
   const [creating, setCreating] = useState(false);

   const [formData, setFormData] = useState<CreateStaffDto>({
      fullName: '',
      hireDate: new Date().toISOString().split('T')[0],
      login: '',
      password: '',
      role: 'ServiceEngineer'
   });

   const loadStaff = async () => {
      try {
         setLoading(true);
         setError(null);
         console.log('🔄 Загрузка сотрудников...');

         const data = await staffService.getAllStaff();
         console.log('✅ Получено записей:', data.length);

         // 🔥 ФИЛЬТРУЕМ: убираем диспетчеров и клиентов
         // Показываем только технических специалистов
         const allowedRoles = ['ServiceEngineer', 'Accountant', 'OmtEmployee'];
         const filteredStaff = data.filter(employee =>
            allowedRoles.includes(employee.role)
         );

         console.log('✅ После фильтрации (только сотрудники):', filteredStaff.length);
         setStaff(filteredStaff);
      } catch (err: any) {
         console.error('❌ Ошибка загрузки:', err);
         setError(err.message || 'Не удалось загрузить сотрудников');
      } finally {
         setLoading(false);
      }
   };

   useEffect(() => {
      loadStaff();
   }, []);

   const handleCreate = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
         setCreating(true);
         await staffService.createStaff(formData);
         setShowCreateForm(false);
         setFormData({
            fullName: '',
            hireDate: new Date().toISOString().split('T')[0],
            login: '',
            password: '',
            role: 'ServiceEngineer'
         });
         await loadStaff();
         alert('✅ Сотрудник успешно создан!');
      } catch (err: any) {
         console.error('Ошибка создания:', err);
         alert(err.message || 'Не удалось создать сотрудника');
      } finally {
         setCreating(false);
      }
   };

   const handleDelete = async (userId: number) => {
      if (!window.confirm('Вы уверены, что хотите деактивировать сотрудника?')) return;
      try {
         await staffService.deleteStaff(userId);
         await loadStaff();
         alert('✅ Сотрудник деактивирован');
      } catch (err: any) {
         alert(err.message || 'Не удалось удалить сотрудника');
      }
   };

   const getRoleName = (role: string): string => {
      const roles: Record<string, string> = {
         'ServiceEngineer': 'Инженер сервиса',
         'Dispatcher': 'Диспетчер',
         'Accountant': 'Бухгалтер',
         'OmtEmployee': 'Сотрудник ОМТС'
      };
      return roles[role] || role;
   };

   if (loading) {
      return (
         <div className={styles.container}>
            <div className={styles.loading}>
               <div className={styles.spinner}></div>
               <p>Загрузка сотрудников...</p>
            </div>
         </div>
      );
   }

   if (error) {
      return (
         <div className={styles.container}>
            <div className={styles.error}>
               <h3>❌ Ошибка загрузки</h3>
               <p>{error}</p>
               <button onClick={loadStaff} className={styles.retryBtn}>
                  🔄 Повторить
               </button>
            </div>
         </div>
      );
   }

   return (
      <div className={styles.container}>
         <div className={styles.header}>
            <h1>Управление сотрудниками</h1>
            <button
               className={styles.addBtn}
               onClick={() => setShowCreateForm(true)}
            >
               ➕ Добавить сотрудника
            </button>
         </div>

         {staff.length === 0 ? (
            <div className={styles.empty}>
               <p>📭 Сотрудники не найдены</p>
            </div>
         ) : (
            <table className={styles.table}>
               <thead>
                  <tr>
                     <th>Таб. №</th>
                     <th>ФИО</th>
                     <th>Логин</th>
                     <th>Роль</th>
                     <th>Дата приема</th>
                     <th>Статус</th>
                     <th>Действия</th>
                  </tr>
               </thead>
               <tbody>
                  {staff.map((employee) => (
                     <tr key={employee.userId}>
                        <td>{employee.tabNumber * 1235}</td>
                        <td>{employee.fullName}</td>
                        <td>{employee.login}</td>
                        <td>
                           <span className={`${styles.roleBadge} ${styles[employee.role]}`}>
                              {getRoleName(employee.role)}
                           </span>
                        </td>
                        <td>{new Date(employee.hireDate).toLocaleDateString('ru-RU')}</td>
                        <td>
                           <span className={employee.isActive ? styles.active : styles.inactive}>
                              {employee.isActive ? '✓ Активен' : '✗ Неактивен'}
                           </span>
                        </td>
                        <td>
                           <button
                              className={styles.deleteBtn}
                              onClick={() => handleDelete(employee.userId)}
                              disabled={!employee.isActive}
                              title={employee.isActive ? 'Деактивировать' : 'Уже неактивен'}
                           >
                              {employee.isActive ? '🗑️ Деактивировать' : '—'}
                           </button>
                        </td>
                     </tr>
                  ))}
               </tbody>
            </table>
         )}

         {showCreateForm && (
            <div className={styles.modal} onClick={() => setShowCreateForm(false)}>
               <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                  <h2>➕ Добавить сотрудника</h2>
                  <form onSubmit={handleCreate}>
                     <div className={styles.formGroup}>
                        <label>ФИО: *</label>
                        <input
                           type="text"
                           value={formData.fullName}
                           onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                           placeholder="Иванов Иван Иванович"
                           required
                        />
                     </div>

                     <div className={styles.formGroup}>
                        <label>Логин: *</label>
                        <input
                           type="text"
                           value={formData.login}
                           onChange={(e) => setFormData({ ...formData, login: e.target.value })}
                           placeholder="ivanov"
                           required
                        />
                     </div>

                     <div className={styles.formGroup}>
                        <label>Пароль: *</label>
                        <input
                           type="password"
                           value={formData.password}
                           onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                           placeholder="••••••••"
                           required
                           minLength={6}
                        />
                     </div>

                     <div className={styles.formGroup}>
                        <label>Роль: *</label>
                        <select
                           value={formData.role}
                           onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                        >
                           <option value="ServiceEngineer">🔧 Инженер сервиса</option>
                           <option value="Accountant">💰 Бухгалтер</option>
                           <option value="OmtEmployee">📦 Сотрудник ОМТС</option>
                        </select>
                     </div>

                     <div className={styles.formGroup}>
                        <label>Дата приема: *</label>
                        <input
                           type="date"
                           value={formData.hireDate}
                           onChange={(e) => setFormData({ ...formData, hireDate: e.target.value })}
                           required
                        />
                     </div>

                     <div className={styles.formActions}>
                        <button
                           type="button"
                           onClick={() => setShowCreateForm(false)}
                           disabled={creating}
                        >
                           Отмена
                        </button>
                        <button
                           type="submit"
                           disabled={creating}
                           className={styles.submitBtn}
                        >
                           {creating ? '⏳ Создание...' : '✅ Создать'}
                        </button>
                     </div>
                  </form>
               </div>
            </div>
         )}
      </div>
   );
};

export default StaffManagement;