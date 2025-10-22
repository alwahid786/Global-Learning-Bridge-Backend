import express from "express";
const app = express.Router();
import { isAuthenticated } from "../middlewares/authMiddleware.js";
import {
  getNotifications,
  deleteNotification,
  readNotification,
} from "../controllers/notifications.controller.js";

app.get("/getNotifications", isAuthenticated, getNotifications);
app.delete("/deleteNotification/:id", isAuthenticated, deleteNotification);
app.put("/readNotification/:id", isAuthenticated, readNotification);

export default app;
