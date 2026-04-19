const config = require("../config");

module.exports = {
  cmd: "smartstatus",
  aliases: ["ss", "statusview"],

  run: async ({ sock, msg, from }) => {
    try {

      if (!config.AUTO_STATUS_VIEW) {
        return sock.sendMessage(from, {
          text: "⚠️ Smart Status is disabled in config."
        });
      }

      let viewed = 0;

      sock.ev.on("messages.upsert", async ({ messages }) => {
        for (let m of messages) {

          if (!m.message) continue;

          const type = Object.keys(m.message)[0];

          // detect status messages
          if (type === "protocolMessage") {
            continue;
          }

          if (m.key?.remoteJid === "status@broadcast") {

            try {
              // 👀 view status
              await sock.readMessages([m.key]);

              viewed++;

              // ⚡ optional reaction (safe delay)
              if (config.AUTO_STATUS_LIKE) {
                setTimeout(async () => {
                  await sock.sendMessage(m.key.remoteJid, {
                    react: {
                      text: config.STATUS_REACTION || "🔥",
                      key: m.key
                    }
                  });
                }, 1200);
              }

            } catch (e) {}
          }
        }
      });

      return sock.sendMessage(from, {
        text: `🧠 Smart-Status v2 activated\n👀 Auto viewer ON\n⚡ Reaction: ${config.STATUS_REACTION || "🔥"}`
      });

    } catch (err) {
      console.log("SmartStatus error:", err);

      return sock.sendMessage(from, {
        text: "❌ Smart-status failed to start"
      });
    }
  }
};
