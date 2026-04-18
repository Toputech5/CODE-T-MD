const axios = require("axios");
const config = require("../config");

module.exports = {
  command: "redeploy",

  run: async (sock, msg, { from }) => {
    try {
      // 🔐 OWNER ONLY
      if (!msg.key.fromMe && from !== config.OWNER_JID) {
        return sock.sendMessage(from, {
          text: "❌ This command is only for the owner."
        });
      }

      const apiKey = process.env.HEROKU_API_KEY;
      const appName = process.env.HEROKU_APP_NAME;

      if (!apiKey || !appName) {
        return sock.sendMessage(from, {
          text: "❌ HEROKU_API_KEY or HEROKU_APP_NAME not set."
        });
      }

      await sock.sendMessage(from, {
        text: "♻️ Redeploying bot on Heroku..."
      });

      // 🔥 Trigger new build
      await axios.post(
        `https://api.heroku.com/apps/${appName}/builds`,
        {
          source_blob: {
            url: "https://github.com/Toputech5/CODE-T-MD/archive/refs/heads/main.zip"
          }
        },
        {
          headers: {
            Accept: "application/vnd.heroku+json; version=3",
            Authorization: `Bearer ${apiKey}`,
            "Content-Type": "application/json"
          }
        }
      );

      await sock.sendMessage(from, {
        text: "✅ Redeploy started successfully!"
      });

    } catch (err) {
      console.log("Redeploy error:", err.response?.data || err);

      await sock.sendMessage(from, {
        text: "❌ Failed to redeploy bot."
      });
    }
  }
};
