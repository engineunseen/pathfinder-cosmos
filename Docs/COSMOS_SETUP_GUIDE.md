# 🦾 NVIDIA COSMOS: MASTER SETUP GUIDE
## For Pathfinder Physical AI Simulation
🔗 **Live Demo:** [cosmos.unseenengine.tech](https://cosmos.unseenengine.tech/)

---

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
5. Выполните команды по одной (заменив `TOKEN` на ваш HuggingFace токен):
   ```bash
   export HF_TOKEN=TOKEN
   curl -sSL https://raw.githubusercontent.com/engineunseen/pathfinder-cosmos/main/Docs/setup_cosmos.sh -o setup_cosmos.sh
   bash setup_cosmos.sh
   ```
   ⏳ **Ждите 3-5 минут.** Скрипт скачает модель (~5 ГБ) и запустит сервер.
   ✅ Готово когда появится: `Application startup complete`.

### Шаг 2: Настройка доступа и Мост
1. **Ссылка (Brev)**: В разделе "Using Secure Links" нажмите **Share a Service**.
2. Введите порт `8000`. **ОБЯЗАТЕЛЬНО** переключите тумблер **Make Public** в положение ВКЛ.
3. Нажмите **Done** и скопируйте ссылку (например, `https://8000-xxxx.brevlab.com`).
4. **Мост (Ваш ПК)**: В терминале VS Code запустите:
   ```bash
   node proxy.js
   ```

### Шаг 3: Запуск и проверка
1. Откройте [cosmos.unseenengine.tech](https://cosmos.unseenengine.tech/) (или `http://localhost:5173` для локальной версии).
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
   curl -sSL https://raw.githubusercontent.com/engineunseen/pathfinder-cosmos/main/Docs/setup_cosmos.sh -o setup_cosmos.sh
   bash setup_cosmos.sh
   ```
   ⏳ Wait 3-5 minutes until `Application startup complete` appears.

### Step 2: Access & Proxy
1. **Share Service** for Port `8000` on Brev. **ENABLE "Make Public"**.
2. Run `node proxy.js` on your local machine.

### Step 3: Simulation Configuration
1. Open [cosmos.unseenengine.tech](https://cosmos.unseenengine.tech/).
2. Settings → AI section:
   - **Model**: `nvidia/Cosmos-Reason2-2B`
   - **Endpoint**: `http://localhost:8001/v1`
   - **API Key**: Your Brev Public Link.

---

## ⚡ Troubleshooting
- **Script shows text but doesn't run**: Use `curl -o setup_cosmos.sh` then `bash setup_cosmos.sh` (two separate commands).
- **Long wait on first start**: Model download is ~5 GB. Wait for `Application startup complete`.
- **Offline / connection refused**: Check that `proxy.js` is running and the Brev link is set to **Public**.
- **No AI response**: Verify the Brev server hasn't timed out (check Brev dashboard).
