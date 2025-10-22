import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auth",
      required: true,
    },
    claimId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Claims",
      required: true,
    },
    content: {
      type: String,
      default: "",
    },
    type: {
      type: String,
      enum: ["text", "file"],
      default: "text",
    },
    fileData: {
      filename: { type: String },
      public_id: { type: String },
      url: { type: String },
      format: { type: String },
      resource_type: { type: String },
    },
  },
  { timestamps: true }
);

export const Chat = mongoose.model("Chat", chatSchema);
