import { useEffect, useMemo, useState } from "react";
import { HomePage } from "./pages/HomePage";
import { AboutPage } from "./pages/About";
import { RoomPage } from "./pages/RoomPage";
import { useGeolocation } from "./hooks/useGeolocation";
import { useRoomSocket } from "./hooks/useRoomSocket";

const LAST_JOIN_KEY = "livetrack:lastJoin";
const MAX_NAME_LENGTH = 12;

function createRoomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase();
}

function getSharedRoomCodeFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const candidate = String(params.get("room") || "").trim().toUpperCase();

  if (/^[A-Z0-9]{6}$/.test(candidate)) {
    return candidate;
  }

  return "";
}

function clearRoomCodeFromUrl() {
  const url = new URL(window.location.href);

  if (!url.searchParams.has("room")) {
    return;
  }

  url.searchParams.delete("room");
  const nextUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState({}, "", nextUrl || "/");
}

function readLastJoin() {
  try {
    const raw = window.sessionStorage.getItem(LAST_JOIN_KEY);

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    const roomCode = String(parsed?.roomCode || "").trim().toUpperCase();
    const name = String(parsed?.name || "").trim();
    const rejoinPromptAvailable = parsed?.rejoinPromptAvailable !== false;

    if (!/^[A-Z0-9]{6}$/.test(roomCode) || !name) {
      return null;
    }

    return { roomCode, name, rejoinPromptAvailable };
  } catch {
    return null;
  }
}

function saveLastJoin(roomCode, name) {
  try {
    window.sessionStorage.setItem(
      LAST_JOIN_KEY,
      JSON.stringify({
        roomCode: roomCode.trim().toUpperCase(),
        name: name.trim(),
        rejoinPromptAvailable: true
      })
    );
  } catch {
    // Ignore storage failures (private mode/quota); core flow should still work.
  }
}

function markRejoinPromptAsUsed() {
  const lastJoin = readLastJoin();

  if (!lastJoin) {
    return;
  }

  try {
    window.sessionStorage.setItem(
      LAST_JOIN_KEY,
      JSON.stringify({
        roomCode: lastJoin.roomCode,
        name: lastJoin.name,
        rejoinPromptAvailable: false
      })
    );
  } catch {
    // Ignore storage failures.
  }
}

function clearLastJoin() {
  try {
    window.sessionStorage.removeItem(LAST_JOIN_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export default function App() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';

  if (pathname === '/about') {
    return <AboutPage />;
  }
  const [roomCode, setRoomCode] = useState("");
  const [roomCodeFromLink, setRoomCodeFromLink] = useState(false);
  const [showRejoinAction, setShowRejoinAction] = useState(false);
  const [name, setName] = useState("");
  const [activeRoom, setActiveRoom] = useState(null);
  const [sharing, setSharing] = useState(false);
  const [localError, setLocalError] = useState("");

  const { connected, roomState, socketError, joinRoom, sendLocationUpdate, stopSharing, leaveRoom, userId, locationSyncToken } = useRoomSocket();
  const { location, error: locationError } = useGeolocation({ enabled: sharing });

  const status = useMemo(() => {
    if (socketError) return socketError;
    return connected ? "Connected to server" : "Connecting to server...";
  }, [connected, socketError]);

  useEffect(() => {
    const sharedCode = getSharedRoomCodeFromUrl();

    if (sharedCode) {
      setRoomCode(sharedCode);
      setRoomCodeFromLink(true);
      setShowRejoinAction(false);
      clearRoomCodeFromUrl();
      return;
    }

    const lastJoin = readLastJoin();

    if (lastJoin) {
      if (lastJoin.rejoinPromptAvailable) {
        setName(lastJoin.name);
        setRoomCode(lastJoin.roomCode);
        setRoomCodeFromLink(true);
        setShowRejoinAction(true);
        markRejoinPromptAsUsed();
      } else {
        clearLastJoin();
      }
    }
  }, []);

  useEffect(() => {
    if (!sharing || !location || !activeRoom) return;

    sendLocationUpdate({
      roomCode: activeRoom.roomCode,
      userId,
      name: activeRoom.name,
      latitude: location.latitude,
      longitude: location.longitude,
      accuracy: location.accuracy,
      timestamp: location.timestamp
    });
  }, [sharing, location, activeRoom, sendLocationUpdate, userId, locationSyncToken]);

  async function joinSelectedRoom(cleanRoomCode, cleanName, options = {}) {
    const room = await joinRoom({ roomCode: cleanRoomCode, name: cleanName, ...options });
    setActiveRoom(room);
    saveLastJoin(cleanRoomCode, cleanName);
    setShowRejoinAction(false);
    setLocalError("");
  }

  async function handleJoin(event) {
    event.preventDefault();

    const cleanRoomCode = roomCode.trim().toUpperCase();
    const cleanName = name.trim();

    if (!cleanName) {
      setLocalError("Name is required");
      return;
    }

    if (cleanName.length > MAX_NAME_LENGTH) {
      setLocalError("Name must be 12 characters or fewer");
      return;
    }

    if (!cleanRoomCode) {
      setLocalError("Room code is required");
      return;
    }

    try {
      await joinSelectedRoom(cleanRoomCode, cleanName, { createIfMissing: false });
    } catch (error) {
      setLocalError(error.message || "Unable to join room");
    }
  }

  async function handleCreateRoom() {
    const cleanName = name.trim();

    if (!cleanName) {
      setLocalError("Name is required");
      return;
    }

    if (cleanName.length > MAX_NAME_LENGTH) {
      setLocalError("Name must be 12 characters or fewer");
      return;
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const generatedRoomCode = createRoomCode();

      try {
        setRoomCodeFromLink(false);
        setRoomCode(generatedRoomCode);
        await joinSelectedRoom(generatedRoomCode, cleanName, { createIfMissing: true });
        return;
      } catch (error) {
        const message = error.message || "Unable to create room";

        // Retry on rare random-code collisions, otherwise stop immediately.
        if (message === "Room code already exists" && attempt < 4) {
          continue;
        }

        setLocalError(message);
        return;
      }
    }
  }

  function handleStartSharing() {
    if (!activeRoom) return;
    setSharing(true);
  }

  function handleStopSharing() {
    setSharing(false);
    stopSharing();
  }

  function performLeaveRoom() {
    setActiveRoom(null);
    setSharing(false);
    stopSharing();
    leaveRoom();
    clearLastJoin();
    setShowRejoinAction(false);
    setName("");
    setRoomCode("");
    setRoomCodeFromLink(false);
  }

  function handleLeaveRoom() {
    const confirmed = window.confirm("Are you sure you want to leave this room?");
    if (confirmed) {
      performLeaveRoom();
    }
  }

  if (activeRoom) {
    return (
      <RoomPage
        room={activeRoom}
        socketStatus={status}
        connected={connected}
        participants={roomState.participants}
        currentUserId={userId}
        onLeave={handleLeaveRoom}
        onStartSharing={handleStartSharing}
        onStopSharing={handleStopSharing}
        locationError={locationError}
        sharing={sharing}
        location={location}
      />
    );
  }

  return (
    <HomePage
      name={name}
      roomCode={roomCode}
      onNameChange={setName}
      onRoomCodeChange={(nextRoomCode) => {
        setRoomCode(nextRoomCode);
        setRoomCodeFromLink(false);
        setShowRejoinAction(false);
      }}
      onJoin={handleJoin}
      onCreate={handleCreateRoom}
      connected={connected}
      status={status}
      error={localError}
      roomCodeFromLink={roomCodeFromLink}
      showRejoinAction={showRejoinAction}
    />
  );
}