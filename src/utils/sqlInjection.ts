
export const hasSQLInjection = (value: string): boolean => {
  // Приводим к нижнему регистру для проверки (но сохраняем оригинал для точных совпадений)
  const lower = value.toLowerCase();

  // Список опасных ключевых слов SQL
  const sqlKeywords = [
    'select', 'insert', 'update', 'delete', 'drop', 'union', 'exec', 'execute',
    'create', 'alter', 'merge', 'truncate', 'grant', 'revoke', 'rename',
    'backup', 'restore', 'shutdown', 'xp_cmdshell', 'information_schema',
    'sys.tables', 'sys.columns'
  ];

  // Проверка на отдельно стоящие ключевые слова (окружённые границами слова)
  for (const keyword of sqlKeywords) {
    const regex = new RegExp(`\\b${keyword}\\b`, 'i');
    if (regex.test(value)) {
      return true;
    }
  }

  // Паттерны для типичных конструкций инъекций
  const patterns = [
    /(?:^|\W)(or|and)(?:\W|$)\s*['"]?\s*\d+\s*['"]?\s*[=<>]/i,     // or 1=1, and 'a'='a'
    /['"]\s*(or|and)\s*['"]\s*[=<>]/i,                             // ' OR '1'='1
    /union\s+all\s+select/i,
    /;\s*drop\s+table/i,
    /;\s*shutdown/i,
    /exec\s*\(/i,
    /waitfor\s+delay/i,
    /@@version/i,
    /xp_cmdshell/i,
    /information_schema/i,
    /--|#|\/\*|\*\/|;\s*$/,                                         // комментарии и точка с запятой в конце
    /['"]\s*;$/,                                                    // кавычка с точкой с запятой в конце
    /\b(union|select)\b.*\bfrom\b/i,                                // union select ... from
    /\b(insert|replace)\s+into\b/i,
    /\b(update|delete)\s+from\b/i,
    /\b(drop|create|alter)\s+table\b/i,
    /\b(exec|execute)\s+sp_/i,
    /\b(cast|convert)\s*\(/i,
    /\b(char|nchar|varchar|nvarchar)\s*\(/i,
    /0x[0-9a-f]{4,}/i,                                              // шестнадцатеричные литералы
    /\\x[0-9a-f]{2}/i,                                               // экранированные hex-последовательности
  ];

  for (const pattern of patterns) {
    if (pattern.test(value)) {
      return true;
    }
  }

  // Проверка на подозрительное количество кавычек (например, несбалансированные кавычки)
  const quotesCount = (value.match(/['"]/g) || []).length;
  if (quotesCount % 2 !== 0) {
    // Нечётное количество кавычек может указывать на попытку инъекции
    return true;
  }

  // Проверка на экранирование (обратный слеш перед кавычкой)
  if (/\\['"]/.test(value)) {
    return true;
  }

  return false;
};