const fs = require("fs");
const path = require("path");
const express = require("express");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

const config = require("./config");
const Logger = require("./lib/logger");
const AMD = require("./lib/amd");

/* =========================
   🧯 GLOBAL SAFETY NET
========================= */
process.on("uncaughtException", (err) => {
  console.log("❌ Uncaught:", err.message);
});

process.on("unhandledRejection", (err) => {
  console.log("❌ Rejection:", err?.message || err);
});

/* =========================
   🌐 KEEP ALIVE SERVER
========================= */
const app = express();

app.get("/", (req, res) => {
  res.send(`${config.BOT_NAME} is alive 🚀`);
});

const PORT = process.env.PORT || 8000;
app.listen(PORT, "0.0.0.0", () => {
  Logger.info(`Server running on ${PORT}`);
});

/* =========================
   📁 SAFE STORAGE
========================= */
const SESSION_PATH = "./sessions";

if (!fs.existsSync(SESSION_PATH)) {
  fs.mkdirSync(SESSION_PATH, { recursive: true });
}

/* =========================
   🔐 SAFE SESSION LOADER
   (NEVER CRASHES BOT)
========================= */
function loadSession() {
  try {
    if (!config.SESSION_ID) {
      console.log("⚠️ No SESSION_ID, QR mode enabled");
      return;
    }

    let decoded;
    try {
      decoded = Buffer.from(config.SESSION_ID, "base64").toString("utf-8");
    } catch {
      console.log("❌ SESSION decode failed");
      return;
    }

    try {
      JSON.parse(decoded);
    } catch {
      console.log("❌ SESSION not valid JSON, skipping write");
      return;
    }

    fs.writeFileSync(
      path.join(SESSION_PATH, "creds.json"),
      decoded
    );

    console.log("✅ Session loaded safely");
  } catch (e) {
    console.log("⚠️ Session loader error ignored");
  }
}

/* =========================
   🤖 BOT CORE STARTER
========================= */
async function startBot() {
  try {
    loadSession();

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);
    const { version } = await fetchLatestBaileysVersion();

    if (!state) {
      throw new Error("Auth state missing");
    }

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: !config.SESSION_ID,
      browser: [config.BOT_NAME, "Heroku", "v3"],
      syncFullHistory: false,
      markOnlineOnConnect: true
    });

    global.sock = sock;

    /* =========================
       🧠 AMD ENGINE SAFE LOAD
    ========================= */
    const amd = new AMD(sock, config);
    global.amd = amd;

    try {
      amd.loadPlugins();
      amd.watchPlugins();
    } catch (e) {
      console.log("⚠️ AMD plugin error ignored:", e.message);
    }

    /* =========================
       💬 MESSAGE HANDLER SAFE
    ========================= */
    sock.ev.on("messages.upsert", async ({ messages }) => {
      try {
        const msg = messages?.[0];
        if (!msg || !msg.message) return;

        if (config.AUTO_READ_MESSAGES) {
          await sock.readMessages([msg.key]).catch(() => {});
        }

        await amd.handleMessage(msg).catch(() => {});

      } catch (e) {
        console.log("⚠️ Message handler safe error");
      }
    });

    /* =========================
       👀 STATUS SYSTEM SAFE
    ========================= */
    try {
      amd.statusHook();

      amd.on("status", async (msg) => {
        try {
          if (config.AUTO_STATUS_VIEW) {
            await sock.readMessages([msg.key]).catch(() => {});
          }

          if (config.AUTO_STATUS_LIKE) {
            await sock.sendMessage(msg.key.remoteJid, {
              react: {
                text: config.STATUS_REACTION || "🔥",
                key: msg.key
              }
            }).catch(() => {});
          }
        } catch {}
      });
    } catch {}

    /* =========================
       🔐 SAVE CREDS
    ========================= */
    sock.ev.on("creds.update", saveCreds);

    /* =========================
       🔁 CONNECTION ENGINE (AUTO FIX)
    ========================= */
    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "open") {
        console.log(`✅ ${config.BOT_NAME} connected`);
      }

      if (connection === "close") {
        const reason = lastDisconnect?.error?.output?.statusCode;

        console.log("⚠️ Connection closed");

        if (reason === DisconnectReason.loggedOut) {
          console.log("❌ Logged out - manual session required");
          return;
        }

        console.log("🔄 Restarting bot...");
        setTimeout(() => startBot(), 5000);
      }
    });

  } catch (err) {
    console.log("❌ Bot crashed, auto-restarting:", err.message);
    setTimeout(() => startBot(), 8000);
  }
}

/* =========================
   🚀 START ENGINE
========================= */
startBot();
