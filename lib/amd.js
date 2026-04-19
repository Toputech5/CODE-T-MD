const fs = require("fs");
const path = require("path");
const EventEmitter = require("events");

class AMD extends EventEmitter {
  constructor(sock, config = {}) {
    super();
    this.sock = sock;
    this.config = config;

    this.plugins = new Map();
    this.aliases = new Map();
    this.cooldowns = new Map();
  }

  /* =========================
     🧠 SAFE PLUGIN LOADER v4
  ========================= */
  loadPlugins(pluginPath = "./plugins") {
    try {
      const fullPath = path.join(process.cwd(), pluginPath);

      if (!fs.existsSync(fullPath)) {
        fs.mkdirSync(fullPath, { recursive: true });
        console.log("⚠️ Plugins folder created");
        return;
      }

      const files = fs.readdirSync(fullPath).filter(f => f.endsWith(".js"));

      for (const file of files) {
        const filePath = path.join(fullPath, file);

        try {
          delete require.cache[require.resolve(filePath)];
          const plugin = require(filePath);

          if (!plugin || typeof plugin !== "object") continue;

          const cmd = plugin.cmd || plugin.command || plugin.name;
          if (!cmd) continue;

          this.plugins.set(cmd, plugin);

          const aliases = plugin.aliases || [];
          for (const a of aliases) {
            this.aliases.set(a, cmd);
          }

        } catch (err) {
          console.log(`❌ Plugin skipped (${file}): ${err.message}`);
        }
      }

      console.log(`🧠 AMD loaded ${this.plugins.size} plugins`);

    } catch (e) {
      console.log("❌ Plugin loader error:", e.message);
    }
  }

  /* =========================
     🔍 COMMAND RESOLVER
  ========================= */
  resolveCommand(cmd) {
    if (!cmd) return null;

    if (this.plugins.has(cmd)) return this.plugins.get(cmd);

    const real = this.aliases.get(cmd);
    return this.plugins.get(real) || null;
  }

  /* =========================
     💬 ULTRA SMART MESSAGE PARSER
  ========================= */
  getBody(msg) {
    const m = msg.message;
    if (!m) return "";

    return (
      m.conversation ||
      m.extendedTextMessage?.text ||
      m.imageMessage?.caption ||
      m.videoMessage?.caption ||
      m.documentMessage?.caption ||
      m.buttonsResponseMessage?.selectedButtonId ||
      m.listResponseMessage?.singleSelectReply?.selectedRowId ||

      // 🔥 MODERN WHATSAPP WRAPPERS
      m.ephemeralMessage?.message?.extendedTextMessage?.text ||
      m.ephemeralMessage?.message?.conversation ||

      m.viewOnceMessage?.message?.extendedTextMessage?.text ||
      m.viewOnceMessage?.message?.conversation ||

      m.viewOnceMessageV2?.message?.extendedTextMessage?.text ||
      m.viewOnceMessageV2?.message?.conversation ||

      m.documentWithCaptionMessage?.message?.documentMessage?.caption ||

      ""
    );
  }

  /* =========================
     💬 MESSAGE HANDLER v4
  ========================= */
  async handleMessage(msg) {
    try {
      if (!msg?.message) return;

      const body = this.getBody(msg);

      // 🔥 DEBUG (REMOVE LATER IF YOU WANT)
      // console.log("📩 BODY:", body);

      if (!body || typeof body !== "string") return;

      const from = msg.key.remoteJid;
      const sender = msg.key.participant || from;

      const prefix =
  this.config.PREFIX ||
  this.config.prefix ||
  ".";

// 🧠 safety: ensure body is valid string
if (!body || typeof body !== "string") return;

// 🧠 normalize for consistency
const cleanBody = body.trim();

// ❌ ignore non-command messages
if (!cleanBody.startsWith(prefix)) return;

// ✅ ALWAYS use cleanBody (important fix)
const withoutPrefix = cleanBody.slice(prefix.length);

const args = withoutPrefix.trim().split(/\s+/);
const command = (args.shift() || "").toLowerCase();

      const plugin = this.resolveCommand(command);
      if (!plugin || typeof plugin.run !== "function") return;

      const key = sender + command;
      const now = Date.now();

      const cooldownTime = this.cooldowns.get(key) || 0;
      if (now < cooldownTime) return;

      this.cooldowns.set(key, now + 3000);

      await plugin.run({
        sock: this.sock,
        msg,
        from,
        sender,
        args,
        body,
        config: this.config
      });

    } catch (err) {
      console.log("⚠️ AMD handler error:", err.message);
    }
  }

  /* =========================
     👀 STATUS HOOK v4
  ========================= */
  statusHook() {
  try {
    this.sock.ev.on("messages.upsert", async ({ messages }) => {
      for (const msg of messages) {
        try {
          if (!msg?.key) continue;

          const jid = msg.key.remoteJid;

          // ✅ REAL WhatsApp Status detection
          if (jid === "status@broadcast") {
            this.emit("status", msg);
          }

        } catch (e) {}
      }
    });

  } catch (e) {
    console.log("⚠️ Status hook failed");
  }
}

  /* =========================
     ♻️ HOT RELOAD v4
  ========================= */
  watchPlugins(dir = "./plugins") {
    try {
      const fullPath = path.join(process.cwd(), dir);

      if (!fs.existsSync(fullPath)) return;

      fs.watch(fullPath, (event, file) => {
        if (!file || !file.endsWith(".js")) return;

        const filePath = path.join(fullPath, file);

        try {
          delete require.cache[require.resolve(filePath)];
          const plugin = require(filePath);

          const cmd = plugin?.cmd || plugin?.command || plugin?.name;
          if (cmd) this.plugins.set(cmd, plugin);

          console.log(`♻️ Plugin updated: ${cmd}`);

        } catch (e) {
          console.log("❌ Reload error:", e.message);
        }
      });

    } catch (e) {
      console.log("⚠️ Watch disabled");
    }
  }
}

module.exports = AMD;
