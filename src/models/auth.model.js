import mongoose from "mongoose";
import bcrypt from "bcrypt";

// Address Sub-schema
const addressSchema = new mongoose.Schema({
  store: { type: String, trim: true },
  street: { type: String, trim: true },
  area: { type: String, trim: true },
  city: { type: String, trim: true },
  state: { type: String, trim: true },
  country: { type: String, trim: true },
  zip: { type: String, trim: true },
});

// Auth Schema
const authSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Auth",
      required: function () {
        return this.role === "client" || this.role === "user";
      },
    },
    name: { type: String, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    password: { type: String, required: false, minlength: 6, select: false },
    phone: {
      type: String,
      required: false,
    },
    gender: {
      type: String,
      enum: ["Male", "Female", "Other"],
      required: false,
    },
    companyName: {
      type: String,
      required: false,
      trim: true,
    },
    role: {
      type: String,
      enum: ["superadmin", "admin", "user", "client"],
      required: true,
    },
    designation: {
      type: String,
      required: false,
      trim: true,
    },
    image: {
      public_id: { type: String },
      url: { type: String },
    },
    companyLogo: {
      public_id: { type: String },
      url: { type: String },
    },
    companyLogoWithoutBackground: {
      public_id: { type: String },
      url: { type: String },
    },
    refreshToken: { type: String, default: null },
    resetPasswordToken: String,
    resetPasswordExpire: Date,

    lastLogin: { type: Date },

    activeStatus: { type: Boolean, default: true },

    // Membership Fields
    //------------------
    isMember: { type: Boolean, default: false },
    subscriptionEnd: { type: Date },

    // ----------------
    // Client Fields
    // ----------------
    storeName: { type: String, trim: true },
    dealerId: { type: String, trim: true },
    address: addressSchema,
    storePhone: {
      type: String,
    },
    emails: [{ type: String, lowercase: true, trim: true }],
    accountOwner: { type: String, trim: true },
    businessOwner: { type: String, trim: true },
    businessOwnerView: { type: Boolean, default: false },
    percentage: { type: Number, default: 0 },
  },
  { timestamps: true }
);

// Hash password before save
authSchema.pre("save", async function (next) {
  const user = this;
  if (!user.isModified("password")) return next();
  const hashedPassword = await bcrypt.hash(user.password, 10);
  user.password = hashedPassword;
  return next();
});

export const Auth = mongoose.model("Auth", authSchema);
