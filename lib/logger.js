const util = require("util");

/* =========================
   🎨 COLOR CODES (ANSI)
========================= */
const colors = {
  reset: "\x1b[0m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m"
};

/* =========================
   ⏰ TIME FORMAT
========================= */
function time() {
  return new Date().toLocaleString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  });
}

/* =========================
   🧠 MAIN LOGGER ENGINE
========================= */
class Logger {

  static info(msg) {
    console.log(
      `${colors.cyan}[INFO]${colors.reset} ${colors.gray}[${time()}]${colors.reset} ${msg}`
    );
  }

  static success(msg) {
    console.log(
      `${colors.green}[SUCCESS]${colors.reset} ${colors.gray}[${time()}]${colors.reset} ${msg}`
    );
  }

  static warn(msg) {
    console.log(
      `${colors.yellow}[WARN]${colors.reset} ${colors.gray}[${time()}]${colors.reset} ${msg}`
    );
  }

  static error(msg) {
    console.log(
      `${colors.red}[ERROR]${colors.reset} ${colors.gray}[${time()}]${colors.reset} ${msg}`
    );
  }

  static debug(msg) {
    if (process.env.DEBUG === "true") {
      console.log(
        `${colors.magenta}[DEBUG]${colors.reset} ${colors.gray}[${time()}]${colors.reset} ${util.inspect(msg, { depth: 2 })}`
      );
    }
  }

  /* =========================
     🤖 BOT STATUS LOGGER
  ========================= */
  static bot(msg) {
    console.log(
      `${colors.blue}[BOT]${colors.reset} ${colors.gray}[${time()}]${colors.reset} ${msg}`
    );
  }

  /* =========================
     🔥 PLUGIN LOGGER
  ========================= */
  static plugin(msg) {
    console.log(
      `${colors.magenta}[PLUGIN]${colors.reset} ${colors.gray}[${time()}]${colors.reset} ${msg}`
    );
  }

  /* =========================
     ⚡ CONNECTION LOGGER
  ========================= */
  static connection(msg) {
    console.log(
      `${colors.cyan}[CONNECTION]${colors.reset} ${colors.gray}[${time()}]${colors.reset} ${msg}`
    );
  }
}

module.exports = Logger;
