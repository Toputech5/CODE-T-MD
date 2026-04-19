const { bold } = require("../lib/utils");

module.exports = {
  cmd: "menu",
  aliases: ["help", "list", "commands"],

  run: async ({ sock, msg, from, config }) => {
    try {

      // 🧠 GET AMD INSTANCE
      const amd = global.amd;
      if (!amd) {
        return sock.sendMessage(from, {
          text: "❌ Menu system not linked to AMD loader."
        });
      }

      // 📦 GET COMMANDS FROM AMD
      const plugins = amd.plugins || new Map();
      const aliases = amd.aliases || new Map();

      let cmdList = [];

      for (let [cmd, plugin] of plugins.entries()) {
        if (!cmd) continue;

        // optional: hide system/internal commands
        if (plugin.hidden === true) continue;

        cmdList.push(cmd);
      }

      // remove duplicates from aliases
      for (let [alias, real] of aliases.entries()) {
        if (real && !cmdList.includes(alias)) {
          cmdList.push(alias);
        }
      }

      cmdList = [...new Set(cmdList)].sort();

      // 🧾 FORMAT MENU
      let menu = `
╭───〔 🤖 CODE-T-MD MENU 〕───╮
│ 👤 User: ${msg.pushName || "User"}
│ ⚡ Commands: ${cmdList.length}
╰─────────────────────────────╯

📌 *AVAILABLE COMMANDS*
`;

      let count = 1;
      for (let cmd of cmdList) {
        menu += `\n${count++}. ${cmd}`;
      }

      menu += `

╭─────────────────────────────╮
│ ⚡ Powered by AMD Engine
│ 🧠 Auto-loaded system
╰─────────────────────────────╯
`;

      // 📤 SEND MENU
      await sock.sendMessage(from, {
        text: menu
      }, { quoted: msg });

    } catch (err) {
      console.log("❌ Menu error:", err);

      await sock.sendMessage(from, {
        text: "❌ Failed to load menu."
      });
    }
  }
};
