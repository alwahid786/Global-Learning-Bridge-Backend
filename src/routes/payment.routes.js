import express from "express";
import {
  createPaymentIntent,
  stripeWebhook,
} from "../controllers/payment.controller.js";

const app = express();

app.post("/create-payment-intent", createPaymentIntent);
app.post("/webhook", express.raw({ type: "application/json" }), stripeWebhook);

export default app;
