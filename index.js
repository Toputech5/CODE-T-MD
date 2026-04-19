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
   📁 SESSION PATH
========================= */
const SESSION_PATH = "./sessions";

if (!fs.existsSync(SESSION_PATH)) {
  fs.mkdirSync(SESSION_PATH, { recursive: true });
}

/* =========================
   🔐 SESSION LOADER SAFE
========================= */
function loadSession() {
  try {
    if (!config.SESSION_ID) return;

    const decoded = Buffer.from(config.SESSION_ID, "base64").toString("utf8");

    if (!decoded || typeof decoded !== "string") return;

    fs.writeFileSync(
      path.join(SESSION_PATH, "creds.json"),
      decoded
    );

    console.log("✅ Session loaded");

  } catch (e) {
    console.log("⚠️ Session ignored");
  }
}

/* =========================
   🤖 BOT STARTER
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
      browser: [config.BOT_NAME, "Heroku", "v3"],
      syncFullHistory: false,
      markOnlineOnConnect: true
    });

    global.sock = sock;

    /* =========================
       🧠 AMD ENGINE
    ========================= */
    const amd = new AMD(sock, config);
    global.amd = amd;

    amd.loadPlugins();
    amd.watchPlugins();
    amd.statusHook();

    /* =========================
       💬 MESSAGE HANDLER (FIXED + DEBUG)
    ========================= */
 sock.ev.on("messages.upsert", async ({ messages }) => {
  for (const msg of messages) {
    if (!msg?.message) continue;

    try {
      if (config.DEBUG_MODE) {
        console.log("📦 TYPE:", Object.keys(msg.message || {}));
        console.log("📦 MSG:", JSON.stringify(msg.message, null, 2));
      }

      if (config.AUTO_READ_MESSAGES) {
        await sock.readMessages([msg.key]).catch(() => {});
      }

      await amd.handleMessage(msg);

    } catch (err) {
      console.log("⚠️ Message error:", err.message);
    }
  }
});

    /* =========================
       👀 STATUS SYSTEM
    ========================= */
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
        console.log(`✅ ${config.BOT_NAME} connected`);
      }

      if (connection === "close") {
        const reason = lastDisconnect?.error?.output?.statusCode;

        console.log("⚠️ Connection closed");

        if (reason === DisconnectReason.loggedOut) {
          console.log("❌ Logged out - session required");
          return;
        }

        console.log("🔄 Restarting bot...");
        setTimeout(startBot, 5000);
      }
    });

  } catch (err) {
    console.log("❌ Bot crash:", err.message);
    setTimeout(startBot, 8000);
  }
}

/* =========================
   🚀 START BOT
========================= */
startBot();
