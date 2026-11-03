--[[
    FPSettings.lua
    ModuleScript -> StarterPlayer > StarterPlayerScripts

    ЕДИНЫЙ ФАЙЛ НАСТРОЕК для «First Person Pistol Viewmodel».
    Меняй цифры здесь, остальные скрипты трогать не надо.

    Актуально: ноябрь 2026 / Roblox Studio / Luau.
    Автор: твой кодер-гений по Roblox-скриптам :)
--]]

local Settings = {}

-- =====================================================================
-- 1. РЕНДЕР ВЬЮМОДЕЛИ
-- =====================================================================
-- "Camera"   -> детали живут прямо в Workspace.CurrentCamera.
--               Свет мира совпадает 1:1, максимально дёшево.
--               Минус: у самой стенки пистолет может на кадр «зарезаться».
-- "Viewport" -> рендер через ViewportFrame + WorldModel + отдельная Camera.
--               Геометрия мира НИКОГДА не перекрывает оружие (топ для шутера).
--               Свет настраивается отдельно, чуть дороже по GPU.
Settings.RENDER_MODE = "Camera" -- "Camera" | "Viewport"

-- =====================================================================
-- 2. КАМЕРА / ПЕРВОЕ ЛИЦО
-- =====================================================================
Settings.FORCE_FIRST_PERSON  = true
Settings.CAMERA_MIN_ZOOM     = 0      -- 0 = прилипшая к голове камера
Settings.CAMERA_MAX_ZOOM     = 0      -- 0 = запрет третьего лица колесом
Settings.FIELD_OF_VIEW       = 75
Settings.HIDE_REAL_CHARACTER = true   -- прячем родные руки/торс/шляпы игрока
Settings.LOCK_MOUSE          = false  -- true = курсор залочен (чистый FPS-фил)
Settings.DISABLE_SHIFT_LOCK  = true   -- чтобы Shift не откидывал камеру в плечо

-- =====================================================================
-- 3. УПРАВЛЕНИЕ
-- =====================================================================
Settings.SWAP_KEYS = {
    Enum.KeyCode.LeftControl,
    Enum.KeyCode.RightControl,
}
Settings.SWAP_TIME          = 0.28    -- сек, плавный переезд TweenService
Settings.SHOW_TOUCH_BUTTON = true     -- кнопка «⇄» для телефона/планшета
Settings.SHOW_HINT         = true     -- подсказка «CTRL» внизу экрана

-- =====================================================================
-- 4. ПОЛОЖЕНИЕ ОРУЖИЯ (CFrame относительно камеры)
--    -Z = ВПЕРЁД, +Z = к глазам, -X = ЛЕВО, +X = ПРАВО, -Y = НИЗ
--    LEFT  -> старт: пистолет слева, рука из нижнего левого угла
--    RIGHT -> после Ctrl: пистолет справа, рука из нижнего правого угла
-- =====================================================================
Settings.LEFT_OFFSET = CFrame.new(-0.46, -0.40, -1.12)
    * CFrame.Angles(math.rad(-2), math.rad(11), math.rad(-6))

Settings.RIGHT_OFFSET = CFrame.new(0.46, -0.40, -1.12)
    * CFrame.Angles(math.rad(-2), math.rad(-11), math.rad(6))

-- Небольшая «дуга» при перекидывании, чтобы рука не ехала по прямой
Settings.SWAP_ARC_LIFT = 0.035
Settings.SWAP_ARC_YAW  = 0.050

-- =====================================================================
-- 5. АНИМАЦИЯ ХОДЬБЫ (БОБ)
-- =====================================================================
Settings.BOB_FREQUENCY = 9.2    -- рад/сек на полном бегу
Settings.BOB_SIDE      = 0.026  -- влево-вправо
Settings.BOB_UP        = 0.022  -- вверх-вниз
Settings.BOB_FORWARD   = 0.014  -- вперёд-назад
Settings.BOB_PITCH     = 0.030  -- радиан
Settings.BOB_YAW       = 0.022
Settings.BOB_ROLL      = 0.045
Settings.BOB_SMOOTH    = 10.0   -- сглаживание входа/выхода из движения

-- =====================================================================
-- 6. ДЫХАНИЕ В ПОКОЕ
-- =====================================================================
Settings.IDLE_SWAY_POS = 0.007
Settings.IDLE_SWAY_ROT = 0.010

-- =====================================================================
-- 7. СВАЙ ОТ ПОВОРОТА ГОЛОВЫ / МЫШИ
-- =====================================================================
Settings.LOOK_SWAY         = 0.0016 -- радиан за пиксель дельты мыши
Settings.LOOK_CAMERA_GAIN  = 1.35   -- импульс за радиан реального поворота камеры
Settings.LOOK_IMPULSE_CLAMP = 0.25  -- защита от скачка при телепорте
Settings.LOOK_RETURN       = 9.0    -- как быстро возвращается к нулю
Settings.LOOK_MAX          = 0.10   -- потолок, радиан

-- =====================================================================
-- 8. ВИЗУАЛЬНАЯ ОТДАЧА (бонус на ЛКМ, УРОНА НЕ НАНАСИТ)
--    Хочешь настоящую стрельбу -> скажи, добавлю RemoteEvent + серверный
--    Raycast + репликацию выстрела + хитбоксы + анти-чит.
-- =====================================================================
Settings.ENABLE_COSMETIC_FIRE = true
Settings.RECOIL_KICK_BACK    = 0.075
Settings.RECOIL_KICK_UP      = 0.045
Settings.RECOIL_PITCH        = 0.160
Settings.RECOIL_RETURN       = 12.0
Settings.MUZZLE_FLASH_TIME   = 0.055
Settings.SHOT_SOUND_ID       = ""  -- вставь "rbxassetid://...", пусто = тишина
Settings.SHOT_VOLUME         = 0.6

-- =====================================================================
-- 9. ЦВЕТА / МАТЕРИАЛЫ
-- =====================================================================
Settings.COLOR_SLIDE   = Color3.fromRGB(38, 41, 48)
Settings.COLOR_FRAME   = Color3.fromRGB(26, 28, 33)
Settings.COLOR_GRIP    = Color3.fromRGB(22, 23, 27)
Settings.COLOR_METAL   = Color3.fromRGB(112, 118, 128)
Settings.COLOR_ACCENT  = Color3.fromRGB(180, 140, 70)
Settings.COLOR_SLEEVE  = Color3.fromRGB(38, 62, 96)
Settings.COLOR_FLASH   = Color3.fromRGB(255, 214, 120)

-- Цвет кожи берётся автоматически из BodyColors.LeftArmColor персонажа.
-- Это fallback, если BodyColors ещё не прогрузился.
Settings.COLOR_SKIN_FALLBACK = Color3.fromRGB(226, 175, 134)

-- =====================================================================
-- 10. СЛУЖЕБНОЕ (не трогай без нужды)
-- =====================================================================
Settings.VIEWMODEL_NAME  = "FP_Pistol_ViewModel"
Settings.SCREEN_GUI_NAME = "FP_Pistol_Gui"
Settings.SWAP_GUI_NAME   = "FP_SwapButtonGui"
-- RenderPriority.Camera == 200. Ставим 201: вьюмодель идёт ПОСЛЕ того, как
-- стандартный PlayerModule уже посчитал CFrame камеры -> ноль рывков.
Settings.BIND_PRIORITY   = Enum.RenderPriority.Camera.Value + 1
Settings.BIND_NAME       = "FP_Pistol_Viewmodel_Update"

return Settings
