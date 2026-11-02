// UI strings and data-name translations, copied from the design (Sweepr widget board).
/* eslint-disable */
export const UI: Record<string, Record<string, string>> = {
  en: {
    reviewX: 'Review {x}', cleanX: 'Clean {x}', previewX: 'Preview {x}', scannedAgo: 'Scanned {n} min ago', scannedNow: 'Scanned just now', scanningPct: 'Scanning… {n}%', placesN: '{n} places', rescan: 'Scan again', settings: 'Settings', canFree: 'can be freed', canFreeGB: '{u} can be freed', scanning: 'scanning',
    reviewClean: 'Review & clean', quickClean: 'Quick clean · Safe only {x}', disk: 'Local Disk ({d}:)',
    low: 'Low space', tight: 'Getting tight', healthy: 'Healthy', freeOf: '{a} free of {b}', canGo: '{a} can go',
    memory: 'Memory', cpu: 'CPU', uptime: 'Uptime', days: 'days', suggestions: 'Suggestions',
    tipStartup: '{n} heavy startup apps', tipStartupSub: 'Boot could be ≈ {n} s faster', tipWsl: 'WSL disk can shrink', tipWslSub: 'ext4.vhdx is {x} · needs admin',
    tipRestart: 'Restart recommended', tipRestartSub: 'Up {n} days', tipUpd: ' · update waiting',
    tAdmin: 'Added to the next admin batch', tRemind: 'Reminder set for 22:00', tScan: 'Scan complete · nothing new', tApplied: 'Applied · undo anytime',
    back: 'Back', hide: 'Hide', review: 'Review', cleaning: 'Cleaning', previewing: 'Previewing', report: 'Report', safeOnly: 'Safe only',
    fAll: 'All', rSafe: 'Safe', rLow: 'Low', rMed: 'Medium', rHigh: 'High', iHigh: 'High impact', iMed: 'Medium impact', iLow: 'Low impact',
    admin: 'Admin', toBin: 'To Recycle Bin', selected: '{a} of {b} selected', clean: 'Clean', preview: 'Preview',
    confClean: 'Clean {x}?', confPreview: 'Preview {x}?', measured: 'Free space is measured before and after.',
    fCaches: 'Caches are deleted — apps rebuild them', fBin: '{n} of your file groups go to the Recycle Bin', fAdmin: '{n} need admin · one Windows prompt', fRestore: ' · restore point first', fDry: 'Preview only — nothing is deleted',
    understand: 'I understand what will be removed', cancel: 'Cancel', cleanNow: 'Clean now',
    paused: 'Paused — nothing is being deleted', verifying: 'Verifying free space…', pause: 'Pause', resume: 'Resume',
    freedX: 'Freed {x}', wouldX: 'Would free {x}', left: '≈ {n} s left', almost: 'almost done', steamRunning: 'Steam is running', cancelled: 'Cancelled',
    doneFreed: '{x} freed', doneWould: '{x} would go', doneLine: 'Estimated {a} · measured {b} · {n} s', retrySteam: 'Close Steam and retry', done: 'Done',
    rCleaned: 'Cleaned', rSkipped: 'Skipped', none: 'None', recycle: 'Recycle Bin', nItems: '{n} items', driveC: 'Drive {d}:', aOfB: '{a} of {b}', freeChange: '{a} → {b} free',
    startup: 'Startup', bootNow: 'Boot now', afterApply: 'After apply', changed: 'Changed', discard: 'Discard', applyN: 'Apply {n}', noChanges: 'No changes', sec: '{n} s',
    look: 'Look', language: 'Language', theme: 'Theme', dark: 'Dark', light: 'Light', palette: 'Palette', bright: 'Bright', pastel: 'Pastel', bw: 'Black & White',
    accent: 'Accent', chart: 'Chart', chSquircle: 'Squircle', chRound: 'Round', chBars: 'Bars', chWaffle: 'Waffle',
    cleaningRules: 'Cleaning', weekly: 'Weekly auto-clean', weeklySub: 'Sundays 21:00 · Safe items only', binOpt: 'Recycle Bin for my files', binOptSub: 'Leftovers, old downloads, duplicates',
    advanced: 'Advanced', advSub: 'Corners, motion, accessibility, rules', corners: 'Corners', cnMixed: 'Mixed', cnRound: 'Round', cnSharp: 'Sharp',
    motion: 'Motion', smooth: 'Smooth', reduced: 'Reduced', tempOlder: 'Temporary files older than', d1: '1 day', d3: '3 days', d7: '7 days',
    restore: 'Restore point first', restoreSub: 'Before admin and system changes', dry: 'Preview before cleaning', drySub: 'Shows what would go, deletes nothing',
    hc: 'High contrast', hcSub: 'Stronger text and dividers', cvd: 'Colorblind-friendly status', cvdSub: 'Blue and orange instead of green and red',
    never: 'Never touched', neverList: 'Passwords and bookmarks, game saves, OneDrive files, Windows\\Installer, WinSxS, Prefetch, Docker volumes, AI models, database folders.',
    version: 'Version {v}',
    blue: 'Blue', violet: 'Violet', green: 'Green', orange: 'Orange', pink: 'Pink', teal: 'Teal',
    GB: 'GB', MB: 'MB', B: 'B'
  },
  ru: {
    reviewX: 'Проверить {x}', cleanX: 'Очистить {x}', previewX: 'Просмотреть {x}', scannedAgo: 'Проверено {n} мин назад', scannedNow: 'Проверено только что', scanningPct: 'Сканирование… {n}%', placesN: 'мест: {n}', rescan: 'Сканировать снова', settings: 'Настройки', canFree: 'можно освободить', canFreeGB: '{u} можно освободить', scanning: 'сканирование',
    reviewClean: 'Проверить и очистить', quickClean: 'Быстро · только безопасное {x}', disk: 'Локальный диск ({d}:)',
    low: 'Мало места', tight: 'Место заканчивается', healthy: 'В норме', freeOf: '{a} свободно из {b}', canGo: '{a} можно удалить',
    memory: 'Память', cpu: 'ЦП', uptime: 'Без перезагрузки', days: 'дн.', suggestions: 'Советы',
    tipStartup: '{n} тяжёлых программ в автозагрузке', tipStartupSub: 'Загрузка может ускориться на ≈ {n} с', tipWsl: 'Диск WSL можно сжать', tipWslSub: 'ext4.vhdx — {x} · нужны права администратора',
    tipRestart: 'Стоит перезагрузить', tipRestartSub: 'Работает {n} дн.', tipUpd: ' · ждёт обновление',
    tAdmin: 'Добавлено в задачи администратора', tRemind: 'Напоминание на 22:00', tScan: 'Сканирование завершено · нового нет', tApplied: 'Применено · можно отменить',
    back: 'Назад', hide: 'Свернуть', review: 'Проверка', cleaning: 'Очистка', previewing: 'Просмотр', report: 'Отчёт', safeOnly: 'Безопасное',
    fAll: 'Все', rSafe: 'Безопасно', rLow: 'Низкий', rMed: 'Средний', rHigh: 'Высокий', iHigh: 'Сильное влияние', iMed: 'Среднее влияние', iLow: 'Слабое влияние',
    admin: 'Админ', toBin: 'В корзину', selected: 'Выбрано {a} из {b}', clean: 'Очистить', preview: 'Просмотр',
    confClean: 'Очистить {x}?', confPreview: 'Просмотреть {x}?', measured: 'Свободное место измеряется до и после.',
    fCaches: 'Кэш удаляется — программы создадут его заново', fBin: 'Группы ваших файлов ({n}) уйдут в корзину', fAdmin: 'Нужны права администратора ({n}) · один запрос Windows', fRestore: ' · сначала точка восстановления', fDry: 'Только просмотр — ничего не удаляется',
    understand: 'Я понимаю, что будет удалено', cancel: 'Отмена', cleanNow: 'Очистить',
    paused: 'Пауза — ничего не удаляется', verifying: 'Проверяем свободное место…', pause: 'Пауза', resume: 'Продолжить',
    freedX: 'Освобождено {x}', wouldX: 'Будет освобождено {x}', left: 'осталось ≈ {n} с', almost: 'почти готово', steamRunning: 'Steam запущен', cancelled: 'Отменено',
    doneFreed: 'Освобождено {x}', doneWould: 'Можно освободить {x}', doneLine: 'Оценка {a} · факт {b} · {n} с', retrySteam: 'Закрыть Steam и повторить', done: 'Готово',
    rCleaned: 'Очищено', rSkipped: 'Пропущено', none: 'Нет', recycle: 'Корзина', nItems: '{n} шт.', driveC: 'Диск {d}:', aOfB: '{a} из {b}', freeChange: '{a} → {b} свободно',
    startup: 'Автозагрузка', bootNow: 'Загрузка сейчас', afterApply: 'После применения', changed: 'Изменено', discard: 'Сбросить', applyN: 'Применить ({n})', noChanges: 'Нет изменений', sec: '{n} с',
    look: 'Вид', language: 'Язык', theme: 'Тема', dark: 'Тёмная', light: 'Светлая', palette: 'Палитра', bright: 'Яркая', pastel: 'Пастельная', bw: 'Чёрно-белая',
    accent: 'Акцент', chart: 'Диаграмма', chSquircle: 'Сквиркл', chRound: 'Круг', chBars: 'Полосы', chWaffle: 'Вафля',
    cleaningRules: 'Очистка', weekly: 'Еженедельная автоочистка', weeklySub: 'Воскресенье 21:00 · только безопасное', binOpt: 'Корзина для моих файлов', binOptSub: 'Остатки, старые загрузки, дубликаты',
    advanced: 'Дополнительно', advSub: 'Углы, анимация, доступность, правила', corners: 'Углы', cnMixed: 'Смешанные', cnRound: 'Круглые', cnSharp: 'Острые',
    motion: 'Анимация', smooth: 'Плавная', reduced: 'Меньше', tempOlder: 'Временные файлы старше', d1: '1 дня', d3: '3 дней', d7: '7 дней',
    restore: 'Сначала точка восстановления', restoreSub: 'Перед системными изменениями', dry: 'Просмотр перед очисткой', drySub: 'Показывает, что уйдёт, ничего не удаляя',
    hc: 'Высокий контраст', hcSub: 'Более чёткий текст и линии', cvd: 'Статусы для дальтоников', cvdSub: 'Синий и оранжевый вместо зелёного и красного',
    never: 'Никогда не трогаем', neverList: 'Пароли и закладки, сохранения игр, файлы OneDrive, Windows\\Installer, WinSxS, Prefetch, тома Docker, ИИ-модели, папки баз данных.',
    version: 'Версия {v}',
    blue: 'Синий', violet: 'Фиолетовый', green: 'Зелёный', orange: 'Оранжевый', pink: 'Розовый', teal: 'Бирюзовый',
    GB: 'ГБ', MB: 'МБ', B: 'Б'
  },
  es: {
    reviewX: 'Revisar {x}', cleanX: 'Limpiar {x}', previewX: 'Vista previa de {x}', scannedAgo: 'Analizado hace {n} min', scannedNow: 'Analizado ahora mismo', scanningPct: 'Analizando… {n}%', placesN: '{n} ubicaciones', rescan: 'Analizar de nuevo', settings: 'Ajustes', canFree: 'se pueden liberar', canFreeGB: '{u} se pueden liberar', scanning: 'analizando',
    reviewClean: 'Revisar y limpiar', quickClean: 'Rápida · solo seguro {x}', disk: 'Disco local ({d}:)',
    low: 'Poco espacio', tight: 'Espacio justo', healthy: 'Bien', freeOf: '{a} libres de {b}', canGo: '{a} se pueden borrar',
    memory: 'Memoria', cpu: 'CPU', uptime: 'Encendido', days: 'días', suggestions: 'Sugerencias',
    tipStartup: '{n} apps pesadas al inicio', tipStartupSub: 'El arranque podría ser ≈ {n} s más rápido', tipWsl: 'El disco WSL se puede reducir', tipWslSub: 'ext4.vhdx ocupa {x} · requiere admin',
    tipRestart: 'Se recomienda reiniciar', tipRestartSub: 'Encendido {n} días', tipUpd: ' · actualización pendiente',
    tAdmin: 'Añadido a las tareas de administrador', tRemind: 'Recordatorio a las 22:00', tScan: 'Análisis completo · nada nuevo', tApplied: 'Aplicado · puedes deshacerlo',
    back: 'Atrás', hide: 'Ocultar', review: 'Revisión', cleaning: 'Limpiando', previewing: 'Vista previa', report: 'Informe', safeOnly: 'Solo seguro',
    fAll: 'Todo', rSafe: 'Seguro', rLow: 'Bajo', rMed: 'Medio', rHigh: 'Alto', iHigh: 'Impacto alto', iMed: 'Impacto medio', iLow: 'Impacto bajo',
    admin: 'Admin', toBin: 'A la papelera', selected: '{a} de {b} seleccionados', clean: 'Limpiar', preview: 'Vista previa',
    confClean: '¿Limpiar {x}?', confPreview: '¿Vista previa de {x}?', measured: 'El espacio libre se mide antes y después.',
    fCaches: 'Las cachés se borran — las apps las regeneran', fBin: '{n} grupos de tus archivos van a la papelera', fAdmin: '{n} requieren admin · un solo aviso de Windows', fRestore: ' · antes, punto de restauración', fDry: 'Solo vista previa — no se borra nada',
    understand: 'Entiendo lo que se eliminará', cancel: 'Cancelar', cleanNow: 'Limpiar ahora',
    paused: 'En pausa — no se borra nada', verifying: 'Verificando espacio libre…', pause: 'Pausa', resume: 'Reanudar',
    freedX: 'Liberado {x}', wouldX: 'Liberaría {x}', left: 'quedan ≈ {n} s', almost: 'casi listo', steamRunning: 'Steam está abierto', cancelled: 'Cancelado',
    doneFreed: '{x} liberados', doneWould: 'Se liberarían {x}', doneLine: 'Estimado {a} · medido {b} · {n} s', retrySteam: 'Cerrar Steam y reintentar', done: 'Listo',
    rCleaned: 'Limpiado', rSkipped: 'Omitido', none: 'Ninguno', recycle: 'Papelera', nItems: '{n} elementos', driveC: 'Disco {d}:', aOfB: '{a} de {b}', freeChange: '{a} → {b} libres',
    startup: 'Inicio', bootNow: 'Arranque ahora', afterApply: 'Tras aplicar', changed: 'Cambiado', discard: 'Descartar', applyN: 'Aplicar ({n})', noChanges: 'Sin cambios', sec: '{n} s',
    look: 'Aspecto', language: 'Idioma', theme: 'Tema', dark: 'Oscuro', light: 'Claro', palette: 'Paleta', bright: 'Viva', pastel: 'Pastel', bw: 'Blanco y negro',
    accent: 'Acento', chart: 'Gráfico', chSquircle: 'Squircle', chRound: 'Círculo', chBars: 'Barras', chWaffle: 'Gofre',
    cleaningRules: 'Limpieza', weekly: 'Limpieza semanal', weeklySub: 'Domingos 21:00 · solo lo seguro', binOpt: 'Papelera para mis archivos', binOptSub: 'Restos, descargas viejas, duplicados',
    advanced: 'Avanzado', advSub: 'Esquinas, animación, accesibilidad, reglas', corners: 'Esquinas', cnMixed: 'Mixtas', cnRound: 'Redondas', cnSharp: 'Rectas',
    motion: 'Animación', smooth: 'Suave', reduced: 'Reducida', tempOlder: 'Archivos temporales con más de', d1: '1 día', d3: '3 días', d7: '7 días',
    restore: 'Punto de restauración antes', restoreSub: 'Antes de cambios del sistema', dry: 'Vista previa antes de limpiar', drySub: 'Muestra lo que se iría, sin borrar nada',
    hc: 'Alto contraste', hcSub: 'Texto y líneas más marcados', cvd: 'Estados para daltonismo', cvdSub: 'Azul y naranja en vez de verde y rojo',
    never: 'Nunca se toca', neverList: 'Contraseñas y marcadores, partidas guardadas, archivos de OneDrive, Windows\\Installer, WinSxS, Prefetch, volúmenes de Docker, modelos de IA, carpetas de bases de datos.',
    version: 'Versión {v}',
    blue: 'Azul', violet: 'Violeta', green: 'Verde', orange: 'Naranja', pink: 'Rosa', teal: 'Turquesa',
    GB: 'GB', MB: 'MB', B: 'B'
  },
  zh: {
    reviewX: '查看 {x}', cleanX: '清理 {x}', previewX: '预览 {x}', scannedAgo: '{n} 分钟前已扫描', scannedNow: '刚刚扫描', scanningPct: '扫描中… {n}%', placesN: '{n} 个位置', rescan: '重新扫描', settings: '设置', canFree: '可释放', canFreeGB: '{u} 可释放', scanning: '扫描中',
    reviewClean: '查看并清理', quickClean: '快速清理 · 仅安全项 {x}', disk: '本地磁盘 ({d}:)',
    low: '空间不足', tight: '空间紧张', healthy: '良好', freeOf: '可用 {a}，共 {b}', canGo: '{a} 可清理',
    memory: '内存', cpu: 'CPU', uptime: '运行时间', days: '天', suggestions: '建议',
    tipStartup: '{n} 个高负载启动项', tipStartupSub: '开机可加快约 {n} 秒', tipWsl: 'WSL 磁盘可压缩', tipWslSub: 'ext4.vhdx 占 {x} · 需要管理员权限',
    tipRestart: '建议重启', tipRestartSub: '已运行 {n} 天', tipUpd: ' · 有待安装的更新',
    tAdmin: '已加入管理员任务', tRemind: '已设置 22:00 提醒', tScan: '扫描完成 · 无新内容', tApplied: '已应用 · 可随时撤销',
    back: '返回', hide: '隐藏', review: '查看', cleaning: '正在清理', previewing: '正在预览', report: '报告', safeOnly: '仅安全项',
    fAll: '全部', rSafe: '安全', rLow: '低', rMed: '中', rHigh: '高', iHigh: '影响大', iMed: '影响中', iLow: '影响小',
    admin: '管理员', toBin: '移至回收站', selected: '已选 {a}/{b}', clean: '清理', preview: '预览',
    confClean: '清理 {x}？', confPreview: '预览 {x}？', measured: '清理前后都会测量可用空间。',
    fCaches: '缓存将被删除，应用会自动重建', fBin: '{n} 组你的文件将移至回收站', fAdmin: '{n} 项需要管理员权限 · 仅一次 Windows 提示', fRestore: ' · 先创建还原点', fDry: '仅预览，不会删除任何内容',
    understand: '我了解将删除哪些内容', cancel: '取消', cleanNow: '立即清理',
    paused: '已暂停，没有删除任何内容', verifying: '正在核实可用空间…', pause: '暂停', resume: '继续',
    freedX: '已释放 {x}', wouldX: '可释放 {x}', left: '剩余约 {n} 秒', almost: '即将完成', steamRunning: 'Steam 正在运行', cancelled: '已取消',
    doneFreed: '已释放 {x}', doneWould: '可释放 {x}', doneLine: '预估 {a} · 实测 {b} · {n} 秒', retrySteam: '关闭 Steam 并重试', done: '完成',
    rCleaned: '已清理', rSkipped: '已跳过', none: '无', recycle: '回收站', nItems: '{n} 项', driveC: '{d} 盘', aOfB: '{a}/{b}', freeChange: '可用 {a} → {b}',
    startup: '启动项', bootNow: '当前开机', afterApply: '应用后', changed: '已更改', discard: '放弃', applyN: '应用 ({n})', noChanges: '无更改', sec: '{n} 秒',
    look: '外观', language: '语言', theme: '主题', dark: '深色', light: '浅色', palette: '配色', bright: '鲜艳', pastel: '柔和', bw: '黑白',
    accent: '强调色', chart: '图表', chSquircle: '超椭圆', chRound: '圆环', chBars: '条形', chWaffle: '华夫',
    cleaningRules: '清理', weekly: '每周自动清理', weeklySub: '每周日 21:00 · 仅安全项', binOpt: '我的文件移至回收站', binOptSub: '残留、旧下载、重复文件',
    advanced: '高级', advSub: '圆角、动画、无障碍、规则', corners: '圆角', cnMixed: '混合', cnRound: '圆润', cnSharp: '直角',
    motion: '动画', smooth: '流畅', reduced: '减少', tempOlder: '临时文件早于', d1: '1 天', d3: '3 天', d7: '7 天',
    restore: '先创建还原点', restoreSub: '在系统更改之前', dry: '清理前预览', drySub: '显示将清理的内容，不删除',
    hc: '高对比度', hcSub: '更清晰的文字和分隔线', cvd: '色盲友好状态', cvdSub: '用蓝色和橙色代替绿色和红色',
    never: '从不触碰', neverList: '密码和书签、游戏存档、OneDrive 文件、Windows\\Installer、WinSxS、Prefetch、Docker 卷、AI 模型、数据库文件夹。',
    version: '版本 {v}',
    blue: '蓝', violet: '紫', green: '绿', orange: '橙', pink: '粉', teal: '青',
    GB: 'GB', MB: 'MB', B: 'B'
  }
};
// ---------- data strings (keyed by English) ----------
export const DATA: Record<string, Record<string, string>> = {
  ru: {
    'Developer caches': 'Кэш разработчика', 'Dev caches': 'Разработка', 'GPU & games': 'GPU и игры', 'Leftovers & old files': 'Остатки и старые файлы', 'Leftovers': 'Остатки', 'Windows system': 'Система Windows', 'System': 'Система', 'Apps': 'Приложения', 'Browsers': 'Браузеры',
    'Yarn v1 cache': 'Кэш Yarn v1', 'Go build cache': 'Кэш сборки Go', 'npm cache': 'Кэш npm', 'pnpm store': 'Хранилище pnpm', 'NVIDIA shader cache': 'Кэш шейдеров NVIDIA', 'Steam web cache': 'Веб-кэш Steam', 'DirectX shader cache': 'Кэш шейдеров DirectX', 'AMD DX cache': 'Кэш AMD DX',
    'Open WebUI leftovers': 'Остатки Open WebUI', 'Old installers': 'Старые установщики', 'Windows Update cache': 'Кэш Центра обновления', 'Thumbnail cache': 'Кэш эскизов', 'Temporary files': 'Временные файлы', 'Error reports': 'Отчёты об ошибках', 'App crash dumps': 'Дампы сбоев',
    'Telegram media cache': 'Медиакэш Telegram', 'Discord cache': 'Кэш Discord', 'VS Code old extensions': 'Старые расширения VS Code', 'Zen browser cache': 'Кэш браузера Zen', 'Edge cache': 'Кэш Edge', 'Cookies & history': 'Cookie и история',
    'Packages re-download on the next install': 'Пакеты скачаются заново при следующей установке', 'Looks like 3.1 GB, frees 0 B — all packages still linked': 'Выглядит как 3,1 ГБ, но освободит 0 Б — все пакеты используются',
    'First launch of each game may stutter briefly': 'Первый запуск каждой игры может ненадолго подтормаживать', 'Steam is running — skipped unless closed': 'Steam запущен — будет пропущено, если не закрыть',
    'App uninstalled · untouched for 94 days': 'Программа удалена · папку не трогали 94 дня', 'Older than 30 days': 'Старше 30 дней', 'Open files and folders changed in the last 24 h are kept': 'Открытые файлы и папки, изменённые за 24 ч, сохраняются',
    'Media re-downloads when you open old chats': 'Медиа скачается заново при открытии старых чатов', 'Passwords and bookmarks are never touched': 'Пароли и закладки не затрагиваются',
    'settings and chat history go to the Recycle Bin': 'настройки и история чатов уйдут в корзину', 'installers you might reuse go to the Recycle Bin': 'установщики, которые могут пригодиться, уйдут в корзину', 'you will be signed out of most websites': 'вы выйдете из аккаунтов на большинстве сайтов',
    'Microsoft Edge auto-launch': 'Автозапуск Microsoft Edge'
  },
  es: {
    'Developer caches': 'Cachés de desarrollo', 'Dev caches': 'Desarrollo', 'GPU & games': 'GPU y juegos', 'Leftovers & old files': 'Restos y archivos viejos', 'Leftovers': 'Restos', 'Windows system': 'Sistema Windows', 'System': 'Sistema', 'Apps': 'Apps', 'Browsers': 'Navegadores',
    'Yarn v1 cache': 'Caché de Yarn v1', 'Go build cache': 'Caché de compilación de Go', 'npm cache': 'Caché de npm', 'pnpm store': 'Almacén de pnpm', 'NVIDIA shader cache': 'Caché de shaders NVIDIA', 'Steam web cache': 'Caché web de Steam', 'DirectX shader cache': 'Caché de shaders DirectX', 'AMD DX cache': 'Caché AMD DX',
    'Open WebUI leftovers': 'Restos de Open WebUI', 'Old installers': 'Instaladores viejos', 'Windows Update cache': 'Caché de Windows Update', 'Thumbnail cache': 'Caché de miniaturas', 'Temporary files': 'Archivos temporales', 'Error reports': 'Informes de errores', 'App crash dumps': 'Volcados de fallos',
    'Telegram media cache': 'Caché multimedia de Telegram', 'Discord cache': 'Caché de Discord', 'VS Code old extensions': 'Extensiones antiguas de VS Code', 'Zen browser cache': 'Caché del navegador Zen', 'Edge cache': 'Caché de Edge', 'Cookies & history': 'Cookies e historial',
    'Packages re-download on the next install': 'Los paquetes se descargan de nuevo en la próxima instalación', 'Looks like 3.1 GB, frees 0 B — all packages still linked': 'Parece 3,1 GB, pero libera 0 B — todos los paquetes en uso',
    'First launch of each game may stutter briefly': 'Cada juego puede dar tirones en su primer inicio', 'Steam is running — skipped unless closed': 'Steam está abierto — se omitirá si no se cierra',
    'App uninstalled · untouched for 94 days': 'App desinstalada · carpeta sin cambios desde hace 94 días', 'Older than 30 days': 'Más de 30 días', 'Open files and folders changed in the last 24 h are kept': 'Se conservan archivos abiertos y carpetas cambiadas en las últimas 24 h',
    'Media re-downloads when you open old chats': 'Los archivos se descargan de nuevo al abrir chats antiguos', 'Passwords and bookmarks are never touched': 'Contraseñas y marcadores nunca se tocan',
    'settings and chat history go to the Recycle Bin': 'sus ajustes e historial de chats van a la papelera', 'installers you might reuse go to the Recycle Bin': 'instaladores que podrías reutilizar van a la papelera', 'you will be signed out of most websites': 'se cerrará tu sesión en la mayoría de sitios web',
    'Microsoft Edge auto-launch': 'Inicio automático de Edge'
  },
  zh: {
    'Developer caches': '开发缓存', 'Dev caches': '开发缓存', 'GPU & games': '显卡与游戏', 'Leftovers & old files': '残留与旧文件', 'Leftovers': '残留文件', 'Windows system': 'Windows 系统', 'System': '系统', 'Apps': '应用', 'Browsers': '浏览器',
    'Yarn v1 cache': 'Yarn v1 缓存', 'Go build cache': 'Go 构建缓存', 'npm cache': 'npm 缓存', 'pnpm store': 'pnpm 存储', 'NVIDIA shader cache': 'NVIDIA 着色器缓存', 'Steam web cache': 'Steam 网页缓存', 'DirectX shader cache': 'DirectX 着色器缓存', 'AMD DX cache': 'AMD DX 缓存',
    'Open WebUI leftovers': 'Open WebUI 残留', 'Old installers': '旧安装包', 'Windows Update cache': 'Windows 更新缓存', 'Thumbnail cache': '缩略图缓存', 'Temporary files': '临时文件', 'Error reports': '错误报告', 'App crash dumps': '应用崩溃转储',
    'Telegram media cache': 'Telegram 媒体缓存', 'Discord cache': 'Discord 缓存', 'VS Code old extensions': 'VS Code 旧扩展', 'Zen browser cache': 'Zen 浏览器缓存', 'Edge cache': 'Edge 缓存', 'Cookies & history': 'Cookie 和历史记录',
    'Packages re-download on the next install': '下次安装时会重新下载软件包', 'Looks like 3.1 GB, frees 0 B — all packages still linked': '看似 3.1 GB，实际释放 0 B——所有包仍在使用',
    'First launch of each game may stutter briefly': '每个游戏首次启动可能短暂卡顿', 'Steam is running — skipped unless closed': 'Steam 正在运行——不关闭则跳过',
    'App uninstalled · untouched for 94 days': '应用已卸载 · 文件夹 94 天未改动', 'Older than 30 days': '超过 30 天', 'Open files and folders changed in the last 24 h are kept': '保留已打开的文件和 24 小时内修改的文件夹',
    'Media re-downloads when you open old chats': '打开旧聊天时会重新下载媒体', 'Passwords and bookmarks are never touched': '绝不触碰密码和书签',
    'settings and chat history go to the Recycle Bin': '其设置和聊天记录将移至回收站', 'installers you might reuse go to the Recycle Bin': '可能还会用到的安装包将移至回收站', 'you will be signed out of most websites': '你将从大多数网站退出登录',
    'Microsoft Edge auto-launch': 'Edge 自动启动'
  }
};
export const LOCALE: Record<string, string> = { en: 'en-US', ru: 'ru-RU', es: 'es-ES', zh: 'zh-CN' };
export const LANGS = [['en', 'English'], ['ru', 'Русский'], ['es', 'Español'], ['zh', '中文']];

