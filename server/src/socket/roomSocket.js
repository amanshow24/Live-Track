import { Room } from "../models/Room.js";

const ROOM_CAPACITY = 20;
const ROOM_CODE_REGEX = /^[a-z0-9]{6}$/;
const MAX_NAME_LENGTH = 12;
const EMPTY_ROOM_GRACE_MS = 60_000;
const pendingRoomDeletionTimers = new Map();

function normalizeCoordinates(location) {
  if (!location || typeof location !== "object") {
    return null;
  }

  const rawLatitude = location.latitude ?? location.lat;
  const rawLongitude = location.longitude ?? location.lng ?? location.lon;
  const latitude = Number(rawLatitude);
  const longitude = Number(rawLongitude);

  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return null;
  }

  const normalized = {
    latitude,
    longitude,
    accuracy: Number(location.accuracy),
    timestamp: Number(location.timestamp || Date.now())
  };

  if (!Number.isFinite(normalized.accuracy)) {
    delete normalized.accuracy;
  }

  if (!Number.isFinite(normalized.timestamp)) {
    normalized.timestamp = Date.now();
  }

  return normalized;
}

function normalizeParticipants(participants) {
  return (participants || []).map((participant) => {
    const location = normalizeCoordinates(participant?.location);

    if (!location) {
      return participant;
    }

    return {
      ...participant,
      location
    };
  });
}

