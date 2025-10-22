import { Counter } from "../models/counter.model.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { CustomError } from "../utils/customError.js";
import { Auth } from "../models/auth.model.js";
import { isValidObjectId } from "mongoose";
import { Invoice } from "../models/invoices.model.js";
import {
  removeFromCloudinary,
  uploadMultipleOnCloudinary,
} from "../utils/cloudinary.js";
import { generateInvoicePDF } from "../utils/pdfGenerator.js";
import { sendMail } from "../utils/resendMail.js";
import { createNotification } from "../utils/createNotification.js";
import { mailTemplateForNotifications } from "../utils/htmlPages.js";

// Create Invoice + Create Notification + send email notification
//---------------
const createInvoice = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById(ownerId);
  if (!user) return next(new CustomError(400, "User Not Found"));

  let formData = req.body;

  if (!formData)
    return next(new CustomError(400, "Please provide all required fields"));

  if (formData.adjustments && typeof formData.adjustments === "string") {
    formData.adjustments = JSON.parse(formData.adjustments);
  }

  const {
    clientId,
    client,
    company,
    statementType,
    statementNumber,
    statementTotal,
    finalTotal,
    adjustments,
    assignedPercentage,
    bypass,
    explanation,
    status,
  } = formData;

  const invoiceNumber = await Counter.findOneAndUpdate(
    { owner: ownerId, name: "invoiceNumber" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  if (Array.isArray(formData.adjustments)) {
    formData.adjustments = formData.adjustments.map((adj) => ({
      ...adj,
      type:
        adj.type === "Charge"
          ? "add"
          : adj.type === "Deduction"
          ? "deduction"
          : adj.type,
    }));
  }

  if (!invoiceNumber)
    return next(new CustomError(400, "Invoice Number Not Found"));

  if (
    !clientId ||
    !client ||
    !company ||
    !invoiceNumber?.seq ||
    !statementType ||
    !statementNumber ||
    !statementTotal ||
    !finalTotal
  )
    return next(new CustomError(400, "Please provide all required fields"));

  let uploadedFiles = [];
  if (req.files && req.files.length > 0) {
    uploadedFiles = await uploadMultipleOnCloudinary(req.files, "invoices");
  }

  const newInvoice = await Invoice.create({
    owner: ownerId,
    clientId,
    clientName: client,
    warrantyCompany: company,
    invoiceNumber: invoiceNumber?.seq,
    statementType,
    statementNumber,
    statementTotal,
    finalTotal,
    adjustments: formData?.adjustments,
    assignedPercentage,
    bypassPercentage: bypass || false,
    freeTextExplanation: explanation || "",
    attachedReports: uploadedFiles.map((f) => ({
      filename: f.original_filename,
      public_id: f.public_id,
      url: f.secure_url,
      resource_type: f.resource_type,
    })),
    status,
  });

  if (!newInvoice) return next(new CustomError(400, "Invoice Not Created"));

  const clientData = await Auth.findById(clientId);
  if (!client) return next(new CustomError(400, "Client Not Found"));

  const notification = await createNotification({
    owner: ownerId,
    clientId: clientId,
    title: "Invoice Created By Admin",
    message: `Invoice ${
      newInvoice?.invoiceNumber
    } has been created for Client ${clientData?.name} Company ${
      clientData?.companyName || clientData?.storeName
    }.`,
  });

  if (!notification)
    return next(new CustomError(400, "Notification Not Created"));

  // Send Email Notification
  //-----------------------
  const emails = clientData?.emails;
  const clientName = clientData?.name;
  const storeName = clientData?.companyName || clientData?.storeName;

  const subject = "Invoice Created Notification";
  const message = `Invoice ${newInvoice?.invoiceNumber} has been created for Client ${clientName} Company ${storeName}.`;

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
    message: "Invoice Created Successfully",
    invoice: newInvoice,
  });
});

// get clients
//---------------
const getClients = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById(ownerId);
  if (!user) return next(new CustomError(400, "User Not Found"));

  const clients = await Auth.find({ owner: ownerId, role: "client" });
  if (!clients) return next(new CustomError(400, "Clients Not Found"));

  return res.status(200).json({ success: true, data: clients });
});

// get invoices
//---------------
const getInvoices = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById(ownerId);
  if (!user) return next(new CustomError(400, "User Not Found"));

  const invoices = await Invoice.find({
    owner: ownerId,
    archived: false,
  }).populate(
    "clientId",
    "-password -__v -_id -createdAt -updatedAt -lastLogin -activeStatus -storeName -dealerId -address -storePhone -emails -accountOwner -businessOwner -businessOwnerView -percentage"
  );
  if (!invoices) return next(new CustomError(400, "Invoices Not Found"));

  return res.status(200).json({ success: true, data: invoices });
});

