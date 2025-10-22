import bcrypt from "bcrypt";
import { isValidObjectId } from "mongoose";
import { Auth } from "../models/auth.model.js";
import { Claims } from "../models/claims.model.js";
import { Invoice } from "../models/invoices.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { CustomError } from "../utils/customError.js";
import { sendMail } from "../utils/resendMail.js";
import {
  mailTemplateForNotifications,
  mailTemplateForNewUserCredentials,
} from "../utils/htmlPages.js";
import { getEnv } from "../configs/config.js";
import { sendToken } from "../utils/sendToken.js";

// Create Member
//-------------
const createMember = asyncHandler(async (req, res, next) => {
  const { name, email, phone, password, gender } = req.body;

  if (!name || !email || !phone || !password || !gender) {
    return next(new CustomError(400, "Please provide all required fields"));
  }

  const existingUser = await Auth.findOne({ email });
  if (existingUser?._id)
    return next(new CustomError(403, "Email already exists"));

  const newMember = await Auth.create({
    name,
    email,
    phone,
    password,
    gender,
    role: "member",
    lastLogin: new Date(),
    isDonor: false,
  });
  if (!newMember)
    return next(new CustomError(400, "Error while creating user"));

  // email notification pending for now

  await sendToken(res, next, newMember, 201, "Member created successfully");
});

// Get clients
//----------
const getClients = asyncHandler(async (req, res, next) => {
  const userId = req?.user?._id;
  if (!isValidObjectId(userId))
    return next(new CustomError(400, "Invalid User Id"));
  const user = await Auth.findById(userId);
  if (!user) return next(new CustomError(400, "User Not Found"));
  const clients = await Auth.find({ owner: userId, role: "client" })
    .sort({ createdAt: -1 })
    .lean();
  if (!clients && clients.length === 0) {
    return res.status(200).json({
      success: true,
      message: "No clients found",
      clients: [],
    });
  }
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);

  // Set Active Status false if client's last login is past 30 days otherwise true
  await Auth.updateMany(
    { owner: userId, role: "client", lastLogin: { $lt: thirtyDaysAgo } },
    { $set: { activeStatus: false } }
  );
  await Auth.updateMany(
    { owner: userId, role: "client", lastLogin: { $gte: thirtyDaysAgo } },
    { $set: { activeStatus: true } }
  );

  const counts = await Auth.aggregate([
    {
      $match: { owner: userId, role: "client" },
    },
    {
      $project: {
        isActive: {
          $cond: [
            { $gte: ["$lastLogin", thirtyDaysAgo] },
            "active",
            "inactive",
          ],
        },
      },
    },
    {
      $group: {
        _id: "$isActive",
        count: { $sum: 1 },
      },
    },
  ]);

  let activeClients = 0;
  let inactiveClients = 0;
  counts.forEach((c) => {
    if (c._id === "active") activeClients = c.count;
    if (c._id === "inactive") inactiveClients = c.count;
  });

  // Set Active Status false if user's last login is past 30 days otherwise true
  if (user.lastLogin && user.lastLogin < thirtyDaysAgo) {
    user.activeStatus = false;
  } else {
    user.activeStatus = true;
  }
  await user.save();

  return res.status(200).json({
    success: true,
    data: clients,
    clientCount: { activeClients, inactiveClients },
  });
});

// Delete client
//------------
const deleteClient = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  const clientId = req?.params?.id;

  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));
  if (!isValidObjectId(clientId))
    return next(new CustomError(400, "Invalid Client Id"));

  const user = await Auth.findById(ownerId);
  if (!user) return next(new CustomError(400, "User Not Found"));

  // Delete related data
  await Claims.deleteMany({ owner: clientId });
  await Invoice.deleteMany({ clientId: clientId });
  await Auth.deleteMany({ owner: clientId, role: "user" });

  // Delete Chats Against Every Claim Of the Client

  const claims = await Claims.find({ owner: clientId });
  claims.forEach(async (claim) => {
    await Chat.deleteMany({ claimId: claim._id });
  });

  // Delete client itself
  const client = await Auth.findOneAndDelete({ owner: ownerId, _id: clientId });
  if (!client) return next(new CustomError(400, "Client Not Found"));

  return res.status(200).json({
    success: true,
    message: "Client Deleted Successfully",
  });
});