// ---------- added for real scan data (step 2) ----------
const UI_ADD: Record<string, Record<string, string>> = {
  en: { appCache: '{app} cache', appLeftovers: '{app} leftovers', oldExt: '{app} old extensions', untouched: 'App uninstalled · untouched for {n} days', warnRunning: '{app} is running — skipped unless closed', appRunning: '{app} is running', retryApp: 'Close {app} and retry', needsAdmin: 'Needs admin rights', toolMissing: 'Tool not found', toolFailed: 'Did not finish — see log', undo: 'Undo', tUndone: 'Undone · previous startup restored', tNotApplied: 'Some changes were not applied', adminDeclined: 'Windows prompt declined', helperMissing: 'Admin helper not found', helperFailed: 'Admin helper stopped', restoreOff: 'System Protection is off', restoreFailed: 'Restore point not created', notAllowed: 'Not allowed', close: 'Close', minimize: 'Minimize', font: 'Font', d30: '30 days', time: 'Time', safeOnlyItems: 'Safe items only', excluded: 'Excluded folders', excludedSub: 'Never scanned, reviewed or cleaned', addFolder: 'Add folder', remove: 'Remove', tipUpdate: 'Update available · {v}', tipUpdateSub: 'Open the release page to download', updates: 'Check for updates', updatesSub: 'Asks GitHub twice a day; nothing about you is sent' },
  ru: { appCache: 'Кэш {app}', appLeftovers: 'Остатки {app}', oldExt: 'Старые расширения {app}', untouched: 'Программа удалена · папку не трогали {n} дн.', warnRunning: '{app} запущен — будет пропущено, если не закрыть', appRunning: '{app} запущен', retryApp: 'Закрыть {app} и повторить', needsAdmin: 'Нужны права администратора', toolMissing: 'Инструмент не найден', toolFailed: 'Не завершено — см. журнал', undo: 'Отменить', tUndone: 'Отменено · автозагрузка восстановлена', tNotApplied: 'Часть изменений не применена', adminDeclined: 'Запрос Windows отклонён', helperMissing: 'Помощник администратора не найден', helperFailed: 'Помощник администратора остановился', restoreOff: 'Защита системы отключена', restoreFailed: 'Точка восстановления не создана', notAllowed: 'Не разрешено', close: 'Закрыть', minimize: 'Свернуть', font: 'Шрифт', d30: '30 дней', time: 'Время', safeOnlyItems: 'только безопасное', excluded: 'Исключённые папки', excludedSub: 'Не сканируются, не проверяются и не очищаются', addFolder: 'Добавить папку', remove: 'Убрать', tipUpdate: 'Доступно обновление · {v}', tipUpdateSub: 'Открыть страницу релиза для загрузки', updates: 'Проверять обновления', updatesSub: 'Запрос к GitHub дважды в день; о вас ничего не отправляется' },
  es: { appCache: 'Caché de {app}', appLeftovers: 'Restos de {app}', oldExt: 'Extensiones antiguas de {app}', untouched: 'App desinstalada · carpeta sin cambios desde hace {n} días', warnRunning: '{app} está abierto — se omitirá si no se cierra', appRunning: '{app} está abierto', retryApp: 'Cerrar {app} y reintentar', needsAdmin: 'Requiere permisos de administrador', toolMissing: 'Herramienta no encontrada', toolFailed: 'No terminó — ver registro', undo: 'Deshacer', tUndone: 'Deshecho · inicio restaurado', tNotApplied: 'Algunos cambios no se aplicaron', adminDeclined: 'Aviso de Windows rechazado', helperMissing: 'No se encontró el asistente de admin', helperFailed: 'El asistente de admin se detuvo', restoreOff: 'La protección del sistema está desactivada', restoreFailed: 'No se creó el punto de restauración', notAllowed: 'No permitido', close: 'Cerrar', minimize: 'Minimizar', font: 'Fuente', d30: '30 días', time: 'Hora', safeOnlyItems: 'solo lo seguro', excluded: 'Carpetas excluidas', excludedSub: 'Nunca se analizan, revisan ni limpian', addFolder: 'Añadir carpeta', remove: 'Quitar', tipUpdate: 'Actualización disponible · {v}', tipUpdateSub: 'Abre la página de la versión para descargarla', updates: 'Buscar actualizaciones', updatesSub: 'Consulta GitHub dos veces al día; no se envía nada sobre ti' },
  zh: { appCache: '{app} 缓存', appLeftovers: '{app} 残留', oldExt: '{app} 旧扩展', untouched: '应用已卸载 · 文件夹 {n} 天未改动', warnRunning: '{app} 正在运行——不关闭则跳过', appRunning: '{app} 正在运行', retryApp: '关闭 {app} 并重试', needsAdmin: '需要管理员权限', toolMissing: '未找到工具', toolFailed: '未完成——请查看日志', undo: '撤销', tUndone: '已撤销 · 启动项已恢复', tNotApplied: '部分更改未应用', adminDeclined: 'Windows 提示被拒绝', helperMissing: '未找到管理员助手', helperFailed: '管理员助手已停止', restoreOff: '系统保护已关闭', restoreFailed: '未创建还原点', notAllowed: '不允许', close: '关闭', minimize: '最小化', font: '字体', d30: '30 天', time: '时间', safeOnlyItems: '仅安全项', excluded: '排除的文件夹', excludedSub: '永不扫描、查看或清理', addFolder: '添加文件夹', remove: '移除', tipUpdate: '有可用更新 · {v}', tipUpdateSub: '打开发布页面下载', updates: '检查更新', updatesSub: '每天向 GitHub 查询两次，不发送任何个人信息' }
};
const DATA_ADD: Record<string, Record<string, string>> = {
  ru: {
    'Bun cache': 'Кэш Bun', 'pip cache': 'Кэш pip', 'uv cache': 'Кэш uv', 'Poetry cache': 'Кэш Poetry', 'Conda packages': 'Пакеты Conda', 'Go module cache': 'Кэш модулей Go', 'Cargo registry cache': 'Кэш реестра Cargo', 'Gradle caches': 'Кэш Gradle', 'Maven repository': 'Репозиторий Maven', 'NuGet cache': 'Кэш NuGet', 'Playwright browsers': 'Браузеры Playwright', 'Puppeteer browsers': 'Браузеры Puppeteer', 'JetBrains caches & logs': 'Кэш и логи JetBrains', 'Visual Studio component cache': 'Кэш компонентов Visual Studio',
    'AMD shader cache': 'Кэш шейдеров AMD', 'Intel shader cache': 'Кэш шейдеров Intel', 'Epic Games web cache & logs': 'Веб-кэш и логи Epic Games', 'Roblox logs': 'Логи Roblox', 'Prism Launcher cache': 'Кэш Prism Launcher', 'Steam logs & dumps': 'Логи и дампы Steam', 'Steam shader cache': 'Кэш шейдеров Steam',
    'Windows temporary files': 'Временные файлы Windows', 'System error reports': 'Системные отчёты об ошибках', 'Memory dumps': 'Дампы памяти', 'Windows logs': 'Журналы Windows', 'Driver installer leftovers': 'Остатки установщиков драйверов', 'Store app caches': 'Кэш приложений Store', 'Recycle Bin': 'Корзина',
    'Spotify cache': 'Кэш Spotify', 'Office file cache': 'Кэш файлов Office', 'CapCut cache': 'Кэш CapCut', 'OneDrive logs': 'Логи OneDrive', 'Adobe media cache': 'Медиакэш Adobe',
    'Hardlinked store: may free much less than shown': 'Хранилище на жёстких ссылках: освободится меньше, чем показано', 'Explorer rebuilds thumbnails as you browse': 'Проводник создаст эскизы заново', 'Crash diagnostics are lost': 'Диагностика сбоев будет потеряна',
    'settings and data go to the Recycle Bin': 'настройки и данные уйдут в корзину', 'Previous Windows installation': 'Предыдущая установка Windows', 'Restore point': 'Точка восстановления', 'Compact virtual disk': 'Сжатие виртуального диска', 'you can no longer roll back to the previous Windows version': 'вы больше не сможете вернуться к предыдущей версии Windows', 'deleted files can no longer be restored': 'удалённые файлы больше нельзя будет восстановить'
  },
  es: {
    'Bun cache': 'Caché de Bun', 'pip cache': 'Caché de pip', 'uv cache': 'Caché de uv', 'Poetry cache': 'Caché de Poetry', 'Conda packages': 'Paquetes de Conda', 'Go module cache': 'Caché de módulos de Go', 'Cargo registry cache': 'Caché del registro de Cargo', 'Gradle caches': 'Cachés de Gradle', 'Maven repository': 'Repositorio de Maven', 'NuGet cache': 'Caché de NuGet', 'Playwright browsers': 'Navegadores de Playwright', 'Puppeteer browsers': 'Navegadores de Puppeteer', 'JetBrains caches & logs': 'Cachés y registros de JetBrains', 'Visual Studio component cache': 'Caché de componentes de Visual Studio',
    'AMD shader cache': 'Caché de shaders AMD', 'Intel shader cache': 'Caché de shaders Intel', 'Epic Games web cache & logs': 'Caché web y registros de Epic Games', 'Roblox logs': 'Registros de Roblox', 'Prism Launcher cache': 'Caché de Prism Launcher', 'Steam logs & dumps': 'Registros y volcados de Steam', 'Steam shader cache': 'Caché de shaders de Steam',
    'Windows temporary files': 'Archivos temporales de Windows', 'System error reports': 'Informes de errores del sistema', 'Memory dumps': 'Volcados de memoria', 'Windows logs': 'Registros de Windows', 'Driver installer leftovers': 'Restos de instaladores de drivers', 'Store app caches': 'Cachés de apps de Store', 'Recycle Bin': 'Papelera',
    'Spotify cache': 'Caché de Spotify', 'Office file cache': 'Caché de archivos de Office', 'CapCut cache': 'Caché de CapCut', 'OneDrive logs': 'Registros de OneDrive', 'Adobe media cache': 'Caché multimedia de Adobe',
    'Hardlinked store: may free much less than shown': 'Almacén con enlaces duros: puede liberar mucho menos de lo indicado', 'Explorer rebuilds thumbnails as you browse': 'El Explorador regenera las miniaturas al navegar', 'Crash diagnostics are lost': 'Se pierden los diagnósticos de fallos',
    'settings and data go to the Recycle Bin': 'sus ajustes y datos van a la papelera', 'Previous Windows installation': 'Instalación anterior de Windows', 'Restore point': 'Punto de restauración', 'Compact virtual disk': 'Compactar disco virtual', 'you can no longer roll back to the previous Windows version': 'ya no podrás volver a la versión anterior de Windows', 'deleted files can no longer be restored': 'los archivos borrados ya no se podrán recuperar'
  },
  zh: {
    'Bun cache': 'Bun 缓存', 'pip cache': 'pip 缓存', 'uv cache': 'uv 缓存', 'Poetry cache': 'Poetry 缓存', 'Conda packages': 'Conda 软件包', 'Go module cache': 'Go 模块缓存', 'Cargo registry cache': 'Cargo 注册表缓存', 'Gradle caches': 'Gradle 缓存', 'Maven repository': 'Maven 仓库', 'NuGet cache': 'NuGet 缓存', 'Playwright browsers': 'Playwright 浏览器', 'Puppeteer browsers': 'Puppeteer 浏览器', 'JetBrains caches & logs': 'JetBrains 缓存和日志', 'Visual Studio component cache': 'Visual Studio 组件缓存',
    'AMD shader cache': 'AMD 着色器缓存', 'Intel shader cache': 'Intel 着色器缓存', 'Epic Games web cache & logs': 'Epic Games 网页缓存和日志', 'Roblox logs': 'Roblox 日志', 'Prism Launcher cache': 'Prism Launcher 缓存', 'Steam logs & dumps': 'Steam 日志和转储', 'Steam shader cache': 'Steam 着色器缓存',
    'Windows temporary files': 'Windows 临时文件', 'System error reports': '系统错误报告', 'Memory dumps': '内存转储', 'Windows logs': 'Windows 日志', 'Driver installer leftovers': '驱动安装残留', 'Store app caches': '应用商店应用缓存', 'Recycle Bin': '回收站',
    'Spotify cache': 'Spotify 缓存', 'Office file cache': 'Office 文件缓存', 'CapCut cache': 'CapCut 缓存', 'OneDrive logs': 'OneDrive 日志', 'Adobe media cache': 'Adobe 媒体缓存',
    'Hardlinked store: may free much less than shown': '硬链接存储：实际释放可能远少于显示', 'Explorer rebuilds thumbnails as you browse': '资源管理器会在浏览时重建缩略图', 'Crash diagnostics are lost': '崩溃诊断信息将丢失',
    'settings and data go to the Recycle Bin': '其设置和数据将移至回收站', 'Previous Windows installation': '以前的 Windows 安装', 'Restore point': '还原点', 'Compact virtual disk': '压缩虚拟磁盘', 'you can no longer roll back to the previous Windows version': '将无法回退到以前的 Windows 版本', 'deleted files can no longer be restored': '已删除的文件将无法再恢复'
  }
};
for (const l in UI_ADD) Object.assign(UI[l], UI_ADD[l]);
for (const l in DATA_ADD) Object.assign(DATA[l], DATA_ADD[l]);
