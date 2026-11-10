-- AIAgentBridge.server.lua
-- Этот скрипт живет в твоей игре. Каждые 2 секунды он проверяет GitHub
-- на новые команды от AI и выполняет их прямо в игре (рантайм режим)
-- Включи HttpService в Game Settings -> Security -> Allow HTTP Requests

local HttpService = game:GetService("HttpService")

-- ПОМЕНЯЙ НА СВОЙ РЕПОЗИТОРИЙ:
local GITHUB_RAW_URL = "https://raw.githubusercontent.com/zakriden-commits/-/arena/4127a506-repo/commands/queue.json"
-- Если сделаешь репо приватным - используй Open Cloud или свой сервер

local function processCommand(cmd)
    print("[AI Bridge] Команда: " .. cmd.action)
    
    if cmd.action == "create_part" then
        local part = Instance.new("Part")
        part.Size = Vector3.new(cmd.size and cmd.size[1] or 4, cmd.size and cmd.size[2] or 1, cmd.size and cmd.size[3] or 2)
        part.Position = Vector3.new(cmd.position and cmd.position[1] or 0, cmd.position and cmd.position[2] or 5, cmd.position and cmd.position[3] or 0)
        part.Anchored = true
        part.BrickColor = BrickColor.new(cmd.color or "Bright blue")
        part.Material = Enum.Material[cmd.material or "SmoothPlastic"]
        part.Name = cmd.name or "AI_Part"
        part.Parent = workspace
        print("[AI Bridge] Создал Part: " .. part.Name)
        
    elseif cmd.action == "print" then
        print("[AI] " .. (cmd.message or "hello"))
        
    elseif cmd.action == "chat" then
        game:GetService("ReplicatedStorage"):SetAttribute("AI_LastMessage", cmd.message)
    end
end

-- Простой поллинг
while true do
    pcall(function()
        local json = HttpService:GetAsync(GITHUB_RAW_URL .. "?t=" .. tick())
        local data = HttpService:JSONDecode(json)
        for _, cmd in ipairs(data) do
            if not cmd.done then
                processCommand(cmd)
                -- Чтобы не выполнять повторно, в реальном проекте помечай done через API
                -- Тут просто выполняем 1 раз за сессию
            end
        end
    end)
    task.wait(2)
end
