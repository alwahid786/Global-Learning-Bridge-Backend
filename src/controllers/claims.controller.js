import { Claims } from "../models/claims.model.js";
import { Counter } from "../models/counter.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { CustomError } from "../utils/customError.js";
import { Auth } from "../models/auth.model.js";
import { isValidObjectId } from "mongoose";
import { Invoice } from "../models/invoices.model.js";
import { Chat } from "../models/chat.model.js";
import { createNotification } from "../utils/createNotification.js";
import { Parser } from "json2csv";
import { sendMail } from "../utils/resendMail.js";
import {
  mailTemplateForNotifications,
  receiptMailTemplate,
} from "../utils/htmlPages.js";
import Payment from "../models/payment.model.js";
import { generateReceiptPDF } from "../utils/pdfGenerator.js";

// Create Claims + Create Notification + send email notification
//--------------
const createClaims = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById(ownerId);
  if (!user) return next(new CustomError(400, "User Not Found"));

  if (!req?.csvData || req.csvData.length === 0 || !Array.isArray(req.csvData))
    return next(new CustomError(400, "Please Provide Claims Data"));

  const headerMap = {
    "RO number": "roNumber",
    "RO suffix": "roSuffix",
    "RO date": "roDate",
    Job: "jobNumber",
    "#": "jobNumber",
    quoted: "quoted",
    Status: "status",
    "Ent Date": "entryDate",
    "Error description": "errorDescription",
  };

  const claims = req.csvData.map((item) => {
    const normalized = {};
    for (const key in item) {
      const cleanKey = headerMap[key.trim()];
      if (cleanKey) {
        normalized[cleanKey] = item[key];
      }
    }
    return {
      owner: ownerId,
      ...normalized,
    };
  });

  try {
    const savedClaims = await Claims.insertMany(claims, {
      ordered: false,
    });

    let makeNotification = null;

    // Notification for Client
    if (user?.role === "client") {
      makeNotification = await createNotification({
        owner: user?.owner,
        clientId: user?._id,
        title: `Claims Created By Client ${user?.name} Company ${
          user?.companyName || user?.storeName
        }`,
        message: `Client ${user?.name} Company ${
          user?.companyName || user?.storeName
        } has created ${savedClaims.length} new claims.`,
      });
    } else if (user?.role === "user") {
      makeNotification = await createNotification({
        owner: user?.owner,
        clientId: user?._id,
        title: `Claims Created By User ${user?.name} Company ${
          user?.companyName || user?.storeName
        }`,
        message: `User ${user?.name} Company ${
          user?.companyName || user?.storeName
        } has created ${savedClaims.length} new claims.`,
      });
    } else if (user?.role === "admin") {
      makeNotification = await createNotification({
        owner: user?.owner,
        clientId: user?._id,
        title: `Claims Created By Admin ${user?.name} Company ${
          user?.companyName || user?.storeName
        }`,
        message: `Admin ${user?.name} Company ${
          user?.companyName || user?.storeName
        } has created ${savedClaims.length} new claims.`,
      });
    }

    if (!makeNotification) {
      return next(new CustomError(500, "Error while creating notification"));
    }

    // Send Email Notification
    //-----------------------
    const emails = user?.emails;
    const clientName = user?.name;
    const storeName = user?.companyName || user?.storeName;

    const subject = "New Claims Created Notification";
    const message = `${savedClaims.length} new claims have been created for Client ${clientName} Company ${storeName}.`;

    const templateData = {
      clientName: clientName,
      message: message,
      clientCompany: storeName,
      senderCompany: user?.companyName || user?.storeName,
    };

    const templatePage = mailTemplateForNotifications(templateData);

    if (Array.isArray(emails) && emails.length > 0) {
      emails.forEach((email) => {
        sendMail(email, subject, `${templatePage}`, true).catch((err) =>
          console.error("Email sending failed:", err.message)
        );
      });
    }

    return res.status(201).json({
      success: true,
      message: `${savedClaims.length} Claims Created Successfully`,
      data: savedClaims,
    });
  } catch (err) {
    if (err.code === 11000) {
      return next(
        new CustomError(409, "Some claims already exist, others were created")
      );
    }
    console.error("Claim Insert Error:", err);
    return next(new CustomError(500, "Error while creating claims"));
  }
});

