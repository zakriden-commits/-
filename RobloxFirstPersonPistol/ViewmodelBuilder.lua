--[[
    ViewmodelBuilder.lua
    ModuleScript -> StarterPlayer > StarterPlayerScripts

    ПРОЦЕДУРНЫЙ ПИСТОЛЕТ + КИСТЬ + ПРЕДПЛЕЧЬЕ.
    Никаких Weld / WeldConstraint / Motor6D / Humanoid / Animator.

    Почему так (best practice 2026):
      * все детали Anchored = true, CanCollide = false, CastShadow = false;
      * каждый кадр мы ОДНИМ baseCFrame пересчитываем CFrame каждой детали;
      * нет физики -> нет лага на 1 кадр, нет дёрганья при 240 FPS,
        нет «welds ломаются на респавне»;
      * зеркало для правой руки считается аналитически (отражение по X),
        поэтому переезд Ctrl получается плавным морфингом, а не подменой модели.

    Все локальные координаты заданы ОТНОСИТЕЛЬНО центра рукояти (root).
    Ствол смотрит в -Z (вперёд от камеры).
--]]

local Settings = require(script.Parent:WaitForChild("FPSettings"))

local Builder = {}
Builder.__index = Builder

local function V(x, y, z)
    return Vector3.new(x, y, z)
end

local function R(x, y, z)
    return Vector3.new(math.rad(x), math.rad(y), math.rad(z))
end

local function mirrorVec(v)
    return V(-v.X, v.Y, v.Z)
end

local function mirrorRot(r)
    -- Отражение по плоскости YZ: X-поворот сохраняем, Y и Z инвертируем.
    return V(r.X, -r.Y, -r.Z)
end

local function cfFromRot(pos, rot, cylinderAlign)
    local cf = CFrame.new(pos) * CFrame.Angles(rot.X, rot.Y, rot.Z)
    if cylinderAlign then
        -- Цилиндр в Roblox по умолчанию вытянут по Y -> доворачиваем в Z.
        cf = cf * CFrame.Angles(math.rad(90), 0, 0)
    end
    return cf
end

-- ---------------------------------------------------------------------
-- Создаёт одну деталь и запоминает её ЛЕВЫЙ и ПРАВЫЙ локальные CFrame.
-- ---------------------------------------------------------------------
function Builder:_add(s)
    local part = Instance.new("Part")
    part.Name            = s.Name
    part.Size            = s.Size
    part.Shape           = s.Shape or Enum.PartType.Block
    part.Material        = s.Material or Enum.Material.SmoothPlastic
    part.Color           = s.Color
    part.Transparency    = s.Transparency or 0
    part.Anchored        = true
    part.CanCollide      = false
    part.CastShadow      = false
    part.Massless        = true
    part.Parent          = self.Model

    local leftCF, rightCF

    if s.LookAt then
        -- Для предплечья удобнее CFrame.lookAt: ось -Z смотрит на кисть.
        leftCF = CFrame.lookAt(s.Pos, s.LookAt)
        rightCF = s.Mirror
            and CFrame.lookAt(mirrorVec(s.Pos), mirrorVec(s.LookAt))
            or leftCF
    else
        leftCF = cfFromRot(s.Pos, s.Rot, s.CylinderAlign)
        rightCF = s.Mirror
            and cfFromRot(mirrorVec(s.Pos), mirrorRot(s.Rot), s.CylinderAlign)
            or leftCF
    end

    local rec = {
        Part             = part,
        LeftCF           = leftCF,
        RightCF          = rightCF,
        BaseTransparency = part.Transparency,
        IsFlash          = (s.IsFlash == true),
        IsSkin           = (s.IsSkin == true),
    }

    table.insert(self.Records, rec)

    if rec.IsSkin then
        table.insert(self.SkinParts, part)
    end

    if rec.IsFlash then
        self.FlashPart = part
        local light = Instance.new("PointLight")
        light.Name      = "MuzzleLight"
        light.Color     = Settings.COLOR_FLASH
        light.Brightness = 4
        light.Range      = 3.5
        light.Enabled    = false
        light.Parent     = part
        rec.Light        = light
        self.FlashLight  = light
    end

    return rec
end

