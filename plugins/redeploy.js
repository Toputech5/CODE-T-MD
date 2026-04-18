const axios = require("axios");
const config = require("../config");

const API = "https://api.heroku.com";

function headers(key) {
  return {
    Accept: "application/vnd.heroku+json; version=3",
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json"
  };
}

// 🔐 OWNER CHECK
function isOwner(msg, from) {
  return msg.key.fromMe || from === config.OWNER_JID;
}

module.exports = {
  command: "heroku",

  run: async (sock, msg, { from, body }) => {
    try {
      if (!isOwner(msg, from)) {
        return sock.sendMessage(from, { text: "❌ Owner only command." });
      }

      const apiKey = process.env.HEROKU_API_KEY;
      const app = process.env.HEROKU_APP_NAME;

      if (!apiKey || !app) {
        return sock.sendMessage(from, {
          text: "❌ HEROKU_API_KEY or HEROKU_APP_NAME missing."
        });
      }

      const args = body.split(" ").slice(1);
      const cmd = args[0];

      // =========================
      // RESTART
      // =========================
      if (cmd === "restart") {
        await axios.delete(`${API}/apps/${app}/dynos`, {
          headers: headers(apiKey)
        });

        return sock.sendMessage(from, {
          text: "♻️ App restarting..."
        });
      }

      // =========================
      // REDEPLOY
      // =========================
      if (cmd === "redeploy") {
        await axios.post(
          `${API}/apps/${app}/builds`,
          {
            source_blob: {
              url: "https://github.com/Toputech5/CODE-T-MD/archive/refs/heads/main.zip"
            }
          },
          { headers: headers(apiKey) }
        );

        return sock.sendMessage(from, {
          text: "🚀 Redeploy started..."
        });
      }

      // =========================
      // LOGS
      // =========================
      if (cmd === "logs") {
        const res = await axios.get(
          `${API}/apps/${app}/log-sessions`,
          {
            headers: headers(apiKey),
            params: { tail: false }
          }
        );

        const logUrl = res.data.logplex_url;

        return sock.sendMessage(from, {
          text: `📜 Logs:\n${logUrl}`
        });
      }

      // =========================
      // SET VAR
      // =========================
      if (cmd === "setvar") {
        const pair = args[1];
        if (!pair || !pair.includes("=")) {
          return sock.sendMessage(from, {
            text: "❌ Use: .heroku setvar KEY=value"
          });
        }

        const [key, value] = pair.split("=");

        await axios.patch(
          `${API}/apps/${app}/config-vars`,
          { [key]: value },
          { headers: headers(apiKey) }
        );

        return sock.sendMessage(from, {
          text: `✅ Set ${key}=${value}`
        });
      }

      // =========================
      // GET VAR
      // =========================
      if (cmd === "getvar") {
        const key = args[1];

        const res = await axios.get(
          `${API}/apps/${app}/config-vars`,
          { headers: headers(apiKey) }
        );

        const val = res.data[key];

        return sock.sendMessage(from, {
          text: val ? `🔑 ${key}=${val}` : "❌ Variable not found"
        });
      }

      // =========================
      // DELETE VAR
      // =========================
      if (cmd === "delvar") {
        const key = args[1];

        await axios.patch(
          `${API}/apps/${app}/config-vars`,
          { [key]: null },
          { headers: headers(apiKey) }
        );

        return sock.sendMessage(from, {
          text: `🗑 Deleted ${key}`
        });
      }

      // =========================
      // HELP
      // =========================
      return sock.sendMessage(from, {
        text:
`⚡ HEROKU CONTROL PANEL

.heroku restart
.heroku redeploy
.heroku logs
.heroku setvar KEY=value
.heroku getvar KEY
.heroku delvar KEY`
      });

    } catch (err) {
      console.log("Heroku error:", err.response?.data || err);

      sock.sendMessage(from, {
        text: "❌ Heroku operation failed."
      });
    }
  }
};
