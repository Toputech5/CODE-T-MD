const fs = require("fs");
const path = require("path");
const pino = require("pino");
const express = require("express");

const config = require("./config");

const {
  default: makeWASocket,
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");

/**
 * =========================
 * SESSION LOADER (BASE64)
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
    console.log("✅ Session loaded from Base64");
  } catch (err) {
    console.log("❌ Invalid SESSION_ID", err);
  }
}

/**
 * =========================
 * PLUGINS LOADER
 * =========================
 */
function loadPlugins() {
  const pluginMap = new Map();
  const pluginDir = path.join(__dirname, "plugins");

  if (!fs.existsSync(pluginDir)) fs.mkdirSync(pluginDir);

  const files = fs.readdirSync(pluginDir).filter(f => f.endsWith(".js"));

  for (let file of files) {
    try {
      delete require.cache[require.resolve(`./plugins/${file}`)];
      const plugin = require(`./plugins/${file}`);

      if (plugin.command && plugin.run) {
        pluginMap.set(plugin.command, plugin);
        console.log("🧩 Loaded plugin:", plugin.command);
      }
    } catch (e) {
      console.log("Plugin error:", file, e);
    }
  }

  return pluginMap;
}

/**
 * =========================
 * AUTO PRESENCE SYSTEM (CONFIG DRIVEN)
 * =========================
 */
const presenceCooldown = new Map();

async function autoPresence(sock, jid) {
  try {
    if (!config.AUTO_PRESENCE) return;

    const now = Date.now();
    const last = presenceCooldown.get(jid) || 0;

    if (now - last < (config.PRESENCE_COOLDOWN || 4000)) return;
    presenceCooldown.set(jid, now);

    const type = config.PRESENCE_TYPE || "typing";

    await sock.sendPresenceUpdate("available", jid);

    if (type === "typing") {
      await sock.sendPresenceUpdate("composing", jid);

      setTimeout(() => {
        sock.sendPresenceUpdate("paused", jid).catch(() => {});
      }, 1200);
    }

    if (type === "online") {
      await sock.sendPresenceUpdate("available", jid);
    }

    if (type === "recording") {
      await sock.sendPresenceUpdate("recording", jid);

      setTimeout(() => {
        sock.sendPresenceUpdate("paused", jid).catch(() => {});
      }, 1500);
    }

  } catch (e) {
    console.log("Presence error:", e);
  }
}

/**
 * =========================
 * START BOT
 * =========================
 */
async function startBot() {

  loadSession();

  const { state, saveCreds } = await useMultiFileAuthState("./sessions");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    version,
    browser: ["CODE-T MD", "Chrome", "1.0.0"]
  });

  const plugins = loadPlugins();

  console.log("⚡ CODE-T MD starting...");

  /**
   * SAVE SESSION
   */
  sock.ev.on("creds.update", saveCreds);

  /**
   * CONNECTION HANDLER
   */
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log("✅ CODE-T MD CONNECTED");

      sock.sendPresenceUpdate("available");
    }

    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;

      console.log("❌ Disconnected:", reason);

      if (reason !== DisconnectReason.loggedOut) {
        console.log("♻️ Reconnecting...");
        setTimeout(startBot, 4000);
      } else {
        console.log("❌ Logged out. Regenerate SESSION_ID.");
      }
    }
  });

  /**
   * =========================
   * MESSAGE HANDLER
   * =========================
   */
  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (let msg of messages) {
      try {
        if (!msg.message) continue;

        const jid = msg.key.remoteJid;

        const body =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          "";

        if (jid === "status@broadcast") continue;

        /**
         * 🔥 AUTO PRESENCE TRIGGER
         */
        autoPresence(sock, jid);

        /**
         * STATUS SYSTEM
         */
        if (jid === "status@broadcast") {
          if (config.AUTO_STATUS_VIEW || config.AUTO_STATUS_READ) {
            await sock.readMessages([msg.key]);
          }

          if (config.AUTO_STATUS_LIKE) {
            await sock.sendMessage(jid, {
              react: {
                text: config.STATUS_REACTION || "🔥",
                key: msg.key
              }
            });
          }
          continue;
        }

        /**
         * COMMAND SYSTEM
         */
        if (!body.startsWith(config.PREFIX)) continue;

        const args = body.slice(config.PREFIX.length).trim().split(" ");
        const command = args.shift().toLowerCase();

        const plugin = plugins.get(command);

        if (plugin) {
          await plugin.run(sock, msg, {
            from: jid,
            args,
            body,
            command
          });
        }

      } catch (err) {
        console.log("💥 MESSAGE ERROR:", err);
      }
    }
  });
}

/**
 * =========================
 * START BOT
 * =========================
 */
startBot();

/**
 * =========================
 * EXPRESS SERVER (RENDER)
 * =========================
 */
const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("CODE-T MD is running 🚀");
});

app.listen(PORT, () => {
  console.log("🌐 Server running on port", PORT);
});
