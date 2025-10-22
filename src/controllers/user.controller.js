import bcrypt from "bcrypt";
import { isValidObjectId } from "mongoose";
import { Auth } from "../models/auth.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { CustomError } from "../utils/customError.js";
import { sendMail } from "../utils/resendMail.js";
import { mailTemplateForNewUserCredentials } from "../utils/htmlPages.js";
import { getEnv } from "../configs/config.js";

// Create User and send profile through email
//-----------
const createUser = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));
  const user = await Auth.findById(ownerId);
  if (!user) return next(new CustomError(400, "User Not Found"));
  if (!req?.body)
    return next(new CustomError(400, "Please provide all required fields"));
  const { name, email, phone, password } = req.body;
  if (!name || !email || !password) {
    return next(new CustomError(400, "Name, Email and Password are required"));
  }
  const existingUser = await Auth.findOne({ email });
  if (existingUser?._id)
    return next(new CustomError(403, "Email already exists"));
  const newUser = await Auth.create({
    owner: ownerId,
    name,
    email,
    phone,
    password,
    role: "user",
    lastLogin: new Date(),
  });
  if (!newUser) return next(new CustomError(400, "Error while creating user"));

  const htmlTemplate = mailTemplateForNewUserCredentials({
    message: "Hi there, your user account has been created using your email",
    receiverEmail: email,
    autoPassword: password,
    senderCompany: "National Warranty System",
    loginUrl: getEnv("LOGIN_URL"),
    logoUrl: getEnv("LOGO_URL_WITH_BACKGROUND"),
  });

  await sendMail(email, "Your Account Credentials", htmlTemplate, true);

  return res.status(200).json({
    success: true,
    message: "User Created Successfully",
    user: newUser,
  });
});

// Get Users
//----------
const getUsers = asyncHandler(async (req, res, next) => {
  const userId = req?.user?._id;
  if (!isValidObjectId(userId))
    return next(new CustomError(400, "Invalid User Id"));
  const users = await Auth.find({ owner: userId, role: "user" })
    .sort({ createdAt: -1 })
    .lean();
  if (!users) return next(new CustomError(400, "Users Not Found"));
  const now = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(now.getDate() - 30);

  // Set Active Status false if user's last login is past 30 days otherwise true
  await Auth.updateMany(
    { owner: userId, role: "user", lastLogin: { $lt: thirtyDaysAgo } },
    { $set: { activeStatus: false } }
  );
  await Auth.updateMany(
    { owner: userId, role: "user", lastLogin: { $gte: thirtyDaysAgo } },
    { $set: { activeStatus: true } }
  );

  const counts = await Auth.aggregate([
    {
      $match: { owner: userId, role: "user" },
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

  let activeUsers = 0;
  let inactiveUsers = 0;
  counts.forEach((c) => {
    if (c._id === "active") activeUsers = c.count;
    if (c._id === "inactive") inactiveUsers = c.count;
  });

  return res.status(200).json({
    success: true,
    data: users,
    userCount: { activeUsers, inactiveUsers },
  });
});

// Delete User
//------------
const deleteUser = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  const userId = req?.params?.id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));
  if (!isValidObjectId(userId))
    return next(new CustomError(400, "Invalid User Id"));
  const user = await Auth.findOneAndDelete({
    $and: [{ owner: ownerId }, { _id: userId }],
  });
  if (!user) return next(new CustomError(400, "User Not Found"));
  return res
    .status(200)
    .json({ success: true, message: "User Deleted Successfully" });
});

// Update User
//------------
const updateUser = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  const userId = req?.params?.id;
  const { name, email, phone, password } = req?.body;

  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid Owner Id"));

  if (!isValidObjectId(userId))
    return next(new CustomError(400, "Invalid User Id"));

  const updateData = { name, email, phone };

  if (password) {
    updateData.password = await bcrypt.hash(password, 10);
  }

  const user = await Auth.findOneAndUpdate(
    { owner: ownerId, _id: userId },
    updateData,
    { new: true }
  );

  if (!user) return next(new CustomError(400, "User Not Found"));

  return res
    .status(200)
    .json({ success: true, message: "User Updated Successfully", user });
});

