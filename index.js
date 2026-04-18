const fs = require("fs");
const path = require("path");
const pino = require("pino");
const express = require("express");

const config = require("./config");

const {
  default: makeWASocket,
  useSingleFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

/**
 * =========================
 * LOAD BASE64 SESSION
 * =========================
 */
function loadSession() {
  const sessionFile = path.join(__dirname, "session.json");

  if (fs.existsSync(sessionFile)) return;

  if (!config.SESSION_ID) {
    console.log("❌ No SESSION_ID found");
    return;
  }

  try {
    const decoded = Buffer.from(config.SESSION_ID, "base64").toString("utf-8");
    fs.writeFileSync(sessionFile, decoded);
    console.log("✅ Session loaded from Base64");
  } catch (err) {
    console.log("❌ Invalid SESSION_ID", err);
  }
}

/**
 * =========================
 * LOAD PLUGINS
 * =========================
 */
function loadPlugins() {
  const pluginMap = new Map();
  const pluginDir = path.join(__dirname, "plugins");

  if (!fs.existsSync(pluginDir)) {
    fs.mkdirSync(pluginDir);
  }

  const files = fs.readdirSync(pluginDir).filter(f => f.endsWith(".js"));

  for (let file of files) {
    try {
      const plugin = require(`./plugins/${file}`);
      if (plugin.command && plugin.run) {
        pluginMap.set(plugin.command, plugin);
      }
    } catch (e) {
      console.log("Plugin load error:", file, e);
    }
  }

  return pluginMap;
}

/**
 * =========================
 * START BOT
 * =========================
 */
async function startBot() {

  loadSession();

  const { state, saveState } = useSingleFileAuthState("./session.json");

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "info" }),
    printQRInTerminal: false,
    browser: ["CODE-T MD", "Chrome", "1.0.0"]
  });

  const plugins = loadPlugins();

  console.log("⚡ CODE-T MD starting...");

  /**
   * SAVE SESSION
   */
  sock.ev.on("creds.update", saveState);

  /**
   * CONNECTION HANDLER
   */
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect } = update;

    if (connection === "open") {
      console.log("✅ CODE-T MD CONNECTED");
    }

    if (connection === "close") {
      const error = lastDisconnect?.error;
      const reason = error?.output?.statusCode;

      console.log("❌ Disconnected:", reason);
      console.log("❌ Full error:", error);

      if (reason !== DisconnectReason.loggedOut) {
        console.log("♻️ Reconnecting in 5 seconds...");
        setTimeout(() => startBot(), 5000);
      } else {
        console.log("❌ Logged out. Generate new SESSION_ID");
      }
    }
  });

  /**
   * =========================
   * MESSAGE HANDLER
   * =========================
   */
  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      for (let msg of messages) {
        if (!msg.message) continue;

        const jid = msg.key.remoteJid;

        const body =
          msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          "";

        /**
         * STATUS SYSTEM
         */
        if (jid === "status@broadcast") {
          try {
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
          } catch (e) {
            console.log("Status error:", e);
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
          try {
            await plugin.run(sock, msg, {
              from: jid,
              args,
              body,
              command
            });
          } catch (err) {
            console.log("Command error:", err);
            await sock.sendMessage(jid, {
              text: "⚠️ Error executing command."
            });
          }
        }
      }
    } catch (err) {
      console.log("💥 MESSAGE CRASH:", err);
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
