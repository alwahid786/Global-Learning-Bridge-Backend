import mongoose from "mongoose";

const claimsSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auth",
      required: true,
    },
    roNumber: { type: String, required: true },
    roSuffix: { type: String, required: true },
    roDate: { type: String, required: true },
    jobNumber: { type: String },
    quoted: { type: String, required: true },
    status: {
      type: String,
      enum: ["PC", "PO", "PQ", "PR", "PA", "CR"],
      required: true,
    },
    entryDate: { type: String, required: true },
    errorDescription: { type: String, required: true },
    additionalInfo: { type: String, default: "" },
    internalNotes: { type: String, default: "" },
    archived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

claimsSchema.index({ roNumber: 1, roSuffix: 1 }, { unique: true });

export const Claims = mongoose.model("Claims", claimsSchema);
