--[[
    FPViewmodel.client.lua
    LocalScript -> StarterPlayer > StarterPlayerScripts

    ЧТО ДЕЛАЕТ:
      1) Жёстко держит первое лицо (зум 0/0, CameraSubject = Humanoid).
      2) Прячет родное тело игрока, чтобы не торчали «настоящие» руки.
      3) Создаёт процедурный пистолет с кистью и предплечьем СЛЕВА,
         направленный вперёд (-Z камеры), как будто игрок его держит.
      4) При ходьбе/беге оружие анимированно качается (боб + ролл + питч),
         в покое «дышит», при резком повороте головы инерционно отстаёт.
      5) Ctrl (левый ИЛИ правый) плавно перекидывает пистолет НАПРАВО,
         повторный Ctrl возвращает налево. Есть кнопка «⇄» для тач-экранов.
      6) Бонус: ЛКМ = косметическая отдача + дульная вспышка (без урона).

    ВАЖНО: скрипт НЕ трогает сервер, НЕ спавнит Tool, НЕ меняет анимации
    персонажа -> не конфликтует с Animate, с R15/R6, с любыми датасторами.

    Актуально: ноябрь 2026 / Roblox Studio / Luau.
--]]

local Players              = game:GetService("Players")
local RunService           = game:GetService("RunService")
local UserInputService     = game:GetService("UserInputService")
local ContextActionService = game:GetService("ContextActionService")
local TweenService         = game:GetService("TweenService")

local Settings         = require(script.Parent:WaitForChild("FPSettings"))
local ViewmodelBuilder = require(script.Parent:WaitForChild("ViewmodelBuilder"))

local player    = Players.LocalPlayer
local playerGui = player:WaitForChild("PlayerGui")
local camera    = workspace.CurrentCamera
assert(camera, "[FP Pistol] Workspace.CurrentCamera ещё не создан")

-- =====================================================================
-- СОСТОЯНИЕ
-- =====================================================================
local builder       = nil
local renderParent  = nil

local screenGui     = nil   -- для режима "Viewport"
local worldModel    = nil
local viewportCamera = nil

local sideValue = Instance.new("NumberValue")
sideValue.Name   = "FP_SideBlend"  -- 0 = ЛЕВАЯ, 1 = ПРАВАЯ
sideValue.Value  = 0
sideValue.Parent = script

local sideTween = nil

local bobPhase   = 0
local idleTime   = 0
local lastMoveAmp = 0
local lookYaw      = 0
local lookPitch    = 0
local lastLookVector = nil
local recoil       = 0
local flashAlpha   = 0

local charConns = {}

-- =====================================================================
-- РЕНДЕР-РИГ: Camera  /  ViewportFrame + WorldModel
-- =====================================================================
local function destroyRenderRig()
    if screenGui then
        screenGui:Destroy()
        screenGui = nil
    end
    if worldModel then
        worldModel:Destroy()
        worldModel = nil
    end
    viewportCamera = nil
end

local function buildRenderRig()
    destroyRenderRig()

    if Settings.RENDER_MODE == "Viewport" then
        screenGui = Instance.new("ScreenGui")
        screenGui.Name             = Settings.SCREEN_GUI_NAME
        screenGui.ResetOnSpawn     = false
        screenGui.DisplayOrder     = 50
        screenGui.IgnoreGuiInset   = true
        screenGui.ZIndexBehavior   = Enum.ZIndexBehavior.Sibling
        screenGui.Parent           = playerGui

        local vf = Instance.new("ViewportFrame")
        vf.Name                   = "FP_Viewport"
        vf.Size                   = UDim2.fromScale(1, 1)
        vf.Position               = UDim2.fromScale(0, 0)
        vf.BackgroundTransparency = 1
        vf.Active                 = false
        vf.LightDirection         = Vector3.new(-0.5, -1, -0.4)
        vf.Ambient                = Color3.fromRGB(150, 150, 162)
        vf.LightColor             = Color3.fromRGB(255, 245, 225)
        vf.Parent                 = screenGui

        worldModel = Instance.new("WorldModel")
        worldModel.Name   = "FP_WorldModel"
        worldModel.Parent = vf

        viewportCamera = Instance.new("Camera")
        viewportCamera.Name        = "FP_ViewportCamera"
        viewportCamera.FieldOfView = Settings.FIELD_OF_VIEW
        pcall(function()
            viewportCamera.NearPlaneZ = 0.02
        end)
        viewportCamera.Parent = vf
        vf.CurrentCamera      = viewportCamera

        renderParent = worldModel
    else
        renderParent = camera
    end

    return renderParent
end

