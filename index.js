const fs = require("fs");
const path = require("path");
const pino = require("pino");

const config = require("./config");

const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason
} = require("@whiskeysockets/baileys");

/**
 * =========================
 * PLUGIN LOADER (FAST MAP)
 * =========================
 */
function loadPlugins() {
  const pluginMap = new Map();

  const files = fs.readdirSync(path.join(__dirname, "plugins"))
    .filter(f => f.endsWith(".js"));

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
 * BOT START FUNCTION
 * =========================
 */
async function startBot() {
  const { state, saveCreds } = await useMultiFileAuthState(
    path.join(__dirname, "session")
  );

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: true,
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
    }

    if (connection === "close") {
      const reason = lastDisconnect?.error?.output?.statusCode;

      if (reason !== DisconnectReason.loggedOut) {
        console.log("♻️ Reconnecting CODE-T MD...");
        startBot();
      } else {
        console.log("❌ Logged out. Rescan QR.");
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
      if (!msg.message) continue;

      const jid = msg.key.remoteJid;

      const body =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "";

      /**
       * =========================
       * STATUS SYSTEM
       * =========================
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
       * =========================
       * COMMAND HANDLER
       * =========================
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
  });
}

/**
 * =========================
 * START BOT
 * =========================
 */
startBot();
