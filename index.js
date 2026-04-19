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
   🔐 SAFE SESSION (FIXED)
========================= */
function loadSession() {
  try {
    if (!config.SESSION_ID) return;

    let decoded;

    try {
      decoded = Buffer.from(config.SESSION_ID, "base64").toString("utf8");
    } catch (e) {
      console.log("❌ SESSION decode failed");
      return;
    }

    // DO NOT strict JSON parse (this was breaking bots)
    if (typeof decoded !== "string" || decoded.length < 10) {
      console.log("❌ SESSION invalid");
      return;
    }

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
       💬 MESSAGE HANDLER (FIXED)
    ========================= */
    sock.ev.on("messages.upsert", async ({ messages }) => {
      const msg = messages?.[0];
      if (!msg?.message) return;

      try {
        if (config.AUTO_READ_MESSAGES) {
          await sock.readMessages([msg.key]);
        }

        // ❌ removed .catch() wrapper (was hiding errors)
        await amd.handleMessage(msg);

      } catch (err) {
        console.log("⚠️ Message error:", err.message);
      }
    });

    /* =========================
       👀 STATUS SYSTEM (FIXED SAFE)
    ========================= */
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

      } catch (e) {
        console.log("⚠️ Status error ignored");
      }
    });

    /* =========================
       🔐 SAVE CREDS
    ========================= */
    sock.ev.on("creds.update", saveCreds);

    /* =========================
       🔁 CONNECTION FIXED
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

        console.log("🔄 Restarting...");
        setTimeout(startBot, 5000);
      }
    });

    /* =========================
       🔐 SAVE CREDS EVENT
    ========================= */
    sock.ev.on("creds.update", saveCreds);

  } catch (err) {
    console.log("❌ Bot crash:", err.message);
    setTimeout(startBot, 8000);
  }
}

/* =========================
   🚀 START
========================= */
startBot();
