// controllers/youkassaController.js

const YouKassa = require('yookassa');
const { createPayment, updatePaymentStatus } = require('./dbController');

const youkassa = new YouKassa({
    shopId: process.env.SHOP_ID,
    secretKey: process.env.SECRET_KEY
});

const createYouKassaPayment = async (courseName, part, price, chatId, callbackData) => {
    try {
        const payment = await youkassa.createPayment({
            amount: {
                value: price,
                currency: "RUB"
            },
            confirmation: {
                type: 'redirect',
                return_url: 'https://t.me/isupovsport_bot'
            },
            capture: true,
            description: `Платеж за ${courseName}, ${part}`
        });

        await createPayment({
            amount: parseFloat(price),
            currency: "RUB",
            status: "pending",
            course: courseName,
            part: part,
            chatId: chatId,
            description: `Платеж за ${courseName}, ${part}`,
            paymentId: payment.id,
            callbackData: callbackData  // Передаем новое поле
        });

        return payment.confirmation.confirmation_url;
    } catch (error) {
        console.error("Error creating YouKassa payment:", error);
        throw error;
    }
};

const handleYouKassaWebhook = async (event) => {
    console.log('handleYouKassaWebhook');
    console.log(event);
    console.log(event.event);
    const paymentId = event.object.id;

    if (event.event === 'payment.waiting_for_capture') {
        console.log('Платеж ожидает захвата:', paymentId);
    } else if (event.event === 'payment.succeeded') {
        console.log('Платеж успешен:', paymentId);
        const payment = await updatePaymentStatus(paymentId, 'succeeded');
        return payment;
    } else if (event.event === 'payment.canceled') {
        console.log('Платеж отменен:', paymentId);
        await updatePaymentStatus(paymentId, 'canceled');
    }
};

module.exports = {
    createYouKassaPayment,
    handleYouKassaWebhook
};