-- ---------------------------------------------------------------------
-- Сборка модели
-- ---------------------------------------------------------------------
function Builder:_build()
    -- ==== ЗАТВОР / РАМА / СТВОЛ ======================================
    self:_add {
        Name = "Frame", Size = V(0.150, 0.170, 0.580),
        Pos = V(0, 0.050, -0.200), Rot = R(0, 0, 0),
        Color = Settings.COLOR_FRAME, Material = Enum.Material.Metal,
    }
    self:_add {
        Name = "Slide", Size = V(0.158, 0.078, 0.600),
        Pos = V(0, 0.145, -0.205), Rot = R(0, 0, 0),
        Color = Settings.COLOR_SLIDE, Material = Enum.Material.Metal,
    }
    self:_add {
        Name = "SlideTopStripe", Size = V(0.022, 0.010, 0.500),
        Pos = V(0, 0.188, -0.205), Rot = R(0, 0, 0),
        Color = Settings.COLOR_ACCENT, Material = Enum.Material.Neon,
    }
    self:_add {
        Name = "EjectionPort", Size = V(0.012, 0.038, 0.140),
        Pos = V(0.084, 0.145, -0.160), Rot = R(0, 0, 0),
        Color = Settings.COLOR_FRAME, Material = Enum.Material.Metal,
    }

    -- Насечки на затворе (с двух сторон)
    for i = 0, 4 do
        local z = -0.400 + i * 0.045
        self:_add {
            Name = "SerrationL_" .. i, Size = V(0.012, 0.050, 0.012),
            Pos = V(0.084, 0.145, z), Rot = R(0, 0, 0),
            Color = Settings.COLOR_METAL, Material = Enum.Material.Metal,
        }
        self:_add {
            Name = "SerrationR_" .. i, Size = V(0.012, 0.050, 0.012),
            Pos = V(-0.084, 0.145, z), Rot = R(0, 0, 0),
            Color = Settings.COLOR_METAL, Material = Enum.Material.Metal,
        }
    end

    self:_add {
        Name = "Barrel", Size = V(0.075, 0.200, 0.075),
        Pos = V(0, 0.075, -0.550), Rot = R(0, 0, 0),
        Shape = Enum.PartType.Cylinder, CylinderAlign = true,
        Color = Settings.COLOR_METAL, Material = Enum.Material.Metal,
    }
    self:_add {
        Name = "MuzzleRing", Size = V(0.092, 0.035, 0.092),
        Pos = V(0, 0.075, -0.655), Rot = R(0, 0, 0),
        Shape = Enum.PartType.Cylinder, CylinderAlign = true,
        Color = Settings.COLOR_FRAME, Material = Enum.Material.Metal,
    }
    self:_add {
        Name = "FrontSight", Size = V(0.026, 0.050, 0.030),
        Pos = V(0, 0.215, -0.470), Rot = R(0, 0, 0),
        Color = Settings.COLOR_FRAME, Material = Enum.Material.Metal,
    }
    self:_add {
        Name = "RearSight", Size = V(0.100, 0.045, 0.032),
        Pos = V(0, 0.215, -0.015), Rot = R(0, 0, 0),
        Color = Settings.COLOR_FRAME, Material = Enum.Material.Metal,
    }
    self:_add {
        Name = "Hammer", Size = V(0.075, 0.050, 0.050),
        Pos = V(0, 0.205, 0.065), Rot = R(0, 0, 0),
        Color = Settings.COLOR_METAL, Material = Enum.Material.Metal,
    }

    -- ==== РУКОЯТЬ / МАГАЗИН / СПУСК ==================================
    self:_add {
        Name = "Grip", Size = V(0.135, 0.300, 0.170),
        Pos = V(0, -0.150, 0.050), Rot = R(-12, 0, 0),
        Color = Settings.COLOR_GRIP, Material = Enum.Material.SmoothPlastic,
    }
    self:_add {
        Name = "GripPanelL", Size = V(0.010, 0.240, 0.130),
        Pos = V(0.072, -0.150, 0.050), Rot = R(-12, 0, 0),
        Color = Settings.COLOR_ACCENT, Material = Enum.Material.SmoothPlastic,
    }
    self:_add {
        Name = "GripPanelR", Size = V(0.010, 0.240, 0.130),
        Pos = V(-0.072, -0.150, 0.050), Rot = R(-12, 0, 0),
        Color = Settings.COLOR_ACCENT, Material = Enum.Material.SmoothPlastic,
    }
    self:_add {
        Name = "Magazine", Size = V(0.120, 0.090, 0.160),
        Pos = V(0, -0.315, 0.065), Rot = R(-12, 0, 0),
        Color = Settings.COLOR_FRAME, Material = Enum.Material.Metal,
    }
    self:_add {
        Name = "TriggerGuard", Size = V(0.100, 0.022, 0.170),
        Pos = V(0, -0.075, -0.065), Rot = R(0, 0, 0),
        Color = Settings.COLOR_FRAME, Material = Enum.Material.Metal,
    }
    self:_add {
        Name = "TriggerGuardFront", Size = V(0.100, 0.075, 0.022),
        Pos = V(0, -0.040, -0.145), Rot = R(0, 0, 0),
        Color = Settings.COLOR_FRAME, Material = Enum.Material.Metal,
    }
    self:_add {
        Name = "Trigger", Size = V(0.020, 0.065, 0.024),
        Pos = V(0, -0.035, -0.060), Rot = R(18, 0, 0),
        Color = Settings.COLOR_METAL, Material = Enum.Material.Metal,
    }

    -- ==== РУКА (ЛЕВАЯ, Mirror = true -> правая считается сама) =======
    local ELBOW_L = V(-0.280, -0.460, 0.520)
    local HAND_L  = V(-0.020, -0.110, 0.020)

    self:_add {
        Name = "Forearm", Size = V(0.155, 0.155, 0.660),
        Pos = ELBOW_L:Lerp(HAND_L, 0.5), LookAt = HAND_L, Mirror = true,
        Color = Settings.COLOR_SKIN_FALLBACK,
        Material = Enum.Material.SmoothPlastic, IsSkin = true,
    }
    self:_add {
        Name = "Sleeve", Size = V(0.190, 0.190, 0.220),
        Pos = ELBOW_L:Lerp(HAND_L, 0.14), LookAt = HAND_L, Mirror = true,
        Color = Settings.COLOR_SLEEVE, Material = Enum.Material.Fabric,
    }
    self:_add {
        Name = "Wrist", Size = V(0.150, 0.150, 0.120),
        Pos = HAND_L:Lerp(ELBOW_L, 0.12), LookAt = HAND_L, Mirror = true,
        Color = Settings.COLOR_SKIN_FALLBACK, IsSkin = true,
    }
    self:_add {
        Name = "Palm", Size = V(0.175, 0.200, 0.200),
        Pos = V(-0.015, -0.100, 0.015), Rot = R(-8, 6, -10), Mirror = true,
        Color = Settings.COLOR_SKIN_FALLBACK, IsSkin = true,
    }
    self:_add {
        Name = "Thumb", Size = V(0.070, 0.100, 0.090),
        Pos = V(-0.095, -0.075, 0.020), Rot = R(0, 0, -25), Mirror = true,
        Color = Settings.COLOR_SKIN_FALLBACK, IsSkin = true,
    }
    for i = 1, 4 do
        self:_add {
            Name = "Finger_" .. i, Size = V(0.150, 0.032, 0.075),
            Pos = V(-0.005, -0.005 - (i - 1) * 0.045, -0.055),
            Rot = R(0, 6, -6), Mirror = true,
            Color = Settings.COLOR_SKIN_FALLBACK, IsSkin = true,
        }
    end

    -- ==== ДУЛЬНАЯ ВСПЫШКА (бонус на ЛКМ) =============================
    self:_add {
        Name = "MuzzleFlash", Size = V(0.170, 0.170, 0.170),
        Pos = V(0, 0.075, -0.720), Rot = R(0, 0, 0),
        Shape = Enum.PartType.Ball, Material = Enum.Material.Neon,
        Color = Settings.COLOR_FLASH, Transparency = 1, IsFlash = true,
    }
