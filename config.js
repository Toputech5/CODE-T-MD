module.exports = {
  BOT_NAME: process.env.BOT_NAME || "CODE-T MD",
  PREFIX: process.env.PREFIX || ".",
  VERSION: process.env.VERSION || "1.0.0",

  OWNER_NAME: process.env.OWNER_NAME || "CODE-T OWNER",
  OWNER_NUMBER: process.env.OWNER_NUMBER || "255XXXXXXXXX",
  OWNER_JID: process.env.OWNER_JID || "255XXXXXXXXX@s.whatsapp.net",

  SESSION_NAME: process.env.SESSION_NAME || "session",
  SESSION_ID: process.env.SESSION_ID || "",

  HEROKU_API_KEY: process.env.HEROKU_API_KEY || "",
  HEROKU_APP_NAME: process.env.HEROKU_APP_NAME || "",

  AUTO_STATUS_VIEW: process.env.AUTO_STATUS_VIEW === "true",
  AUTO_STATUS_READ: process.env.AUTO_STATUS_READ === "true",
  AUTO_STATUS_LIKE: process.env.AUTO_STATUS_LIKE === "true",
  STATUS_REACTION: process.env.STATUS_REACTION || "🔥",

  PUBLIC_MODE: process.env.PUBLIC_MODE === "true",
  AUTO_READ_MESSAGES: process.env.AUTO_READ_MESSAGES === "true",

  AUTO_PRESENCE: process.env.AUTO_PRESENCE === "true",
  PRESENCE_TYPE: process.env.PRESENCE_TYPE || "typing",
  PRESENCE_COOLDOWN: Number(process.env.PRESENCE_COOLDOWN) || 4000,

  ANTI_LINK: process.env.ANTI_LINK === "true",
  ANTI_SPAM: process.env.ANTI_SPAM === "true",

  AUTO_RECONNECT: process.env.AUTO_RECONNECT !== "false",
  LOG_LEVEL: process.env.LOG_LEVEL || "silent", // ✅ FIXED

  DEBUG_MODE: process.env.DEBUG_MODE !== "false" // ✅ NOW VALID
};
