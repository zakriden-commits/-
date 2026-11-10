-- AIAgentBridge.server.lua - ПОСЛЕДНИЙ РАЗ ВСТАВЛЯЕШЬ, ДАЛЬШЕ Я САМ
-- 1 раз вставь в ServerScriptService -> дальше просто пишешь мне в чат и я сам спавню/удаляю/меняю кубы
-- Включи Game Settings -> Security -> Allow HTTP Requests

local HttpService = game:GetService("HttpService")
local RunService = game:GetService("RunService")
local Players = game:GetService("Players")

local GITHUB_RAW_URL = "https://raw.githubusercontent.com/zakriden-commits/-/refs/heads/arena/4127a506-repo/commands/queue.json"

local cubes = {}
local SPEED = 12
local executedIds = {}

local function clearCubes()
    for _, c in ipairs(cubes) do c:Destroy() end
    cubes = {}
end

local function createCube(pos, name)
    local cube = Instance.new("Part")
    cube.Name = name
    cube.Size = Vector3.new(4,4,4)
    cube.Color = Color3.fromRGB(255,0,0)
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
end

local function spawnChasers(count)
    clearCubes()
    for i=1, count do
        local angle = (360/count * i)
        local rad = math.rad(angle)
        local pos = Vector3.new(math.cos(rad)*20, 5, math.sin(rad)*20)
        createCube(pos, "RedChaser"..i)
    end
    print("[AI] Заспавнил "..count.." кубов")
end

local function getClosest(fromPos)
    local closest, dist = nil, math.huge
    for _, plr in ipairs(Players:GetPlayers()) do
        if plr.Character and plr.Character:FindFirstChild("HumanoidRootPart") then
            local hrp = plr.Character.HumanoidRootPart
            local d = (hrp.Position - fromPos).Magnitude
            if d < dist then closest=hrp; dist=d end
        end
    end
    return closest
end

RunService.Heartbeat:Connect(function(dt)
    for _, cube in ipairs(cubes) do
        local target = getClosest(cube.Position)
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

-- старт: 1 куб чтобы видно что работает
spawnChasers(1)
print("[AI Bridge] Готов. Пиши команды в чат Arena - я сам применю")

-- слушаем команды с GitHub
task.spawn(function()
    while true do
        pcall(function()
            local json = HttpService:GetAsync(GITHUB_RAW_URL.."?t="..tick())
            local data = HttpService:JSONDecode(json)
            for _, cmd in ipairs(data) do
                if not executedIds[cmd.id] and not cmd.done then
                    executedIds[cmd.id] = true
                    print("[AI] Команда: "..cmd.action)
                    if cmd.action == "spawn_chasers" then
                        spawnChasers(cmd.count or 2)
                    elseif cmd.action == "clear" then
                        clearCubes()
                    elseif cmd.action == "set_speed" then
                        SPEED = cmd.speed
                    end
                end
            end
        end)
        task.wait(1.5)
    end
end)