export function registerRoomSocketHandlers(io, socket) {
  const cancelRoomDeletion = (roomCode) => {
    const timer = pendingRoomDeletionTimers.get(roomCode);

    if (timer) {
      clearTimeout(timer);
      pendingRoomDeletionTimers.delete(roomCode);
    }
  };

  const scheduleRoomDeletion = (roomCode) => {
    cancelRoomDeletion(roomCode);

    const timer = setTimeout(async () => {
      try {
        const room = await Room.findOne({ roomCode }).lean();

        if (!room) {
          return;
        }

        if ((room.participants || []).length === 0) {
          await Room.deleteOne({ roomCode });
          io.to(roomCode).emit("room_state", { roomCode, participants: [] });
        }
      } catch (error) {
        console.error("scheduleRoomDeletion error:", error);
      } finally {
        pendingRoomDeletionTimers.delete(roomCode);
      }
    }, EMPTY_ROOM_GRACE_MS);

    pendingRoomDeletionTimers.set(roomCode, timer);
  };

  const emitRoomState = async (roomCode) => {
    const room = await Room.findOne({ roomCode }).lean();

    if (!room) {
      io.to(roomCode).emit("room_state", { roomCode, participants: [] });
      return;
    }

    io.to(roomCode).emit("room_state", {
      roomCode,
      participants: normalizeParticipants(room.participants)
    });
  };

  socket.on("join_room", async (payload, ack) => {
    const respond = typeof ack === "function" ? ack : () => {};

    try {
      const roomCode = String(payload?.roomCode || "").trim().toLowerCase();
      const userId = String(payload?.userId || "").trim();
      const name = String(payload?.name || "").trim();

      if (!roomCode || !userId || !name) {
        const message = "roomCode, userId, and name are required";
        socket.emit("error_message", { message });
        respond({ ok: false, message });
        return;
      }

      if (name.length > MAX_NAME_LENGTH) {
        const message = "Name must be 12 characters or fewer";
        socket.emit("error_message", { message });
        respond({ ok: false, message, code: "INVALID_NAME_LENGTH" });
        return;
      }

      if (!ROOM_CODE_REGEX.test(roomCode)) {
        const message = "Room code must be exactly 6 letters/numbers";
        socket.emit("error_message", { message });
        respond({ ok: false, message, code: "INVALID_ROOM_CODE" });
        return;
      }

      const existingRoom = await Room.findOne({ roomCode }).lean();

      if (!existingRoom) {
        const message = "Room not found. Ask the host for a valid room code.";
        socket.emit("error_message", { message });
        respond({ ok: false, message, code: "ROOM_NOT_FOUND" });
        return;
      }

      cancelRoomDeletion(roomCode);

      const addParticipantResult = await Room.updateOne(
        {
          roomCode,
          "participants.userId": { $ne: userId },
          $expr: { $lt: [{ $size: "$participants" }, ROOM_CAPACITY] }
        },
        {
          $push: {
            participants: {
              userId,
              name,
              isSharing: false
            }
          }
        }
      );

      if (!addParticipantResult.modifiedCount) {
        const room = await Room.findOne({ roomCode }).lean();

        if (!room) {
          const message = "Room not found";
          socket.emit("error_message", { message });
          respond({ ok: false, message });
          return;
        }

        const isExistingParticipant = room.participants.some((participant) => participant.userId === userId);

        if (!isExistingParticipant && room.participants.length >= ROOM_CAPACITY) {
          const message = "Room full. Maximum 20 users are allowed.";
          socket.emit("error_message", { message });
          respond({ ok: false, message, code: "ROOM_FULL", capacity: ROOM_CAPACITY });
          return;
        }
      }

      await socket.join(roomCode);
      socket.data.roomCode = roomCode;
      socket.data.userId = userId;

      const roomAfterJoin = await Room.findOne({ roomCode }).lean();

      if (roomAfterJoin) {
        socket.emit("room_state", {
          roomCode,
          participants: roomAfterJoin.participants
        });
      }

      socket.to(roomCode).emit("sync_location_request", { roomCode });

      await emitRoomState(roomCode);
      respond({ ok: true, roomCode, capacity: ROOM_CAPACITY });
    } catch (error) {
      const message = "Failed to join room";
      socket.emit("error_message", { message });
      respond({ ok: false, message });
      console.error("join_room error:", error);
    }
  });

  socket.on("location_update", async (payload) => {
    try {
      const roomCode = socket.data.roomCode || String(payload?.roomCode || "").trim().toLowerCase();
      const userId = socket.data.userId || String(payload?.userId || "").trim();

      if (!roomCode || !userId) {
        return;
      }

      const location = normalizeCoordinates(payload);

      if (!location) {
        return;
      }

      const updateResult = await Room.updateOne(
        { roomCode, "participants.userId": userId },
        {
          $set: {
            "participants.$.isSharing": true,
            "participants.$.location": location
          }
        }
      );

      if (!updateResult.matchedCount) {
        return;
      }

      await emitRoomState(roomCode);
    } catch (error) {
      socket.emit("error_message", { message: "Failed to update location" });
      console.error("location_update error:", error);
    }
  });

  socket.on("sharing_stopped", async () => {
    try {
      const roomCode = socket.data.roomCode;
      const userId = socket.data.userId;

      if (!roomCode || !userId) {
        return;
      }

      const updateResult = await Room.updateOne(
        { roomCode, "participants.userId": userId },
        {
          $set: { "participants.$.isSharing": false },
          $unset: { "participants.$.location": 1 }
        }
      );

      if (!updateResult.matchedCount) {
        return;
      }

      await emitRoomState(roomCode);
    } catch (error) {
      socket.emit("error_message", { message: "Failed to stop sharing" });
      console.error("sharing_stopped error:", error);
    }
  });

  socket.on("leave_room", async () => {
    try {
      const roomCode = socket.data.roomCode;
      const userId = socket.data.userId;

      if (!roomCode || !userId) {
        return;
      }

      await Room.updateOne({ roomCode }, { $pull: { participants: { userId } } });

      socket.leave(roomCode);
      socket.data.roomCode = null;
      socket.data.userId = null;

      await emitRoomState(roomCode);

      const roomAfterLeave = await Room.findOne({ roomCode }).select("participants").lean();

      if (roomAfterLeave && roomAfterLeave.participants.length === 0) {
        scheduleRoomDeletion(roomCode);
      }
    } catch (error) {
      socket.emit("error_message", { message: "Failed to leave room" });
      console.error("leave_room error:", error);
    }
  });

  socket.on("disconnect", async () => {
    try {
      const roomCode = socket.data.roomCode;
      const userId = socket.data.userId;

      if (!roomCode || !userId) {
        return;
      }

      await Room.updateOne({ roomCode }, { $pull: { participants: { userId } } });
      await emitRoomState(roomCode);

      const roomAfterDisconnect = await Room.findOne({ roomCode }).select("participants").lean();

      if (roomAfterDisconnect && roomAfterDisconnect.participants.length === 0) {
        scheduleRoomDeletion(roomCode);
      }
    } catch (error) {
      console.error("disconnect error:", error);
    }
  });
}