// EDIT INVOICE
//---------------
const editInvoice = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById(ownerId);
  if (!user) return next(new CustomError(400, "User Not Found"));

  const invoiceId = req?.params?.id;
  if (!isValidObjectId(invoiceId))
    return next(new CustomError(400, "Invalid Invoice Id"));

  const invoice = await Invoice.findById(invoiceId);
  if (!invoice) return next(new CustomError(400, "Invoice Not Found"));

  let {
    clientId,
    client,
    company,
    invoiceNumber,
    statementType,
    statementNumber,
    statementTotal,
    finalTotal,
    adjustments,
    assignedPercentage,
    bypass,
    explanation,
    status,
    existingFiles,
  } = req.body;

  try {
    if (typeof adjustments === "string") {
      adjustments = JSON.parse(adjustments);
    }
    if (typeof existingFiles === "string") {
      existingFiles = JSON.parse(existingFiles);
    }
    if (typeof bypass === "string") {
      bypass = bypass === "true";
    }
  } catch (err) {
    return next(new CustomError(400, "Invalid JSON in request body"));
  }

  let updatedAdjustments = adjustments;
  if (Array.isArray(adjustments)) {
    updatedAdjustments = adjustments.map((adj) => ({
      ...adj,
      type:
        adj.type === "Charge"
          ? "add"
          : adj.type === "Deduction"
          ? "deduction"
          : adj.type,
    }));
  }

  let uploadedFiles = [];
  let finalAttachedReports = invoice.attachedReports || [];

  let parsedExistingFiles = Array.isArray(existingFiles) ? existingFiles : [];

  if (invoice.attachedReports && invoice.attachedReports.length > 0) {
    const filesToDelete = invoice.attachedReports.filter(
      (oldFile) =>
        !parsedExistingFiles.some(
          (existFile) => existFile.public_id === oldFile.public_id
        )
    );

    for (const file of filesToDelete) {
      await removeFromCloudinary(file.public_id, file.resource_type || "image");
    }
  }

  if (req.files && req.files.length > 0) {
    uploadedFiles = await uploadMultipleOnCloudinary(req.files, "invoices");
    if (uploadedFiles.length !== req.files.length) {
      return next(
        new CustomError(400, "Error while uploading files on Cloudinary")
      );
    }
  }

  finalAttachedReports = [
    ...parsedExistingFiles,
    ...uploadedFiles.map((f) => ({
      filename: f.original_filename,
      public_id: f.public_id,
      url: f.secure_url,
      resource_type: f.resource_type,
    })),
  ];

  if (
    !clientId ||
    !client ||
    !company ||
    !statementType ||
    !statementNumber ||
    !statementTotal ||
    !finalTotal
  ) {
    return next(new CustomError(400, "Please provide all required fields"));
  }

  const updatedInvoice = await Invoice.findByIdAndUpdate(
    invoiceId,
    {
      clientId,
      clientName: client,
      warrantyCompany: company,
      statementType,
      statementNumber,
      statementTotal,
      finalTotal,
      adjustments: updatedAdjustments,
      assignedPercentage,
      bypassPercentage: bypass || false,
      freeTextExplanation: explanation || "",
      attachedReports: finalAttachedReports,
      status,
    },
    { new: true }
  );

  if (!updatedInvoice) return next(new CustomError(400, "Invoice Not Updated"));

  return res.status(200).json({
    success: true,
    message: "Invoice Updated Successfully",
    invoice: updatedInvoice,
  });
});

// Delete Invoice + Create Notification
//--------------
const deleteInvoice = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById(ownerId);
  if (!user) return next(new CustomError(400, "User Not Found"));

  const invoiceId = req?.params?.id;
  if (!isValidObjectId(invoiceId))
    return next(new CustomError(400, "Invalid Invoice Id"));

  const invoice = await Invoice.findById(invoiceId).populate("clientId");
  if (!invoice) return next(new CustomError(400, "Invoice Not Found"));

  // Delete files from cloudinary
  if (invoice.attachedReports && invoice.attachedReports.length > 0) {
    for (const file of invoice.attachedReports) {
      await removeFromCloudinary(file.public_id, file.resource_type || "image");
    }
  }

  const deletedInvoice = await Invoice.findByIdAndDelete(invoiceId);
  if (!deletedInvoice) return next(new CustomError(400, "Invoice Not Deleted"));

  const notification = await createNotification({
    owner: ownerId,
    clientId: invoice?.clientId?._id,
    title: "Invoice Deleted By Admin",
    message: `Invoice ${
      deletedInvoice?.invoiceNumber
    } has been deleted for Client ${invoice?.clientId?.name} Company ${
      invoice?.clientId?.companyName || invoice?.clientId?.storeName
    }.`,
  });

  if (!notification)
    return next(new CustomError(400, "Notification Not Created"));

  return res.status(200).json({
    success: true,
    message: "Invoice Deleted Successfully",
    invoice: deletedInvoice,
  });
});

