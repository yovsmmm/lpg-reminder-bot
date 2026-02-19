const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const http = require('http');

// ===== HTTP server (щоб Render не засинав) =====
const PORT = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain' });
  res.end('Bot is running');
}).listen(PORT);

// ===== Telegram Bot =====
const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

const DATA_FILE = 'data.json';

// ===== Data =====
let data = {
  reminders: {},   // chatId -> reminder
  history: {}      // chatId -> array
};

// Load data
if (fs.existsSync(DATA_FILE)) {
  try {
    data = JSON.parse(fs.readFileSync(DATA_FILE));
  } catch (e) {
    console.error('Failed to load data.json');
  }
}

// Save data
function saveData() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ===== Utils =====
function addWorkingDays(days) {
  let date = new Date();
  let added = 0;

  while (added < days) {
    date.setDate(date.getDate() + 1);
    const d = date.getDay(); // 0=Нд,1=Пн,2=Вт...
    if (d >= 2 && d <= 6) added++;
  }

  date.setHours(10, 0, 0, 0);
  return date.getTime();
}

// ===== /start =====
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "🤖 Сервіс-бот LPG\n\n" +
    "Бот для контролю заміни фільтра LPG.\n" +
    "Нагадує у робочі дні та веде журнал обслуговування обладнання.\n\n" +
    "Оберіть дію:",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Через 3 робочі дні", callback_data: "set_3" }],
          [{ text: "Через 10 робочих днів", callback_data: "set_10" }],
          [{ text: "Статус", callback_data: "status" }],
          [{ text: "Підтвердити заміну", callback_data: "confirm" }],
          [{ text: "Журнал замін", callback_data: "history" }]
        ]
      }
    }
  );
});

// ===== Buttons =====
bot.on('callback_query', (q) => {
  const chatId = q.message.chat.id;
  const action = q.data;

  if (!data.history[chatId]) data.history[chatId] = [];

  if (action.startsWith('set_')) {
    const days = parseInt(action.split('_')[1]);

    data.reminders[chatId] = {
      workingDays: days,
      nextReminder: addWorkingDays(days),
      sentToday: false
    };

    saveData();
    bot.sendMessage(chatId, `✅ Нагадування встановлено через ${days} робочі дні о 10:00.`);
  }

  if (action === 'status') {
    const r = data.reminders[chatId];
    if (!r) {
      bot.sendMessage(chatId, "⛔ Нагадування не встановлено.");
    } else {
      bot.sendMessage(chatId, `📅 Наступне нагадування:\n${new Date(r.nextReminder).toLocaleString()}`);
    }
  }

  if (action === 'confirm') {
    const now = new Date().toLocaleString();
    data.history[chatId].push(now);
    saveData();
    bot.sendMessage(chatId, "✅ Заміна фільтра підтверджена та записана в журнал.");
  }

  if (action === 'history') {
    const list = data.history[chatId];
    if (!list || list.length === 0) {
      bot.sendMessage(chatId, "📒 Журнал поки пустий.");
    } else {
      let text = "📒 Журнал замін:\n\n";
      list.slice(-20).forEach((d, i) => {
        text += `${i + 1}. ${d}\n`;
      });
      bot.sendMessage(chatId, text);
    }
  }

  bot.answerCallbackQuery(q.id);
});

// ===== Reminder loop =====
setInterval(() => {
  const now = new Date();

  for (const chatId in data.reminders) {
    const r = data.reminders[chatId];

    if (
      now.getTime() >= r.nextReminder &&
      now.getHours() === 10 &&
      !r.sentToday
    ) {
      bot.sendMessage(
        chatId,
        "⚠️ 10:00 Нагадування:\nЧас замінити фільтр LPG.\nПісля заміни натисніть «Підтвердити заміну»."
      );

      r.sentToday = true;
      r.nextReminder = addWorkingDays(r.workingDays);
      saveData();
    }

    if (now.getHours() >= 11) {
      r.sentToday = false;
    }
  }
}, 30000);

console.log("✅ LPG Service Bot running (Render Free friendly)");