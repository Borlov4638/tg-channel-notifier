require("dotenv").config();
const axios = require("axios");
const cheerio = require("cheerio");

const CHANNEL_USERNAME = process.env.CHANNEL_USERNAME;
const KEYWORDS = process.env.KEYWORD.split(",");
const CHECK_INTERVAL = process.env.CHECK_INTERVAL || 10000;
const BOT_TOKEN = process.env.BOT_TOKEN;
const USER_IDS = process.env.USER_IDS.split(",");

// Загружаем lastMessageId из файла (если существует)
let lastMessageId = null;

// Функция для проверки новых сообщений
async function checkChannelMessages() {
  try {
    const url = `https://t.me/s/${CHANNEL_USERNAME}`;
    const response = await axios.get(url);

    // Парсим HTML страницы
    const $ = cheerio.load(response.data);
    const messages = [];

    // Ищем сообщения на странице
    $(".tgme_widget_message").each((i, element) => {
      const messageId = $(element).attr("data-post");
      const messageText = $(element)
        .find(".tgme_widget_message_text")
        .text()
        .trim();
      const messageDate = $(element)
        .find(".tgme_widget_message_date time")
        .attr("datetime"); // Дата отправки

      // Добавляем сообщение и дату в массив
      messages.push({ messageId, messageText, messageDate });
    });

    // Обрабатываем только новые сообщения
    let newLastMessageId = messages[messages.length - 1].messageId;

    for (const message of messages.reverse()) {
      if (message.messageId === lastMessageId) break;

      console.log(`Новое сообщение: ${message.messageText}`);
      const containsKeyword = KEYWORDS.some((keyword) => {
        if (message.messageText.toLowerCase().includes(keyword)) {
          console.log(`🔔 Найдено ключевое слово: "${keyword}"`);
          return true;
        }
        return false;
      });

      if (containsKeyword) {
        const formattedMessage = formatMessage(
          message.messageText,
          message.messageDate
        );
        notifyUsers(formattedMessage);
      }
    }

    // Если были новые сообщения, сохраняем новый lastMessageId
    if (newLastMessageId !== lastMessageId) {
      lastMessageId = newLastMessageId;
    }
  } catch (error) {
    console.error("Ошибка при загрузке канала:", error.message);
  }
}

// Функция для форматирования сообщения с датой
function formatMessage(messageText, messageDate) {
  const date = new Date(messageDate); // Преобразуем строку даты в объект Date
  const formattedDate = date.toLocaleString("ru-RU", {
    weekday: "long", // день недели
    year: "numeric", // год
    month: "long", // месяц
    day: "numeric", // день
    hour: "numeric", // часы
    minute: "numeric", // минуты
    second: "numeric", // секунды
  });

  return `${messageText}\n\nДата публикации: ${formattedDate}`;
}

// Функция для отправки сообщения одному пользователю
async function sendMessage(userId, text) {
  const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;

  try {
    await axios.post(url, {
      chat_id: userId,
      text: text,
    });
    console.log(`Сообщение отправлено пользователю ${userId}`);
  } catch (error) {
    console.error(
      `Ошибка при отправке сообщения пользователю ${userId}:`,
      error.response?.data || error.message
    );
  }
}

// Функция для отправки сообщений списку пользователей
async function notifyUsers(messageText) {
  for (const userId of USER_IDS) {
    await sendMessage(userId, messageText);
  }
}

// Периодически проверяем канал
setInterval(checkChannelMessages, CHECK_INTERVAL);
