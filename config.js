module.exports = {
  /**
   * =========================
   * BOT BASIC SETTINGS
   * =========================
   */
  BOT_NAME: "CODE-T MD",
  PREFIX: ".",
  VERSION: "1.0.0",

  /**
   * =========================
   * OWNER SETTINGS
   * =========================
   */
  OWNER_NAME: "CODE-T OWNER",
  OWNER_NUMBER: "255XXXXXXXXX", // replace with your number
  OWNER_JID: "255XXXXXXXXX@s.whatsapp.net",

  /**
   * =========================
   * SESSION SETTINGS
   * =========================
   */
  SESSION_NAME: "session",

  // 🔐 IMPORTANT (ADD THIS)
  SESSION_ID: process.env.SESSION_ID || "", // paste your base64 session here (eyJ...)

  /**
   * =========================
   * STATUS SYSTEM
   * =========================
   */
  AUTO_STATUS_VIEW: true,
  AUTO_STATUS_READ: true,
  AUTO_STATUS_LIKE: true,
  STATUS_REACTION: "🔥",

  /**
   * =========================
   * BOT MODE SETTINGS
   * =========================
   */
  PUBLIC_MODE: true,
  AUTO_READ_MESSAGES: true,

  /**
   * =========================
   * SAFETY / CONTROL
   * =========================
   */
  ANTI_LINK: false,
  ANTI_SPAM: false,

  /**
   * =========================
   * SYSTEM SETTINGS
   * =========================
   */
  AUTO_RECONNECT: true,
  LOG_LEVEL: "silent"
};
