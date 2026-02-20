# План интеграции NVIDIA Cosmos Reason 2 (v3.2.0 — Пошаговый)

Этот документ описывает процесс перехода с Gemini на NVIDIA Cosmos. Процесс разделен на этапы: подготовка (бесплатно) и активная фаза (платно).

## 🚀 Дорожная карта для пользователя

### Этап 1: Подготовка (На стороне кода, сервер пока не нужен)
*На этом этапе мы готовим приложение к работе с "любым" ИИ, чтобы как только сервер запустится, мы могли мгновенно протестировать связь.*
1. **Создание `VisionProvider`:** Я перепишу логику в `aiNavigator.js`, вынесу работу с API в отдельный модуль.
2. **Реализация захвата кадров:** Добавление функции `captureFrame()`, которая будет брать изображение текущей камеры ровера для отправки в ИИ.
3. **Локальное тестирование:** Проверим, что кадры корректно захватываются и данные готовы к отправке.

### Этап 2: Запуск инфраструктуры (Начинается расход кредитов)
*Я дам тебе пошаговые инструкции для терминала/интерфейса Brev.dev.*
1. **Запуск инстанса L40S:** Инструкция по созданию виртуальной машины.
2. **Развертывание контейнера NIM:** Одна команда Docker, которую нужно вставить в терминал инстанса.
3. **Получение IP-адреса:** Ты дашь мне адрес, и я пропишу его в конфиг приложения.

### Этап 3: Сопряжение и сценарии (Активная работа)
*Проверяем два ключевых сценария интеграции.*
1. **Сценарий А (Штурман):** Передаем карту высот в Cosmos. Он строит маршрут (Waypoints).
2. **Сценарий Б (Пилот):** Передаем "живой" поток кадров. Cosmos управляет ровером напрямую (`steer`, `throttle`).
3. **Настройка парсинга:** Оптимизация обработки ответов, чтобы исключить ошибки (JSON-валидация).

### Этап 4: Безопасность и экономия
1. **Индикатор простоя:** Если API не используется 15 минут, HUD начнет мигать: `IDLE ALERT: Удалите инстанс, чтобы не тратить кредиты!`.
2. **Fallback:** Проверка плавного перехода на локальный драйвер при задержках связи > 4 сек.

### Этап 5: Сохранение существующей архитектуры
1. **Никакого удаления:** Интеграция NVIDIA Cosmos не заменяет существующие нейросети (Gemini). Они остаются доступными как альтернативные провайдеры зрения.
2. **Unseen Core Fallback:** В системе реализован "Digital Twin" (Unseen Core) — физический движок, который автоматически берет управление при отсутствии связи с ИИ.

---

## 🛠 Техническая спецификация

### 1. Архитектура "Наблюдение + Верификация"
- **Cosmos (Observation):** "Видит" препятствия через камеру. Дает вектор намерения.
- **Monte Carlo (Verification):** Проверяет вектор ИИ через 300 физических симуляций. Если ИИ ошибается, физика его блокирует.

### 2. Сценарии использования
- **Strategic Waypoints:** Построение глобального пути по карте высот.
- **Visual Autopilot:** Локальное маневрирование в реальном времени по видеопотоку.

### 3. Контроль затрат
- Мониторинг времени жизни инстанса.
- Оповещение пользователя о бездействии в интерфейсе HUD.

---
**Статус:** Ожидает утверждения пользователем для начала Этапа 1.
**Версия:** v3.3.5

---

# NVIDIA Cosmos Integration Roadmap (English v3.3.4)

## 🚀 Step-by-Step Roadmap for the User

### Phase 1: Preparation (Code-side, No server yet)
*Focus on preparing the app for any Vision model to minimize paid uptime.*
1. **Implement `VisionProvider`:** Modularize API logic in `aiNavigator.js`.
2. **Implement `captureFrame()`:** Add logic to capture the active Three.js camera view as Base64.
3. **Local Validation:** Verify frame capture works without errors.

### Phase 2: Infrastructure Trigger (Credits begin to spend)
*I will provide step-by-step terminal instructions for the Brev.dev environment.*
1. **L40S Instance Creation:** Step-by-step guide to spawning the VM.
2. **NIM Deployment:** One-line Docker command execution.
3. **Endpoint Connectivity:** You provide the IP, I update the application link.

### Phase 3: Integration & Scenarios (Active Testing)
1. **Scenario A (Strategic):** Send heightmap to Cosmos -> Receive waypoints.
2. **Scenario B (Tactical):** Send live frame stream -> Receive steering/throttle.
3. **Parsing Robustness:** Tune JSON validation to handle any Cosmos output format.

### Phase 4: Safety & Cost Optimization
1. **Idle Alert:** Pulse `IDLE ALERT: Delete instance to save credits!` if API is unused for 15 minutes.
2. **Latency Fallback:** Ensure a smooth handoff to the "Digital Twin" if RTT exceeds 4s.

### Phase 5: Architectural Integrity
1. **No Replacement:** NVIDIA Cosmos integration does NOT remove existing neural networks (Gemini). They remain as valid vision providers.
2. **Unseen Core Fallback:** The "Digital Twin" (Unseen Core) engine is the primary fallback. It automatically engages if AI connectivity is lost, ensuring mission continuity.

---
**Status:** Awaiting User Approval to proceed with Phase 1.
**Version:** v3.2.0