-- Камера может пересоздаться (респавн / телепорт / Studio Reset)
local function ensureCamera()
    local cam = workspace.CurrentCamera
    if cam and cam ~= camera then
        camera = cam
        if Settings.RENDER_MODE == "Camera" then
            renderParent = cam
            if builder then
                builder:SetParent(cam)
            end
        end
    end
    return cam or camera
end

workspace:GetPropertyChangedSignal("CurrentCamera"):Connect(ensureCamera)

-- =====================================================================
-- ПРЯЧЕМ РОДНОЙ ПЕРСОНАЖ (иначе из-под вьюмодели торчат руки R15)
-- =====================================================================
local function hidePart(obj)
    if obj:IsA("BasePart") then
        obj.LocalTransparencyModifier = 1
        obj.CastShadow = false
    elseif obj:IsA("Decal") or obj:IsA("Texture") then
        obj.Transparency = 1
    elseif obj:IsA("ParticleEmitter") or obj:IsA("Trail") then
        obj.Enabled = false
    end
end

local function clearCharConns()
    for _, c in ipairs(charConns) do
        c:Disconnect()
    end
    table.clear(charConns)
end

local function hideCharacter(char)
    clearCharConns()
    if not Settings.HIDE_REAL_CHARACTER then
        return
    end
    for _, obj in ipairs(char:GetDescendants()) do
        hidePart(obj)
    end
    -- Аксессуары/шляпы могут подгрузиться чуть позже -> добиваем на лету.
    table.insert(charConns, char.DescendantAdded:Connect(hidePart))
end

-- =====================================================================
-- ПЕРСОНАЖ / КАМЕРА ПРИ СПАВНЕ
-- =====================================================================
local function getHumanoid()
    local char = player.Character
    return char and char:FindFirstChildOfClass("Humanoid") or nil
end

local function onCharacterAdded(char)
    local humanoid = char:WaitForChild("Humanoid", 10)
    if not humanoid then
        warn("[FP Pistol] Humanoid не найден в Character")
        return
    end

    camera.CameraType    = Enum.CameraType.Custom
    camera.CameraSubject = humanoid
    camera.FieldOfView   = Settings.FIELD_OF_VIEW

    if Settings.FORCE_FIRST_PERSON then
        player.CameraMinZoomDistance = Settings.CAMERA_MIN_ZOOM
        player.CameraMaxZoomDistance = Settings.CAMERA_MAX_ZOOM
    end
    if Settings.LOCK_MOUSE then
        UserInputService.MouseBehavior = Enum.MouseBehavior.LockCurrentPosition
    end

    hideCharacter(char)

    -- Цвет кожи берём из BodyColors игрока, чтобы рука совпадала со скином.
    local skin = Settings.COLOR_SKIN_FALLBACK
    local bodyColors = char:FindFirstChildOfClass("BodyColors")
    if bodyColors then
        pcall(function()
            skin = bodyColors.LeftArmColor.Color
        end)
    end
    if builder then
        builder:SetSkin(skin)
        builder:SetVisible(true)
    end

    table.insert(charConns, humanoid.Died:Connect(function()
        if builder then
            builder:SetVisible(false)
        end
    end))
end

player.CharacterAdded:Connect(onCharacterAdded)
player.CharacterRemoving:Connect(function()
    if builder then
        builder:SetVisible(false)
    end
end)

-- =====================================================================
-- Ctrl -> ПЛАВНАЯ СМЕНА РУКИ
-- =====================================================================
local function toggleSide()
    local target = (sideValue.Value < 0.5) and 1 or 0
    if sideTween then
        sideTween:Cancel()
    end
    sideTween = TweenService:Create(
        sideValue,
        TweenInfo.new(Settings.SWAP_TIME, Enum.EasingStyle.Quad, Enum.EasingDirection.InOut),
        { Value = target }
    )
    sideTween:Play()
end

local function onSwap(_actionName, inputState, _inputObject)
    if inputState == Enum.UserInputState.Begin then
        toggleSide()
    end
    -- Pass = не забираем ввод у чужих скриптов (например, у krouch-систем).
    return Enum.ContextActionResult.Pass
end

ContextActionService:BindAction(
    "FP_SwapHand",
    onSwap,
    false,
    table.unpack(Settings.SWAP_KEYS)
)

