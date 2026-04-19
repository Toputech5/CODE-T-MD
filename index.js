const fs = require("fs");
const path = require("path");
const pino = require("pino");
const express = require("express");
const axios = require("axios");
const config = require("./config");

require("events").EventEmitter.defaultMaxListeners = 500;

const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

/**
 * =========================
 * SESSION LOADER
 * =========================
 */
function loadSession() {
  const sessionDir = path.join(__dirname, "sessions");
  const credsPath = path.join(sessionDir, "creds.json");

  if (!fs.existsSync(sessionDir)) fs.mkdirSync(sessionDir);
  if (fs.existsSync(credsPath)) return;

  if (!config.SESSION_ID) {
    console.log("❌ No SESSION_ID found");
    return;
  }

  try {
    const decoded = Buffer.from(config.SESSION_ID, "base64").toString("utf-8");
    fs.writeFileSync(credsPath, decoded);
    console.log("✅ Session loaded");
  } catch {
    console.log("❌ Invalid SESSION_ID");
  }
}

/**
 * =========================
 * PLUGIN LOADER
 * =========================
 */
function loadPlugins(sock) {
  const pluginMap = new Map();
  const pluginDir = path.join(__dirname, "plugins");

  if (!fs.existsSync(pluginDir)) fs.mkdirSync(pluginDir);

  const files = fs.readdirSync(pluginDir).filter(f => f.endsWith(".js"));

  for (let file of files) {
    try {
      delete require.cache[require.resolve(`./plugins/${file}`)];
      const plugin = require(`./plugins/${file}`);

      // ✅ COMMAND PLUGINS
      if (plugin.command && plugin.run) {
        pluginMap.set(plugin.command, plugin);
        console.log("🧩 Loaded:", plugin.command);
      }

      // 🔥 INIT SUPPORT (SMART STATUS WILL USE THIS)
      if (typeof plugin.init === "function") {
        plugin.init(sock);
        console.log("⚙️ Initialized:", file);
      }

    } catch (e) {
      console.log("❌ Plugin error:", file, e);
    }
  }

  return pluginMap;
}

/**
 * =========================
 * PRESENCE SYSTEM
 * =========================
 */
const presenceCooldown = new Map();

function presenceEffect(sock, jid) {
  try {
    if (!config.AUTO_PRESENCE) return;

    const now = Date.now();
    const last = presenceCooldown.get(jid) || 0;

    if (now - last < (config.PRESENCE_COOLDOWN || 4000)) return;
    presenceCooldown.set(jid, now);

    setTimeout(() => {
      if (config.PRESENCE_TYPE === "typing") {
        sock.sendPresenceUpdate("composing", jid).catch(() => {});
      } else if (config.PRESENCE_TYPE === "recording") {
        sock.sendPresenceUpdate("recording", jid).catch(() => {});
      } else {
        sock.sendPresenceUpdate("available", jid).catch(() => {});
      }
    }, 100);

  } catch {}
}

/**
 * =========================
 * START BOT
 * =========================
 */
let isStarting = false;

async function startBot() {
  if (isStarting) return;
  isStarting = true;

  loadSession();

  const { state, saveCreds } = await useMultiFileAuthState("./sessions");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: config.LOG_LEVEL || "silent" }),
    version,
    browser: ["CODE-T MD", "Chrome", "1.0.0"],
    syncFullHistory: true, // 🔥 improves status receiving
    markOnlineOnConnect: true
  });

  console.log("⚡ CODE-T MD starting...");

  // 🔥 LOAD PLUGINS WITH INIT
  const plugins = loadPlugins(sock);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log("✅ CONNECTED");

      if (config.AUTO_PRESENCE) {
        sock.sendPresenceUpdate("available").catch(() => {});
      }
    }

    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;

      console.log("❌ Disconnected:", reason);

      isStarting = false;

      if (reason !== DisconnectReason.loggedOut && config.AUTO_RECONNECT) {
        setTimeout(startBot, 5000);
      } else {
        console.log("❌ Session expired");
      }
    }
  });

  /**
   * =========================
   * MESSAGE HANDLER
   * =========================
   */
  sock.ev.on("messages.upsert", async ({ messages }) => {

    await Promise.all(messages.map(async (msg) => {
      try {
        if (!msg.message) return;
        if (msg.key.fromMe) return;

        const jid = msg.key.remoteJid;

        // ❌ IMPORTANT: DO NOT HANDLE STATUS HERE
        // Smart system plugin handles it

        const body =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          "";

        // ⚡ presence
        presenceEffect(sock, jid);

        // 📩 auto read
        if (config.AUTO_READ_MESSAGES) {
          sock.readMessages([msg.key]).catch(() => {});
        }

        if (!body.startsWith(config.PREFIX)) return;

        const args = body.slice(config.PREFIX.length).trim().split(" ");
        const command = args.shift().toLowerCase();

        const plugin = plugins.get(command);

        if (plugin) {
          plugin.run(sock, msg, {
            from: jid,
            args,
            command,
            body
          }).catch(console.error);
        }

      } catch (err) {
        console.log("💥 Error:", err);
      }
    }));

  });
}

/**
 * =========================
 * GLOBAL ERROR PROTECTION
 * =========================
 */
process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

/**
 * START
 */
startBot();

/**
 * =========================
 * EXPRESS SERVER
 * =========================
 */
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("CODE-T MD running 🚀");
});

app.listen(PORT, () => {
  console.log("🌐 Server running on port", PORT);
});

/**
 * =========================
 * SELF PING
 * =========================
 */
setInterval(async () => {
  try {
    await axios.get(`http://localhost:${PORT}`);
    console.log("🔄 Self ping");
  } catch {}
}, 1000 * 60 * 5);