// Update Client
//-----------------
const updateClient = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  const clientId = req?.params?.id;

  if (!isValidObjectId(ownerId)) {
    return next(new CustomError(400, "Invalid Owner Id"));
  }
  if (!isValidObjectId(clientId)) {
    return next(new CustomError(400, "Invalid Client Id"));
  }

  const user = await Auth.findById(ownerId);
  if (!user) return next(new CustomError(400, "User Not Found"));

  if (!req?.body) {
    return next(new CustomError(400, "Please provide fields to update"));
  }

  const {
    clientName,
    clientEmail,
    clientPhone,
    clientPassword,
    storeName,
    dealerId,
    address,
    storePhone,
    emails,
    accountOwner,
    businessOwner,
    businessOwnerView,
    percentage,
  } = req.body;

  // Prepare update object dynamically
  const updateData = {};
  if (clientName) updateData.name = clientName;
  if (clientEmail) updateData.email = clientEmail;
  if (clientPhone) updateData.phone = clientPhone;
  if (clientPassword)
    updateData.password = await bcrypt.hash(clientPassword, 10);

  if (storeName) updateData.storeName = storeName;
  if (dealerId) updateData.dealerId = dealerId;
  if (address) updateData.address = address;
  if (storePhone) updateData.storePhone = storePhone;
  if (emails) updateData.emails = emails;
  if (accountOwner) updateData.accountOwner = accountOwner;
  if (businessOwner) updateData.businessOwner = businessOwner;
  if (typeof businessOwnerView === "boolean")
    updateData.businessOwnerView = businessOwnerView;
  if (percentage !== undefined) updateData.percentage = percentage;

  const client = await Auth.findOneAndUpdate(
    { owner: ownerId, _id: clientId },
    updateData,
    { new: true }
  );

  if (!client) return next(new CustomError(400, "Client Not Found"));

  return res.status(200).json({
    success: true,
    message: "Client Updated Successfully",
    client,
  });
});

// Get Client Stats with Percentage
//-------------------------------
const getClientStats = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById(ownerId);
  if (!user) return next(new CustomError(400, "User Not Found"));

  const clients = await Auth.find({ owner: ownerId });
  if (!clients) return next(new CustomError(400, "Clients Not Found"));

  let totalClient7 = 0,
    totalClient30 = 0,
    totalClient90 = 0;
  let prevClient7 = 0,
    prevClient30 = 0,
    prevClient90 = 0;

  let totalActive7 = 0,
    totalActive30 = 0,
    totalActive90 = 0;
  let prevActive7 = 0,
    prevActive30 = 0,
    prevActive90 = 0;

  let totalInactive7 = 0,
    totalInactive30 = 0,
    totalInactive90 = 0;
  let prevInactive7 = 0,
    prevInactive30 = 0,
    prevInactive90 = 0;

  const today = new Date();

  clients.forEach((client) => {
    const createdDate = new Date(client.createdAt);
    const lastLoginDate = new Date(client.lastLogin);

    const diffCreatedDays = Math.ceil(
      Math.abs(today - createdDate) / (1000 * 60 * 60 * 24)
    );
    const diffLoginDays = Math.ceil(
      Math.abs(today - lastLoginDate) / (1000 * 60 * 60 * 24)
    );

    // --- client Counts ---
    if (diffCreatedDays <= 7) totalClient7++;
    else if (diffCreatedDays > 7 && diffCreatedDays <= 14) prevClient7++;

    if (diffCreatedDays <= 30) totalClient30++;
    else if (diffCreatedDays > 30 && diffCreatedDays <= 60) prevClient30++;

    if (diffCreatedDays <= 90) totalClient90++;
    else if (diffCreatedDays > 90 && diffCreatedDays <= 180) prevClient90++;

    // --- Active Counts ---
    if (diffLoginDays <= 7) totalActive7++;
    else if (diffLoginDays > 7 && diffLoginDays <= 14) prevActive7++;

    if (diffLoginDays <= 30) totalActive30++;
    else if (diffLoginDays > 30 && diffLoginDays <= 60) prevActive30++;

    if (diffLoginDays <= 90) totalActive90++;
    else if (diffLoginDays > 90 && diffLoginDays <= 180) prevActive90++;
  });

  // Calculate Inactive = Total - Active
  totalInactive7 = totalClient7 - totalActive7;
  totalInactive30 = totalClient30 - totalActive30;
  totalInactive90 = totalClient90 - totalActive90;

  prevInactive7 = prevClient7 - prevActive7;
  prevInactive30 = prevClient30 - prevActive30;
  prevInactive90 = prevClient90 - prevActive90;

  // Helper function to calculate %
  const calcPercent = (current, previous) => {
    if (previous === 0 && current > 0) return 100;
    if (previous === 0 && current === 0) return 0;
    return (((current - previous) / previous) * 100).toFixed(2);
  };

  return res.status(200).json({
    success: true,
    clientCount: {
      totalClient7,
      totalClient30,
      totalClient90,
      percentClient7: calcPercent(totalClient7, prevClient7),
      percentClient30: calcPercent(totalClient30, prevClient30),
      percentClient90: calcPercent(totalClient90, prevClient90),
    },
    activeCount: {
      totalActive7,
      totalActive30,
      totalActive90,
      percentActive7: calcPercent(totalActive7, prevActive7),
      percentActive30: calcPercent(totalActive30, prevActive30),
      percentActive90: calcPercent(totalActive90, prevActive90),
    },
    inactiveCount: {
      totalInactive7,
      totalInactive30,
      totalInactive90,
      percentInactive7: calcPercent(totalInactive7, prevInactive7),
      percentInactive30: calcPercent(totalInactive30, prevInactive30),
      percentInactive90: calcPercent(totalInactive90, prevInactive90),
    },
  });
});

