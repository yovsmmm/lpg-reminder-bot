const TelegramBot = require('node-telegram-bot-api');

const token = process.env.BOT_TOKEN;
const bot = new TelegramBot(token, { polling: true });

let reminders = {};

// Функція додавання робочих днів (Вт–Сб)
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

  // Встановлюємо час 10:00
  date.setHours(10, 0, 0, 0);

  return date.getTime();
}

// Команда старт
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(
    msg.chat.id,
    "🤖 Нагадування заміни фільтра LPG\n\n" +
    "Рахує робочі дні (Вт–Сб)\n" +
    "Нагадування о 10:00\n\n" +
    "Команди:\n" +
    "/set 10 — через 10 робочих днів\n" +
    "/status — перевірити дату\n" +
    "/reset — скинути"
  );
});

// Встановити нагадування
bot.onText(/\/set (\d+)/, (msg, match) => {
  const chatId = msg.chat.id;
  const workingDays = parseInt(match[1]);

  const nextReminder = addWorkingDays(workingDays);

  reminders[chatId] = {
    workingDays: workingDays,
    nextReminder: nextReminder,
    sentToday: false
  };

  bot.sendMessage(
    chatId,
    `✅ Нагадування встановлено через ${workingDays} робочих днів о 10:00.`
  );
});

// Статус
bot.onText(/\/status/, (msg) => {
  const chatId = msg.chat.id;

  if (!reminders[chatId]) {
    bot.sendMessage(chatId, "⛔ Нагадування не встановлено.");
    return;
  }

  const date = new Date(reminders[chatId].nextReminder);
  bot.sendMessage(chatId, `📅 Наступне нагадування:\n${date.toLocaleString()}`);
});

// Скинути
bot.onText(/\/reset/, (msg) => {
  const chatId = msg.chat.id;
  delete reminders[chatId];
  bot.sendMessage(chatId, "🔄 Нагадування скинуто.");
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
        "⚠️ Нагадування (10:00):\nЧас замінити фільтр LPG.\nПісля заміни введіть /set 10"
      );

      reminder.sentToday = true;

      // Плануємо наступне нагадування
      reminder.nextReminder = addWorkingDays(reminder.workingDays);
    }

    // Скидаємо прапор після 11:00
    if (now.getHours() >= 11) {
      reminder.sentToday = false;
    }
  }

}, 30000);

console.log("Bot running with working days logic at 10:00...");
