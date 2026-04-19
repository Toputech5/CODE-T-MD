const userStats = new Map();
const seen = new Set();

/**
 * =========================
 * COMMAND CONTROL
 * =========================
 */
module.exports = {
  command: "sae",

  run: async (sock, msg) => {
    const jid = msg.key.remoteJid;

    return sock.sendMessage(jid, {
      text: `🧠 STATUS AI ENGINE\n\nStatus: ACTIVE\nMode: SMART REACTION`
    });
  }
};

/**
 * =========================
 * AI STATUS ENGINE CORE
 * =========================
 */
module.exports.init = (sock) => {

  sock.ev.on("messages.upsert", async ({ messages }) => {

    for (let msg of messages) {
      try {

        if (!msg.message) continue;
        if (msg.key.remoteJid !== "status@broadcast") return;

        const sender = msg.key.participant;
        const id = msg.key.id;

        /**
         * 🔁 AVOID DUPLICATES
         */
        if (seen.has(id)) return;
        seen.add(id);

        setTimeout(() => seen.delete(id), 1000 * 60 * 10);

        /**
         * 👁️ VIEW STATUS (SAFE)
         */
        sock.readMessages([msg.key]).catch(() => {});

        /**
         * 🧠 UPDATE USER BEHAVIOR
         */
        if (!userStats.has(sender)) {
          userStats.set(sender, { count: 1 });
        } else {
          userStats.get(sender).count++;
        }

        const data = userStats.get(sender);

        /**
         * 🧠 DETECT STATUS TYPE
         */
        const msgData = msg.message;

        let type = "text";

        if (msgData.imageMessage) type = "image";
        else if (msgData.videoMessage) type = "video";
        else if (msgData.conversation) type = "text";

        /**
         * ❤️ AI REACTION SYSTEM
         */
        let reaction = "🙂";

        if (type === "image") reaction = data.count > 5 ? "😍" : "🔥";
        if (type === "video") reaction = data.count > 5 ? "😎" : "🔥";
        if (type === "text") reaction = data.count > 5 ? "🤔" : "🙂";

        /**
         * ⏱️ HUMAN DELAY (AI STYLE)
         */
        const delay = Math.floor(Math.random() * (25000 - 8000 + 1)) + 8000;

        setTimeout(async () => {
          try {
            await sock.sendMessage(
              msg.key.remoteJid,
              {
                react: {
                  text: reaction,
                  key: msg.key
                }
              },
              {
                statusJidList: [sender]
              }
            );
          } catch {}
        }, delay);

      } catch (err) {
        console.log("❌ AI Engine Error:", err);
      }
    }

  });

};
