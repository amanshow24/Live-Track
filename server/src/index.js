import "dotenv/config";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import { createServer } from "node:http";
import { Server } from "socket.io";
import healthRouter from "./routes/health.js";
import roomsRouter from "./routes/rooms.js";
import { registerRoomSocketHandlers } from "./socket/roomSocket.js";

const app = express();
app.use(cors());
app.use(express.json());
app.use("/api", healthRouter);
app.use("/api/rooms", roomsRouter);

const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*"
  }
});

io.on("connection", (socket) => {
  console.log("socket connected", socket.id);
  registerRoomSocketHandlers(io, socket);

  socket.on("disconnect", () => {
    console.log("socket disconnected", socket.id);
  });
});

const PORT = Number(process.env.PORT || 4000);
const MONGO_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/livetrack";

mongoose
  .connect(MONGO_URI)
  .then(() => {
    httpServer.listen(PORT, () => {
      console.log(`LiveTrack server running on http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error("MongoDB connection failed:", error.message);
    process.exit(1);
  });
