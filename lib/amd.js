const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const EventEmitter = require("events");

class AMD extends EventEmitter {
  constructor(sock, config = {}) {
    super();
    this.sock = sock;
    this.config = config;
    this.plugins = new Map();
    this.cooldowns = new Map();
  }

  /* =========================
     🔥 LOAD PLUGINS
  ========================= */
  loadPlugins(pluginPath = "./plugins") {
    try {
      const files = fs.readdirSync(pluginPath).filter(f => f.endsWith(".js"));

      for (let file of files) {
        const fullPath = path.join(process.cwd(), pluginPath, file);

        delete require.cache[require.resolve(fullPath)];
        const plugin = require(fullPath);

        if (plugin?.name) {
          this.plugins.set(plugin.name, plugin);
        }
      }

      console.log(`✅ AMD: Loaded ${this.plugins.size} plugins`);
    } catch (e) {
      console.log("❌ Plugin load error:", e);
    }
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

      const plugin = this.plugins.get(command);
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
      const { connection, lastDisconnect } = update;

      if (connection === "close") {
        console.log("🔁 Connection lost. Restarting...");

        setTimeout(() => {
          startFn(); // restart bot
        }, 3000);
      }

      if (connection === "open") {
        console.log("✅ AMD: Bot connected successfully");
      }
    });
  }

  /* =========================
     👀 STATUS VIEW HOOK
     (for smart-status v2)
  ========================= */
  async statusHook() {
    this.sock.ev.on("messages.upsert", async ({ messages }) => {
      for (let msg of messages) {
        if (msg.message?.protocolMessage?.type === 25) {
          // status message detected
          this.emit("status", msg);
        }
      }
    });
  }

  /* =========================
     📦 RELOAD PLUGINS HOT
  ========================= */
  watchPlugins(dir = "./plugins") {
    fs.watch(dir, (event, file) => {
      if (file && file.endsWith(".js")) {
        console.log(`♻️ Reloading plugin: ${file}`);
        this.loadPlugins(dir);
      }
    });
  }
}

module.exports = AMD;
