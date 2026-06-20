import { useState, useRef, useCallback } from "react";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix default marker icon
import icon from "leaflet/dist/images/marker-icon.png";
import iconShadow from "leaflet/dist/images/marker-shadow.png";
const DefaultIcon = L.icon({
  iconUrl: icon,
  shadowUrl: iconShadow,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});
L.Marker.prototype.options.icon = DefaultIcon;

export default function MapPicker({
  onLocationSelect,
  currentMapLocation = "",
}) {
  const [position, setPosition] = useState([14.5995, 120.9842]); // default Manila
  const [pendingLocation, setPendingLocation] = useState(null);
  const [searchText, setSearchText] = useState("");
  const [loading, setLoading] = useState(false);
  const mapRef = useRef(null);

  // Search (instant confirm)
  const handleSearch = useCallback(async () => {
    if (!searchText.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchText)}&format=json&limit=1`,
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const { lat, lon, display_name } = data[0];
        const newPos = [parseFloat(lat), parseFloat(lon)];
        setPosition(newPos);
        setPendingLocation(null);
        if (mapRef.current) mapRef.current.flyTo(newPos, 15);
        onLocationSelect({ map_location: display_name, lat, lng: lon });
      }
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setLoading(false);
    }
  }, [searchText, onLocationSelect]);

  // Map click – mark pending
  const MapClickHandler = () => {
    useMapEvents({
      click(e) {
        const { lat, lng } = e.latlng;
        setPosition([lat, lng]);
        setPendingLocation({ lat, lng });
      },
    });
    return null;
  };

  // Confirm pending click
  const handleConfirmClick = useCallback(async () => {
    if (!pendingLocation) return;
    try {
      const { lat, lng } = pendingLocation;
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
      );
      const data = await res.json();
      const address = data.display_name || `${lat}, ${lng}`;
      onLocationSelect({ map_location: address, lat, lng });
      setPendingLocation(null);
    } catch (err) {
      console.error("Reverse geocode failed", err);
    }
  }, [pendingLocation, onLocationSelect]);

  return (
    <div>
      {/* Current selection preview */}
      {currentMapLocation && (
        <div
          style={{
            marginBottom: "8px",
            padding: "8px",
            background: "#f0f0f0",
            borderRadius: "8px",
            fontSize: "13px",
            color: "#374151",
          }}
        >
          📍 {currentMapLocation}
        </div>
      )}

      {/* Search box */}
      <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
        <input
          type="text"
          placeholder="Search for a location…"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          style={{
            flex: 1,
            padding: "8px",
            borderRadius: "8px",
            border: "1px solid #ccc",
          }}
        />
        <button
          type="button"
          onClick={handleSearch}
          disabled={loading}
          style={{
            padding: "8px 12px",
            background: "var(--primary-color, #800000)",
            color: "white",
            border: "none",
            borderRadius: "8px",
            cursor: "pointer",
          }}
        >
          {loading ? "..." : "Search"}
        </button>
      </div>

      {/* Map */}
      <div
        style={{
          height: "250px",
          width: "100%",
          borderRadius: "12px",
          overflow: "hidden",
        }}
      >
        <MapContainer
          center={position}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
          whenCreated={(map) => {
            mapRef.current = map;
          }}
        >
          <TileLayer
            attribution="&copy; OpenStreetMap contributors"
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={position} draggable={true} />
          <MapClickHandler />
        </MapContainer>
      </div>

      {/* Set Location button (only after a click) */}
      {pendingLocation && (
        <div style={{ marginTop: "10px", textAlign: "center" }}>
          <button
            type="button"
            onClick={handleConfirmClick}
            style={{
              padding: "10px 24px",
              background: "#800000",
              color: "white",
              border: "none",
              borderRadius: "10px",
              fontWeight: "600",
              cursor: "pointer",
            }}
          >
            Set Location
          </button>
        </div>
      )}
    </div>
  );
}
