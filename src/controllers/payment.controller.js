import { Stripe } from "stripe";
import { asyncHandler } from "../utils/asyncHandler.js";
import { CustomError } from "../utils/customError.js";
import { Auth } from "../models/auth.model.js";
import Payment from "../models/payment.model.js";
import { sendMail } from "../utils/resendMail.js";
import { getEnv } from "../configs/config.js";
import crypto from "crypto";
import {
  mailTemplateForNewUserCredentials,
  receiptMailTemplate,
  failedPaymentTemplate,
} from "../utils/htmlPages.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Create Payment
//--------------

const createPaymentIntent = asyncHandler(async (req, res, next) => {
  const { amount, currency, paymentType, email, name } = req.body;

  if (!amount || !currency || !paymentType || !email || !name)
    return next(new CustomError(400, "Missing required payment fields."));

  let user = await Auth.findOne({ email });

  if (!user) {
    const autoPassword = crypto.randomBytes(8).toString("hex");
    user = await Auth.create({
      name,
      email,
      password: autoPassword,
      role: "member",
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

  const paymentIntent = await stripe.paymentIntents.create({
    amount,
    currency,
    automatic_payment_methods: { enabled: true },
    metadata: {
      name,
      email,
      paymentType,
      userId: user._id.toString(),
    },
  });

  await Payment.create({
    userId: user._id,
    name,
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

  const data = event.data.object;
  const eventType = event.type;

  const updatePayment = async (status, metadata) => {
    const payment = await Payment.findOne({ transactionId: data.id });
    if (!payment) return;
    payment.status = status;
    await payment.save();

    if (status === "succeeded" && metadata?.userId) {
      await Auth.findByIdAndUpdate(metadata.userId, { isDonor: true });
    }

    if (status === "succeeded" && metadata?.email) {
      const receipt = await Payment.findOne({ transactionId: data.id });
      const emailTemplate = receiptMailTemplate(receipt);
      const subject = "Donation Receipt - Global Learning Bridge";
      const to = receipt?.email;

      await sendMail(to, subject, `${emailTemplate}`, true);
    }

    if (status === "failed") {
      const receipt = await Payment.findOne({ transactionId: data.id });
      const emailTemplate = failedPaymentTemplate(receipt);
      const subject = "Donation Receipt - Global Learning Bridge";
      const to = receipt?.email;

      await sendMail(to, subject, `${emailTemplate}`, true);
    }
  };

  switch (eventType) {
    case "payment_intent.created":
      console.log("notification for payment created");
      break;

    case "payment_intent.processing":
      await updatePayment("processing", data.metadata);
      break;

    case "payment_intent.succeeded":
      await updatePayment("succeeded", data.metadata);
      break;

    case "payment_intent.payment_failed":
      await updatePayment("failed", data.metadata);
      break;

    case "payment_intent.canceled":
      await updatePayment("canceled", data.metadata);
      break;

    default:
      console.log(`Unhandled event type: ${eventType}`);
  }

  res.status(200).json({ received: true });
});

export { createPaymentIntent, stripeWebhook };