// Change Invoice Status + Create Notification + send email notification
//---------------------
const changeInvoiceStatus = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById(ownerId);
  if (!user) return next(new CustomError(400, "User Not Found"));

  const invoiceId = req?.params?.id;
  if (!isValidObjectId(invoiceId))
    return next(new CustomError(400, "Invalid Invoice Id"));

  const invoice = await Invoice.findById(invoiceId).populate("clientId");
  if (!invoice) return next(new CustomError(400, "Invoice Not Found"));

  const updatedInvoice = await Invoice.findByIdAndUpdate(
    invoiceId,
    { status: req?.body?.status },
    { new: true }
  );

  if (!updatedInvoice) return next(new CustomError(400, "Invoice Not Updated"));

  const notification = await createNotification({
    owner: ownerId,
    clientId: invoice?.clientId?._id,
    title: "Invoice Status Updated By Admin",
    message: `Invoice ${
      updatedInvoice?.invoiceNumber
    } has been updated to status ${updatedInvoice?.status} for Client ${
      invoice?.clientId?.name
    } Company ${
      invoice?.clientId?.companyName || invoice?.clientId?.storeName
    }.`,
  });

  if (!notification)
    return next(new CustomError(400, "Notification Not Created"));

  // Send Email Notification
  //-----------------------
  const clientData = await Auth.findById(invoice?.clientId?._id);
  const emails = clientData?.emails;
  const clientName = clientData?.name;
  const storeName = clientData?.companyName || clientData?.storeName;

  const subject = "Invoice Status Updated Notification";
  const message = `Invoice ${updatedInvoice?.invoiceNumber} has been updated to status ${updatedInvoice?.status} for Client ${clientName} Company ${storeName}.`;

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
    message: "Invoice Status Updated Successfully",
    invoice: updatedInvoice,
  });
});

