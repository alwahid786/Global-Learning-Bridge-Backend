import { Stripe } from "stripe";
import { asyncHandler } from "../utils/asyncHandler.js";
import { CustomError } from "../utils/customError.js";
import { Auth } from "../models/auth.model.js";
import Payment from "../models/payment.model.js";
import { sendMail } from "../utils/resendMail.js";
import { getEnv } from "../configs/config.js";
import crypto from "crypto";
import { mailTemplateForNewUserCredentials } from "../utils/htmlPages.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create Payment
//--------------

const createPaymentIntent = asyncHandler(async (req, res, next) => {
  const { amount, currency, paymentType, email } = req.body;

  if (!amount || !currency || !paymentType || !email)
    return next(new CustomError(400, "Missing required payment fields."));

  let user = await Auth.findOne({ email });

  if (!user) {
    const autoPassword = crypto.randomBytes(8).toString("hex");
    user = await Auth.create({
      name: "Anonymous",
      email,
      password: autoPassword,
      role: "admin",
    });

    const htmlTemplate = mailTemplateForNewUserCredentials({
      receiverEmail: email,
      autoPassword,
      senderCompany: "National Warranty System",
      loginUrl: getEnv("LOGIN_URL"),
      logoUrl: getEnv("LOGO_URL_WITH_BACKGROUND"),
    });

    await sendMail(email, "Your Account Credentials", htmlTemplate, true);
  }

  const now = new Date();

  if (paymentType === "membership") {
    if (user.isMember && user.subscriptionEnd > now) {
      return next(
        new CustomError(400, "You already have an active membership.")
      );
    }

    if (user.isMember && user.subscriptionEnd <= now) {
      console.log("Renewal detected for expired membership");
    }
  }

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency,
    automatic_payment_methods: { enabled: true },
    metadata: {
      email,
      paymentType,
      userId: user._id.toString(),
    },
  });

  await Payment.create({
    userId: user._id,
    email,
    amount,
    currency,
    paymentType,
    status: "pending",
    transactionId: paymentIntent.id,
  });

  res.status(200).json({
    success: true,
    clientSecret: paymentIntent.client_secret,
  });
});

// Stripe Webhook
//--------------

const stripeWebhook = asyncHandler(async (req, res) => {
  const sig = req.headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error("Webhook error:", err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object;
    const { email, paymentType, userId } = paymentIntent.metadata;

    const payment = await Payment.findOne({ transactionId: paymentIntent.id });
    if (payment) {
      payment.status = "succeeded";
      await payment.save();
    }

    const user = await Auth.findOne({
      $or: [{ _id: userId }, { email }],
    });

    if (user && (paymentType === "membership" || paymentType === "donation")) {
      const now = new Date();

      const baseDate =
        user.subscriptionEnd && user.subscriptionEnd > now
          ? user.subscriptionEnd
          : now;

      const newExpiry = new Date(baseDate);
      newExpiry.setMonth(newExpiry.getMonth() + 1);

      user.isMember = true;
      user.subscriptionEnd = newExpiry;

      await user.save();
    }
  }

  res.status(200).json({ received: true });
});

export { createPaymentIntent, stripeWebhook };
