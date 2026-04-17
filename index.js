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
 * BASE64 SESSION LOADER
 * =========================
 */
async function loadSession() {
  const sessionPath = path.join(__dirname, "session");

  if (!fs.existsSync(sessionPath)) {
    fs.mkdirSync(sessionPath);
  }

  const credsPath = path.join(sessionPath, "creds.json");

  // Skip if already exists
  if (fs.existsSync(credsPath)) return;

  if (!config.SESSION_ID) {
    console.log("❌ No SESSION_ID found in config.js");
    return;
  }

  try {
    const decoded = Buffer.from(config.SESSION_ID, "base64").toString("utf-8");
    fs.writeFileSync(credsPath, decoded);
    console.log("✅ Base64 session loaded successfully");
  } catch (err) {
    console.log("❌ Invalid SESSION_ID", err);
  }
}

/**
 * =========================
 * PLUGIN LOADER (FAST MAP)
 * =========================
 */
function loadPlugins() {
  const pluginMap = new Map();

  const pluginDir = path.join(__dirname, "plugins");

  if (!fs.existsSync(pluginDir)) {
    fs.mkdirSync(pluginDir);
  }

  const files = fs.readdirSync(pluginDir)
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

  // 🔐 Load Base64 session before connecting
  await loadSession();

  const { state, saveCreds } = await useMultiFileAuthState(
    path.join(__dirname, "session")
  );

  const sock = makeWASocket({
    auth: state,
    logger: pino({ level: config.LOG_LEVEL || "silent" }),
    printQRInTerminal: false,
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
        console.log("❌ Logged out. Update SESSION_ID.");
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