-- =====================================================================
-- ЭКРАННАЯ КНОПКА + ПОДСКАЗКА (работает и на ПК, и на телефоне)
-- =====================================================================
local function buildSwapButton()
    if not Settings.SHOW_TOUCH_BUTTON and not Settings.SHOW_HINT then
        return
    end

    local gui = Instance.new("ScreenGui")
    gui.Name           = Settings.SWAP_GUI_NAME
    gui.ResetOnSpawn   = false
    gui.DisplayOrder   = 60
    gui.IgnoreGuiInset = true
    gui.Parent         = playerGui

    if Settings.SHOW_TOUCH_BUTTON then
        local btn = Instance.new("TextButton")
        btn.Name                   = "SwapHandButton"
        btn.Size                   = UDim2.fromOffset(64, 64)
        btn.Position               = UDim2.new(1, -82, 1, -96)
        btn.BackgroundColor3       = Color3.fromRGB(20, 22, 28)
        btn.BackgroundTransparency = 0.35
        btn.Text                   = "⇄"
        btn.TextColor3             = Color3.fromRGB(255, 255, 255)
        btn.TextSize               = 30
        btn.Font                   = Enum.Font.GothamBold
        btn.AutoButtonColor        = true
        btn.Parent                 = gui

        local corner = Instance.new("UICorner")
        corner.CornerRadius = UDim.new(0.5, 0)
        corner.Parent = btn

        btn.MouseButton1Click:Connect(toggleSide)
    end

    if Settings.SHOW_HINT then
        local hint = Instance.new("TextLabel")
        hint.Name                  = "Hint"
        hint.Size                  = UDim2.fromOffset(380, 28)
        hint.Position              = UDim2.new(0, 16, 1, -40)
        hint.BackgroundTransparency = 1
        hint.TextXAlignment        = Enum.TextXAlignment.Left
        hint.Font                  = Enum.Font.Gotham
        hint.TextSize              = 15
        hint.TextColor3            = Color3.fromRGB(210, 215, 225)
        hint.Text                  = "CTRL — сменить руку   ·   ЛКМ — отдача"
        hint.Parent                = gui
    end
end

-- =====================================================================
-- КОСМЕТИЧЕСКИЙ ВЫСТРЕЛ (без урона)
-- =====================================================================
local function fire()
    if not Settings.ENABLE_COSMETIC_FIRE then
        return
    end
    recoil     = 1
    flashAlpha = 1

    if Settings.SHOT_SOUND_ID ~= "" then
        local sound = script:FindFirstChild("FP_ShotSound")
        if not sound then
            sound = Instance.new("Sound")
            sound.Name    = "FP_ShotSound"
            sound.SoundId = Settings.SHOT_SOUND_ID
            sound.Volume  = Settings.SHOT_VOLUME
            sound.Parent  = script
        end
        sound:Play()
    end
end

UserInputService.InputBegan:Connect(function(input, gameProcessed)
    if gameProcessed then
        return
    end
    if input.UserInputType == Enum.UserInputType.MouseButton1 then
        fire()
    end
end)