// Get User Stats with Percentage
//-------------------------------
const getUserStats = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));

  const users = await Auth.find({ owner: ownerId, role: "user" });
  if (!users) return next(new CustomError(400, "Users Not Found"));

  let totalUser7 = 0,
    totalUser30 = 0,
    totalUser90 = 0;
  let prevUser7 = 0,
    prevUser30 = 0,
    prevUser90 = 0;

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

  users.forEach((user) => {
    const createdDate = new Date(user.createdAt);
    const lastLoginDate = new Date(user.lastLogin);

    const diffCreatedDays = Math.ceil(
      Math.abs(today - createdDate) / (1000 * 60 * 60 * 24)
    );
    const diffLoginDays = Math.ceil(
      Math.abs(today - lastLoginDate) / (1000 * 60 * 60 * 24)
    );

    // --- User Counts ---
    if (diffCreatedDays <= 7) totalUser7++;
    else if (diffCreatedDays > 7 && diffCreatedDays <= 14) prevUser7++;

    if (diffCreatedDays <= 30) totalUser30++;
    else if (diffCreatedDays > 30 && diffCreatedDays <= 60) prevUser30++;

    if (diffCreatedDays <= 90) totalUser90++;
    else if (diffCreatedDays > 90 && diffCreatedDays <= 180) prevUser90++;

    // --- Active Counts ---
    if (diffLoginDays <= 7) totalActive7++;
    else if (diffLoginDays > 7 && diffLoginDays <= 14) prevActive7++;

    if (diffLoginDays <= 30) totalActive30++;
    else if (diffLoginDays > 30 && diffLoginDays <= 60) prevActive30++;

    if (diffLoginDays <= 90) totalActive90++;
    else if (diffLoginDays > 90 && diffLoginDays <= 180) prevActive90++;
  });

  // Calculate Inactive = Total - Active
  totalInactive7 = totalUser7 - totalActive7;
  totalInactive30 = totalUser30 - totalActive30;
  totalInactive90 = totalUser90 - totalActive90;

  prevInactive7 = prevUser7 - prevActive7;
  prevInactive30 = prevUser30 - prevActive30;
  prevInactive90 = prevUser90 - prevActive90;

  // Helper function to calculate %
  const calcPercent = (current, previous) => {
    if (previous === 0 && current > 0) return 100;
    if (previous === 0 && current === 0) return 0;
    return (((current - previous) / previous) * 100).toFixed(2);
  };

  return res.status(200).json({
    success: true,
    userCount: {
      totalUser7,
      totalUser30,
      totalUser90,
      percentUser7: calcPercent(totalUser7, prevUser7),
      percentUser30: calcPercent(totalUser30, prevUser30),
      percentUser90: calcPercent(totalUser90, prevUser90),
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

// Total Users Today, This Week, This Month With Percentage
// --------------------------------------------------------
const getUserStatsByFilters = asyncHandler(async (req, res, next) => {
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
    role: "user",
    createdAt: { $gte: todayStart },
  });

  const yesterdayCount = await Auth.countDocuments({
    owner: ownerId,
    role: "user",
    createdAt: { $gte: yesterdayStart, $lt: todayStart },
  });

  const thisWeekCount = await Auth.countDocuments({
    owner: ownerId,
    role: "user",
    createdAt: { $gte: thisWeekStart },
  });

  const lastWeekCount = await Auth.countDocuments({
    owner: ownerId,
    role: "user",
    createdAt: { $gte: lastWeekStart, $lt: thisWeekStart },
  });

  const thisMonthCount = await Auth.countDocuments({
    owner: ownerId,
    role: "user",
    createdAt: { $gte: thisMonthStart },
  });

  const lastMonthCount = await Auth.countDocuments({
    owner: ownerId,
    role: "user",
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
const getUserActivityStats = asyncHandler(async (req, res, next) => {
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
        role: "user",
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
  createUser,
  getUsers,
  deleteUser,
  updateUser,
  getUserStats,
  getUserStatsByFilters,
  getUserActivityStats,
};
