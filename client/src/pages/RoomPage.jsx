import { useMemo, useState } from "react";
import { encodeDigiPin, copyToClipboard, formatDigiPin, decodeDigiPin, isInIndia } from "../utils/digipin";
import { ParticipantList } from "../components/ParticipantList";
import { SharingControls } from "../components/SharingControls";
import { TrackingMap } from "../components/TrackingMap";
import { ROOM_CAPACITY } from "../lib/constants";

export function RoomPage({ room, socketStatus, connected, participants, currentUserId, onLeave, onStartSharing, onStopSharing, locationError, sharing, location }) {
  const [copiedRoomLink, setCopiedRoomLink] = useState(false);
  const [copiedDigiPin, setCopiedDigiPin] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchError, setSearchError] = useState('');
  const [searchTarget, setSearchTarget] = useState(null);
  const currentUsers = participants.length;
  const slotsLeft = Math.max(0, ROOM_CAPACITY - currentUsers);

  const roomLink = useMemo(() => {
    return `${window.location.origin}?room=${room.roomCode.toLowerCase()}`;
  }, [room.roomCode]);

  async function handleCopyLink() {
    try {
      await navigator.clipboard.writeText(roomLink);
      setCopiedRoomLink(true);
      setTimeout(() => setCopiedRoomLink(false), 1200);
    } catch {
      // Clipboard can fail in non-secure contexts; no-op keeps UI stable.
    }
  }

  // Called by SharingControls when user submits a DigiPin search
  function handleSearchByDigiPin(code) {
    try {
      const normalized = code.replace(/\s+/g, '').toUpperCase();
      const decoded = decodeDigiPin(normalized);
      const grouped = formatDigiPin(normalized);
      
      // Validate that location is within India
      if (!isInIndia(decoded.center[0], decoded.center[1])) {
        setSearchTarget(null);
        return { ok: false, message: 'Search Only Indian Locations' };
      }
      
      setSearchTarget({ code: grouped, bbox: [decoded.minLat, decoded.minLon, decoded.maxLat, decoded.maxLon], center: decoded.center });
      return { ok: true };
    } catch (err) {
      setSearchTarget(null);
      return { ok: false, message: err?.message || 'Invalid DigiPin' };
    }
  }

  function handleSearchSubmit(e) {
    e?.preventDefault?.();
    setSearchError('');

    const normalized = searchInput.replace(/\s+/g, '').toUpperCase();
    if (!/^[0-9A-F]{10}$/.test(normalized)) {
      setSearchError('Enter a valid 10-character hex DigiPin.');
      return;
    }

    const res = handleSearchByDigiPin(normalized);
    if (res && res.ok === false) {
      setSearchError(res.message || 'Invalid DigiPin');
    }
  }

  function handleSearchInputChange(e) {
    const value = e.target.value;
    setSearchInput(value);

    if (searchError) {
      setSearchError('');
    }

    if (!value.trim()) {
      setSearchTarget(null);
    }
  }

  return (
    <main className="dashboard">
      <aside className="sidebar">
        <section className="room-summary panel">
          <p className="eyebrow small">LiveTrack room</p>
          <h1 className="room-title">{room.roomCode}</h1>
          <p className="muted compact">
            Joined as <strong>{room.name}</strong>. The room state is now driven by the
            backend socket flow.
          </p>

          <div className="room-meta tight">
            <div>
              <span className="label">Connection</span>
              <p>
                <span className={`connection-pill ${connected ? "ok" : "bad"}`}>
                  {connected ? "Connected" : "Disconnected"}
                </span>
              </p>
            </div>
            <div>
              <span className="label">Room link</span>
              <div className="link-row">
                <p>{roomLink}</p>
                <button type="button" className="icon-btn" onClick={handleCopyLink} title="Copy room link" aria-label="Copy room link">
                  {copiedRoomLink ? "✓" : "⧉"}
                </button>
              </div>
            </div>
            <div>
              <span className="label">Room capacity</span>
              <div className="capacity-stats" aria-live="polite">
                <p>
                  Current users <span className="capacity-value">{currentUsers}/{ROOM_CAPACITY}</span>
                </p>
                <p>
                  Slots left <span className="capacity-value">{slotsLeft}</span>
                </p>
              </div>
            </div>
          </div>

          <div className="button-row top-gap leave-wrap">
            <button type="button" className="secondary leave-btn" onClick={onLeave}>
              Leave room
            </button>
          </div>

          <p className="muted tiny">{socketStatus}</p>
        </section>

        <SharingControls
          sharing={sharing}
          onStart={onStartSharing}
          onStop={onStopSharing}
          locationError={locationError}
          roomCode={room.roomCode}
          location={location}
        />

        <ParticipantList participants={participants} currentUserId={currentUserId} />
      </aside>

      <section className="map-panel panel">
        <div className="panel-header room-map-header" style={{ display: 'flex', alignItems: 'center' }}>
          <div className="room-map-title">
            <p className="eyebrow small">Map</p>
            <h2>Live location view</h2>
          </div>

          <form className="digipin-search-form" onSubmit={handleSearchSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 8, marginLeft: 140 }}>
            <span className="label">Search Location by DigiPin</span>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                value={searchInput}
                onChange={handleSearchInputChange}
                placeholder="AB3 25A7 CE5"
                aria-label="Search DigiPin"
                style={{ padding: '8px 12px', borderRadius: 10 }}
              />
              <button type="submit" className="icon-btn" title="Search by DigiPin" aria-label="Search by DigiPin">
                🔍
              </button>
            </div>
            {searchError ? <p style={{ color: '#b42318', fontWeight: 700, margin: 0 }}>{searchError}</p> : null}
          </form>

          {/* LiveTrack DigiPin (shows only for current user when sharing) */}
          <div className="room-digipin-wrap" style={{ marginLeft: 'auto' }}>
            {sharing && location && (
              <div className="digipin-inline">
                <div className="label">Your Current DigiPin -</div>

                <div className="code">
                  {(() => {
                    try {
                        const raw = encodeDigiPin(location.latitude, location.longitude);
                        return formatDigiPin(raw);
                    } catch (e) {
                      return '';
                    }
                  })()}
                </div>

                <div className="actions">
                  <button
                    type="button"
                    className="icon-btn"
                    onClick={async () => {
                      try {
                          const raw = encodeDigiPin(location.latitude, location.longitude);
                          const grouped = formatDigiPin(raw);
                          await copyToClipboard(grouped);
                          setCopiedDigiPin(true);
                          setTimeout(() => setCopiedDigiPin(false), 1200);
                      } catch (err) {
                        console.error('Copy failed', err);
                      }
                    }}
                    title="Copy DigiPin"
                    aria-label="Copy DigiPin"
                  >
                    {copiedDigiPin ? (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <rect x="3" y="3" width="18" height="18" rx="4" fill="#e6f7ec" stroke="#0f5132" strokeWidth="0.8" />
                        <path d="M7 12.5l2 2.2 5-5" stroke="#0f5132" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                      </svg>
                    ) : (
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                        <path d="M16 4h-2.5a1.5 1.5 0 0 0-1.4 1H9.5A1.5 1.5 0 0 0 8 4H6a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z" stroke="#23406b" strokeWidth="1.2" fill="transparent" />
                        <rect x="9" y="8" width="6" height="8" rx="1" stroke="#cfdcf6" strokeWidth="0.8" fill="transparent" />
                      </svg>
                    )}
                  </button>
                  {/* Know more removed per user request */}
                </div>
              </div>
            )}
          </div>
        </div>
        <div className="map-stage">
          <TrackingMap participants={participants} currentUserId={currentUserId} searchTarget={searchTarget} />
        </div>
      </section>
    </main>
  );
}
