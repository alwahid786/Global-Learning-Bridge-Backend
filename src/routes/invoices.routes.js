import express from "express";
const app = express.Router();
import { isAuthenticated } from "../middlewares/authMiddleware.js";
import { multipleUpload } from "../middlewares/multer.js";

import {
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
  getAllMembers,
  changeMemberAccess,
} from "../controllers/invoices.controller.js";

app.post("/createInvoice", isAuthenticated, multipleUpload, createInvoice);

app.get("/getClients", isAuthenticated, getClients);

app.get("/getInvoices", isAuthenticated, getInvoices);

app.put("/editInvoice/:id", isAuthenticated, multipleUpload, editInvoice);

app.delete("/deleteInvoice/:id", isAuthenticated, deleteInvoice);

app.put("/changeInvoiceStatus/:id", isAuthenticated, changeInvoiceStatus);

app.post("/sendInvoice/:id", isAuthenticated, sendInvoice);

app.get("/getArchieveInvoices", isAuthenticated, getArchieveInvoices);

app.post("/removeArchiveInvoices", isAuthenticated, removeArchiveInvoices);

app.post("/createArchiveInvoices", isAuthenticated, createArchiveInvoices);

app.get("/getAllMembers", isAuthenticated, getAllMembers);

app.put("/changeMemberAccess/:id", isAuthenticated, changeMemberAccess);

export default app;
