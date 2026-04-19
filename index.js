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

  if (!config.SESSION_ID) return;

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
 * AMD-STYLE PLUGIN LOADER
 * =========================
 */
function loadModules(sock) {
  const modules = new Map();
  const dir = path.join(__dirname, "plugins");

  if (!fs.existsSync(dir)) fs.mkdirSync(dir);

  const files = fs.readdirSync(dir).filter(f => f.endsWith(".js"));

  for (let file of files) {
    try {
      delete require.cache[require.resolve(`./plugins/${file}`)];
      const mod = require(`./plugins/${file}`);

      // command modules
      if (mod.command && mod.run) {
        modules.set(mod.command, mod);
        console.log("🧩 Loaded module:", mod.command);
      }

      // init modules (status.js, AI engines, etc)
      if (typeof mod.init === "function") {
        mod.init(sock);
        console.log("⚙️ Init module:", file);
      }

    } catch (e) {
      console.log("❌ Module error:", file, e.message);
    }
  }

  return modules;
}

/**
 * =========================
 * CORE MIDDLEWARE (AMD ENGINE)
 * =========================
 */
async function amd(sock, msg, context) {
  try {
    // safe hook point for future AI / filters
    // (status logic MUST live in plugins, not here)

    return true;

  } catch (e) {
    console.log("AMD error:", e);
  }
}

/**
 * =========================
 * START BOT
 * =========================
 */
let starting = false;

async function startBot() {
  if (starting) return;
  starting = true;

  loadSession();

  const { state, saveCreds } = await useMultiFileAuthState("./sessions");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: config.LOG_LEVEL || "silent" }),
    version,
    browser: ["AMD-CORE", "Chrome", "1.0.0"],
    syncFullHistory: true
  });

  console.log("⚡ AMD CORE STARTING...");

  const modules = loadModules(sock);

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log("✅ CONNECTED (AMD CORE)");
    }

    if (connection === "close") {
      starting = false;

      const reason = lastDisconnect?.error?.output?.statusCode;

      console.log("❌ Disconnected:", reason);

      if (reason !== DisconnectReason.loggedOut) {
        setTimeout(startBot, 5000);
      } else {
        console.log("❌ Logged out");
      }
    }
  });

  /**
   * =========================
   * MESSAGE PIPELINE (AMD FLOW)
   * =========================
   */
  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (let msg of messages) {
      try {
        if (!msg.message) continue;
        if (msg.key.fromMe) continue;

        const jid = msg.key.remoteJid;

        const body =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          "";

        /**
         * 🧠 STEP 1: AMD CORE HOOK
         */
        await amd(sock, msg, { config, jid });

        /**
         * 🧩 STEP 2: AUTO READ (CHAT ONLY)
         */
        if (config.AUTO_READ_MESSAGES) {
          sock.readMessages([msg.key]).catch(() => {});
        }

        /**
         * ⚡ STEP 3: COMMAND SYSTEM
         */
        if (!body.startsWith(config.PREFIX)) continue;

        const args = body.slice(config.PREFIX.length).trim().split(" ");
        const command = args.shift().toLowerCase();

        const mod = modules.get(command);

        if (mod) {
          await mod.run(sock, msg, {
            from: jid,
            args,
            command,
            body
          });
        }

      } catch (err) {
        console.log("💥 MSG ERROR:", err);
      }
    }
  });
}

/**
 * =========================
 * START
 * =========================
 */
startBot();

/**
 * =========================
 * ERROR HANDLING
 * =========================
 */
process.on("uncaughtException", console.error);
process.on("unhandledRejection", console.error);

/**
 * =========================
 * EXPRESS SERVER
 * =========================
 */
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("CODE-T BOT RUNNING 🚀");
});

app.listen(PORT, () => {
  console.log("🌐 Server:", PORT);
});

/**
 * =========================
 * KEEP ALIVE
 * =========================
 */
setInterval(async () => {
  try {
    await axios.get(`http://localhost:${PORT}`);
  } catch {}
}, 1000 * 60 * 5);
