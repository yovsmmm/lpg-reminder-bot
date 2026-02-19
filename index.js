const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

let reminders = {};

// Додаємо робочі дні (Вт–Сб)
function addWorkingDays(days) {
  let date = new Date();
  let added = 0;

  while (added < days) {
    date.setDate(date.getDate() + 1);
    let day = date.getDay(); // 0=Нд, 1=Пн, 2=Вт ... 6=Сб

    if (day >= 2 && day <= 6) {
      added++;
    }
  }

  date.setHours(10, 0, 0, 0); // 10:00

  return date.getTime();
}

// Головне меню з кнопками
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "🤖 Нагадування заміни фільтра LPG\n\nОберіть інтервал:",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Через 3 робочі дні", callback_data: "set_3" }],
          [{ text: "Через 10 робочих днів", callback_data: "set_10" }],
          [{ text: "Статус", callback_data: "status" }],
          [{ text: "Скинути", callback_data: "reset" }]
        ]
      }
    }
  );
});

// Обробка кнопок
bot.on("callback_query", (query) => {
  const chatId = query.message.chat.id;
  const data = query.data;

  if (data.startsWith("set_")) {
    const days = parseInt(data.split("_")[1]);

    reminders[chatId] = {
      workingDays: days,
      nextReminder: addWorkingDays(days),
      sentToday: false
    };

    bot.sendMessage(chatId, `✅ Нагадування встановлено через ${days} робочі дні о 10:00.`);
  }

  if (data === "status") {
    if (!reminders[chatId]) {
      bot.sendMessage(chatId, "⛔ Нагадування не встановлено.");
    } else {
      const date = new Date(reminders[chatId].nextReminder);
      bot.sendMessage(chatId, `📅 Наступне нагадування:\n${date.toLocaleString()}`);
    }
  }

  if (data === "reset") {
    delete reminders[chatId];
    bot.sendMessage(chatId, "🔄 Нагадування скинуто.");
  }

  bot.answerCallbackQuery(query.id);
});

// Перевірка кожні 30 секунд
setInterval(() => {
  const now = new Date();

  for (let chatId in reminders) {
    let reminder = reminders[chatId];

    if (
      now.getTime() >= reminder.nextReminder &&
      now.getHours() === 10 &&
      !reminder.sentToday
    ) {
      bot.sendMessage(
        chatId,
        "⚠️ Нагадування (10:00):\nЧас замінити фільтр LPG."
      );

      reminder.sentToday = true;
      reminder.nextReminder = addWorkingDays(reminder.workingDays);
    }

    if (now.getHours() >= 11) {
      reminder.sentToday = false;
    }
  }

}, 30000);

console.log("Bot running with inline buttons...");