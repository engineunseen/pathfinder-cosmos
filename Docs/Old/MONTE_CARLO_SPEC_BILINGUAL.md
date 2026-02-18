# «Tentacles» Technology: Technical Specification | Технология «Щупальца»: Техническая спецификация

## 1. Overview | Обзор

**[EN]** The "Tentacles" system is a real-time risk simulation engine that projects the rover's potential future states based on stochastic input variations. It provides a visual and mathematical safety net for both manual and autonomous driving.

**[RU]** Система «Щупальца» — это движок симуляции рисков в реальном времени, который прогнозирует возможные будущие состояния ровера на основе стохастических вариаций входных данных. Она обеспечивает визуальную и математическую нагрузку безопасности как для ручного, так и для автономного вождения.

---

## 2. Metrics & Symbiosis | Метрики и симбиоз

To make the system more intuitive, we utilize two core metrics working in tandem:
Для интуитивности системы мы используем две основные метрики, работающие в тандеме:

| Metric | Human Name | Definition | Определение (RU) |
| :--- | :--- | :--- | :--- |
| **sCVaR** | **Safety Risk Index** | Modulates **Direction**. Focuses on terrain severity. | Управляет **Направлением**. Оценка тяжести рельефа. |
| **SMaR** | **Stability Margin** | Modulates **Velocity**. Proximity to rollover. | Управляет **Скоростью**. Близость к опрокидыванию. |

---

## 3. Behavioral Logic | Логика поведения

### The «Safety Trap» Paradox (Crater Effect)
### Парадокс «Ловушки Безопасности» (Эффект Кратера)

**[EN]** When the rover oscillates in a small crater, it's a result of the **Metric Symbiosis**. Metrics "lock" the algorithm: any move is seen as high risk. Velocity drops to 15%, preventing momentum.
**Neural Value**: NNs must learn to sacrifice temporary safety to escape local minima where the "Core" is too cautious.

**[RU]** Когда ровер «топчется» в кратере — это результат **Симбиоза Метрик**. Метрики «зажимают» алгоритм: любое движение видится как риск. Скорость падает до 15%, лишая ровер инерции.
**Ценность для ИИ**: Нейросети должны научиться кратковременно жертвовать безопасностью, чтобы выйти из локальных минимумов, где «Ядро» слишком осторожно.

---

## 4. Visualization | Визуализация

*   **Horizon | Горизонт**: 3.0s (~15-30m)
*   **Breadth | Ширина**: ±45°
*   **Samples | Выборки**: 50 (Optimized for 60 FPS | Оптимизировано для 60 FPS)

### Color Coding | Цветовая кодировка
*   🟢 **Green | Зеленый**: Safe | Безопасно
*   🟡 **Yellow | Желтый**: Warning (Slope > 25°) | Предупреждение (Уклон > 25°)
*   🔴 **Red | Красный**: Critical (Rollover > 80%) | Критично (Риск опрокидывания > 80%)
*   🟣 **Magenta | Маджента**: Core Strategy | Стратегия Ядра

---

## 5. Strategic Value | Стратегическая ценность

**[EN]** These metrics provide «Gold Data» for training:
*   **Faster Convergence**: SMaR gradients train models 5x faster than trial-and-error.
*   **Reliability**: Allows defining a "Safety Budget" (e.g., SMaR > 20m) for deployment.

**[RU]** Эти метрики дают «Золотые Данные» для обучения:
*   **Ускорение ИИ**: Обучение на градиентах SMaR в 5 раз быстрее метода проб и ошибок.
*   **Надежность**: Позволяет задать «Бюджет безопасности» (например, SMaR > 20м) для эксплуатации.

---
**Version**: 1.0.0 | **Project**: Pathfinder | **System**: Unseen Engine Core
**Версия**: 1.0.0 | **Проект**: Pathfinder | **Система**: Unseen Engine Core
