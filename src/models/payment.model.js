import mongoose from "mongoose";

const paymentSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  amount: Number,
  currency: String,
  paymentType: {
    type: String,
  },
  status: {
    type: String,
    enum: ["pending", "succeeded", "failed"],
    default: "pending",
  },
  transactionId: String,
  sendCount: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now },
});

export default mongoose.model("Payment", paymentSchema);
