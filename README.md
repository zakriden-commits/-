# Arena → Roblox Studio мост

Ты даешь команду в чате Arena, AI пушит в `commands/queue.json`, а твой локальный мост применяет это в Studio.

## Как запустить (1 раз, 5 минут):

### 1. Установи Rojo
В Roblox Studio: Plugins -> Manage Plugins -> найди Rojo
На компе: `cargo install rojo` или скачай с https://rojo.space/docs/installation/

### 2. Клонируй репо
```bash
git clone https://github.com/zakriden-commits/-.git
cd -
git checkout arena/4127a506-repo
```

### 3. Запусти 2 терминала
Терминал 1 (синк в Studio):
```bash
rojo serve
```
Нажми Connect в плагине Rojo в Studio.

Терминал 2 (мост AI):
```bash
cd mcp-roblox-bridge
npm install
npm start
```

### 4. Дай команду в чате Arena
Примеры:
- "создай скрипт который делает радужный спавн"
- "создай красную платформу 20x1x20"
- "сделай лифт который едет вверх когда наступаешь"

AI запишет команду в `commands/queue.json` и запушит - у тебя в Studio файл появится за ~2 секунды.

### 2 режима:
1. **Edit-time (Rojo)**: AI создает .lua файлы в `src/` -> появляются в Explorer
2. **Runtime (в игре)**: скрипт `AIAgentBridge.server.lua` в игре сам тянет команды через HttpService и спавнит Part'ы без перезапуска

Включи `Game Settings -> Security -> Allow HTTP Requests` для 2 режима.

---
Ветка: `arena/4127a506-repo`
