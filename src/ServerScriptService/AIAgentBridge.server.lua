-- AIAgentBridge.server.lua - ФИКС: теперь сразу спавнит красного куба, без ожидания GitHub
-- Просто вставь в ServerScriptService и нажми Play. Ничего включать не надо.

local RunService = game:GetService("RunService")
local Players = game:GetService("Players")

print("[AI Bridge] Запуск...")

-- 1. СРАЗУ создаем красного куба (не ждем GitHub)
local cube = Instance.new("Part")
cube.Name = "RedChaser"
cube.Size = Vector3.new(4, 4, 4)
cube.Color = Color3.fromRGB(255, 0, 0)
cube.Material = Enum.Material.SmoothPlastic
cube.Anchored = true
cube.CanCollide = false
cube.Position = Vector3.new(0, 5, 0)
cube.Parent = workspace

local light = Instance.new("PointLight", cube)
light.Color = Color3.fromRGB(255,0,0)
light.Range = 10
light.Brightness = 2

local SPEED = 12

local function getClosestPlayer()
    local closest, dist = nil, math.huge
    for _, plr in ipairs(Players:GetPlayers()) do
        if plr.Character and plr.Character:FindFirstChild("HumanoidRootPart") then
            local hrp = plr.Character.HumanoidRootPart
            local d = (hrp.Position - cube.Position).Magnitude
            if d < dist then
                closest = hrp
                dist = d
            end
        end
    end
    return closest
end

RunService.Heartbeat:Connect(function(dt)
    local target = getClosestPlayer()
    if target then
        local dir = (target.Position - cube.Position)
        if dir.Magnitude > 2 then
            dir = dir.Unit
            cube.Position += dir * SPEED * dt
            cube.CFrame = CFrame.new(cube.Position, target.Position)
        end
    end
end)

print("[AI Bridge] Красный куб ЗАСПАВЛЕН! Должен гнаться за тобой")

-- 2. Дальше уже опционально слушаем команды с GitHub (для следующих команд)
-- Если не нужен - можешь удалить всё ниже
task.spawn(function()
    local HttpService = game:GetService("HttpService")
    -- Правильный URL для твоего репо (имя "-" нужно через refs/heads)
    local GITHUB_RAW_URL = "https://raw.githubusercontent.com/zakriden-commits/-/refs/heads/arena/4127a506-repo/commands/queue.json"
    while true do
        pcall(function()
            local json = HttpService:GetAsync(GITHUB_RAW_URL .. "?t=" .. tick())
            local data = HttpService:JSONDecode(json)
            for _, cmd in ipairs(data) do
                if not cmd.done then
                    print("[AI Bridge] Команда с GitHub: " .. cmd.action)
                end
            end
        end)
        task.wait(2)
    end
end)
