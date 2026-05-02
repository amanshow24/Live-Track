import { JoinForm } from "../components/JoinForm";

export function HomePage({ name, roomCode, onNameChange, onRoomCodeChange, onJoin, onCreate, connected, status, error, roomCodeFromLink, showRejoinAction }) {
  return (
    <main className="shell">
      <JoinForm
        name={name}
        roomCode={roomCode}
        onNameChange={onNameChange}
        onRoomCodeChange={onRoomCodeChange}
        onJoin={onJoin}
        onCreate={onCreate}
        connected={connected}
        status={status}
        error={error}
        roomCodeFromLink={roomCodeFromLink}
        showRejoinAction={showRejoinAction}
      />

      <div className="below-join-text" aria-hidden="false">
        <a href="/about" className="below-join-link">About LiveTrack</a><span className="sep">•</span><span className="below-join-copy">© 2026</span><span className="sep">•</span><a href="http://linkedin.com/in/aman-kumar-show-a5589b290/" target="_blank" rel="noreferrer" className="below-join-link">Aman Show</a>
      </div>
    </main>
  );
}