end

-- ---------------------------------------------------------------------
-- ПУБЛИЧНОЕ API
-- ---------------------------------------------------------------------
function Builder.new(parent)
    local self = setmetatable({}, Builder)

    self._parent   = parent
    self.Visible   = true
    self.Records   = {}
    self.SkinParts = {}
    self.FlashPart = nil
    self.FlashLight = nil

    self.Model = Instance.new("Model")
    self.Model.Name   = Settings.VIEWMODEL_NAME
    self.Model.Parent = parent

    self:_build()
    return self
end

-- baseCF  : CFrame камеры * смещение * все анимации
-- blend   : 0 = левая рука, 1 = правая рука (плавно от TweenService)
-- flash   : 0..1, прозрачность вспышки
function Builder:Apply(baseCF, blend, flash)
    if not self.Visible then
        return
    end

    for _, r in ipairs(self.Records) do
        local localCF = r.LeftCF:Lerp(r.RightCF, blend)
        r.Part.CFrame = baseCF * localCF

        if r.IsFlash then
            r.Part.Transparency = 1 - flash
            if r.Light then
                r.Light.Enabled = flash > 0.02
            end
        end
    end
end

function Builder:SetSkin(color)
    for _, p in ipairs(self.SkinParts) do
        p.Color = color
    end
end

function Builder:SetParent(parent)
    self._parent = parent
    self.Model.Parent = self.Visible and parent or nil
end

function Builder:SetVisible(visible)
    self.Visible = visible
    self.Model.Parent = visible and self._parent or nil
end

function Builder:Destroy()
    self.Model:Destroy()
    table.clear(self.Records)
    table.clear(self.SkinParts)
end

return Builder
