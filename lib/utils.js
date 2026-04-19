const fs = require("fs");

/* =========================
   ⏱ DELAY / SLEEP
========================= */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/* =========================
   🧠 SAFE JSON PARSER
========================= */
function safeJSON(data, fallback = {}) {
  try {
    return JSON.parse(data);
  } catch (e) {
    return fallback;
  }
}

/* =========================
   💬 EXTRACT TEXT FROM MESSAGE
========================= */
function getBody(msg) {
  if (!msg?.message) return "";

  const type = Object.keys(msg.message)[0];

  return (
    msg.message?.conversation ||
    msg.message?.[type]?.text ||
    msg.message?.[type]?.caption ||
    msg.message?.[type]?.conversation ||
    ""
  );
}

/* =========================
   📦 COMMAND PARSER
========================= */
function parseCommand(body, prefix = ".") {
  if (!body.startsWith(prefix)) {
    return null;
  }

  const args = body.slice(prefix.length).trim().split(/\s+/);
  const command = args.shift().toLowerCase();

  return { command, args };
}

/* =========================
   📱 SENDER EXTRACTOR
========================= */
function getSender(msg) {
  return msg.key.participant || msg.key.remoteJid;
}

/* =========================
   🧾 CLEAN TEXT (remove emojis/extra spaces)
========================= */
function cleanText(text = "") {
  return text
    .replace(/\s+/g, " ")
    .replace(/[\u{1F300}-\u{1FAFF}]/gu, "") // emojis
    .trim();
}

/* =========================
   📦 MEDIA DETECTOR
========================= */
function hasMedia(msg) {
  if (!msg?.message) return false;

  const type = Object.keys(msg.message)[0];

  return (
    type === "imageMessage" ||
    type === "videoMessage" ||
    type === "audioMessage" ||
    type === "documentMessage"
  );
}

/* =========================
   🔐 SAFE FUNCTION WRAPPER
========================= */
async function safeExec(fn, ...args) {
  try {
    return await fn(...args);
  } catch (e) {
    console.log("❌ Utils error:", e);
    return null;
  }
}

/* =========================
   🧠 FORMAT HELPERS
========================= */
function bold(text) {
  return `*${text}*`;
}

function italic(text) {
  return `_${text}_`;
}

function code(text) {
  return `\`\`\`${text}\`\`\``;
}

/* =========================
   📤 EXPORTS
========================= */
module.exports = {
  sleep,
  safeJSON,
  getBody,
  parseCommand,
  getSender,
  cleanText,
  hasMedia,
  safeExec,
  bold,
  italic,
  code
};
