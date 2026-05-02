import { useState } from 'react';
import { encodeDigiPin, copyToClipboard } from '../utils/digipin';

export function SharingControls({ sharing, onStart, onStop, locationError, roomCode, location }) {
  const [copied, setCopied] = useState(false);

  const digipin = sharing && location ? encodeDigiPin(location.latitude, location.longitude) : null;

  const handleCopyDigiPin = async () => {
    if (digipin) {
      try {
        await copyToClipboard(digipin);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      } catch (error) {
        console.error('Failed to copy DigiPin:', error);
      }
    }
  };

  return (
    <section className="panel">
      <div className="panel-header">
        <div>
          <p className="eyebrow small">Tracking</p>
          <h2>Live location</h2>
        </div>
      </div>

      <p className="muted compact">
        When sharing starts, the browser sends live location updates to the backend socket.
      </p>

      <div className="button-row">
        {!sharing ? (
          <button type="button" onClick={onStart}>Start sharing</button>
        ) : (
          <button type="button" className="danger" onClick={onStop}>
            Stop sharing
          </button>
        )}
      </div>

      {/* DigiPin moved to map header; sidebar section removed intentionally */}

      <div className="room-meta tight">
        <div>
          <span className="label">Room</span>
          <p>{roomCode || "-"}</p>
        </div>
      </div>

      {locationError ? <p className="error-text">{locationError}</p> : null}
    </section>
  );
}
