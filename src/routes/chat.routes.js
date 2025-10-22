import express from "express";
const app = express.Router();
import { isAuthenticated } from "../middlewares/authMiddleware.js";
import {
  sendMessage,
  getChat,
  getAvgResponseTime,
  getAvgResponseTimeAll,
} from "../controllers/chat.controller.js";
import { singleUpload } from "../middlewares/multer.js";

app.get("/getChat/:id", isAuthenticated, getChat);

app.post("/sendMessage", isAuthenticated, singleUpload, sendMessage);

app.get("/companies/avg-response-time", isAuthenticated, getAvgResponseTime);

app.get(
  "/companies/avg-response-time/all",
  isAuthenticated,
  getAvgResponseTimeAll
);

export default app;
