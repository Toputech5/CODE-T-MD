const { bold } = require("../lib/utils");

module.exports = {
  cmd: "menu",
  aliases: ["help", "commands", "list"],

  run: async ({ sock, msg, from }) => {
    try {

      const amd = global.amd;
      if (!amd) {
        return sock.sendMessage(from, {
          text: "❌ CODE-T MD engine not connected."
        });
      }

      const plugins = amd.plugins || new Map();

      let commands = [];

      // 🧠 extract commands safely
      for (let [cmd, plugin] of plugins.entries()) {
        if (!cmd) continue;
        if (plugin?.hidden) continue; // optional hidden system

        commands.push(cmd);
      }

      // remove duplicates + sort
      commands = [...new Set(commands)].sort();

      /* =========================
         📦 FORMAT MENU
      ========================= */
      let menu = `
╭───〔 🤖 CODE-T-MD MENU 〕───╮
│ ⚡ Total Commands: ${commands.length}
╰─────────────────────────────╯

📌 COMMAND LIST
`;

      // group commands (AI-style layout)
      const half = Math.ceil(commands.length / 2);
      const left = commands.slice(0, half);
      const right = commands.slice(half);

      for (let i = 0; i < half; i++) {
        menu += `\n${left[i] || ""}  |  ${right[i] || ""}`;
      }

      menu += `

╭─────────────────────────────╮
│ ⚡ Powered by AMD Engine
│ 🧠 Dynamic Plugin Loader
╰─────────────────────────────╯
`;

      await sock.sendMessage(from, {
        text: menu
      }, { quoted: msg });

    } catch (e) {
      console.log("Menu error:", e);

      await sock.sendMessage(from, {
        text: "❌ Menu failed to load."
      });
    }
  }
};
