import { Chat } from "../models/chat.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { CustomError } from "../utils/customError.js";
import { isValidObjectId } from "mongoose";
import { Auth } from "../models/auth.model.js";
import { uploadOnCloudinary } from "../utils/cloudinary.js";
import { createNotification } from "../utils/createNotification.js";
import { Claims } from "../models/claims.model.js";

// Send Message + Create Notification
//-------------
const sendMessage = asyncHandler(async (req, res, next) => {
  const senderId = req?.body?.senderId;

  if (!isValidObjectId(senderId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById(senderId);
  if (!user) return next(new CustomError(400, "User Not Found"));

  const claimId = req?.body?.claimId;
  if (!isValidObjectId(claimId))
    return next(new CustomError(400, "Invalid User Id"));

  const receiver = await Claims.findById(claimId).populate("owner", "_id");
  if (!receiver) return next(new CustomError(400, "Claim Not Found"));

  const receiverId = receiver?.owner?._id;
  if (!isValidObjectId(receiverId))
    return next(new CustomError(400, "Invalid User Id"));

  const message = req?.body?.message;

  const content = message;

  let fileData = null;
  if (req.file) {
    const uploadedFile = await uploadOnCloudinary(req.file, "messages");
    if (!uploadedFile)
      return next(new CustomError(400, "Error while uploading file"));

    fileData = {
      filename: uploadedFile.original_filename,
      public_id: uploadedFile.public_id,
      url: uploadedFile.secure_url,
      format: uploadedFile.format,
      resource_type: uploadedFile.resource_type,
    };
  }

  const newMessage = await Chat.create({
    senderId,
    claimId,
    content,
    type: req.file ? "file" : "text",
    fileData,
  });

  // Create Notification
  let notification = null;

  if (req?.user?.role === "admin") {
    notification = await createNotification({
      owner: senderId,
      clientId: receiverId,
      claimId: claimId,
      title: `New Message From Admin ${user?.name} Company ${
        user?.companyName || user?.storeName
      }`,
      message: `Admin ${user?.name} Company ${
        user?.companyName || user?.storeName
      } has sent you a message against claim ${receiver?.roNumber}-${
        receiver?.roSuffix
      }.`,
    });
  } else if (req?.user?.role === "client") {
    notification = await createNotification({
      owner: user?.owner,
      clientId: senderId,
      claimId: claimId,
      title: `New Message From Client ${user?.name} Company ${
        user?.companyName || user?.storeName
      }`,
      message: `Client ${user?.name} Company ${
        user?.companyName || user?.storeName
      } has sent you a message against claim ${receiver?.roNumber}-${
        receiver?.roSuffix
      }.`,
    });
  } else if (req?.user?.role === "user") {
    notification = await createNotification({
      owner: senderId,
      clientId: receiverId,
      claimId: claimId,
      title: `New Message From User ${user?.name} Company ${
        user?.companyName || user?.storeName
      }`,
      message: `User ${user?.name} Company ${
        user?.companyName || user?.storeName
      } has sent you a message against claim ${receiver?.roNumber}-${
        receiver?.roSuffix
      }.`,
    });
  }
  if (!notification)
    return next(new CustomError(500, "Error while creating notification"));

  res.status(200).json({
    success: true,
    message: "Message Sent Successfully",
    data: newMessage,
  });
});

// Get Chat
//---------
const getChat = asyncHandler(async (req, res, next) => {
  const senderId = req?.user?._id;
  if (!isValidObjectId(senderId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById(senderId);
  if (!user) return next(new CustomError(400, "User Not Found"));

  const claimId = req?.params?.id;
  if (!isValidObjectId(claimId))
    return next(new CustomError(400, "Invalid User Id"));

  const chat = await Chat.find({ claimId }).sort({ createdAt: 1 });

  res.status(200).json({
    success: true,
    message: "Chat Fetched Successfully",
    data: chat,
  });
});

// Get Avg Response Time
//---------------------
const getAvgResponseTime = asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 5;

  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById(ownerId);
  if (!user) return next(new CustomError(400, "User Not Found"));

  const data = await Chat.aggregate([
    {
      $lookup: {
        from: "auths",
        localField: "senderId",
        foreignField: "_id",
        as: "sender",
      },
    },
    { $unwind: "$sender" },

    {
      $match: { "sender.role": "client", "sender.owner": ownerId },
    },
    {
      $group: {
        _id: "$sender._id",
        companyName: {
          $first: { $ifNull: ["$sender.companyName", "$sender.storeName"] },
        },
        avgResponseTime: { $avg: "$responseTime" },
      },
    },
    { $sort: { avgResponseTime: 1 } },
    { $limit: limit },
  ]);

  res.json(data);
});

// Get Avg Response Time All
//---------------------
const getAvgResponseTimeAll = async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 20;

  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById(ownerId);
  if (!user) return next(new CustomError(400, "User Not Found"));

  // Pipeline
  const basePipeline = [
    {
      $lookup: {
        from: "auths",
        localField: "senderId",
        foreignField: "_id",
        as: "sender",
      },
    },
    { $unwind: "$sender" },
    { $match: { "sender.role": "client", "sender.owner": ownerId } },
    {
      $group: {
        _id: "$sender._id",
        companyName: {
          $first: { $ifNull: ["$sender.companyName", "$sender.storeName"] },
        },
        avgResponseTime: { $avg: "$responseTime" },
      },
    },
  ];

  // total count
  const countResult = await Chat.aggregate([
    ...basePipeline,
    { $count: "total" },
  ]);
  const totalCount = countResult.length > 0 ? countResult[0].total : 0;

  // paginate data
  const data = await Chat.aggregate([
    ...basePipeline,
    { $sort: { avgResponseTime: 1 } },
    { $skip: (page - 1) * limit },
    { $limit: limit },
  ]);

  res.json({
    data,
    totalPages: Math.ceil(totalCount / limit),
    currentPage: page,
  });
};

export { sendMessage, getChat, getAvgResponseTime, getAvgResponseTimeAll };
