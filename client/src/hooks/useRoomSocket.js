import { useEffect, useMemo, useRef, useState } from "react";
import { io } from "socket.io-client";
import { SERVER_URL } from "../lib/constants";

const ROOM_CODE_REGEX = /^[A-Z0-9]{6}$/;
const MAX_NAME_LENGTH = 12;

function createUserId() {
  return Math.random().toString(36).slice(2, 12);
}

function mergeParticipantsWithLastKnownLocation(previousParticipants, nextParticipants) {
  const previousByUserId = new Map((previousParticipants || []).map((participant) => [participant.userId, participant]));

  return (nextParticipants || []).map((participant) => {
    const previousParticipant = previousByUserId.get(participant.userId);

    if (participant.location) {
      return participant;
    }

    if (participant.isSharing && previousParticipant?.location) {
      return {
        ...participant,
        location: previousParticipant.location
      };
    }

    return participant;
  });
}

export function useRoomSocket() {
  const [connected, setConnected] = useState(false);
  const [roomState, setRoomState] = useState({ roomCode: "", participants: [] });
  const [socketError, setSocketError] = useState("");
  const [locationSyncToken, setLocationSyncToken] = useState(0);
  const socketRef = useRef(null);
  const userIdRef = useRef(createUserId());
  const repairingSnapshotRef = useRef(false);

  useEffect(() => {
    const socket = io(SERVER_URL, {
      transports: ["websocket"]
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setConnected(true);
      setSocketError("");
    });

    socket.on("disconnect", () => {
      setConnected(false);
    });

    socket.on("room_state", (payload) => {
      const incomingParticipants = payload.participants || [];

      setRoomState((current) => ({
        roomCode: payload.roomCode || current.roomCode,
        participants: mergeParticipantsWithLastKnownLocation(current.participants, incomingParticipants)
      }));

      const roomCode = String(payload.roomCode || "").trim();
      const hasSharingWithoutLocation = incomingParticipants.some((participant) => participant?.isSharing && !participant?.location);

      if (!roomCode || !hasSharingWithoutLocation || repairingSnapshotRef.current) {
        return;
      }

      repairingSnapshotRef.current = true;

      fetch(`${SERVER_URL}/api/rooms/${encodeURIComponent(roomCode)}`)
        .then(async (response) => {
          if (!response.ok) {
            return null;
          }

          try {
            return await response.json();
          } catch {
            return null;
          }
        })
        .then((room) => {
          if (!room) {
            return;
          }

          const snapshotParticipants = Array.isArray(room.participants) ? room.participants : [];

          setRoomState((current) => ({
            roomCode: String(room.roomCode || current.roomCode).toUpperCase(),
            participants: mergeParticipantsWithLastKnownLocation(current.participants, snapshotParticipants)
          }));
        })
        .finally(() => {
          repairingSnapshotRef.current = false;
        });
    });

    socket.on("error_message", (payload) => {
      setSocketError(payload.message || "Something went wrong");
    });

    socket.on("sync_location_request", () => {
      setLocationSyncToken((value) => value + 1);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const actions = useMemo(() => {
    async function fetchRoomSnapshot(roomCode) {
      const response = await fetch(`${SERVER_URL}/api/rooms/${encodeURIComponent(roomCode)}`);

      if (!response.ok) {
        return null;
      }

      try {
        const room = await response.json();
        return {
          roomCode: String(room?.roomCode || "").toUpperCase(),
          participants: Array.isArray(room?.participants) ? room.participants : []
        };
      } catch {
        return null;
      }
    }

    async function createRoom(roomCode) {
      const response = await fetch(`${SERVER_URL}/api/rooms`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ roomCode })
      });

      if (!response.ok) {
        let message = "Unable to create room";

        try {
          const data = await response.json();
          if (data?.error) {
            message = data.error;
          }
        } catch {
          // Ignore JSON parse errors and use default message.
        }

        throw new Error(message);
      }
    }

    async function ensureRoomExists(roomCode) {
      const response = await fetch(`${SERVER_URL}/api/rooms/${encodeURIComponent(roomCode)}`);

      if (!response.ok) {
        let message = "Room not found";

        try {
          const data = await response.json();
          if (data?.error) {
            message = data.error;
          }
        } catch {
          // Ignore JSON parse errors and use default message.
        }

        throw new Error(message);
      }
    }

    async function joinRoom({ roomCode, name, createIfMissing = false }) {
      const cleanRoomCode = roomCode.trim().toUpperCase();
      const cleanName = name.trim();

      if (!cleanRoomCode || !cleanName) {
        throw new Error("Name and room code are required");
      }

      if (cleanName.length > MAX_NAME_LENGTH) {
        throw new Error("Name must be 12 characters or fewer");
      }

      if (!ROOM_CODE_REGEX.test(cleanRoomCode)) {
        throw new Error("Room code must be exactly 6 letters/numbers");
      }

      if (!socketRef.current || !connected) {
        throw new Error("Server is not ready yet");
      }

      if (createIfMissing) {
        await createRoom(cleanRoomCode);
      } else {
        await ensureRoomExists(cleanRoomCode);
      }

      const joinResponse = await new Promise((resolve) => {
        socketRef.current.emit(
          "join_room",
          {
            roomCode: cleanRoomCode,
            userId: userIdRef.current,
            name: cleanName
          },
          (response) => resolve(response || { ok: false, message: "Join request timed out" })
        );
      });

      if (!joinResponse.ok) {
        throw new Error(joinResponse.message || "Unable to join room");
      }

      const snapshot = await fetchRoomSnapshot(cleanRoomCode);

      if (snapshot) {
        setRoomState((current) => ({
          roomCode: snapshot.roomCode || current.roomCode,
          participants: mergeParticipantsWithLastKnownLocation(current.participants, snapshot.participants)
        }));
      }

      return { roomCode: cleanRoomCode, name: cleanName, userId: userIdRef.current };
    }

    function sendLocationUpdate(payload) {
      socketRef.current?.emit("location_update", payload);
    }

    function stopSharing() {
      socketRef.current?.emit("sharing_stopped");
    }

    function leaveRoom() {
      socketRef.current?.emit("leave_room");
      setRoomState({ roomCode: "", participants: [] });
    }

    return {
      joinRoom,
      sendLocationUpdate,
      stopSharing,
      leaveRoom
    };
  }, [connected]);

  return {
    connected,
    roomState,
    socketError,
    locationSyncToken,
    userId: userIdRef.current,
    ...actions
  };
}