// Export Claims
//--------------
const exportClaims = asyncHandler(async (req, res, next) => {
  const userId = req?.user?._id;
  if (!isValidObjectId(userId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById(userId);
  if (!user) return next(new CustomError(400, "User Not Found"));

  let claims = [];

  if (user.role === "admin") {
    const adminClaims = await Claims.find({
      owner: userId,
      archived: false,
    }).lean();

    const clients = await Auth.find({ owner: userId, role: "client" }).select(
      "_id"
    );
    const clientIds = clients.map((c) => c._id);

    let clientClaims = [];
    if (clientIds.length > 0) {
      clientClaims = await Claims.find({
        owner: { $in: clientIds },
        archived: false,
      }).lean();
    }

    claims = [...adminClaims, ...clientClaims];
  } else if (user.role === "client") {
    claims = await Claims.find({
      owner: userId,
      archived: false,
    }).lean();
  } else {
    return next(new CustomError(403, "Not authorized"));
  }

  if (!claims || claims.length === 0)
    return next(new CustomError(400, "No claims found to export"));

  const fields = [
    { label: "RO number", value: "roNumber" },
    { label: "RO suffix", value: "roSuffix" },
    { label: "RO date", value: "roDate" },
    { label: "Job#", value: "jobNumber" },
    { label: "Quoted", value: "quoted" },
    { label: "Status", value: "status" },
    { label: "Ent Date", value: "entryDate" },
    { label: "Error description", value: "errorDescription" },
  ];

  const parser = new Parser({ fields });
  const csv = parser.parse(claims);

  res.setHeader("Content-Type", "text/csv");
  res.attachment("claims_export.csv");
  res.send(csv);
});

// Get Claims
//----------
const getClaims = asyncHandler(async (req, res, next) => {
  const userId = req?.user?._id;
  if (!isValidObjectId(userId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById(userId);
  if (!user) return next(new CustomError(400, "User Not Found"));

  let claims = [];

  if (user?.role === "admin") {
    const adminClaims = await Claims.find({
      owner: userId,
      archived: false,
    });

    const clients = await Auth.find({ owner: userId, role: "client" }).select(
      "_id"
    );
    const clientIds = clients.map((c) => c._id);

    let clientClaims = [];
    if (clientIds.length > 0) {
      clientClaims = await Claims.find({
        owner: { $in: clientIds },
        archived: false,
      });
    }

    claims = [...adminClaims, ...clientClaims];
  } else if (user?.role === "client") {
    claims = await Claims.find({
      owner: userId,
      archived: false,
    });
  } else {
    return next(new CustomError(403, "Not authorized"));
  }

  res.status(200).json({
    success: true,
    message: "Claims fetched successfully",
    data: claims,
  });
});

// Update Claims status + Create Notification + send email notification
//--------------------------------------------------
const updateClaim = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById(ownerId);
  if (!user) return next(new CustomError(400, "User Not Found"));

  const claimId = req?.params?.id;

  if (!isValidObjectId(claimId))
    return next(new CustomError(400, "Invalid Claim Id"));

  const claimData = req?.body;
  if (!claimData)
    return next(new CustomError(400, "Please Provide Claim Data"));

  const updatedClaim = await Claims.findOneAndUpdate(
    { _id: claimId },
    { $set: { status: claimData?.status } }
  );

  if (!updatedClaim) return next(new CustomError(400, "Claim Not Updated"));

  const claim = await Claims.findById(claimId).lean();

  if (!claim) return next(new CustomError(400, "Claim Not Found"));

  let notification = null;

  if (user?.role === "client") {
    notification = await createNotification({
      owner: user?.owner,
      clientId: user?._id,
      title: "Claim Updated By Client",
      message: `Claim ${claim?.roNumber} - ${claim?.roSuffix} has been updated to ${claim?.status}.`,
    });
  } else if (user?.role === "admin") {
    notification = await createNotification({
      owner: user?._id,
      clientId: claim?.owner,
      title: "Claim Updated By Admin",
      message: `Claim ${claim?.roNumber} - ${claim?.roSuffix} has been updated to ${claim?.status}.`,
    });
  } else if (user?.role === "user") {
    notification = await createNotification({
      owner: user?._id,
      clientId: claim?.owner,
      title: "Claim Updated By User",
      message: `Claim ${claim?.roNumber} - ${claim?.roSuffix} has been updated to ${claim?.status}.`,
    });
  }

  if (!notification)
    return next(new CustomError(400, "Notification Not Created"));

  // Send Email Notification
  //-----------------------
  const clientData = await Auth.findById(claim?.owner);
  const emails = clientData?.emails;
  const clientName = clientData?.name;
  const storeName = clientData?.companyName || clientData?.storeName;

  const subject = "Claim Updated Notification";
  const message = `Claim ${claim?.roNumber} - ${claim?.roSuffix} has been updated to ${claim?.status} for Client ${clientName} Company ${storeName}.`;

  const templateData = {
    clientName: clientName,
    message: message,
    clientCompany: storeName,
    senderCompany: user?.companyName || user?.storeName,
  };

  const templatePage = mailTemplateForNotifications(templateData);

  if (Array.isArray(emails) && emails.length > 0) {
    emails.forEach((email) => {
      sendMail(email, subject, `${templatePage}`, true).catch((err) =>
        console.error("Email sending failed:", err.message)
      );
    });
  }

  return res.status(200).json({
    success: true,
    message: "Claim Updated Successfully",
  });
});

// Update Claim's additional data
//-------------------------------
const updateClaimAdditionalData = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById(ownerId);
  if (!user) return next(new CustomError(404, "User Not Found"));

  const claimId = req?.params?.id;
  if (!isValidObjectId(claimId))
    return next(new CustomError(400, "Invalid Claim Id"));

  const updatedData = req?.body?.claimData || req?.body;
  if (!updatedData || Object.keys(updatedData).length === 0) {
    return next(new CustomError(400, "No Claim Data Provided"));
  }

  console.log("Updating Claim:", claimId, "with data:", updatedData);

  const {
    roNumber,
    roSuffix,
    roDate,
    jobNumber,
    quoted,
    status,
    entryDate,
    errorDescription,
    additionalInfo,
    internalNotes,
  } = updatedData;

  if (
    !roNumber ||
    !roSuffix ||
    !roDate ||
    !quoted ||
    !status ||
    !entryDate ||
    !errorDescription
  ) {
    return next(new CustomError(400, "All required fields must be provided"));
  }

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US");
  };

  const updatedClaim = await Claims.findByIdAndUpdate(
    claimId,
    {
      $set: {
        roNumber,
        roSuffix,
        roDate: formatDate(roDate),
        jobNumber,
        quoted,
        status,
        entryDate: formatDate(entryDate),
        errorDescription,
        additionalInfo,
        internalNotes,
      },
    },
    { new: true, runValidators: true }
  );

  if (!updatedClaim) return next(new CustomError(404, "Claim Not Found"));

  return res.status(200).json({
    success: true,
    message: "Claim Updated Successfully",
    data: updatedClaim,
  });
});

