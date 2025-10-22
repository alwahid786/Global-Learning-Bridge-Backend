import express from "express";
import {
  createUser,
  getUsers,
  deleteUser,
  updateUser,
  getUserStats,
  getUserStatsByFilters,
  getUserActivityStats,
} from "../controllers/user.controller.js";
import { isAuthenticated } from "../middlewares/authMiddleware.js";
import { singleUpload } from "../middlewares/multer.js";

const app = express.Router();

app.post("/createUser", isAuthenticated, singleUpload, createUser);
app.get("/getUsers", isAuthenticated, getUsers);
app.delete("/deleteUser/:id", isAuthenticated, deleteUser);
app.put("/updateUser/:id", isAuthenticated, singleUpload, updateUser);
app.get("/getUserStats", isAuthenticated, getUserStats);
app.get("/getUserStatsByFilters", isAuthenticated, getUserStatsByFilters);
app.get("/getUserActivityStats", isAuthenticated, getUserActivityStats);

export default app;
