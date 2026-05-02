import { Router } from "express";
import { Room } from "../models/Room.js";

const router = Router();
const ROOM_CODE_REGEX = /^[a-z0-9]{6}$/;

router.post("/", async (req, res) => {
  const roomCode = String(req.body?.roomCode || "").trim().toLowerCase();

  if (!ROOM_CODE_REGEX.test(roomCode)) {
    return res.status(400).json({ error: "roomCode must be exactly 6 letters/numbers" });
  }

  const existingRoom = await Room.findOne({ roomCode });

  if (existingRoom) {
    return res.status(409).json({ error: "Room code already exists" });
  }

  const room = await Room.create({ roomCode, participants: [] });

  res.status(201).json({ roomCode: room.roomCode, isActive: room.isActive });
});

router.get("/:roomCode", async (req, res) => {
  const roomCode = String(req.params.roomCode || "").trim().toLowerCase();

  if (!ROOM_CODE_REGEX.test(roomCode)) {
    return res.status(400).json({ error: "roomCode must be exactly 6 letters/numbers" });
  }

  const room = await Room.findOne({ roomCode });

  if (!room) {
    return res.status(404).json({ error: "Room not found" });
  }

  res.json(room);
});

export default router;