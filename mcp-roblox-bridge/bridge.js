// bridge.js - запускаешь У СЕБЯ на компе где открыт Roblox Studio
// Делает: каждые 2 сек тянет commands/queue.json с GitHub ветки arena/4127a506-repo
// и применяет команды как файлы для Rojo

const REPO_RAW = "https://raw.githubusercontent.com/zakriden-commits/-/arena/4127a506-repo";
const BRANCH = "arena/4127a506-repo";
const POLL_MS = 2000;

let lastHash = "";

async function fetchQueue() {
  const url = `${REPO_RAW}/${BRANCH}/commands/queue.json?t=${Date.now()}`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(res.status);
    const text = await res.text();
    if (text === lastHash) return;
    lastHash = text;
    const queue = JSON.parse(text);
    for (const cmd of queue) {
      if (cmd.done) continue;
      await handle(cmd);
    }
  } catch (e) {
    console.log("[bridge] poll error:", e.message);
  }
}

async function handle(cmd) {
  console.log(`[bridge] -> ${cmd.action}`, cmd);
  const fs = await import("fs/promises");
  const path = await import("path");

  if (cmd.action === "create_script") {
    const filePath = path.join("..", cmd.path);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, cmd.content, "utf8");
    console.log(`[bridge] записан файл ${cmd.path} -> Rojo подхватит автоматически`);
  }

  if (cmd.action === "create_part") {
    // Генерируем Lua скрипт который создаст Part при следующем синке
    const lua = `
local part = Instance.new("Part")
part.Name = "${cmd.name || "AI_Part"}"
part.Size = Vector3.new(${cmd.size?.join(",") || "4,1,2"})
part.Position = Vector3.new(${cmd.position?.join(",") || "0,5,0"})
part.BrickColor = BrickColor.new("${cmd.color || "Bright blue"}")
part.Anchored = true
part.Parent = workspace
`;
    const filePath = path.join("..", `src/Workspace/${cmd.name || "AI_Part"}.server.lua`);
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, lua, "utf8");
    console.log(`[bridge] создан Part через скрипт ${filePath}`);
  }

  if (cmd.action === "delete") {
    const fs2 = await import("fs/promises");
    try { await fs2.unlink(path.join("..", cmd.path)); console.log("[bridge] удален", cmd.path); } catch {}
  }
}

console.log(`[bridge] запущен. Слежу за ${REPO_RAW}/${BRANCH}/commands/queue.json`);
console.log(`[bridge] 1) Открой Roblox Studio с Rojo плагином`);
console.log(`[bridge] 2) В терминале в папке проекта запусти: rojo serve`);
console.log(`[bridge] 3) В другом терминале: npm start (в папке mcp-roblox-bridge)`);
setInterval(fetchQueue, POLL_MS);
fetchQueue();
