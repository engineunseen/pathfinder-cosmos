# 🦾 NVIDIA COSMOS: MASTER SETUP GUIDE (Physical AI Simulation)
## 🇷🇺 ИНСТРУКЦИЯ НА РУССКОМ (Click-by-Click)
### Шаг 0: Подготовка (Hugging Face)
1. Создайте аккаунт на [Hugging Face](https://huggingface.co/).
2. Получите доступ к модели: **[nvidia/Cosmos-Reason2-2B](https://huggingface.co/nvidia/Cosmos-Reason2-2B)** (нажмите "Agree and access repository").
3. Создайте **Read** токен в [настройках](https://huggingface.co/settings/tokens) и скопируйте его.

### Шаг 1: Облачный сервер (Brev.dev)
1. Перейдите по ссылке: **[Brev.dev L40S Deployment](https://brev.nvidia.com/environment/new?gpu=L40S)**.
2. Выберите GPU **L40S** (Crusoe/Verda).
3. Нажмите кнопку **Deploy** (внизу слева). Дождитесь статуса **Running**.
4. Нажмите **Open Notebook** -> в Jupyter выберите иконку **Terminal**.
5. Выполните команды (заменив `TOKEN` на ваш):
   ```bash
   export HF_TOKEN=TOKEN
   curl -sSL https://raw.githubusercontent.com/engineunseen/pathfinder-cosmos/main/Docs/setup_cosmos.sh | bash
   ```
   *Ждите до появления надписи: `Application startup complete`.*

### Шаг 2: Настройка доступа и Мост
1. **Сслыка (Brev)**: В разделе "Using Secure Links" нажмите **Share a Service**.
2. Введите порт `8000`. **ОБЯЗАТЕЛЬНО** переключите тумблер **Make Public** в положение ВКЛ.
3. Нажмите **Done** и скопируйте ссылку (например, `https://8000-xxxx.brevlab.com`).
4. **Мост (Ваш ПК)**: В терминале VS Code запустите:
   ```bash
   node proxy.js
   ```

### Шаг 3: Запуск и проверка
1. Откройте симуляцию в браузере (локально или по ссылке).
2. Нажмите **Settings** (шестеренка) -> раздел **AI**.
3. **Заполните поля:**
   - **Identity**: `NVIDIA Cosmos (Local NIM)`
   - **Model**: `nvidia/Cosmos-Reason2-2B`
   - **Endpoint**: `http://localhost:8001/v1`
   - **API Key**: Ваша ссылка из Шага 2 (с `https://`).
4. Закройте настройки и переключитесь в режим **Autopilot (клавиша M)**.

---

## 🇬🇧 ENGLISH VERSION

### Step 1: Cloud Server
1. Deploy **L40S** on **[Brev.dev](https://brev.nvidia.com/environment/new?gpu=L40S)**.
2. In **Open Notebook** Terminal, run:
   ```bash
   export HF_TOKEN=YOUR_TOKEN
   curl -sSL https://raw.githubusercontent.com/engineunseen/pathfinder-cosmos/main/Docs/setup_cosmos.sh | bash
   ```

### Step 2: Access & Proxy
1. **Share Service** for Port `8000` on Brev. **ENABLE "Make Public"**.
2. Run `node proxy.js` on your local machine.

### Step 3: Simulation Configuration
- **Model**: `nvidia/Cosmos-Reason2-2B`
- **Endpoint**: `http://localhost:8001/v1`
- **API Key**: Your Brev Public Link.

---

## ⚡ Troubleshooting
- **404 Not Found**: Ensure you added `.sh` to the curl URL if checking manually.
- **Offline**: Check if `proxy.js` is running and the Brev link is set to **Public**.
- **Metrics**: Ensure **sCVaR** and **SMaR** are visible in the HUD.
