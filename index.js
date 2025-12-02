const axios = require("axios");
const TelegramBot = require("node-telegram-bot-api");
const { Redis } = require("@upstash/redis");
const cron = require("node-cron");

// ------------------ CONFIG ---------------------
const BOT_TOKEN = "8303035400:AAG4I6ScEoJucL06TZ_e5bLdARj5n1brHng";
const CHAT_ID = "5332581775";

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const redis = new Redis({
  url: 'https://liked-condor-6414.upstash.io',
  token: 'AhkOAAIgcDIZZq1IoHDstdVvJTXkmCMk9PIdmQUne0uWtaG_4OPKcw',
})

// ------------------ COMMAND KEYBOARD ---------------------
const mainKeyboard = {
  reply_markup: {
    keyboard: [
      [{ text: "/start" }],
      [{ text: "/reset" }],
    ],
    resize_keyboard: true,
    one_time_keyboard: false,
  },
};

// ------------------ FETCH TVs ---------------------
async function getTVs() {
  try {
    const res = await axios.get(
      "https://web-production-26e3d.up.railway.app/offerup_posts"
    );
    return res.data;
  } catch (err) {
    console.error("Error fetching TVs:", err.message);
    return [];
  }
}

// ------------------ SEND TO TELEGRAM ---------------------
async function sendTVToTelegram(tv, chatId) {
  const text = `*${tv.title}*\nPrice: $${tv.price}\nLocation: ${tv.locationName}\n[View Listing](${tv.listingUrl})`;

  try {
    if (tv.image && tv.image.url) {
      await bot.sendPhoto(chatId, tv.image.url, {
        caption: text,
        parse_mode: "Markdown",
      });
    } else {
      await bot.sendMessage(chatId, text, {
        parse_mode: "Markdown",
      });
    }
  } catch (err) {
    console.error("Error sending to Telegram:", err.message);
  }
}

// ------------------ /start COMMAND ---------------------
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  await bot.sendMessage(chatId, "Fetching TVs... 📺", mainKeyboard);

  const tvs = await getTVs();

  if (!tvs || tvs.length === 0) {
    return bot.sendMessage(chatId, "No TVs found right now.", mainKeyboard);
  }

  for (const tv of tvs) {
    const seen = await redis.sismember("seenListings", tv.listingId);

    if (!seen) {
      await sendTVToTelegram(tv, chatId);
      await redis.sadd("seenListings", tv.listingId);
    }
  }

  await bot.sendMessage(chatId, "Done! 🚀", mainKeyboard);
});

// ------------------ /reset COMMAND ---------------------
bot.onText(/\/reset/, async (msg) => {
  await redis.del("seenListings");
  bot.sendMessage(msg.chat.id, "Memory cleared. I will resend all TVs next time.", mainKeyboard);
});

// --------------------------------------------------------
console.log("BOT IS RUNNING...");


// Run every hour at minute 0 from 9:00 to 18:00 Los Angeles time
