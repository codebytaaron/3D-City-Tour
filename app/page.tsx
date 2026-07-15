"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Map as MapLibreMap, Marker } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

type Landmark = {
  id: string;
  name: string;
  kicker: string;
  coordinates: [number, number];
  zoom: number;
  bearing: number;
  fact: string;
};

const landmarks: Landmark[] = [
  {
    id: "westminster",
    name: "Westminster",
    kicker: "01 · The seat of power",
    coordinates: [-0.1246, 51.5007],
    zoom: 16.3,
    bearing: 22,
    fact: "Big Ben’s Great Bell first rang across London in 1859.",
  },
  {
    id: "eye",
    name: "London Eye",
    kicker: "02 · South Bank",
    coordinates: [-0.1195, 51.5033],
    zoom: 16.4,
    bearing: -35,
    fact: "A full rotation reveals up to 40 kilometres of skyline.",
  },
  {
    id: "stpauls",
    name: "St Paul’s",
    kicker: "03 · Wren’s masterpiece",
    coordinates: [-0.0984, 51.5138],
    zoom: 16.2,
    bearing: 30,
    fact: "The cathedral’s dome has defined the city for over 300 years.",
  },
  {
    id: "tower",
    name: "Tower Bridge",
    kicker: "04 · The eastern icon",
    coordinates: [-0.0754, 51.5055],
    zoom: 16.1,
    bearing: -58,
    fact: "Its two bascules still lift for river traffic around 800 times a year.",
  },
  {
    id: "buckingham",
    name: "Buckingham Palace",
    kicker: "05 · Royal London",
    coordinates: [-0.1419, 51.5014],
    zoom: 16,
    bearing: 18,
    fact: "The palace has been the monarch’s official London residence since 1837.",
  },
];

const routeGeoJson = {
  type: "FeatureCollection" as const,
  features: [
    {
      type: "Feature" as const,
      properties: {},
      geometry: {
        type: "LineString" as const,
        coordinates: landmarks.map((landmark) => landmark.coordinates),
      },
    },
  ],
};

