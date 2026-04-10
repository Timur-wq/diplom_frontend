// src/components/WorkSpareSelector.tsx

import React from 'react';
import { SpareOption, WorkSpareLink } from '../../types/diagnostic';
import styles from './WorkSpareSelector.module.scss';

interface WorkSpareSelectorProps {
  workName: string;
  availableSpares: SpareOption[];
  onConfirm: (selectedSpares: WorkSpareLink[]) => void;
  onCancel: () => void;
}

export const WorkSpareSelector: React.FC<WorkSpareSelectorProps> = ({
  workName,
  availableSpares,
  onConfirm,
  onCancel
}) => {
  const [selectedSpares, setSelectedSpares] = React.useState<WorkSpareLink[]>([]);

  const toggleSpare = (spare: SpareOption) => {
    setSelectedSpares(prev => {
      const exists = prev.find(s => s.spareCode === spare.spareCode);
      if (exists) {
        return prev.filter(s => s.spareCode !== spare.spareCode);
      }
      return [...prev, {
        spareCode: spare.spareCode,
        spareName: spare.spareName,
        quantity: 1,
        isRequired: true,
        unit: spare.unit
      }];
    });
  };

  return (
    <div className={styles.modal}>
      <div className={styles.modalContent}>
        <h3>Выберите ЗИП для работы: {workName}</h3>
        
        <div className={styles.spareList}>
          {availableSpares.map(spare => (
            <label key={spare.spareCode} className={styles.spareItem}>
              <input
                type="checkbox"
                checked={selectedSpares.some(s => s.spareCode === spare.spareCode)}
                onChange={() => toggleSpare(spare)}
              />
              <span>{spare.spareName} ({spare.amount} {spare.unit})</span>
            </label>
          ))}
        </div>

        <div className={styles.actions}>
          <button onClick={onCancel}>Отмена</button>
          <button onClick={() => onConfirm(selectedSpares)}>
            Добавить ({selectedSpares.length})
          </button>
        </div>
      </div>
    </div>
  );
};