-- =====================================================================
-- ГЛАВНЫЙ ЦИКЛ (BindToRenderStep с приоритетом ПОСЛЕ камеры Roblox)
-- =====================================================================
local function onRender(dt)
    local cam = ensureCamera()
    if not cam then
        return
    end

    -- В режиме Viewport держим свою камеру синхронной с игровой.
    if Settings.RENDER_MODE == "Viewport" and viewportCamera then
        viewportCamera.CFrame      = cam.CFrame
        viewportCamera.FieldOfView = cam.FieldOfView
    end

    local blend = math.clamp(sideValue.Value, 0, 1)

    -- ---------- Скорость / боб -------------------------------------
    local moveAmp = 0
    local hum = getHumanoid()
    if hum then
        local md = hum.MoveDirection
        local grounded = true
        pcall(function()
            grounded = (hum.FloorMaterial ~= Enum.Material.Air)
        end)

        if grounded and md.Magnitude > 0.01 then
            local horiz = 0
            local root = hum.RootPart
            if root then
                local ok, vel = pcall(function()
                    return root.AssemblyLinearVelocity
                end)
                if not ok or typeof(vel) ~= "Vector3" then
                    ok, vel = pcall(function()
                        return root.Velocity
                    end)
                end
                if ok and typeof(vel) == "Vector3" then
                    horiz = Vector3.new(vel.X, 0, vel.Z).Magnitude
                end
            end
            local ws = hum.WalkSpeed > 0 and hum.WalkSpeed or 16
            local ratio = math.clamp(horiz / ws, 0, 1.35)
            moveAmp = math.clamp(md.Magnitude, 0, 1) * ratio
        end
    end

    lastMoveAmp = lastMoveAmp
        + (moveAmp - lastMoveAmp) * math.clamp(dt * Settings.BOB_SMOOTH, 0, 1)
    bobPhase = bobPhase + dt * Settings.BOB_FREQUENCY * (0.35 + lastMoveAmp)
    idleTime = idleTime + dt

    local s1 = math.sin(bobPhase)
    local s2 = math.sin(bobPhase * 2)

    local bob = CFrame.new(
        s1 * Settings.BOB_SIDE * lastMoveAmp,
        math.abs(s2) * Settings.BOB_UP * lastMoveAmp,
        s2 * Settings.BOB_FORWARD * lastMoveAmp
    ) * CFrame.Angles(
        s1 * Settings.BOB_PITCH * lastMoveAmp,
        s1 * Settings.BOB_YAW * lastMoveAmp,
        s2 * Settings.BOB_ROLL * lastMoveAmp
    )

    -- ---------- Дыхание --------------------------------------------
    local idle = CFrame.new(
        math.sin(idleTime * 1.15) * Settings.IDLE_SWAY_POS,
        math.sin(idleTime * 1.73) * Settings.IDLE_SWAY_POS * 0.7,
        0
    ) * CFrame.Angles(
        math.sin(idleTime * 0.93) * Settings.IDLE_SWAY_ROT,
        math.sin(idleTime * 1.31) * Settings.IDLE_SWAY_ROT * 0.6,
        math.sin(idleTime * 0.71) * Settings.IDLE_SWAY_ROT * 0.8
    )

    -- ---------- Инерция от поворота мыши/головы --------------------
    -- Два источника: сырая дельта мыши И реальный поворот камеры.
    -- Второй нужен, чтобы свай работал на геймпаде, таче и без LockMouse.
    local mouseDelta = UserInputService:GetMouseDelta()

    local camYawImpulse, camPitchImpulse = 0, 0
    local curLook = cam.CFrame.LookVector
    if lastLookVector then
        local d = curLook - lastLookVector
        camYawImpulse   = math.clamp(-d.X * Settings.LOOK_CAMERA_GAIN,
            -Settings.LOOK_IMPULSE_CLAMP, Settings.LOOK_IMPULSE_CLAMP)
        camPitchImpulse = math.clamp( d.Y * Settings.LOOK_CAMERA_GAIN,
            -Settings.LOOK_IMPULSE_CLAMP, Settings.LOOK_IMPULSE_CLAMP)
    end
    lastLookVector = curLook

    local decay = 1 - math.clamp(dt * Settings.LOOK_RETURN, 0, 1)
    lookYaw   = (lookYaw   + camYawImpulse   - mouseDelta.X * Settings.LOOK_SWAY) * decay
    lookPitch = (lookPitch + camPitchImpulse + mouseDelta.Y * Settings.LOOK_SWAY) * decay
    lookYaw   = math.clamp(lookYaw,   -Settings.LOOK_MAX, Settings.LOOK_MAX)
    lookPitch = math.clamp(lookPitch, -Settings.LOOK_MAX, Settings.LOOK_MAX)
    local look = CFrame.Angles(lookPitch, lookYaw, 0)

    -- ---------- Дуга при перекидывании руки ------------------------
    local arc = math.sin(blend * math.pi)
    local swapArc = CFrame.new(0, arc * Settings.SWAP_ARC_LIFT, 0)
        * CFrame.Angles(0, arc * Settings.SWAP_ARC_YAW, 0)

    -- ---------- Отдача ---------------------------------------------
    recoil     = math.max(0, recoil - dt * Settings.RECOIL_RETURN)
    flashAlpha = math.max(0, flashAlpha - dt / math.max(Settings.MUZZLE_FLASH_TIME, 0.001))

    local recoilCF = CFrame.new(
        0,
        recoil * Settings.RECOIL_KICK_UP,
        recoil * Settings.RECOIL_KICK_BACK
    ) * CFrame.Angles(recoil * Settings.RECOIL_PITCH, 0, 0)

    -- ---------- Финальный CFrame -----------------------------------
    local baseOffset = Settings.LEFT_OFFSET:Lerp(Settings.RIGHT_OFFSET, blend)

    local baseCF = cam.CFrame
        * baseOffset
        * bob
        * idle
        * look
        * swapArc
        * recoilCF

    if builder then
        builder:Apply(baseCF, blend, flashAlpha)
    end
end

-- =====================================================================
-- ЗАПУСК
-- =====================================================================
camera = ensureCamera()
local parent = buildRenderRig()
builder = ViewmodelBuilder.new(parent)

buildSwapButton()

if player.Character then
    onCharacterAdded(player.Character)
end

RunService:BindToRenderStep(Settings.BIND_NAME, Settings.BIND_PRIORITY, onRender)

print("[FP Pistol] Готово. Первое лицо + пистолет слева. Ctrl -> направо. Режим: " .. Settings.RENDER_MODE)