// Delete Claim + Notification
//-------------
const deleteClaim = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById(ownerId);
  if (!user) return next(new CustomError(400, "User Not Found"));

  const claimId = req?.params?.id;
  if (!isValidObjectId(claimId))
    return next(new CustomError(400, "Invalid Claim Id"));

  // First Delete Chats Against That Claim

  const chats = await Chat.find({ claimId: claimId });
  if (chats && chats.length > 0) {
    await Chat.deleteMany({ claimId: claimId });
  }

  const claim = await Claims.findByIdAndDelete(claimId).populate("owner");
  if (!claim) return next(new CustomError(400, "Claim Not Found"));

  let notification = null;
  if (req?.user?.role === "admin") {
    notification = await createNotification({
      owner: user?._id,
      clientId: claim?.owner?._id,
      claimId: claim?._id,
      title: "Claim Deleted By Admin",
      message: `Claim ${claim?.roNumber} - ${claim?.roSuffix} has been deleted by admin.`,
    });
  } else if (req?.user?.role === "client") {
    notification = await createNotification({
      owner: user?.owner,
      clientId: user?._id,
      claimId: claim?._id,
      title: "Claim Deleted By Client",
      message: `Claim ${claim?.roNumber} - ${claim?.roSuffix} has been deleted by Client.`,
    });
  } else if (req?.user?.role === "user") {
    notification = await createNotification({
      owner: user?._id,
      clientId: claim?.owner?._id,
      claimId: claim?._id,
      title: "Claim Deleted By User",
      message: `Claim ${claim?.roNumber} - ${claim?.roSuffix} has been deleted by User.`,
    });
  }

  if (!notification)
    return next(new CustomError(500, "Error while creating notification"));

  return res
    .status(200)
    .json({ success: true, message: "Claim Deleted Successfully" });
});

//
//
//
//
//
//
//

