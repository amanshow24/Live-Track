export function ParticipantList({ participants, currentUserId }) {
  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow small">Participants</p>
          <h2>{participants.length} connected</h2>
        </div>
      </div>

      <div className="participant-list">
        {participants.length === 0 ? (
          <p className="muted compact">No participants yet.</p>
        ) : (
          participants.map((participant) => (
            <div key={participant.userId} className="participant-item">
              <div>
                <strong>{participant.name}</strong>
                {participant.userId === currentUserId ? <span className="badge">you</span> : null}
              </div>
              <span className={participant.isSharing ? "status on" : "status off"}>
                {participant.isSharing ? "sharing" : "idle"}
              </span>
            </div>
          ))
        )}
      </div>
    </section>
  );
}
