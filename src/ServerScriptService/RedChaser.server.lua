-- RedChaser.server.lua - красный куб который гонится за ближайшим игроком
-- Кидай в ServerScriptService и запусти Play

local RunService = game:GetService("RunService")
local Players = game:GetService("Players")

-- создаем куб
local cube = Instance.new("Part")
cube.Name = "RedChaser"
cube.Size = Vector3.new(4, 4, 4)
cube.Color = Color3.fromRGB(255, 0, 0)
cube.Material = Enum.Material.SmoothPlastic
cube.Anchored = true
cube.CanCollide = false -- чтобы не застревал, поставь true если хочешь толкаться
cube.Position = Vector3.new(0, 5, 0)
cube.Parent = workspace

-- чтобы видно было что это враг - добавим огонь/подсветку
local light = Instance.new("PointLight", cube)
light.Color = Color3.fromRGB(255,0,0)
light.Range = 10
light.Brightness = 2

local SPEED = 12 -- скорость, поменяй если слишком быстро/медленно

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
        -- не двигаемся по Y слишком сильно, чтобы не улетал в небо
        -- dir = Vector3.new(dir.X, 0, dir.Z) -- раскомментируй если хочешь только по земле
        
        if dir.Magnitude > 2 then
            dir = dir.Unit
            cube.Position += dir * SPEED * dt
            -- смотрит на игрока
            cube.CFrame = CFrame.new(cube.Position, target.Position)
        end
    end
end)

print("[RedChaser] Красный куб заспанился и гонится!")
