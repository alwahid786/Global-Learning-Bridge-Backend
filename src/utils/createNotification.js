import { Notification } from "../models/notification.model.js";

export const createNotification = async ({
  owner,
  clientId,
  claimId,
  invoiceNumber,
  title,
  message,
}) => {
  try {
    const notification = await Notification.create({
      owner,
      clientId,
      claimId,
      invoiceNumber,
      title,
      message,
    });
    return notification;
  } catch (error) {
    console.error("Error creating notification:", error.message);
    throw error;
  }
};
