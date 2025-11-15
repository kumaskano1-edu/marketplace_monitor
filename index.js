const fs = require("fs");
const axios = require("axios");
const TelegramBot = require("node-telegram-bot-api");
const {Redis} = require("@upstash/redis")
const cron = require("node-cron");

// Telegram setup
const BOT_TOKEN = "8303035400:AAG4I6ScEoJucL06TZ_e5bLdARj5n1brHng";
const CHAT_ID = "5332581775";

const bot = new TelegramBot(BOT_TOKEN, { polling: false });
const redis = new Redis({
  url: 'https://champion-pup-54707.upstash.io',
  token: 'AdWzAAIncDE2MWEyOGQ4MzliMjA0OGIzODI0M2NmYmRlZDZmNGJlMHAxNTQ3MDc',
})

cron.schedule("0 0 * * 1", async () => {
  try {
    await redis.del("seenListings");
    console.log("Weekly reset: cleared seenListings.");
  } catch (err) {
    console.error("Redis reset failed:", err);
  }
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

// Main flow
(async () => {
  const tvs = await getTVs();
  await bot.sendMessage(CHAT_ID, "Tvs", {parse_mode: "Markdown"});
  for (const tv of tvs) {
    // Check if we've already seen this listing
    const alreadySeen = await redis.sismember("seenListings", tv.listingId);
    if (!alreadySeen) {
      await sendTVToTelegram(tv);
      await redis.sadd("seenListings", tv.listingId); // add to Redis set
    }
  }
  console.log(`Processed ${tvs.length} new TVs.`);
})();
