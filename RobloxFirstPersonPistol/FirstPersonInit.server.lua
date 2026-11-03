--[[
    FirstPersonInit.server.lua
    Script -> ServerScriptService

    ЗАЧЕМ: клиент уже ставит зум 0/0, но сервер ДОЛЖЕН заранее выставить
    StarterPlayer.CameraMode = LockFirstPerson. Иначе в Play Solo / при первом
    тике PlayerModule успевает один кадр показать третье лицо и дёрнуть камеру.

    Что делает:
      * LockFirstPerson для всех, кто зайдёт ПОСЛЕ старта сервера;
      * отключает Shift-Lock (иначе камера уезжает в плечо);
      * на всякий случай дублирует Min/MaxZoomDistance на каждого Player
        и на каждый респавн (PlayerModule иногда перечитывает значения);
      * всё через pcall -> не упадёт, если Roblox переименует свойство.

    НЕ трогает: CharacterAutoLoads, Humanoid, анимации, Tools, DataStores.
    Актуально: ноябрь 2026 / Roblox Studio / Luau.
--]]

local Players       = game:GetService("Players")
local StarterPlayer = game:GetService("StarterPlayer")

local function forceStarterPlayer()
    pcall(function()
        StarterPlayer.CameraMode = Enum.CameraMode.LockFirstPerson
    end)
    pcall(function()
        StarterPlayer.EnableMouseLockOption = false
    end)
    -- На некоторых каналах эти два свойства живут и на StarterPlayer,
    -- на некоторых только на Player -> потому pcall, а не прямой вызов.
    pcall(function()
        StarterPlayer.CameraMinZoomDistance = 0
    end)
    pcall(function()
        StarterPlayer.CameraMaxZoomDistance = 0
    end)
end

local function forcePlayerZoom(player)
    pcall(function()
        player.CameraMinZoomDistance = 0
        player.CameraMaxZoomDistance = 0
    end)
end

local function onPlayerAdded(player)
    forcePlayerZoom(player)
    player.CharacterAdded:Connect(function()
        forcePlayerZoom(player)
    end)
end

forceStarterPlayer()
Players.PlayerAdded:Connect(onPlayerAdded)

-- Уже онлайн (важно для Studio «Play» с заранее созданным игроком)
for _, p in ipairs(Players:GetPlayers()) do
    onPlayerAdded(p)
end

print("[FP Pistol][Server] LockFirstPerson включён, Shift-Lock выключен.")
