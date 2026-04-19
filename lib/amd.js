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
     🧠 SAFE PLUGIN LOADER
  ========================= */
  loadPlugins(pluginPath = "./plugins") {
    try {
      const fullPath = path.join(process.cwd(), pluginPath);

      // ✅ FIX: prevent crash if folder missing
      if (!fs.existsSync(fullPath)) {
        console.log("⚠️ Plugins folder missing - creating...");
        fs.mkdirSync(fullPath, { recursive: true });
        return;
      }

      const files = fs.readdirSync(fullPath).filter(f => f.endsWith(".js"));

      for (let file of files) {
        const filePath = path.join(fullPath, file);

        try {
          delete require.cache[require.resolve(filePath)];
          const plugin = require(filePath);

          if (!plugin) continue;

          const cmd = plugin.cmd || plugin.command || plugin.name;
          const aliases = plugin.aliases || [];

          if (!cmd) continue;

          this.plugins.set(cmd, plugin);

          for (let a of aliases) {
            this.aliases.set(a, cmd);
          }

        } catch (err) {
          console.log(`❌ Plugin skipped (${file}):`, err.message);
        }
      }

      console.log(`🧠 AMD: Loaded ${this.plugins.size} plugins`);

    } catch (e) {
      console.log("❌ Plugin loader fatal (ignored):", e.message);
    }
  }

  /* =========================
     🔍 COMMAND RESOLVER
  ========================= */
  resolveCommand(cmd) {
    if (this.plugins.has(cmd)) return this.plugins.get(cmd);

    const real = this.aliases.get(cmd);
    return this.plugins.get(real) || null;
  }

  /* =========================
     💬 MESSAGE HANDLER (SAFE)
  ========================= */
  async handleMessage(msg) {
    try {
      if (!msg?.message) return;

      const type = Object.keys(msg.message)[0];
      const body =
        msg.message.conversation ||
        msg.message[type]?.text ||
        msg.message[type]?.caption ||
        "";

      const from = msg.key.remoteJid;
      const sender = msg.key.participant || from;

      const prefix = this.config.prefix || ".";
      if (!body.startsWith(prefix)) return;

      const args = body.slice(prefix.length).trim().split(" ");
      const command = args.shift()?.toLowerCase();

      const plugin = this.resolveCommand(command);
      if (!plugin?.run) return;

      const key = sender + command;
      const now = Date.now();

      if (this.cooldowns.get(key) > now) return;

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
      console.log("⚠️ AMD message error (ignored)");
    }
  }

  /* =========================
     👀 STATUS HOOK (SAFE)
  ========================= */
  statusHook() {
    try {
      this.sock.ev.on("messages.upsert", async ({ messages }) => {
        for (let msg of messages) {
          if (msg.message?.protocolMessage?.type === 25) {
            this.emit("status", msg);
          }
        }
      });
    } catch (e) {
      console.log("⚠️ Status hook failed (ignored)");
    }
  }

  /* =========================
     ♻️ HOT RELOAD (SAFE)
  ========================= */
  watchPlugins(dir = "./plugins") {
    try {
      const fullPath = path.join(process.cwd(), dir);

      if (!fs.existsSync(fullPath)) return;

      fs.watch(fullPath, (event, file) => {
        if (!file?.endsWith(".js")) return;

        const filePath = path.join(fullPath, file);

        try {
          delete require.cache[require.resolve(filePath)];
          const plugin = require(filePath);

          const cmd = plugin.cmd || plugin.command || plugin.name;

          if (cmd) this.plugins.set(cmd, plugin);

          console.log(`♻️ Plugin updated: ${cmd}`);

        } catch (e) {
          console.log("❌ Reload failed:", e.message);
        }
      });

    } catch (e) {
      console.log("⚠️ Watch disabled safely");
    }
  }
}

module.exports = AMD;