// Send Invoice + Create Notification + send email notification
//-------------
const sendInvoice = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById(ownerId);
  if (!user) return next(new CustomError(400, "User Not Found"));

  const invoiceId = req?.params?.id;
  if (!isValidObjectId(invoiceId))
    return next(new CustomError(400, "Invalid Invoice Id"));

  const invoice = await Invoice.findById(invoiceId)
    .populate("clientId")
    .populate("owner");
  if (!invoice) return next(new CustomError(400, "Invoice Not Found"));

  try {
    const pdfBuffer = await generateInvoicePDF(invoice);

    const subject = `Invoice PDF - INV-${invoice?.invoiceNumber} ${
      invoice?.clientId?.companyName || invoice?.clientId?.storeName
    }`;
    const to = invoice?.clientId?.email;
    const attachments = [
      {
        filename: `INV-${invoice?.invoiceNumber}.pdf`,
        content: pdfBuffer,
        contentType: "application/pdf",
      },
    ];
    const data = {
      clientName: invoice?.clientId?.name,
      message: `Please find the attached invoice for ${
        invoice?.clientId?.companyName || invoice?.clientId?.storeName
      } Invoice Number ${invoice?.invoiceNumber} of Client ${
        invoice?.clientId?.name
      }.`,
      clientCompany:
        invoice?.clientId?.companyName || invoice?.clientId?.storeName,
      senderCompany: user?.companyName || user?.storeName,
    };
    const htmlPage = mailTemplateForNotifications(data);
    await sendMail(to, subject, `${htmlPage}`, true, attachments);

    const invSent = await Invoice.findByIdAndUpdate(
      invoiceId,
      {
        $inc: { sentCount: 1 },
        $set: { lastSent: new Date() },
      },
      { new: true }
    );

    if (!invSent) return next(new CustomError(400, "Invoice Not Sent"));

    const notification = await createNotification({
      owner: ownerId,
      clientId: invoice?.clientId?._id,
      title: "Invoice PDF Sent By Admin",
      message: `Invoice ${invSent?.invoiceNumber} has been sent for Client ${
        invoice?.clientId?.name
      } Company ${
        invoice?.clientId?.companyName || invoice?.clientId?.storeName
      } on email ${invoice?.clientId?.email}.`,
    });

    if (!notification)
      return next(new CustomError(400, "Notification Not Created"));

    // Send Email Notification
    //-----------------------
    const clientData = await Auth.findById(invoice?.clientId?._id);
    const emails = clientData?.emails;
    const clientName = clientData?.name;
    const storeName = clientData?.companyName || clientData?.storeName;

    const subject1 = "Invoice PDF Sent Notification";
    const message = `Invoice ${invSent?.invoiceNumber} has been sent for Client ${clientName} Company ${storeName} on email ${invoice?.clientId?.email}.`;

    const templateData = {
      clientName: clientName,
      message: message,
      clientCompany: storeName,
      senderCompany: user?.companyName || user?.storeName,
    };

    const templatePage = mailTemplateForNotifications(templateData);

    if (Array.isArray(emails) && emails.length > 0) {
      emails.forEach((email) => {
        sendMail(email, subject1, `${templatePage}`, true).catch((err) =>
          console.error("Email sending failed:", err.message)
        );
      });
    }

    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename=INV-${invoice?.invoiceNumber}.pdf`,
    });
    return res.send(pdfBuffer);
  } catch (err) {
    console.error("PDF/Mail error:", err);
    return next(new CustomError(500, "Error while generating or sending PDF"));
  }
});

// Get Archieve Invoices
//---------------------
const getArchieveInvoices = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));

  const user = await Auth.findById(ownerId);
  if (!user) return next(new CustomError(400, "User Not Found"));

  const invoices = await Invoice.find({ owner: ownerId, archived: true });
  if (!invoices) return next(new CustomError(400, "Invoices Not Found"));

  return res.status(200).json({ success: true, data: invoices });
});

// Create Archieve Invoices + Create Notification
//-----------------------------------------------
const createArchiveInvoices = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));
  const user = await Auth.findById(ownerId);
  if (!user) return next(new CustomError(400, "User Not Found"));
  let archivedIds = req?.body;
  if (!archivedIds || !Array.isArray(archivedIds) || archivedIds.length === 0)
    return next(new CustomError(400, "Please Provide Invoice Data"));

  console.log("archivedIds", archivedIds);

  const updatedInvoices = await Invoice.updateMany(
    { _id: { $in: archivedIds }, owner: ownerId, archived: { $ne: true } },
    { $set: { archived: true } }
  );
  if (!updatedInvoices || updatedInvoices.modifiedCount === 0)
    return next(new CustomError(400, "Invoices Not Updated"));

  const invoices = await Invoice.find({ _id: { $in: archivedIds } })
    .populate("clientId")
    .lean();

  await Promise.all(
    invoices.map((invoice) => {
      createNotification({
        owner: ownerId,
        invoiceNumber: invoice?.invoiceNumber,
        title: "Invoice Archived",
        message: `Invoice #${invoice?.invoiceNumber} (Statement #${invoice?.statementNumber}, ${invoice?.statementType}) for client ${invoice?.clientName} under ${invoice?.warrantyCompany} has been archived. Final Total: $${invoice?.finalTotal}.`,
      });
    })
  );

  return res.status(200).json({
    success: true,
    message: "Invoices Archived Successfully",
  });
});

// Remove Invoices out of Archieve + send notification
//--------------------------------------------------
const removeArchiveInvoices = asyncHandler(async (req, res, next) => {
  const ownerId = req?.user?._id;
  if (!isValidObjectId(ownerId))
    return next(new CustomError(400, "Invalid User Id"));
  const user = await Auth.findById(ownerId);
  if (!user) return next(new CustomError(400, "User Not Found"));
  let archivedIds = req?.body;
  if (!archivedIds || !Array.isArray(archivedIds) || archivedIds.length === 0)
    return next(new CustomError(400, "Please Provide Invoice Data"));
  const updatedInvoices = await Invoice.updateMany(
    { _id: { $in: archivedIds }, owner: ownerId },
    { $set: { archived: false } }
  );

  if (!updatedInvoices || updatedInvoices.modifiedCount === 0)
    return next(new CustomError(400, "Invoices Not Updated"));

  const invoices = await Invoice.find({ _id: { $in: archivedIds } })
    .populate("clientId")
    .lean();

  await Promise.all(
    invoices.map((invoice) => {
      createNotification({
        owner: ownerId,
        invoiceNumber: invoice?.invoiceNumber,
        title: "Invoice Unarchived",
        message: `Invoice #${invoice?.invoiceNumber} (Statement #${invoice?.statementNumber}, ${invoice?.statementType}) for client ${invoice?.clientName} under ${invoice?.warrantyCompany} has been Unarchived. Final Total: $${invoice?.finalTotal}.`,
      });
    })
  );

  return res.status(200).json({
    success: true,
    message: "Invoices Unarchived Successfully",
  });
});

export {
  getClients,
  createInvoice,
  getInvoices,
  editInvoice,
  deleteInvoice,
  changeInvoiceStatus,
  sendInvoice,
  getArchieveInvoices,
  removeArchiveInvoices,
  createArchiveInvoices,
};
