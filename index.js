const axios = require("axios");
const TelegramBot = require("node-telegram-bot-api");
const { Redis } = require("@upstash/redis");
const cron = require("node-cron");

// --------------------------------------------------------
// TOKENS (you provided — test tokens)
const BOT_TOKEN = "8303035400:AAG4I6ScEoJucL06TZ_e5bLdARj5n1brHng";
const CHAT_ID = "5332581775";

const redis = new Redis({
  url: "https://liked-condor-6414.upstash.io",
  token: "ARkOAAImcDI3OGI0ZDg3N2M1OTQ0YWU5YTYyY2IxNGQ5MTgzNjI4YnAyNjQxNA",
});

// --------------------------------------------------------
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const mainKeyboard = {
  reply_markup: {
    keyboard: [[{ text: "/start" }], [{ text: "/reset" }]],
    resize_keyboard: true,
    one_time_keyboard: false,
  },
};

// --------------------------------------------------------
// HELPER: sleep between messages (Telegram anti-spam)
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --------------------------------------------------------
// HELPER: safe sending with retry
async function safeSend(fn) {
  try {
    return await fn();
  } catch (err) {
    console.error("Telegram send failed:", err.message);

    // retry once after delay
    await sleep(1500);
    try {
      return await fn();
    } catch (err2) {
      console.error("Retry failed:", err2.message);
    }
  }
}

// --------------------------------------------------------
// FETCH TVs
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

// --------------------------------------------------------
// SEND TV TO TELEGRAM
async function sendTVToTelegram(tv, chatId) {
  const text = `*${tv.title}*\nPrice: $${tv.price}\nLocation: ${tv.locationName}\n[View Listing](${tv.listingUrl})`;

  try {
    if (tv.image && tv.image.url) {
      await safeSend(() =>
        bot.sendPhoto(chatId, tv.image.url, {
          caption: text,
          parse_mode: "Markdown",
        })
      );
    } else {
      await safeSend(() =>
        bot.sendMessage(chatId, text, {
          parse_mode: "Markdown",
        })
      );
    }
  } catch (err) {
    console.error("Send error:", err.message);
  }
}

// --------------------------------------------------------
// /start COMMAND
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  await bot.sendMessage(chatId, "Fetching TVs... 📺", mainKeyboard);

  const tvs = await getTVs();

  if (!tvs || tvs.length === 0) {
    return bot.sendMessage(chatId, "No TVs found right now.", mainKeyboard);
  }

  for (const tv of tvs) {
    let seen = false;

    // Check Redis safely
    try {
      seen = await redis.sismember("seenListings", tv.listingId);
    } catch (err) {
      console.error("Redis read error:", err.message);
    }

    if (!seen) {
      await sendTVToTelegram(tv, chatId);

      // Save to Redis safely
      try {
        await redis.sadd("seenListings", tv.listingId);
      } catch (err) {
        console.error("Redis write error:", err.message);
      }

      // Telegram safe delay
      await sleep(1200);
    }
  }

  await bot.sendMessage(chatId, "Done! 🚀", mainKeyboard);
});

// --------------------------------------------------------
// /reset COMMAND
bot.onText(/\/reset/, async (msg) => {
  try {
    await redis.del("seenListings");
  } catch (err) {
    console.error("Redis delete error:", err.message);
  }

  bot.sendMessage(
    msg.chat.id,
    "Memory cleared. I will resend all TVs next time.",
    mainKeyboard
  );
});

// --------------------------------------------------------
console.log("BOT IS RUNNING...");
