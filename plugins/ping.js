module.exports = {
  command: "ping",

  run: async (sock, msg, { from }) => {
    await sock.sendMessage(from, {
      text: "🏓 CODE-T MD is alive ⚡"
    });
  }
};
