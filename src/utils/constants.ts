export const enum InputFieldMessages{
   RequireEmail="Email обязателен",
   IncorrectEmail="Некорректный email",
   EmailExists="Пользователь с таким email уже зарегестрирован",
   RequireUserName="Имя пользователя обязательно",
   RequireMinUserNamne="Минимум 3 символа",
   RequireLatLettersAndDigits="Только латинские буквы и цифры",
   UserNameSqlInj="Некорректный формат имени пользователя",
   RequirePass="Пароль обязателен",
   RequireMinPass="Минимум 8 символов",
   RequireBigLetPass="Должна быть хотя бы одна ЗАГЛАВНАЯ латинская буква",
   RequireSmallLetPass="Должна быть хотя бы одна строчная латинская буква",
   RequireDigitsPass="Должна быть хотя бы одна цифра",
   RequireSpecPass="Должен быть хотя бы один специальный символ (!@#$%^&* и т.д.)",
   ConfirmPass="Подтвердите пароль",
   PassAreNotSimilar="Пароли не совпадают",

}

/**
 * Список типов средств вычислительной техники (СВТ)
 * для использования в формах заявки на ремонт
 */
export const DEVICE_TYPES = [
  { value: 'laptop', label: 'Ноутбук' },
  { value: 'tablet', label: 'Планшет' },
  { value: 'desktop_pc', label: 'Стационарный ПК' },
  { value: 'monoblock', label: 'Моноблок' },
  { value: 'monitor', label: 'Монитор' },
  { value: 'keyboard', label: 'Клавиатура' },
  { value: 'mouse', label: 'Мышь' },
  { value: 'printer', label: 'Принтер' },
  { value: 'scanner', label: 'Сканер' },
  { value: 'mfd', label: 'МФУ (многофункциональное устройство)' },
  { value: 'webcam', label: 'Веб-камера' },
  { value: 'speakers', label: 'Колонки / Акустическая система' },
  { value: 'headphones', label: 'Наушники' },
  { value: 'microphone', label: 'Микрофон' },
  { value: 'router', label: 'Роутер / Маршрутизатор' },
  { value: 'switch', label: 'Коммутатор / Switch' },
  { value: 'server', label: 'Сервер' },
  { value: 'ups', label: 'ИБП (источник бесперебойного питания)' },
  { value: 'hdd_ssd', label: 'Жёсткий диск / SSD' },
  { value: 'ram', label: 'Оперативная память' },
  { value: 'gpu', label: 'Видеокарта' },
  { value: 'motherboard', label: 'Материнская плата' },
  { value: 'psu', label: 'Блок питания' },
  { value: 'cooler', label: 'Кулер / Система охлаждения' },
  { value: 'dock_station', label: 'Док-станция' },
  { value: 'graphics_tablet', label: 'Графический планшет' },
  { value: 'projector', label: 'Проектор' },
  { value: 'game_console', label: 'Игровая консоль' },
  { value: 'smartphone', label: 'Смартфон' },
  { value: 'ebook', label: 'Электронная книга' },
  { value: 'smartwatch', label: 'Умные часы / Фитнес-браслет' },
  { value: 'other', label: 'Другое' },
] as const;

// Тип для значения устройства (для type-safety)
export type DeviceTypeValue = typeof DEVICE_TYPES[number]['value'];

// Тип для объекта устройства
export type DeviceType = {
  value: DeviceTypeValue;
  label: string;
};