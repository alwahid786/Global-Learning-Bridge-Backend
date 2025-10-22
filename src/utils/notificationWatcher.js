import { Notification } from "../models/notification.model.js";
import { getUserSocketId } from "./sockets.js";

export function initNotificationWatcher(io) {
  const changeStream = Notification.watch([], { fullDocument: "updateLookup" });

  changeStream.on("change", (change) => {
    const { operationType, fullDocument } = change;

    if (operationType === "insert") {
      // Notify owner (admin)
      if (fullDocument.owner) {
        const owner = fullDocument.owner.toString();
        const ownerSocketid = getUserSocketId(owner);
        if (ownerSocketid) {
          io.to(ownerSocketid).emit("notification:insert", fullDocument);
        }
      }

      // Notify client (if present)
      if (fullDocument.clientId) {
        const client = fullDocument.clientId.toString();
        const clientSocketid = getUserSocketId(client);
        if (clientSocketid) {
          io.to(clientSocketid).emit("notification:insert", fullDocument);
        }
      }
    }
  });

  changeStream.on("error", (err) => {
    console.error("Notification change stream error:", err);
  });

  console.log("Notification watcher initialized");
}
