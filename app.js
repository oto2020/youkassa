require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const TelegramBot = require('node-telegram-bot-api');
const { createYouKassaPayment, handleYouKassaWebhook } = require('./controllers/youkassaController');
const { getPaidPayments, getPaymentByPaymentId } = require('./controllers/dbController');
const courses = require('./prices.json');

const groupId = -4218073723;

const app = express();
const port = process.env.PORT || 3000;
const bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });

app.use(bodyParser.json());

let paidCallbackData = null;

const getCoursesButtons = async (chatId) => {
  const paidPayments = await getPaidPayments(chatId);
  paidCallbackData = paidPayments.map(payment => payment.callbackData);

  return Object.keys(courses).map(course => {
    const buttons = courses[course].buttons.map(button => {
      const isPaid = paidCallbackData && paidCallbackData.includes(button.callback_data);
      const buttonText = isPaid ? `${button.text} ✅` : button.text;
      return {
        text: buttonText,
        callback_data: button.callback_data
      };
    });

    return {
      text: courses[course].title,
      callback_data: course,
      buttons: buttons
    };
  });
};

bot.onText(/\/start/, async (msg) => {
  if (msg.chat.type === 'private') {
    const chatId = msg.chat.id;
    bot.sendMessage(chatId, "Добро пожаловать! Выберите опцию ниже:");
    await showCourses(chatId);
  }
});

bot.onText(/\/pay/, async (msg) => {
  if (msg.chat.type === 'private') {
    const chatId = msg.chat.id;
    await showCourses(chatId);
  }
});

bot.on('message', async (msg) => {
  if (msg.chat.type === 'private') {
    const chatId = msg.chat.id;
    const text = msg.text;

    if (text === "🆘 Помощь") {
      bot.sendMessage(chatId, "Если у вас возникли вопросы или желание записаться на индивидуальное занятие, свяжитесь с нашим мастером https://t.me/Isupovsport", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Все курсы", callback_data: "all_courses" }]
          ]
        }
      });
    } else {
      await showCourses(chatId);
    }
  }
});

const showCourses = async (chatId) => {
  const coursesButtons = await getCoursesButtons(chatId);

  bot.sendMessage(chatId, "Выберите курс:", {
    reply_markup: {
      inline_keyboard: [
        ...coursesButtons.map(course => [course]),
        [{ text: "🆘 Помощь", callback_data: "help" }]
      ]
    }
  });
};

bot.on('callback_query', async (query) => {
  const chatId = query.message.chat.id;
  const callbackData = query.data;
  const [courseName, part, price] = callbackData.split('_');

  if (callbackData === "help") {
    bot.sendMessage(chatId, "Если у вас возникли вопросы или желание записаться на индивидуальное занятие, свяжитесь с нашим мастером https://t.me/Isupovsport", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Все курсы", callback_data: "all_courses" }]
        ]
      }
    });
  } else if (callbackData === "all_courses") {
    await showCourses(chatId);
  } else if (courses[courseName] && !part) {
    const buttons = courses[courseName].buttons.map(button => {
      const isPaid = paidCallbackData && paidCallbackData.includes(button.callback_data);
      const buttonText = isPaid ? `${button.text} ✅` : button.text;
      return [{
        text: buttonText,
        callback_data: button.callback_data
      }];
    });
    bot.sendMessage(chatId, `Вы выбрали курс "${courses[courseName].title}". Выберите часть курса:`, {
      reply_markup: {
        inline_keyboard: buttons
      }
    });
  } else if (courseName && part && price) {
    const selectedCourse = courses[courseName].buttons.find(item => item.callback_data === callbackData);
    const intermediateMessage = selectedCourse.intermediate_message;
    const successMessage = "Ваш платеж прошел успешно! \n" + selectedCourse.success_message;
    
    const isPaid = paidCallbackData && paidCallbackData.includes(callbackData);

    if (isPaid) {
      bot.sendMessage(chatId, successMessage);
    } else {
      bot.sendMessage(chatId, intermediateMessage).then(async () => {
        if (!part.includes("IntroductionFree")) {
          try {
            const confirmationUrl = await createYouKassaPayment(courseName, part, price, chatId, callbackData);
            bot.sendMessage(chatId, `Пожалуйста, совершите платеж по следующей ссылке: ${confirmationUrl}`);
          } catch (error) {
            bot.sendMessage(chatId, 'Ошибка при создании платежа.');
          }
        }
      });
    }
  } else if (callbackData === "Back") {
    await showCourses(chatId);
  }
});

app.post('/webhook', async (req, res) => {
  const event = req.body;

  console.log('Webhook received:', event);

  try {
    const payment = await handleYouKassaWebhook(event);
    if (payment && payment.count > 0) {
      const paymentRecord = await getPaymentByPaymentId(event.object.id);
      if (paymentRecord) {
        const chatId = paymentRecord.user.chatId;
        const callbackData = paymentRecord.callbackData;
        const [course, part, price] = callbackData.split('_');
        const selectedCourse = courses[course].buttons.find(item => item.callback_data === callbackData);
        const successMessage = "Ваш платеж прошел успешно! \n" + selectedCourse.success_message;

        bot.sendMessage(chatId, successMessage);
        bot.sendMessage(groupId, `Успешный платёж! ${course} ${part} на сумму ${price} рублей!`);
      }
    }
  } catch (error) {
    console.error('Error handling webhook:', error);
  }

  res.status(200).send('OK');
});

app.listen(port, () => {
  console.log(`Сервер запущен на порту ${port}\nБот https://t.me/isupovsport_bot`);
});