// Total Clients Today, This Week, This Month With Percentage
// --------------------------------------------------------
const getClientsStatsByFilters = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;

  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));

  const owner = await Auth.findById(ownerId);
  if (!owner) return next(new CustomError(400, "User Not Found"));

  const now = new Date();

  // Dates
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 1
  );

  const thisWeekStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 7
  );
  const lastWeekStart = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - 14
  );

  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastMonthStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthEnd = new Date(now.getFullYear(), now.getMonth(), 0);

  // Counts
  const todayCount = await Auth.countDocuments({
    owner: ownerId,
    role: "client",
    createdAt: { $gte: todayStart },
  });

  const yesterdayCount = await Auth.countDocuments({
    owner: ownerId,
    role: "client",
    createdAt: { $gte: yesterdayStart, $lt: todayStart },
  });

  const thisWeekCount = await Auth.countDocuments({
    owner: ownerId,
    role: "client",
    createdAt: { $gte: thisWeekStart },
  });

  const lastWeekCount = await Auth.countDocuments({
    owner: ownerId,
    role: "client",
    createdAt: { $gte: lastWeekStart, $lt: thisWeekStart },
  });

  const thisMonthCount = await Auth.countDocuments({
    owner: ownerId,
    role: "client",
    createdAt: { $gte: thisMonthStart },
  });

  const lastMonthCount = await Auth.countDocuments({
    owner: ownerId,
    role: "client",
    createdAt: { $gte: lastMonthStart, $lte: lastMonthEnd },
  });

  // Percentage helper
  const calcChange = (current, prev) => {
    if (prev === 0) return current > 0 ? 100 : 0;
    return (((current - prev) / prev) * 100).toFixed(2);
  };

  return res.status(200).json({
    success: true,
    data: {
      today: {
        count: todayCount,
        prev: yesterdayCount,
        change: calcChange(todayCount, yesterdayCount),
      },
      thisWeek: {
        count: thisWeekCount,
        prev: lastWeekCount,
        change: calcChange(thisWeekCount, lastWeekCount),
      },
      thisMonth: {
        count: thisMonthCount,
        prev: lastMonthCount,
        change: calcChange(thisMonthCount, lastMonthCount),
      },
    },
  });
});

// Attendance Chart Data
// ---------------------
const getClientsActivityStats = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;

  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));

  const owner = await Auth.findById(ownerId);
  if (!owner) return next(new CustomError(400, "User Not Found"));

  const now = new Date();
  const startOfYear = new Date(now.getFullYear(), 0, 1);

  const stats = await Auth.aggregate([
    {
      $match: {
        lastLogin: { $gte: startOfYear },
        owner: ownerId,
        role: "client",
      },
    },
    {
      $project: {
        month: { $month: "$lastLogin" },
        isActive: { $eq: ["$activeStatus", true] },
      },
    },
    {
      $group: {
        _id: { month: "$month", status: "$isActive" },
        count: { $sum: 1 },
      },
    },
  ]);

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const result = months.map((month, index) => {
    const active =
      stats.find((s) => s._id.month === index + 1 && s._id.status === true)
        ?.count || 0;

    const inactive =
      stats.find((s) => s._id.month === index + 1 && s._id.status === false)
        ?.count || 0;

    return {
      month,
      Active: active,
      Inactive: inactive,
    };
  });

  res.status(200).json({
    success: true,
    data: result,
  });
});

export {
  createMember,
  getClients,
  deleteClient,
  updateClient,
  getClientStats,
  getClientsActivityStats,
  getClientsStatsByFilters,
};
