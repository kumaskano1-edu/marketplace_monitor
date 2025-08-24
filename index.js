const fs = require("fs");
const axios = require("axios");
const TelegramBot = require("node-telegram-bot-api");

// Telegram setup
const BOT_TOKEN = "8303035400:AAG4I6ScEoJucL06TZ_e5bLdARj5n1brHng";
const CHAT_ID = "5332581775";
const bot = new TelegramBot(BOT_TOKEN, { polling: false });

const redis = new Redis({
  url: process.env.REDIS_URL,
  token: process.env.REDIS_TOKEN,
});


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

(async () => {
  const tvs = await getTVs();

  await bot.sendMessage(CHAT_ID, "📺 New TV Listings:", { parse_mode: "Markdown" });

  for (const tv of tvs) {
    // Check if we've already seen this listing
    const alreadySeen = await redis.sismember("seenListings", tv.listingId);
    if (!alreadySeen) {
      await sendTVToTelegram(tv);
      await redis.sadd("seenListings", tv.listingId); // add to Redis set
    }
  }

  console.log("✅ Finished processing TV listings.");
})();

