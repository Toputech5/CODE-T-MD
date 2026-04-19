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
   🧯 GLOBAL CRASH GUARD
========================= */
process.on("uncaughtException", (err) => {
  console.log("❌ Uncaught Exception:", err);
});

process.on("unhandledRejection", (err) => {
  console.log("❌ Unhandled Rejection:", err);
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
   📁 SAFE SESSION FOLDER
========================= */
const SESSION_PATH = "./sessions";

if (!fs.existsSync(SESSION_PATH)) {
  fs.mkdirSync(SESSION_PATH, { recursive: true });
}

/* =========================
   🔐 SESSION LOADER (SAFE)
========================= */
function loadSession() {
  try {
    if (!config.SESSION_ID) return;

    const decoded = Buffer.from(config.SESSION_ID, "base64").toString("utf-8");

    // Only write if valid JSON
    JSON.parse(decoded);

    fs.writeFileSync(
      path.join(SESSION_PATH, "creds.json"),
      decoded
    );

    Logger.success("Session loaded successfully ✔");
  } catch (e) {
    Logger.error("SESSION_ID invalid or corrupted");
  }
}

/* =========================
   🤖 START BOT
========================= */
async function startBot() {
  try {
    loadSession();

    const { state, saveCreds } = await useMultiFileAuthState(SESSION_PATH);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: !config.SESSION_ID,
      browser: [config.BOT_NAME, "Heroku", "1.0.0"],
      syncFullHistory: false,
      markOnlineOnConnect: true
    });

    const amd = new AMD(sock, config);
    global.amd = amd;

    amd.loadPlugins();
    amd.watchPlugins();

    /* =========================
       💬 MESSAGE HANDLER
    ========================= */
    sock.ev.on("messages.upsert", async ({ messages }) => {
      try {
        const msg = messages?.[0];
        if (!msg || !msg.message) return;

        if (config.AUTO_READ_MESSAGES) {
          await sock.readMessages([msg.key]);
        }

        await amd.handleMessage(msg);

      } catch (err) {
        Logger.error("Message handler error: " + err.message);
      }
    });

    /* =========================
       👀 STATUS SYSTEM
    ========================= */
    amd.statusHook();

    amd.on("status", async (msg) => {
      try {
        if (config.AUTO_STATUS_VIEW) {
          await sock.readMessages([msg.key]);
        }

        if (config.AUTO_STATUS_LIKE) {
          await sock.sendMessage(msg.key.remoteJid, {
            react: {
              text: config.STATUS_REACTION || "🔥",
              key: msg.key
            }
          });
        }
      } catch (e) {}
    });

    /* =========================
       🔐 SAVE CREDS
    ========================= */
    sock.ev.on("creds.update", saveCreds);

    /* =========================
       🔁 CONNECTION HANDLER
    ========================= */
    sock.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "open") {
        Logger.success(`${config.BOT_NAME} connected ⚡`);
      }

      if (connection === "close") {
        const reason = lastDisconnect?.error?.output?.statusCode;

        Logger.warn("Connection closed");

        if (
          config.AUTO_RECONNECT &&
          reason !== DisconnectReason.loggedOut
        ) {
          setTimeout(() => startBot(), 5000);
        } else {
          Logger.error("Logged out or fatal error. Manual restart needed.");
        }
      }
    });

  } catch (err) {
    Logger.error("Fatal startup error: " + err.message);
    setTimeout(() => startBot(), 7000);
  }
}

/* =========================
   🚀 START BOT
========================= */
startBot();
