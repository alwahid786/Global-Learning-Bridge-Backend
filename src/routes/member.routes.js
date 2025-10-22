import express from "express";
import {
  createMember,
  getClients,
  deleteClient,
  updateClient,
  getClientStats,
  getClientsActivityStats,
  getClientsStatsByFilters,
} from "../controllers/members.controller.js";
import { isAuthenticated } from "../middlewares/authMiddleware.js";
import { singleUpload } from "../middlewares/multer.js";

const app = express.Router();

app.post("/createMember", singleUpload, createMember);
app.get("/getClients", isAuthenticated, getClients);
app.delete("/deleteClient/:id", isAuthenticated, deleteClient);
app.put("/updateClient/:id", isAuthenticated, singleUpload, updateClient);
app.get("/getClientStats", isAuthenticated, getClientStats);
app.get("/getClientsStatsByFilters", isAuthenticated, getClientsStatsByFilters);
app.get("/getClientsActivityStats", isAuthenticated, getClientsActivityStats);

export default app;
