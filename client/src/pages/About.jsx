import React from "react";

export function AboutPage() {
  return (
    <main className="about-page">
      <a href="/" className="about-back-btn">Go Back</a>
      <article className="about-article">
        <h1>About LiveTrack</h1>

        <p>
          LiveTrack is a lightweight, privacy-first location sharing experience built for
          small groups. It focuses on real-time position updates, simple room-based sharing,
          and clear, human-friendly location references.
        </p>

        <section>
          <h2>What is DigiPin?</h2>
          <p>
            DigiPin is a compact, deterministic location encoding used in LiveTrack to share
            approximate positions quickly and consistently. It encodes a location into a
            10-character code which identifies a small geographic cell. DigiPin is intended
            for quick sharing and searching inside LiveTrack and is not a replacement for
            formal addressing systems.
          </p>
        </section>

        <section>
          <h2>About Indian Post / National Level Addressing Grid</h2>
          <p>
            DigiPin is not the same as the Indian Post's National Level Addressing Grid (NLAG).
            NLAG is an addressing initiative with its own structure and purposes. To learn more
            about the Indian Post's approach, see the National Level Addressing Grid on
            Wikipedia:
            {' '}
            <a href="https://en.wikipedia.org/wiki/National_Level_Addressing_Grid" target="_blank" rel="noreferrer">https://en.wikipedia.org/wiki/National_Level_Addressing_Grid</a>
          </p>
        </section>

        <section>
          <h2>Privacy and Use</h2>
          <p>
            LiveTrack only shows your DigiPin to you while sharing; DigiPin codes shared in a
            room are intended to be minimal, human-friendly references rather than precise
            postal addresses. Use DigiPin for quick location lookup inside LiveTrack.
          </p>
        </section>

        <p className="author-note">© 2026 LiveTrack — Built by Aman Show</p>
      </article>
    </main>
  );
}

export default AboutPage;
