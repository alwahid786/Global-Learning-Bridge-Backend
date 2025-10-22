import { isValidObjectId } from "mongoose";
import { Notification } from "../models/notification.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { CustomError } from "../utils/customError.js";
import { Auth } from "../models/auth.model.js";

// Get Notifications
//----------------
const getNotifications = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById({ _id: ownerId });
  if (!user) return next(new CustomError(400, "User Not Found"));

  let notifications = [];

  if (user?.role === "admin") {
    notifications = await Notification.find({ owner: ownerId }).sort({
      createdAt: -1,
    });
  } else if (user?.role === "client") {
    notifications = await Notification.find({ clientId: ownerId }).sort({
      createdAt: -1,
    });
  }

  if (!notifications)
    return next(new CustomError(400, "Notifications Not Found"));

  let unReadCount = 0;

  for (let i = 0; i < notifications.length; i++) {
    if (!notifications[i].isRead) {
      unReadCount++;
    }
  }

  res.status(200).json({
    success: true,
    message: "Notifications Fetched Successfully",
    data: notifications,
    unReadCount,
  });
});

// Delete Notification
//-------------------
const deleteNotification = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById({ _id: ownerId });
  if (!user) return next(new CustomError(400, "User Not Found"));

  const notificationId = req?.params?.id;

  if (!isValidObjectId(notificationId))
    return next(new CustomError(400, "Invalid Notification Id"));

  const notification = await Notification.findByIdAndDelete(notificationId);

  if (!notification)
    return next(new CustomError(400, "Notification Not Found"));

  res.status(200).json({
    success: true,
    message: "Notification Deleted Successfully",
  });
});

// Read Notification
//------------------
const readNotification = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById({ _id: ownerId });
  if (!user) return next(new CustomError(400, "User Not Found"));

  const notificationId = req?.params?.id;

  if (!isValidObjectId(notificationId))
    return next(new CustomError(400, "Invalid Notification Id"));

  const notification = await Notification.findByIdAndUpdate(
    { _id: notificationId },
    { $set: { isRead: true, readAt: new Date() } },
    { new: true }
  );

  if (!notification)
    return next(new CustomError(400, "Notification Not Found"));

  res.status(200).json({
    success: true,
    message: "Notification Read Successfully",
  });
});

export { getNotifications, deleteNotification, readNotification };
