const axios = require("axios");

module.exports = {
  command: "dl",

  run: async (sock, msg, { from, args }) => {
    try {

      if (!args[0]) {
        return sock.sendMessage(from, {
          text:
`⚡ CODE-T MD DOWNLOADER

Commands:

🎵 TikTok:
.tiktokdl <link>

📘 Facebook:
.fb / .fbdl <link>

📸 Instagram:
.instagram <link>

🎧 Audio:
.song / .mp3 / .play <name>

🎬 Video:
.mp4 / .ytmp4 <name>

🎥 Movie:
.movie / .mov <name>

📌 Pinterest:
.pinterest <query>

🎧 Spotify:
.spotify <song>

✂️ CapCut:
.capcut <template>`
        });
      }

      const cmd = args[0].toLowerCase();
      const query = args.slice(1).join(" ");

      /**
       * =========================
       * TIKTOK
       * =========================
       */
      if (cmd == "tiktokdl") {
        const res = await axios.get(
          `https://api.vreden.web.id/api/tiktok?url=${encodeURIComponent(query)}`
        );

        const data = res.data.result;

        return sock.sendMessage(from, {
          video: { url: data.nowm || data.wm },
          caption: "🎵 TikTok Downloaded"
        });
      }

      /**
       * =========================
       * FACEBOOK
       * =========================
       */
      if (cmd == "fb" || cmd == "fbdl") {
        const res = await axios.get(
          `https://api.vreden.web.id/api/facebook?url=${encodeURIComponent(query)}`
        );

        const data = res.data.result;

        return sock.sendMessage(from, {
          video: { url: data.hd || data.sd },
          caption: "📘 Facebook Downloaded"
        });
      }

      /**
       * =========================
       * INSTAGRAM
       * =========================
       */
      if (cmd == "instagram") {
        const res = await axios.get(
          `https://api.vreden.web.id/api/instagram?url=${encodeURIComponent(query)}`
        );

        const data = res.data.result;

        if (data.type === "video") {
          return sock.sendMessage(from, {
            video: { url: data.url },
            caption: "📸 Instagram Video"
          });
        }

        return sock.sendMessage(from, {
          image: { url: data.url },
          caption: "📸 Instagram Image"
        });
      }

      /**
       * =========================
       * YOUTUBE AUDIO
       * =========================
       */
      if (cmd == "song" || cmd == "mp3" || cmd == "play") {
        const res = await axios.get(
          `https://api.vreden.web.id/api/youtube?query=${encodeURIComponent(query)}`
        );

        const data = res.data.result;

        return sock.sendMessage(from, {
          audio: { url: data.mp3 },
          mimetype: "audio/mp4"
        });
      }

      /**
       * =========================
       * YOUTUBE VIDEO
       * =========================
       */
      if (cmd == "mp4" || cmd == "ytmp4") {
        const res = await axios.get(
          `https://api.vreden.web.id/api/youtube?query=${encodeURIComponent(query)}`
        );

        const data = res.data.result;

        return sock.sendMessage(from, {
          video: { url: data.mp4 },
          caption: "🎬 YouTube Video Downloaded"
        });
      }

      /**
       * =========================
       * MOVIE
       * =========================
       */
      if (cmd == "movie" || cmd == "mov") {
        const res = await axios.get(
          `https://api.vreden.web.id/api/youtube?query=${encodeURIComponent(query)} movie`
        );

        const data = res.data.result;

        return sock.sendMessage(from, {
          video: { url: data.mp4 },
          caption: "🎥 Movie Downloaded"
        });
      }

      /**
       * =========================
       * PINTEREST
       * =========================
       */
      if (cmd == "pinterest") {
        const res = await axios.get(
          `https://api.vreden.web.id/api/pinterest?query=${encodeURIComponent(query)}`
        );

        const data = res.data.result;

        return sock.sendMessage(from, {
          image: { url: data.url },
          caption: "📌 Pinterest Result"
        });
      }

      /**
       * =========================
       * SPOTIFY
       * =========================
       */
      if (cmd == "spotify") {
        const res = await axios.get(
          `https://api.vreden.web.id/api/spotify?query=${encodeURIComponent(query)}`
        );

        const data = res.data.result;

        return sock.sendMessage(from, {
          audio: { url: data.download || data.url },
          mimetype: "audio/mp4"
        });
      }

      /**
       * =========================
       * CAPCUT
       * =========================
       */
      if (cmd == "capcut") {
        const res = await axios.get(
          `https://api.vreden.web.id/api/capcut?query=${encodeURIComponent(query)}`
        );

        const data = res.data.result;

        return sock.sendMessage(from, {
          video: { url: data.video },
          caption: "🎬 CapCut Template"
        });
      }

      /**
       * =========================
       * DEFAULT
       * =========================
       */
      return sock.sendMessage(from, {
        text: "❌ Unknown command. Type .dl for help."
      });

    } catch (err) {
      console.log("Downloader error:", err);

      await sock.sendMessage(from, {
        text: "❌ Download failed. Try again later."
      });
    }
  }
};
