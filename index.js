const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const express = require("express");
const path = require("path");

const config = require("./config");
const Logger = require("./lib/logger");
const AMD = require("./lib/amd");

/* =========================
   🌐 KEEP ALIVE SERVER
========================= */
const app = express();

app.get("/", (req, res) => {
  res.send(`${config.BOT_NAME} is running ⚡`);
});

app.listen(process.env.PORT || 8000, () => {
  Logger.info(`Server running on PORT ${process.env.PORT || 8000}`);
});

/* =========================
   🤖 START BOT ENGINE
========================= */
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(
    config.SESSION_NAME
  );

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
    browser: [config.BOT_NAME, "Chrome", "1.0.0"]
  });

  /* =========================
     🧠 AMD CORE ENGINE
  ========================= */
  const amd = new AMD(sock, config);
  global.amd = amd;

  amd.loadPlugins();
  amd.watchPlugins();

  /* =========================
     💬 MESSAGE HANDLER
  ========================= */
  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (let msg of messages) {
      try {
        if (config.AUTO_READ_MESSAGES) {
          await sock.readMessages([msg.key]);
        }

        await amd.handleMessage(msg);

      } catch (err) {
        Logger.error("Message error: " + err.message);
      }
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
            text: config.STATUS_REACTION,
            key: msg.key
          }
        });
      }

    } catch (e) {
      Logger.warn("Status error");
    }
  });

  /* =========================
     ⚡ PRESENCE SYSTEM
  ========================= */
  if (config.AUTO_PRESENCE) {
    sock.ev.on("messages.upsert", async ({ messages }) => {
      const msg = messages[0];
      const jid = msg.key.remoteJid;

      try {
        await sock.sendPresenceUpdate("available", jid);

        setInterval(async () => {
          await sock.sendPresenceUpdate(
            config.PRESENCE_TYPE || "typing",
            jid
          );
        }, config.PRESENCE_COOLDOWN);

      } catch (e) {}
    });
  }

  /* =========================
     🔐 SAVE SESSION
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

      Logger.warn("Connection closed, restarting...");

      if (config.AUTO_RECONNECT && reason !== DisconnectReason.loggedOut) {
        setTimeout(startBot, 3000);
      } else {
        Logger.error("Logged out. Delete session & rescan QR.");
      }
    }
  });

  return sock;
}

/* =========================
   🚀 START
========================= */
startBot();
