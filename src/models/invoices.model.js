import mongoose from "mongoose";

const invoiceSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auth",
      required: true,
    },
    clientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auth",
      required: true,
    },
    clientName: { type: String, required: true },
    warrantyCompany: { type: String, required: true },
    invoiceNumber: { type: String, required: true, unique: true },
    logo: { type: String },

    statementType: { type: String, required: true },
    statementNumber: { type: String, required: true },
    statementTotal: { type: Number, required: true },

    adjustments: [
      {
        type: { type: String, enum: ["add", "deduction"] },
        amount: { type: Number },
        reason: { type: String },
      },
    ],

    assignedPercentage: Number,
    bypassPercentage: { type: Boolean, default: false },
    finalTotal: { type: Number, required: true },

    freeTextExplanation: String,
    attachedReports: [
      {
        filename: { type: String },
        public_id: { type: String },
        url: { type: String },
        resource_type: { type: String },
      },
    ],
    status: { type: String, enum: ["draft", "finalized"], default: "draft" },
    archived: {
      type: Boolean,
      default: false,
    },
    sentCount: {
      type: Number,
      default: 0,
    },
    lastSent: {
      type: Date,
    },
  },
  { timestamps: true }
);

export const Invoice = mongoose.model("Invoice", invoiceSchema);
