const fs = require("fs");
const path = require("path");
const config = require("../config");

module.exports = {
  command: "menu",

  run: async (sock, msg, { from }) => {
    try {
      const pluginDir = path.join(__dirname);
      const files = fs.readdirSync(pluginDir).filter(f => f.endsWith(".js"));

      let commands = [];

      for (let file of files) {
        try {
          const plugin = require(`./${file}`);
          if (plugin.command) {
            commands.push(plugin.command);
          }
        } catch {}
      }

      commands = commands.sort();

      const menuText = `
╔═〘 ⚡ ${config.BOT_NAME} 〙═╗
║
║ 👤 Owner: ${config.OWNER_NAME}
║ 🔧 Mode: ${config.PUBLIC_MODE ? "Public" : "Private"}
║ ⚙️ Prefix: ${config.PREFIX}
║ 📦 Commands: ${commands.length}
║
╠═〘 📜 COMMAND LIST 〙═╝
${commands.map(cmd => `║ ➤ ${config.PREFIX}${cmd}`).join("\n")}
║
╚═══════════════════╝
      `.trim();

      await sock.sendMessage(from, {
        text: menuText
      });

    } catch (err) {
      console.log("Menu error:", err);

      await sock.sendMessage(from, {
        text: "❌ Failed to load menu."
      });
    }
  }
};
