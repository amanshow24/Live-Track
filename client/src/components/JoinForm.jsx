import { useState } from "react";

export function JoinForm({ name, roomCode, onNameChange, onRoomCodeChange, onJoin, onCreate, connected, status, error, roomCodeFromLink, showRejoinAction }) {
  const [mode, setMode] = useState("join");
  const isJoinMode = showRejoinAction ? true : mode === "join";

  async function handleSubmit(event) {
    if (mode === "create") {
      event.preventDefault();
      await onCreate();
      return;
    }

    await onJoin(event);
  }

  return (
    <section className="card">
      <p className="eyebrow">LiveTrack</p>
      <h1 className="join-title">Join or create a room</h1>
      <p className="muted">
        Up to 20 users are allowed per room at a time.
      </p>

      {showRejoinAction ? (
        <div className="rejoin-banner">
          Room and name restored from your last session. Click rejoin to continue.
        </div>
      ) : (
        <div className="mode-toggle" role="tablist" aria-label="Room action mode">
          <button
            type="button"
            className={`mode-btn ${mode === "join" ? "active" : ""}`}
            onClick={() => setMode("join")}
            aria-pressed={mode === "join"}
          >
            Join room
          </button>
          <button
            type="button"
            className={`mode-btn ${mode === "create" ? "active" : ""}`}
            onClick={() => setMode("create")}
            aria-pressed={mode === "create"}
          >
            Create room
          </button>
        </div>
      )}

      <form className="stack" onSubmit={handleSubmit}>
        <label>
          <span className="label">Your name</span>
          <input
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            placeholder="Enter your name"
            maxLength={12}
          />
        </label>

        {isJoinMode && roomCodeFromLink ? (
          <div className="prefilled-room-code">
            <span className="label">Room code (6 characters)</span>
            <p>
              {showRejoinAction ? "Rejoining room " : "Joining room "}
              <strong>{roomCode}</strong>
              {showRejoinAction ? " from your last session." : " from shared link."}
            </p>
          </div>
        ) : null}

        {isJoinMode && !roomCodeFromLink ? (
          <label>
            <span className="label">Room code (6 characters)</span>
            <input
              className="room-code-input"
              value={roomCode}
              onChange={(event) => onRoomCodeChange(event.target.value.toUpperCase())}
              placeholder="Enter 6-character room code"
              maxLength={6}
              autoCapitalize="characters"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
              pattern="[A-Za-z0-9]{6}"
            />
          </label>
        ) : null}

        <div className="button-row">
          <button type="submit">
            {showRejoinAction ? "Rejoin room" : isJoinMode ? "Join room" : "Create room"}
          </button>
        </div>

        <div className="status-line">
          <span className={connected ? "dot dot-ready" : "dot"} />
          <span>{status}</span>
        </div>

        {error ? <p className="error-text">{error}</p> : null}
      </form>
    </section>
  );
}
