import { useEffect, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { encodeDigiPin, isInIndia, formatDigiPin } from "../utils/digipin";

function getLabel(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function getCoordinates(participant) {
  const location = participant?.location;

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

  return [latitude, longitude];
}

function createCoordinateKey([latitude, longitude]) {
  return `${latitude.toFixed(6)}:${longitude.toFixed(6)}`;
}

function spreadOverlappingCoordinates(entries) {
  const groups = new Map();

  entries.forEach((entry) => {
    const key = createCoordinateKey(entry.coordinates);
    const group = groups.get(key) || [];
    group.push(entry);
    groups.set(key, group);
  });

  groups.forEach((group) => {
    if (group.length <= 1) {
      return;
    }

    group.sort((left, right) => left.participant.userId.localeCompare(right.participant.userId));

    const [baseLatitude, baseLongitude] = group[0].coordinates;
    const latitudeRadians = (baseLatitude * Math.PI) / 180;
    const radiusMeters = 10;
    const latitudeDelta = radiusMeters / 111_320;
    const longitudeScale = Math.max(Math.cos(latitudeRadians), 0.2);
    const longitudeDelta = radiusMeters / (111_320 * longitudeScale);

    group.forEach((entry, index) => {
      const angle = (2 * Math.PI * index) / group.length;
      const latitudeOffset = latitudeDelta * Math.sin(angle);
      const longitudeOffset = longitudeDelta * Math.cos(angle);

      entry.renderCoordinates = [baseLatitude + latitudeOffset, baseLongitude + longitudeOffset];
    });
  });

  return entries;
}

function tuneVectorStyle(map) {
  const layers = map.getStyle()?.layers || [];

  layers.forEach((layer) => {
    const id = layer.id.toLowerCase();

    if (layer.type === "line" && /(road|street|highway|motorway|trunk|primary|secondary|tertiary|path|service|track)/.test(id)) {
      const majorRoad = /(motorway|trunk|primary|highway|main)/.test(id);

      try {
        map.setPaintProperty(layer.id, "line-color", majorRoad ? "#93a2b4" : "#c8d1dd");
        map.setPaintProperty(layer.id, "line-opacity", majorRoad ? 0.96 : 0.9);
      } catch {
        // Ignore layers that do not support these paint properties.
      }
    }

    if (layer.type === "line" && /(water|river|stream|canal)/.test(id)) {
      try {
        map.setPaintProperty(layer.id, "line-color", "#8fd6ef");
        map.setPaintProperty(layer.id, "line-opacity", 0.9);
      } catch {
        // Ignore layers that do not support these paint properties.
      }
    }

    if (layer.type === "fill" && /(landuse|park|forest|greenspace|green)/.test(id)) {
      try {
        map.setPaintProperty(layer.id, "fill-color", "#e7f4ea");
        map.setPaintProperty(layer.id, "fill-opacity", 0.78);
      } catch {
        // Ignore layers that do not support these paint properties.
      }
    }

    if (layer.type === "symbol" && /(label|place|poi|road)/.test(id)) {
      try {
        map.setPaintProperty(layer.id, "text-color", "#314962");
        map.setPaintProperty(layer.id, "text-halo-color", "#ffffff");
        map.setPaintProperty(layer.id, "text-halo-width", 1.35);
        map.setPaintProperty(layer.id, "text-halo-blur", 0.3);
      } catch {
        // Ignore layers that do not support these paint properties.
      }

      if (/(road|street)/.test(id)) {
        try {
          map.setLayoutProperty(layer.id, "text-size", [
            "interpolate",
            ["linear"],
            ["zoom"],
            5,
            10.2,
            10,
            12.2,
            15,
            13.4
          ]);
        } catch {
          // Ignore layers that do not support this layout property.
        }
      }

      if (/(place|poi|settlement|village|town|city)/.test(id)) {
        try {
          map.setLayoutProperty(layer.id, "text-size", [
            "interpolate",
            ["linear"],
            ["zoom"],
            3,
            10.4,
            8,
            12.4,
            13,
            16.4
          ]);
        } catch {
          // Ignore layers that do not support this layout property.
        }
      }
    }
  });
}

function createMarkerElement(participant, currentUserId) {
  const wrapper = document.createElement("div");
  const classes = [
    "marker",
    participant.userId === currentUserId ? "current" : "",
    participant.isSharing ? "is-sharing" : "is-idle"
  ]
    .filter(Boolean)
    .join(" ");

  wrapper.className = "user-marker";
  wrapper.innerHTML = `
    <div class="${classes}">
      <div class="marker-avatar">
        <span>${getLabel(participant.name)}</span>
      </div>
      <div class="marker-name">${participant.name}</div>
    </div>
  `;

  return wrapper;
}

export function TrackingMap({ participants, currentUserId }) {
  // Optional search target from parent: { code, bbox: [minLat,minLon,maxLat,maxLon], center: [lat,lon] }
  // Put prop in signature for backward compatibility
  const _props = arguments[0] || {};
  const searchTarget = _props.searchTarget;

  const mapRef = useRef(null);
  const containerRef = useRef(null);
  const markersRef = useRef(new Map());
  const [mapReady, setMapReady] = useState(false);
  const initialFitDoneRef = useRef(false);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: "https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json",
      center: [77, 20],
      zoom: 4,
      attributionControl: true,
      pitchWithRotate: false,
      dragRotate: false,
      touchPitch: false
    });

    map.addControl(new maplibregl.NavigationControl({ showCompass: false }), "top-left");

    map.on("load", () => {
      tuneVectorStyle(map);
      setMapReady(true);
    });

    // Add click handler for India region to show DigiPin
    map.on("click", (e) => {
      const { lat, lng } = e.lngLat;

      if (isInIndia(lat, lng)) {
        try {
          const digipin = encodeDigiPin(lat, lng);
          const grouped = formatDigiPin(digipin);

          new maplibregl.Popup({
            closeButton: true,
            closeOnClick: true,
            maxWidth: "300px"
          })
            .setLngLat([lng, lat])
            .setHTML(`<div style="padding: 8px;"><strong>DigiPin</strong><br /><code style="font-size: 14px; font-weight: 600; letter-spacing: 1px;">${grouped}</code></div>`)
            .addTo(map);
        } catch (error) {
          console.error("Failed to encode DigiPin:", error);
        }
      }
    });

    mapRef.current = map;

    return () => {
      markersRef.current.forEach(({ marker }) => marker.remove());
      markersRef.current.clear();
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // Show search result when parent sets searchTarget
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !searchTarget) return;

    // Remove previous temporary marker if any
    if (markersRef.current.has('__search__')) {
      const prev = markersRef.current.get('__search__');
      prev.marker.remove();
      markersRef.current.delete('__search__');
    }

    const { bbox, center, code } = searchTarget;
    const popup = new maplibregl.Popup({ closeButton: true, closeOnClick: true, maxWidth: '300px' })
      .setHTML(`<div style="padding:8px"><strong>Related location</strong><br/><code style="font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, monospace; font-weight:700">${code}</code></div>`);

    const el = document.createElement('div');
    el.className = 'user-marker';
    el.innerHTML = `<div class="marker"><div class="marker-avatar" style="width:40px;height:40px;border-radius:50%;background:#2f69d9;color:#fff;display:grid;place-items:center;font-weight:700;box-shadow:0 8px 18px rgba(30,62,120,0.2),0 0 0 2px #fff"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><circle cx="12" cy="12" r="3" fill="currentColor"/><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg></div></div>`;

    const marker = new maplibregl.Marker({ element: el, anchor: 'center' }).setLngLat([center[1], center[0]]).setPopup(popup).addTo(map);

    markersRef.current.set('__search__', { marker, bbox });

    try {
      const [minLat, minLon, maxLat, maxLon] = bbox;
      const bounds = new maplibregl.LngLatBounds([minLon, minLat], [maxLon, maxLat]);
      map.fitBounds(bounds, { padding: 100, maxZoom: 14, duration: 700 });
    } catch {
      // fallback: fly to center
      map.easeTo({ center: [center[1], center[0]], zoom: 14 });
    }

    return () => {
      if (markersRef.current.has('__search__')) {
        const item = markersRef.current.get('__search__');
        item.marker.remove();
        markersRef.current.delete('__search__');
      }
    };
  }, [searchTarget, mapReady]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;

    const activeParticipants = spreadOverlappingCoordinates(
      participants
        .map((participant) => {
          const coordinates = getCoordinates(participant);

          if (!coordinates) {
            return null;
          }

          return { participant, coordinates, renderCoordinates: coordinates };
        })
        .filter(Boolean)
    );

    // Remove only participant markers, keep search marker
    const searchMarker = markersRef.current.get('__search__');
    markersRef.current.forEach((item, key) => {
      if (key !== '__search__') {
        item.marker.remove();
        markersRef.current.delete(key);
      }
    });
    // Re-add search marker if it existed
    if (searchMarker) {
      markersRef.current.set('__search__', searchMarker);
    }

    activeParticipants.forEach(({ participant, coordinates, renderCoordinates }) => {
      const element = createMarkerElement(participant, currentUserId);
      const popup = new maplibregl.Popup({
        offset: 16,
        closeButton: true,
        closeOnClick: true,
        maxWidth: "260px"
      }).setHTML(`
        <strong>${participant.name}</strong><br />
        ${participant.isSharing ? "Sharing live location" : "Idle"}
      `);

      const marker = new maplibregl.Marker({
        element,
        anchor: "center"
      })
        .setLngLat([renderCoordinates[1], renderCoordinates[0]])
        .setPopup(popup)
        .addTo(map);

      markersRef.current.set(participant.userId, { marker, coordinates });
    });

    if (activeParticipants.length > 0) {
      const bounds = new maplibregl.LngLatBounds();

      activeParticipants.forEach(({ coordinates }) => {
        bounds.extend([coordinates[1], coordinates[0]]);
      });

      // Only fit bounds on initial load, not on every location update
      if (!initialFitDoneRef.current) {
        initialFitDoneRef.current = true;
        map.fitBounds(bounds, {
          padding: 50,
          maxZoom: 16,
          duration: 700
        });
      }
    }
  }, [participants, currentUserId, mapReady]);

  return <div ref={containerRef} className="map-shell" />;
}