export default function LondonTour() {
  const mapNode = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const markersRef = useRef<Marker[]>([]);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const [ready, setReady] = useState(false);
  const [active, setActive] = useState(0);
  const [touring, setTouring] = useState(false);
  const [night, setNight] = useState(false);
  const [panelOpen, setPanelOpen] = useState(true);

  const clearTour = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    setTouring(false);
  }, []);

  const visit = useCallback((index: number, duration = 2200) => {
    const map = mapRef.current;
    const landmark = landmarks[index];
    if (!map || !landmark) return;
    setActive(index);
    map.flyTo({
      center: landmark.coordinates,
      zoom: landmark.zoom,
      pitch: 67,
      bearing: landmark.bearing,
      duration,
      essential: true,
    });
  }, []);

  const startTour = useCallback(() => {
    clearTour();
    setTouring(true);
    landmarks.forEach((_, index) => {
      const timer = setTimeout(() => visit(index, 2600), index * 5200);
      timersRef.current.push(timer);
    });
    timersRef.current.push(
      setTimeout(() => setTouring(false), landmarks.length * 5200),
    );
  }, [clearTour, visit]);

  useEffect(() => {
    if (!mapNode.current || mapRef.current) return;
    let cancelled = false;

    import("maplibre-gl").then(({ default: maplibregl }) => {
      if (cancelled || !mapNode.current) return;
      const map = new maplibregl.Map({
        container: mapNode.current,
        style: "https://tiles.openfreemap.org/styles/liberty",
        center: [-0.113, 51.507],
        zoom: 14.2,
        pitch: 58,
        bearing: -18,
        antialias: true,
        attributionControl: false,
      });
      mapRef.current = map;
      map.addControl(new maplibregl.NavigationControl({ visualizePitch: true }), "bottom-right");
      map.addControl(
        new maplibregl.AttributionControl({ compact: true, customAttribution: "OpenFreeMap" }),
        "bottom-right",
      );

      map.on("load", () => {
        const layers = map.getStyle().layers ?? [];
        const labelLayer = layers.find((layer) => layer.type === "symbol")?.id;
        if (!map.getLayer("london-3d-buildings")) {
          map.addLayer(
            {
              id: "london-3d-buildings",
              source: "openmaptiles",
              "source-layer": "building",
              type: "fill-extrusion",
              minzoom: 13.5,
              paint: {
                "fill-extrusion-color": [
                  "interpolate",
                  ["linear"],
                  ["get", "render_height"],
                  0,
                  "#d8d0bd",
                  90,
                  "#b7aa8c",
                  220,
                  "#8f816b",
                ],
                "fill-extrusion-height": [
                  "coalesce",
                  ["get", "render_height"],
                  ["get", "height"],
                  8,
                ],
                "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
                "fill-extrusion-opacity": 0.88,
              },
            },
            labelLayer,
          );
        }

        map.addSource("grand-route", { type: "geojson", data: routeGeoJson });
        map.addLayer({
          id: "grand-route-glow",
          type: "line",
          source: "grand-route",
          paint: { "line-color": "#ef5b38", "line-width": 8, "line-opacity": 0.18, "line-blur": 5 },
        });
        map.addLayer({
          id: "grand-route",
          type: "line",
          source: "grand-route",
          paint: { "line-color": "#ef5b38", "line-width": 2.4, "line-opacity": 0.92, "line-dasharray": [1, 1.6] },
        });

        landmarks.forEach((landmark, index) => {
          const element = document.createElement("button");
          element.className = "map-pin";
          element.type = "button";
          element.setAttribute("aria-label", `Visit ${landmark.name}`);
          element.innerHTML = `<span>${String(index + 1).padStart(2, "0")}</span>`;
          element.addEventListener("click", () => {
            clearTour();
            visit(index);
          });
          const marker = new maplibregl.Marker({ element, anchor: "bottom" })
            .setLngLat(landmark.coordinates)
            .addTo(map);
          markersRef.current.push(marker);
        });
        setReady(true);
      });
    });

    return () => {
      cancelled = true;
      timersRef.current.forEach(clearTimeout);
      markersRef.current.forEach((marker) => marker.remove());
      markersRef.current = [];
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, [clearTour, visit]);

  useEffect(() => {
    document.documentElement.dataset.atmosphere = night ? "night" : "day";
  }, [night]);

  return (
    <main className="experience">
      <div ref={mapNode} className="map" aria-label="Interactive 3D map of central London" />
      <div className="map-grade" aria-hidden="true" />
      <div className="grain" aria-hidden="true" />

      <header className="topbar">
        <button className="brand" type="button" onClick={() => mapRef.current?.flyTo({ center: [-0.113, 51.507], zoom: 14.2, pitch: 58, bearing: -18, duration: 1800 })}>
          <span className="brand-mark">L</span>
          <span><strong>LONDON / 3D</strong><small>51.5074° N · 0.1278° W</small></span>
        </button>
        <div className="top-actions">
          <span className={`live-status ${ready ? "is-ready" : ""}`}><i />{ready ? "LIVE MAP" : "LOADING CITY"}</span>
          <button className="icon-button atmosphere-button" type="button" onClick={() => setNight((value) => !value)} aria-label={`Switch to ${night ? "day" : "night"} mode`}>
            <span>{night ? "☀" : "◐"}</span><small>{night ? "DAY" : "NIGHT"}</small>
          </button>
        </div>
      </header>

      <aside className={`story-panel ${panelOpen ? "is-open" : "is-closed"}`}>
        <button className="panel-toggle" type="button" onClick={() => setPanelOpen((value) => !value)} aria-expanded={panelOpen}>
          {panelOpen ? "−" : "+"}<span className="sr-only">{panelOpen ? "Hide" : "Show"} tour panel</span>
        </button>
        <div className="eyebrow"><span>CURATED CITY FLIGHT</span><b>EST. 2026</b></div>
        <h1>London,<br /><em>above it all.</em></h1>
        <p className="intro">Move through the capital in three dimensions. Five icons, one cinematic route, and the stories hidden between them.</p>
        <button className="tour-button" type="button" onClick={touring ? clearTour : startTour} disabled={!ready}>
          <span className="play">{touring ? "■" : "▶"}</span>
          <span><strong>{touring ? "END THE FLIGHT" : "START THE CITY FLIGHT"}</strong><small>{touring ? `STOP ${String(active + 1).padStart(2, "0")} OF 05` : "A 60-SECOND GUIDED TOUR"}</small></span>
        </button>
        <div className="drag-note"><span>↖</span><p><strong>THE CITY IS YOURS</strong>Drag to orbit · Scroll to climb</p></div>
      </aside>

      <section className="landmark-dock" aria-label="London landmarks">
        <div className="dock-header"><span>LANDMARK INDEX</span><b>{String(active + 1).padStart(2, "0")} / 05</b></div>
        <div className="landmark-list">
          {landmarks.map((landmark, index) => (
            <button key={landmark.id} type="button" className={`landmark-card ${active === index ? "is-active" : ""}`} onClick={() => { clearTour(); visit(index); }}>
              <span className="landmark-number">{String(index + 1).padStart(2, "0")}</span>
              <span className="landmark-copy"><small>{landmark.kicker}</small><strong>{landmark.name}</strong><em>{landmark.fact}</em></span>
              <span className="arrow">↗</span>
            </button>
          ))}
        </div>
      </section>

      <div className="compass" aria-hidden="true"><span>N</span><i /></div>
    </main>
  );
}
