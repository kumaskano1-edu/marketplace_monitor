const axios = require("axios");
const TelegramBot = require("node-telegram-bot-api");
const { Redis } = require("@upstash/redis");
const cron = require("node-cron");

// --------------------------------------------------------
// TOKENS
const BOT_TOKEN = "8303035400:AAG4I6ScEoJucL06TZ_e5bLdARj5n1brHng";
const CHAT_IDS = ["5332581775", "8235748647"];

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
// CORE LOGIC: check and send new TVs to all chat IDs
async function checkAndSendNewTVs() {
  const tvs = await getTVs();
  if (!tvs || tvs.length === 0) {
    console.log("No TVs found.");
    return 0;
  }

  let sentCount = 0;

  for (const tv of tvs) {
    let seen = false;

    try {
      seen = await redis.sismember("seenListings", tv.listingId);
    } catch (err) {
      console.error("Redis read error:", err.message);
    }

    if (!seen) {
      for (const chatId of CHAT_IDS) {
        await sendTVToTelegram(tv, chatId);
        await sleep(1200);
      }

      try {
        await redis.sadd("seenListings", tv.listingId);
        sentCount++;
      } catch (err) {
        console.error("Redis write error:", err.message);
      }
    }
  }

  return sentCount;
}

// --------------------------------------------------------
// /start COMMAND
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  await bot.sendMessage(chatId, "Fetching TVs... 📺", mainKeyboard);

  const sentCount = await checkAndSendNewTVs();

  if (sentCount === 0) {
    await bot.sendMessage(chatId, "No new TVs found right now.", mainKeyboard);
  } else {
    await bot.sendMessage(chatId, `Done! Sent ${sentCount} new listing(s). 🚀`, mainKeyboard);
  }
});

// --------------------------------------------------------
// /reset COMMAND
bot.onText(/\/reset/, async (msg) => {
  try {
    await redis.del("seenListings");
    bot.sendMessage(
      msg.chat.id,
      "Memory cleared. I will resend all TVs next time. ✅",
      mainKeyboard
    );
  } catch (err) {
    console.error("Redis delete error:", err.message);
    bot.sendMessage(msg.chat.id, "Failed to clear memory. Try again.", mainKeyboard);
  }
});

// --------------------------------------------------------
// CRON: every 30 min from 8am to 8pm LA time
cron.schedule(
  "*/30 8-20 * * *",
  async () => {
    console.log("⏰ Running 30-min TV check (LA time)...");
    const sentCount = await checkAndSendNewTVs();
    console.log(`✅ Cycle finished. Sent ${sentCount} new listing(s).`);
  },
  {
    scheduled: true,
    timezone: "America/Los_Angeles",
  }
);

console.log("BOT IS RUNNING...");