// Create Archieve Claims + Create Notification For Archieve Claims
//---------------------------------------------------------------
const createArchieveClaims = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById({ _id: ownerId });
  if (!user) return next(new CustomError(400, "User Not Found"));

  const archivedIds = req?.body;
  if (!archivedIds || !Array.isArray(archivedIds) || archivedIds.length === 0)
    return next(new CustomError(400, "Please Provide Invoice Data"));

  const updatedClaims = await Claims.updateMany(
    { _id: { $in: archivedIds } },
    { $set: { archived: true } }
  );

  if (!updatedClaims) return next(new CustomError(400, "Claims Not Updated"));

  const claims = await Claims.find({ _id: { $in: archivedIds } }).populate(
    "owner"
  );

  await Promise.all(
    claims.map((claim) =>
      createNotification({
        owner: ownerId,
        clientId: claim.owner._id,
        claimId: claim._id,
        title: "Claim Archived By Admin",
        message: `Claim ${claim?.roNumber} - ${claim?.roSuffix} of ${
          claim?.owner?.name
        } of Company ${
          claim?.owner?.companyName || claim?.owner?.storeName
        } has been archived by Admin.`,
      })
    )
  );

  return res.status(200).json({
    success: true,
    message: "Claims Updated Successfully",
  });
});

// Get Archived Claims
//-------------------
const getArchieveClaims = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById({ _id: ownerId });
  if (!user) return next(new CustomError(400, "User Not Found"));

  let archivedClaims = [];

  if (user.role === "admin") {
    let adminClaims = await Claims.find({
      owner: ownerId,
      archived: true,
    }).sort({ updatedAt: -1 });
    const clients = await Auth.find({ owner: ownerId, role: "client" }).select(
      "_id"
    );
    const clientIds = clients.map((c) => c._id);
    let clientClaims = [];
    if (clientIds.length > 0) {
      clientClaims = await Claims.find({
        owner: { $in: clientIds },
        archived: true,
      }).sort({ updatedAt: -1 });
    }
    archivedClaims = [...adminClaims, ...clientClaims];
  } else if (user.role === "client") {
    archivedClaims = await Claims.find({ owner: ownerId, archived: true }).sort(
      { updatedAt: -1 }
    );
  }

  if (!archivedClaims) return next(new CustomError(400, "Claims Not Found"));

  res.status(200).json({
    success: true,
    message: "Archived Claims Fetched Successfully",
    data: archivedClaims,
  });
});

// remove Claims out of archieve + send notification
//------------------------------------------------
const removeArchieveClaims = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById({ _id: ownerId });
  if (!user) return next(new CustomError(400, "User Not Found"));

  const archivedIds = req?.body;
  if (!archivedIds || !Array.isArray(archivedIds) || archivedIds.length === 0)
    return next(new CustomError(400, "Please Provide Invoice Data"));

  const updatedClaims = await Claims.updateMany(
    { _id: { $in: archivedIds } },
    { $set: { archived: false } }
  );

  if (!updatedClaims || updatedClaims.modifiedCount === 0)
    return next(new CustomError(400, "Claims Not Updated"));

  const claims = await Claims.find({ _id: { $in: archivedIds } });

  await Promise.all(
    claims.map((claim) =>
      createNotification({
        owner: ownerId,
        clientId: claim.owner._id,
        claimId: claim._id,
        title: "Claim Unarchived By Admin",
        message: `Claim ${claim?.roNumber} - ${claim?.roSuffix} of ${
          claim?.owner?.name
        } of Company ${
          claim?.owner?.companyName || claim?.owner?.storeName
        } has been unarchived by Admin.`,
      })
    )
  );

  return res.status(200).json({
    success: true,
    message: "Claims Updated Successfully",
  });
});

// Claims Dashboard Stats
//----------------------
const getClaimsStats = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById(ownerId);
  if (!user) return next(new CustomError(400, "User Not Found"));

  const clients = await Auth.find({ owner: ownerId });
  if (!clients || clients.length === 0)
    return res.status(200).json({
      success: true,
      message: "No Clients Found",
      data: [],
    });

  const clientsIds = clients.map((c) => c._id);

  const claims = await Claims.find({ owner: { $in: clientsIds } }).populate(
    "owner"
  );

  const pendingCorrection = claims.filter((c) => c.status === "PC");
  const pendingOrder = claims.filter((c) => c.status === "PO");
  const pendingQuestion = claims.filter((c) => c.status === "PQ");
  const pendingReview = claims.filter((c) => c.status === "PR");
  const pendingAnalysis = claims.filter((c) => c.status === "PA");
  const creditReady = claims.filter((c) => c.status === "CR");

  const claimsByCompanyObj = claims.reduce((acc, claim) => {
    const company =
      claim?.owner?.warrantyCompany ||
      claim?.owner?.storeName ||
      claim?.owner?.companyName ||
      "Unknown";
    acc[company] = (acc[company] || 0) + 1;
    return acc;
  }, {});

  const claimsByCompany = Object.entries(claimsByCompanyObj)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const top5Companies = claimsByCompany.slice(0, 5);

  res.status(200).json({
    success: true,
    message: "Claims Stats Fetched Successfully",
    data: {
      pendingCorrection: pendingCorrection.length,
      pendingOrder: pendingOrder.length,
      pendingQuestion: pendingQuestion.length,
      pendingReview: pendingReview.length,
      pendingAnalysis: pendingAnalysis.length,
      creditReady: creditReady.length,
    },
    claimsByCompany,
    top5Companies,
  });
});

