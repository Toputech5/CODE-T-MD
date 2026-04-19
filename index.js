const fs = require("fs");
const path = require("path");
const express = require("express");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

const config = require("./config");
const Logger = require("./lib/logger");
const AMD = require("./lib/amd");

/* =========================
   🔥 CRASH PROTECTION
========================= */
process.on("uncaughtException", (err) => {
  console.log("❌ Uncaught:", err);
});
process.on("unhandledRejection", (err) => {
  console.log("❌ Rejection:", err);
});

/* =========================
   🌐 KEEP ALIVE SERVER
========================= */
const app = express();

app.get("/", (req, res) => {
  res.send(`${config.BOT_NAME} is alive 🚀`);
});

app.listen(process.env.PORT || 8000, "0.0.0.0", () => {
  Logger.info(`Server running on ${process.env.PORT || 8000}`);
});

/* =========================
   🔐 SESSION FIX (BASE64)
========================= */
function loadSession() {
  if (!config.SESSION_ID) return;

  try {
    const data = Buffer.from(config.SESSION_ID, "base64").toString("utf-8");

    if (!fs.existsSync("./sessions")) {
      fs.mkdirSync("./sessions");
    }

    fs.writeFileSync("./sessions/creds.json", data);
    Logger.success("Session loaded from SESSION_ID");
  } catch (e) {
    Logger.error("Invalid SESSION_ID");
  }
}

/* =========================
   🤖 START BOT
========================= */
async function startBot() {
  loadSession();

  const { state, saveCreds } = await useMultiFileAuthState("./sessions");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: !config.SESSION_ID,
    browser: [config.BOT_NAME, "Heroku", "1.0.0"]
  });

  const amd = new AMD(sock, config);
  global.amd = amd;

  amd.loadPlugins();
  amd.watchPlugins();

  /* =========================
     💬 MESSAGE HANDLER
  ========================= */
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const msg = messages[0];
    if (!msg) return;

    try {
      if (config.AUTO_READ_MESSAGES) {
        await sock.readMessages([msg.key]);
      }

      await amd.handleMessage(msg);

    } catch (e) {
      Logger.error("Message error: " + e.message);
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
      const reason =
        lastDisconnect?.error?.output?.statusCode;

      Logger.warn("Connection closed");

      if (
        config.AUTO_RECONNECT &&
        reason !== DisconnectReason.loggedOut
      ) {
        setTimeout(startBot, 4000);
      } else {
        Logger.error("Logged out. Reconnect manually.");
      }
    }
  });
}

/* =========================
   🚀 START
========================= */
startBot();
