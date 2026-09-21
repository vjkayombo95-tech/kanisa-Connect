import { useEffect, useRef, useState } from "react";
import * as L from "leaflet";
import "leaflet/dist/leaflet.css";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

type ChurchLocationMapPickerProps = {
  latitude: number;
  longitude: number;
  onLocationChange: (latitude: number, longitude: number) => void;
};

const churchMarkerIcon = L.icon({
  iconRetinaUrl: markerIcon2x,
  iconUrl: markerIcon,
  shadowUrl: markerShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function roundCoordinate(value: number) {
  return Number(value.toFixed(6));
}

export function isValidMapCoordinatePair(latitude: number | null, longitude: number | null) {
  return (
    latitude !== null &&
    longitude !== null &&
    Number.isFinite(latitude) &&
    Number.isFinite(longitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    longitude >= -180 &&
    longitude <= 180
  );
}

export function ChurchLocationMapPicker({ latitude, longitude, onLocationChange }: ChurchLocationMapPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markerRef = useRef<L.Marker | null>(null);
  const onLocationChangeRef = useRef(onLocationChange);
  const [mapFailed, setMapFailed] = useState(false);

  useEffect(() => {
    onLocationChangeRef.current = onLocationChange;
  }, [onLocationChange]);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    let isMounted = true;
    let invalidateSizeTimeout: number | undefined;

    try {
      const map = L.map(containerRef.current, {
        attributionControl: true,
        scrollWheelZoom: false,
        zoomControl: true,
      }).setView([latitude, longitude], 16);

      // Public OSM tiles are appropriate for early/light usage; switch to a managed tile provider if traffic grows.
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      const marker = L.marker([latitude, longitude], {
        draggable: true,
        icon: churchMarkerIcon,
        keyboard: true,
      }).addTo(map);

      const updateLocation = (nextLatitude: number, nextLongitude: number) => {
        const roundedLatitude = roundCoordinate(nextLatitude);
        const roundedLongitude = roundCoordinate(nextLongitude);
        marker.setLatLng([roundedLatitude, roundedLongitude]);
        onLocationChangeRef.current(roundedLatitude, roundedLongitude);
      };

      map.on("click", (event: L.LeafletMouseEvent) => {
        updateLocation(event.latlng.lat, event.latlng.lng);
      });

      marker.on("dragend", () => {
        const next = marker.getLatLng();
        updateLocation(next.lat, next.lng);
      });

      mapRef.current = map;
      markerRef.current = marker;
      invalidateSizeTimeout = window.setTimeout(() => {
        if (isMounted) map.invalidateSize();
      }, 0);
    } catch {
      if (isMounted) setMapFailed(true);
    }

    return () => {
      isMounted = false;
      if (invalidateSizeTimeout !== undefined) {
        window.clearTimeout(invalidateSizeTimeout);
      }
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current || !markerRef.current) return;
    const nextPosition: L.LatLngExpression = [latitude, longitude];
    markerRef.current.setLatLng(nextPosition);
    mapRef.current.setView(nextPosition, mapRef.current.getZoom());
  }, [latitude, longitude]);

  if (mapFailed) {
    return (
      <p role="alert" className="rounded-xl border border-border/70 bg-background/70 p-3 text-sm text-muted-foreground">
        Ramani haikuweza kupakiwa. Bado unaweza kuhifadhi eneo kwa kutumia anwani au mipangilio ya kina.
      </p>
    );
  }

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        role="application"
        aria-label="Ramani ya kuchagua eneo la kanisa"
        aria-describedby="church-location-map-help"
        className="h-60 w-full overflow-hidden rounded-2xl border border-border/70 bg-muted sm:h-64"
      />
      <p id="church-location-map-help" className="text-sm text-muted-foreground">
        Gusa kwenye ramani kuweka eneo sahihi la kanisa. Unaweza pia kuburuta alama.
      </p>
    </div>
  );
}