// Invoices Dashboard Stats
//------------------------
const getInvoicesStats = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById(ownerId);
  if (!user) return next(new CustomError(400, "User Not Found"));

  const invoices = await Invoice.find({ owner: ownerId });

  const today = new Date();

  let total7 = 0,
    total30 = 0,
    total90 = 0,
    totalPre7 = 0,
    totalPre30 = 0,
    totalPre90 = 0;

  invoices.forEach((inv) => {
    const invoiceDate = new Date(inv.createdAt);
    const diffTime = Math.abs(today - invoiceDate);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Current periods
    if (diffDays <= 7) total7++;
    if (diffDays <= 30) total30++;
    if (diffDays <= 90) total90++;

    // Previous periods
    if (diffDays > 7 && diffDays <= 14) totalPre7++;
    if (diffDays > 30 && diffDays <= 60) totalPre30++;
    if (diffDays > 90 && diffDays <= 180) totalPre90++;
  });

  // Helper to calculate percentage
  const calcPercentage = (curr, prev) => {
    if (prev === 0) return curr > 0 ? 100 : 0;
    return ((curr - prev) / prev) * 100;
  };

  const percentage7 = calcPercentage(total7, totalPre7);
  const percentage30 = calcPercentage(total30, totalPre30);
  const percentage90 = calcPercentage(total90, totalPre90);

  res.status(200).json({
    success: true,
    message: "Invoices Stats Fetched Successfully",
    data: {
      totalInvoicesIn7Days: total7,
      totalInvoicesIn30Days: total30,
      totalInvoicesIn90Days: total90,
      percentageIn7Days: percentage7,
      percentageIn30Days: percentage30,
      percentageIn90Days: percentage90,
    },
  });
});

// Get All Donations
//------------------
const getAllDonations = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById(ownerId);
  if (!user) return next(new CustomError(400, "User Not Found"));

  const donations = await Payment.find().lean();

  res.status(200).json({
    success: true,
    message: "Donations Fetched Successfully",
    data: donations,
  });
});

// Download Receipt
// ----------------
const downloadReceipt = asyncHandler(async (req, res, next) => {
  const receiptId = req?.params?.receiptId;
  if (!isValidObjectId(receiptId))
    return next(new CustomError(400, "Invalid Receipt Id"));

  const receipt = await Payment.findById(receiptId);
  if (!receipt) return next(new CustomError(400, "Receipt Not Found"));

  const receiptData = {
    donorName: receipt?.name,
    email: receipt?.email,
    amount: receipt?.amount,
    currency: receipt?.currency,
    status: receipt?.status,
    transactionId: receipt?.transactionId,
    date: receipt?.createdAt,
  };

  const pdfBuffer = await generateReceiptPDF(receiptData);

  res.set({
    "Content-Type": "application/pdf",
    "Content-Disposition": `attachment; filename=Receipt-${receipt?.transactionId}.pdf`,
  });
  return res.send(pdfBuffer);
});

// Send Email Receipt
//------------------
const sendEmailReceipt = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById(ownerId);
  if (!user) return next(new CustomError(400, "User Not Found"));

  const receiptId = req?.params?.receiptId;
  if (!isValidObjectId(receiptId))
    return next(new CustomError(400, "Invalid Receipt Id"));

  const receipt = await Payment.findById(receiptId);
  if (!receipt) return next(new CustomError(400, "Receipt Not Found"));

  const emailTemplate = receiptMailTemplate(receipt);
  const subject = "Donation Receipt - Global Learning Bridge";
  const to = receipt?.email;
  const text = "Donation Receipt - Global Learning Bridge";

  await sendMail(to, subject, `${emailTemplate}`, true);

  await Payment.findOneAndUpdate(
    { _id: receiptId },
    { $inc: { sendCount: 1 } }
  );

  res.status(200).json({
    success: true,
    message: "Receipt Sent Successfully",
  });
});

export {
  createClaims,
  exportClaims,
  getClaims,
  updateClaim,
  createArchieveClaims,
  getArchieveClaims,
  removeArchieveClaims,
  getClaimsStats,
  getInvoicesStats,
  updateClaimAdditionalData,
  deleteClaim,
  getAllDonations,
  downloadReceipt,
  sendEmailReceipt,
};
