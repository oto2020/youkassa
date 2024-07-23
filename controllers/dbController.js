// controllers/dbController.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const createPayment = async (data) => {
  try {
    const payment = await prisma.payment.create({
      data: {
        amount: data.amount,
        currency: data.currency,
        status: data.status,
        description: data.description,
        paymentId: data.paymentId,
        callbackData: data.callbackData,  // Добавлено новое поле
        user: {
          connectOrCreate: {
            where: { chatId: data.chatId },
            create: { chatId: data.chatId }
          }
        }
      }
    });
    return payment;
  } catch (error) {
    console.error("Error creating payment:", error);
    throw error;
  }
};

const updatePaymentStatus = async (paymentId, status) => {
  try {
    const payment = await prisma.payment.updateMany({
      where: { paymentId: paymentId, status: 'pending' },
      data: { status: status }
    });
    return payment;
  } catch (error) {
    console.error("Error updating payment status:", error);
    throw error;
  }
};

const getPaidPayments = async (chatId) => {
  try {
    const payments = await prisma.payment.findMany({
      where: {
        user: { chatId: chatId },
        status: 'succeeded'
      }
    });
    return payments;
  } catch (error) {
    console.error("Error fetching paid payments:", error);
    throw error;
  }
};

const getPaymentByPaymentId = async (paymentId) => {
  try {
    const payment = await prisma.payment.findUnique({
      where: { paymentId: paymentId },
      include: { user: true }
    });
    return payment;
  } catch (error) {
    console.error("Error fetching payment by paymentId:", error);
    throw error;
  }
};

module.exports = {
  createPayment,
  updatePaymentStatus,
  getPaidPayments,
  getPaymentByPaymentId
};
