const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const EventEmitter = require("events");

class AMD extends EventEmitter {
  constructor(sock, config = {}) {
    super();
    this.sock = sock;
    this.config = config;

    // 🧠 AI plugin system (UPGRADED)
    this.plugins = new Map();   // command → plugin
    this.aliases = new Map();   // alias → command
    this.fileMap = new Map();   // file → command

    this.cooldowns = new Map();
  }

  /* =========================
     🧠 AI PLUGIN LOADER (UPGRADED)
  ========================= */
  loadPlugins(pluginPath = "./plugins") {
    try {
      const files = fs.readdirSync(pluginPath).filter(f => f.endsWith(".js"));

      for (let file of files) {
        const fullPath = path.join(process.cwd(), pluginPath, file);

        delete require.cache[require.resolve(fullPath)];
        const plugin = require(fullPath);

        if (!plugin) continue;

        const cmd = plugin.cmd || plugin.command || plugin.name;
        const aliases = plugin.aliases || plugin.alliances || [];

        if (!cmd) continue;

        // main command
        this.plugins.set(cmd, plugin);
        this.fileMap.set(file, cmd);

        // aliases
        for (let a of aliases) {
          this.aliases.set(a, cmd);
        }
      }

      console.log(`🧠 AMD AI: Loaded ${this.plugins.size} plugins`);
    } catch (e) {
      console.log("❌ Plugin load error:", e);
    }
  }

  /* =========================
     🔍 AI COMMAND RESOLVER
  ========================= */
  resolveCommand(cmd) {
    if (this.plugins.has(cmd)) return this.plugins.get(cmd);

    const real = this.aliases.get(cmd);
    if (real && this.plugins.has(real)) {
      return this.plugins.get(real);
    }

    return null;
  }

  /* =========================
     💬 MESSAGE HANDLER
  ========================= */
  async handleMessage(msg) {
    try {
      if (!msg.message) return;

      const type = Object.keys(msg.message)[0];
      const body =
        type === "conversation"
          ? msg.message.conversation
          : msg.message[type]?.text || msg.message[type]?.caption || "";

      const from = msg.key.remoteJid;
      const sender = msg.key.participant || from;

      const prefix = this.config.prefix || ".";
      if (!body.startsWith(prefix)) return;

      const args = body.slice(prefix.length).trim().split(" ");
      const command = args.shift().toLowerCase();

      const plugin = this.resolveCommand(command);
      if (!plugin) return;

      // cooldown system
      const now = Date.now();
      const key = sender + command;
      const cooldown = this.cooldowns.get(key);

      if (cooldown && now < cooldown) return;

      this.cooldowns.set(key, now + 3000);

      // execute plugin
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
      console.log("❌ AMD Message Error:", err);
    }
  }

  /* =========================
     🔁 AUTO RECONNECT SYSTEM
  ========================= */
  async autoReconnect(startFn) {
    process.on("uncaughtException", (err) => {
      console.log("⚠️ Crash caught:", err);
    });

    process.on("unhandledRejection", (err) => {
      console.log("⚠️ Promise error:", err);
    });

    this.sock.ev.on("connection.update", (update) => {
      const { connection } = update;

      if (connection === "close") {
        console.log("🔁 Connection lost. Restarting...");

        setTimeout(() => {
          startFn();
        }, 3000);
      }

      if (connection === "open") {
        console.log("✅ AMD: Bot connected successfully");
      }
    });
  }

  /* =========================
     👀 STATUS HOOK (SMART STATUS READY)
  ========================= */
  async statusHook() {
    this.sock.ev.on("messages.upsert", async ({ messages }) => {
      for (let msg of messages) {
        if (msg.message?.protocolMessage?.type === 25) {
          this.emit("status", msg);
        }
      }
    });
  }

  /* =========================
     ♻️ HOT PLUGIN RELOAD (AI MODE)
  ========================= */
  watchPlugins(dir = "./plugins") {
    fs.watch(dir, (eventType, file) => {
      if (!file || !file.endsWith(".js")) return;

      const fullPath = path.join(process.cwd(), dir, file);

      console.log(`♻️ AMD AI Reload: ${file}`);

      try {
        delete require.cache[require.resolve(fullPath)];
        const plugin = require(fullPath);

        if (!plugin) return;

        const cmd = plugin.cmd || plugin.command || plugin.name;
        const aliases = plugin.aliases || plugin.alliances || [];

        if (cmd) {
          this.plugins.set(cmd, plugin);
          this.fileMap.set(file, cmd);
        }

        for (let a of aliases) {
          this.aliases.set(a, cmd);
        }

        console.log(`✅ Updated plugin: ${cmd}`);

      } catch (err) {
        console.log("❌ Reload error:", err.message);
      }
    });
  }
}

module.exports = AMD;
