import express from "express";
const app = express.Router();
import { isAuthenticated } from "../middlewares/authMiddleware.js";
import { upload, parseCSV } from "../middlewares/uploadCSV.middleware.js";
import {
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
} from "../controllers/claims.controller.js";

app.post(
  "/createClaims",
  isAuthenticated,
  upload.single("file"),
  parseCSV,
  createClaims
);

app.get("/exportClaims", isAuthenticated, exportClaims);

app.get("/getClaims", isAuthenticated, getClaims);

app.put("/updateClaim/:id", isAuthenticated, updateClaim);

app.put(
  "/updateClaimAdditionalData/:id",
  isAuthenticated,
  updateClaimAdditionalData
);

app.delete("/deleteClaim/:id", isAuthenticated, deleteClaim);

app.post("/createArchieveClaims", isAuthenticated, createArchieveClaims);

app.get("/getArchieveClaims", isAuthenticated, getArchieveClaims);

app.post("/removeArchieveClaims", isAuthenticated, removeArchieveClaims);

app.get("/getClaimsStats", isAuthenticated, getClaimsStats);

app.get("/getInvoicesStats", isAuthenticated, getInvoicesStats);

app.get("/getAllDonations", isAuthenticated, getAllDonations);

app.get("/downloadReceipt/:receiptId", isAuthenticated, downloadReceipt);

app.get("/sendEmailReceipt/:receiptId", isAuthenticated, sendEmailReceipt);

export default app;
