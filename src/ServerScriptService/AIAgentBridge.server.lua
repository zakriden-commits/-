-- AIAgentBridge.server.lua - 2 красных куба гонятся за тобой
-- Вставь в ServerScriptService и Play

local RunService = game:GetService("RunService")
local Players = game:GetService("Players")

print("[AI Bridge] Запуск 2 кубов...")

local cubes = {}
local SPEED = 12

local function createCube(pos, name)
    local cube = Instance.new("Part")
    cube.Name = name
    cube.Size = Vector3.new(4, 4, 4)
    cube.Color = Color3.fromRGB(255, 0, 0)
    cube.Material = Enum.Material.SmoothPlastic
    cube.Anchored = true
    cube.CanCollide = false
    cube.Position = pos
    cube.Parent = workspace

    local light = Instance.new("PointLight", cube)
    light.Color = Color3.fromRGB(255,0,0)
    light.Range = 10
    light.Brightness = 2
    
    table.insert(cubes, cube)
    return cube
end

-- 2 куба с разных сторон
createCube(Vector3.new(0, 5, 20), "RedChaser1")
createCube(Vector3.new(0, 5, -20), "RedChaser2")

local function getClosestPlayer(fromPos)
    local closest, dist = nil, math.huge
    for _, plr in ipairs(Players:GetPlayers()) do
        if plr.Character and plr.Character:FindFirstChild("HumanoidRootPart") then
            local hrp = plr.Character.HumanoidRootPart
            local d = (hrp.Position - fromPos).Magnitude
            if d < dist then
                closest = hrp
                dist = d
            end
        end
    end
    return closest
end

RunService.Heartbeat:Connect(function(dt)
    for _, cube in ipairs(cubes) do
        local target = getClosestPlayer(cube.Position)
        if target then
            local dir = (target.Position - cube.Position)
            if dir.Magnitude > 3 then
                dir = dir.Unit
                cube.Position += dir * SPEED * dt
                cube.CFrame = CFrame.new(cube.Position, target.Position)
            end
        end
    end
end)

print("[AI Bridge] 2 куба ЗАСПАВЛЕНЫ! Бегут за тобой")
