#!/bin/bash
# setup_cosmos.sh — Автоматизация настройки сервера NVIDIA Cosmos для Pathfinder
# v1.0.0

echo "🚀 ЗАПУСК Pathfinder: Cosmos Bridge Protocol..."

# 1. Очистка и подготовка репозитория
if [ ! -d "cosmos-reason2" ]; then
    echo "📂 Клонирование репозитория NVIDIA Cosmos..."
    git clone https://github.com/nvidia-cosmos/cosmos-reason2.git
fi

cd cosmos-reason2 || exit

# 2. Настройка виртуального окружения через uv (максимальная скорость)
if [ ! -d ".venv" ]; then
    echo "🐍 Создание виртуального окружения..."
    uv venv
fi

echo "🔌 Активация окружения..."
source .venv/bin/activate

echo "📦 Проверка зависимостей (vLLM)..."
uv pip install vllm

# 3. Запуск сервера с оптимизированными параметрами для L40S
echo "🔥 ЗАПУСК СЕРВЕРА NVIDIA COSMOS (PORT 8000)..."
echo "Модель: nvidia/Cosmos-Reason2-2B"

python -m vllm.entrypoints.openai.api_server \
    --model nvidia/Cosmos-Reason2-2B \
    --trust-remote-code \
    --port 8000 \
    --max-model-len 4096 \
    --gpu-memory-utilization 0.9

# vLLM автоматически загрузит веса модели (около 5ГБ) при первом запуске.
