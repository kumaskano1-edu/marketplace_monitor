const fs = require("fs");
const axios = require("axios");
const TelegramBot = require("node-telegram-bot-api");

// Telegram setup
const BOT_TOKEN = "8303035400:AAG4I6ScEoJucL06TZ_e5bLdARj5n1brHng";
const CHAT_ID = "5332581775";
const bot = new TelegramBot(BOT_TOKEN, { polling: false });

// File to store already sent listing IDs
const SEEN_FILE = "seen.json";

// Load seen listing IDs
function loadSeen() {
  if (!fs.existsSync(SEEN_FILE)) return [];
  const data = fs.readFileSync(SEEN_FILE, "utf-8");
  return JSON.parse(data);
}

// Save seen listing IDs
function saveSeen(seen) {
  fs.writeFileSync(SEEN_FILE, JSON.stringify(seen, null, 2));
}

// Fetch TVs
async function getTVs() {
  try {
    const res = await axios.get("https://web-production-26e3d.up.railway.app/offerup_posts");
    return res.data;
  } catch (err) {
    console.error("Error fetching TVs:", err.message);
    return [];
  }
}

// Send TV to Telegram
async function sendTVToTelegram(tv) {
  const text = `*${tv.title}*\nPrice: $${tv.price}\nLocation: ${tv.locationName}\n[View Listing](${tv.listingUrl})`;
  await bot.sendMessage(CHAT_ID, "Tvs", {parse_mode: "Markdown"});

  try {
    if (tv.image && tv.image.url) {
      await bot.sendPhoto(CHAT_ID, tv.image.url, { caption: text, parse_mode: "Markdown" });
    } else {
      await bot.sendMessage(CHAT_ID, text, { parse_mode: "Markdown" });
    }
    console.log(`Sent to Telegram: ${tv.title}`);
  } catch (err) {
    console.error("Error sending to Telegram:", err.message);
  }
}

// Main flow
(async () => {
  const seen = loadSeen();
  const tvs = await getTVs();

  const newTVs = tvs.filter(tv => !seen.includes(tv.listingId));

  for (const tv of newTVs) {
    await sendTVToTelegram(tv);
    seen.push(tv.listingId);
  }

  saveSeen(seen);

  console.log(`Processed ${newTVs.length} new TVs.`);
})();
