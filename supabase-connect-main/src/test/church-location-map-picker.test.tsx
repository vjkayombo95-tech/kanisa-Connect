import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const leafletState = vi.hoisted(() => {
  const tileLayer = {
    addTo: vi.fn(),
    on: vi.fn(),
  };
  const mapInstance = {
    setView: vi.fn(),
    getZoom: vi.fn(),
    on: vi.fn(),
    remove: vi.fn(),
    invalidateSize: vi.fn(),
  };
  const markerInstance = {
    addTo: vi.fn(),
    on: vi.fn(),
    setLatLng: vi.fn(),
    getLatLng: vi.fn(),
  };

  return {
    mapHandlers: {} as Record<string, (event: { latlng: { lat: number; lng: number } }) => void>,
    markerHandlers: {} as Record<string, () => void>,
    tileHandlers: {} as Record<string, () => void>,
    map: vi.fn(),
    marker: vi.fn(),
    tileLayerFactory: vi.fn(),
    icon: vi.fn((options) => ({ options })),
    throwOnMapInit: false,
    mapInstance,
    markerInstance,
    tileLayer,
  };
});

vi.mock("leaflet", () => {
  leafletState.tileLayer.addTo.mockImplementation(() => leafletState.tileLayer);
  leafletState.tileLayer.on.mockImplementation((event: string, handler: () => void) => {
    leafletState.tileHandlers[event] = handler;
    return leafletState.tileLayer;
  });
  leafletState.mapInstance.setView.mockImplementation(() => leafletState.mapInstance);
  leafletState.mapInstance.getZoom.mockReturnValue(16);
  leafletState.mapInstance.on.mockImplementation((event: string, handler: (payload: { latlng: { lat: number; lng: number } }) => void) => {
    leafletState.mapHandlers[event] = handler;
    return leafletState.mapInstance;
  });
  leafletState.markerInstance.addTo.mockImplementation(() => leafletState.markerInstance);
  leafletState.markerInstance.on.mockImplementation((event: string, handler: () => void) => {
    leafletState.markerHandlers[event] = handler;
    return leafletState.markerInstance;
  });
  leafletState.markerInstance.getLatLng.mockReturnValue({ lat: -6.81234567, lng: 39.29876543 });
  leafletState.map.mockImplementation(() => {
    if (leafletState.throwOnMapInit) throw new Error("leaflet failed");
    return leafletState.mapInstance;
  });
  leafletState.marker.mockReturnValue(leafletState.markerInstance);
  leafletState.tileLayerFactory.mockReturnValue(leafletState.tileLayer);

  return {
    icon: leafletState.icon,
    map: leafletState.map,
    marker: leafletState.marker,
    tileLayer: leafletState.tileLayerFactory,
  };
});

import { ChurchLocationMapPicker, isValidMapCoordinatePair } from "@/components/church-admin/ChurchLocationMapPicker";

describe("ChurchLocationMapPicker", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    leafletState.mapHandlers = {};
    leafletState.markerHandlers = {};
    leafletState.tileHandlers = {};
    leafletState.throwOnMapInit = false;
    host = document.createElement("div");
    document.body.append(host);
    root = createRoot(host);
  });

  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const renderPicker = (onLocationChange = vi.fn(), latitude = -6.816, longitude = 39.289) => {
    act(() => {
      root.render(createElement(ChurchLocationMapPicker, { latitude, longitude, onLocationChange }));
    });
    return onLocationChange;
  };

  it("initializes a compact OSM map for valid coordinates including 0,0", () => {
    renderPicker(vi.fn(), 0, 0);

    expect(isValidMapCoordinatePair(0, 0)).toBe(true);
    expect(leafletState.map).toHaveBeenCalledTimes(1);
    expect(leafletState.mapInstance.setView).toHaveBeenCalledWith([0, 0], 16);
    expect(leafletState.marker).toHaveBeenCalledWith([0, 0], expect.objectContaining({ draggable: true }));
    expect(leafletState.tileLayerFactory).toHaveBeenCalledWith(
      "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
      expect.objectContaining({ attribution: expect.stringContaining("OpenStreetMap") }),
    );
    expect(host.textContent).toContain("Gusa kwenye ramani kuweka eneo sahihi la kanisa");
  });

  it("updates local coordinates from map click without saving", () => {
    const onLocationChange = renderPicker();

    act(() => leafletState.mapHandlers.click({ latlng: { lat: -6.81234567, lng: 39.29876543 } }));

    expect(onLocationChange).toHaveBeenCalledWith(-6.812346, 39.298765);
    expect(leafletState.markerInstance.setLatLng).toHaveBeenCalledWith([-6.812346, 39.298765]);
  });

  it("updates local coordinates from marker drag without saving", () => {
    const onLocationChange = renderPicker();

    act(() => leafletState.markerHandlers.dragend());

    expect(onLocationChange).toHaveBeenCalledWith(-6.812346, 39.298765);
  });

  it("syncs marker and map when parent coordinates change", () => {
    const onLocationChange = renderPicker();

    act(() => {
      root.render(createElement(ChurchLocationMapPicker, { latitude: -7.1, longitude: 39.4, onLocationChange }));
    });

    expect(leafletState.markerInstance.setLatLng).toHaveBeenCalledWith([-7.1, 39.4]);
    expect(leafletState.mapInstance.setView).toHaveBeenLastCalledWith([-7.1, 39.4], 16);
  });

  it("shows a friendly fallback if Leaflet initialization fails", () => {
    leafletState.throwOnMapInit = true;

    renderPicker();

    expect(host.textContent).toContain("Ramani haikuweza kupakiwa");
  });

  it("keeps the map usable when a single tile fails", () => {
    const onLocationChange = renderPicker();

    expect(() => leafletState.tileHandlers.tileerror?.()).not.toThrow();
    expect(leafletState.mapInstance.remove).not.toHaveBeenCalled();
    expect(host.textContent).not.toContain("Ramani haikuweza kupakiwa");

    act(() => leafletState.mapHandlers.click({ latlng: { lat: -6.8, lng: 39.3 } }));

    expect(onLocationChange).toHaveBeenCalledWith(-6.8, 39.3);
  });
});
