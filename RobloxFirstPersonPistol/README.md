# First Person Pistol Viewmodel — Roblox Studio / Luau (2026)

Готовый кит: **первое лицо при входе + пистолет с рукой слева + анимация при ходьбе + Ctrl переставляет направо**.

## 📄 Главный файл

**[INSTALL_FIRST_PERSON_PISTOL.txt](./INSTALL_FIRST_PERSON_PISTOL.txt)** — один большой `.txt`: точное дерево Explorer, куда вставлять, настройки, troubleshooting **и полный исходный код всех 4 скриптов** (1186 строк).

## Исходники (готовы к копированию)

| Файл | Тип объекта в Studio | Куда |
| --- | --- | --- |
| `FPSettings.lua` | `ModuleScript` → имя `FPSettings` | `StarterPlayer > StarterPlayerScripts` |
| `ViewmodelBuilder.lua` | `ModuleScript` → имя `ViewmodelBuilder` | `StarterPlayer > StarterPlayerScripts` |
| `FPViewmodel.client.lua` | `LocalScript` → имя `FPViewmodel` | `StarterPlayer > StarterPlayerScripts` |
| `FirstPersonInit.server.lua` | `Script` → имя `FirstPersonInit` | `ServerScriptService` |

> ⚠️ Имена **ModuleScript-объектов** должны быть ровно `FPSettings` и `ViewmodelBuilder` — на них стоят `WaitForChild(...)`.

## Управление

`WASD` — ходьба/боб · `Мышь` — инерция оружия · `LeftCtrl` / `RightCtrl` — смена руки · кнопка `⇄` — для тач-экранов · `ЛКМ` — косметическая отдача.

## Быстрый твик

В `FPSettings.lua`: `RENDER_MODE = "Viewport"` убирает зарезание оружия об стены, `LEFT_OFFSET` / `RIGHT_OFFSET` двигают пистолет, `BOB_*` крутят походную анимацию.

Следующий шаг по запросу: настоящая стрельба (`RemoteEvent` + серверный Raycast + патроны + ADS на ПКМ + анти-чит).
