import React, { useState, useEffect } from "react";
import { GoogleMap, Marker, DirectionsRenderer } from "@react-google-maps/api";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase"; 
import { useTranslation } from 'react-i18next';

// --- MAP SETTINGS ---
const containerStyle = { width: '100%', height: '85vh', borderRadius: "10px" };
const center = { lat: 31.9539, lng: 35.9106 }; 
const activeRouteColor = "#007AFF"; 
const MEU_DESTINATION = { lat: 31.81, lng: 35.92 };

const Dashboard = () => {
  const { t } = useTranslation();

  const [routes, setRoutes] = useState([]);
  const [rawBuses, setRawBuses] = useState([]); // Store all data from DB
  const [activeBuses, setActiveBuses] = useState([]); // Store ONLY live buses
  const [selectedBus, setSelectedBus] = useState(null);
  const [activeRoute, setActiveRoute] = useState(null);
  const [directionsResponse, setDirectionsResponse] = useState(null);
  
  // --- 1. PULSE TIMER STATE ---
  const [currentTime, setCurrentTime] = useState(Date.now());

  const sanitizeCoord = (loc) => {
    if (!loc) return null;
    const lat = parseFloat(loc.lat || loc.latitude);
    const lng = parseFloat(loc.lng || loc.longitude);
    if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;
    return { lat, lng }; 
  };

  // Fetch Routes
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "routes"), (snap) => {
      setRoutes(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => unsubscribe();
  }, []);

  // --- 2. FETCH RAW DATA (Does not filter yet) ---
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "buses"), (snap) => {
      const busesData = snap.docs.map(doc => {
        const d = doc.data();
        
        // Normalize Timestamp
        let lastUpdateTime = 0;
        if (d.lastUpdated && typeof d.lastUpdated.toMillis === 'function') {
            lastUpdateTime = d.lastUpdated.toMillis();
        } else if (d.lastUpdated) {
            lastUpdateTime = new Date(d.lastUpdated).getTime();
        }

        return { 
            id: doc.id, 
            ...d, 
            location: sanitizeCoord(d.location),
            lastUpdateTime 
        };
      });
      setRawBuses(busesData);
    });
    return () => unsubscribe();
  }, []);

  // --- 3. PULSE TICKER (Runs every 1 second) ---
  useEffect(() => {
    const interval = setInterval(() => {
        setCurrentTime(Date.now()); // Forces re-render every second
    }, 1000); 
    return () => clearInterval(interval);
  }, []);

  // --- 4. LIVE FILTER (Runs on every Tick) ---
  useEffect(() => {
    const LIVE_THRESHOLD = 5000; // 5 Seconds Timeout

    const live = rawBuses.filter(bus => {
        const isRecent = (currentTime - bus.lastUpdateTime) < LIVE_THRESHOLD;
        const isActive = bus.status === 'Active';
        const hasLocation = !!bus.location;
        
        // Only show if Active AND Fresh (updated < 5s ago)
        return isActive && hasLocation && isRecent;
    });

    setActiveBuses(live);

    // Auto-close card if the selected bus goes offline
    if (selectedBus && !live.find(b => b.id === selectedBus.id)) {
        handleClose();
    }
  }, [currentTime, rawBuses]); 

  // Directions Logic
  useEffect(() => {
    if (activeRoute && window.google && selectedBus) {
      const directionsService = new window.google.maps.DirectionsService();
      const waypoints = (activeRoute.stops || []).map(stop => {
            const loc = sanitizeCoord(stop);
            return loc ? { location: loc, stopover: true } : null;
        }).filter(w => w !== null);

      const startLoc = sanitizeCoord(activeRoute.startLocation) || selectedBus.location;

      directionsService.route(
        {
          origin: startLoc, 
          destination: MEU_DESTINATION,     
          waypoints: waypoints,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === window.google.maps.DirectionsStatus.OK) {
            setDirectionsResponse(result);
          }
        }
      );
    } else {
      setDirectionsResponse(null);
    }
  }, [activeRoute, selectedBus]);

  const handleBusClick = (bus) => {
    setSelectedBus(bus);
    const matchedRoute = routes.find(r => r.name === bus.route);
    setActiveRoute(matchedRoute || null);
  };

  const handleClose = () => {
    setSelectedBus(null);
    setActiveRoute(null); 
    setDirectionsResponse(null); 
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2 style={{ marginBottom: "15px", color: "#800000" }}>{t('live_buses_map')}</h2>
      
      <div style={{ height: "85vh", width: "100%", position: "relative" }}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={12}
          options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false }}
        >
          {directionsResponse && selectedBus && (
             <DirectionsRenderer 
                directions={directionsResponse} 
                options={{ 
                    polylineOptions: { strokeColor: activeRouteColor, strokeWeight: 6, strokeOpacity: 0.8 }, 
                    suppressMarkers: false, 
                    preserveViewport: false 
                }} 
             />
          )}

          {/* RENDER ONLY ACTIVE BUSES */}
          {activeBuses.map((bus) => (
            <Marker
                key={bus.id}
                position={bus.location} 
                onClick={() => handleBusClick(bus)}
                label={{ 
                    text: bus.busNumber?.toString(), 
                    color: "white", 
                    fontWeight: "bold", 
                    fontSize: "14px" 
                }}
                icon={{ 
                    path: window.google.maps.SymbolPath.CIRCLE, 
                    scale: 18, 
                    fillColor: "#800000", 
                    fillOpacity: 1, 
                    strokeColor: "white", 
                    strokeWeight: 2 
                }}
            />
          ))}
        </GoogleMap>
        
        <div style={statusOverlayStyle}>
          <h4 style={{ margin: "0 0 10px 0" }}>{t('status_overview')}</h4>
          <div style={statRow}>
            <span>🚍 {t('active_buses')}:</span>
            <strong>{activeBuses.length}</strong>
          </div>
          <div style={statRow}>
            <span>🛣️ {t('total_routes')}:</span>
            <strong>{routes.length}</strong>
          </div>
        </div>

        {selectedBus && (
          <div style={busCardStyle}>
            <div style={cardHeader}>
              <div>
                <h2 style={{ margin: 0, fontSize: "22px", color: "#333" }}>{t('bus')} #{selectedBus.busNumber}</h2>
                <span style={{ fontSize: "12px", color: "#666" }}>{selectedBus.driverName}</span>
              </div>
              <button onClick={handleClose} style={closeBtnStyle}>✕</button>
            </div>
            <div style={passengerBox}>
               <div style={passengerLabel}>{t('live_passengers')}</div>
               <div style={passengerCount}>{selectedBus.passengerCount || 0} <span style={capacityLabel}>/ {selectedBus.capacity}</span></div>
            </div>
            <div style={{ marginBottom: "15px" }}>
              <p style={detailText}><strong>📍 {t('route')}:</strong> {selectedBus.route}</p>
              <p style={detailText}><strong>🏁 {t('destination')}:</strong> {t('meu_campus')}</p>
              <p style={detailText}><strong>⚡ {t('speed')}:</strong> {selectedBus.speed || 0} {t('kmh')}</p>
            </div>
            <div style={{ textAlign: "center" }}>
               <span style={{ 
                 padding: "6px 15px", borderRadius: "20px", color: "white", fontWeight: "bold",
                 background: '#2e7d32' 
               }}>
                 {t('active')}
               </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const statusOverlayStyle = { position: "absolute", top: "10px", left: "10px", background: "white", padding: "15px", borderRadius: "8px", boxShadow: "0 4px 6px rgba(0,0,0,0.1)", minWidth: "200px" };
const statRow = { display: "flex", justifyContent: "space-between", marginBottom: "5px" };
const busCardStyle = { position: "absolute", top: "10px", right: "10px", background: "white", padding: "20px", borderRadius: "10px", boxShadow: "0 5px 15px rgba(0,0,0,0.2)", width: "280px", borderLeft: "5px solid #800000" };
const cardHeader = { display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: "15px" };
const closeBtnStyle = { background: "#eee", border: "none", borderRadius: "50%", width: "30px", height: "30px", cursor: "pointer", fontWeight: "bold" };
const passengerBox = { background: "#f8f9fa", padding: "15px", borderRadius: "8px", textAlign: "center", marginBottom: "15px" };
const passengerLabel = { fontSize: "12px", color: "#555", textTransform: "uppercase", letterSpacing: "1px" };
const passengerCount = { fontSize: "32px", fontWeight: "bold", color: "#d32f2f", margin: "5px 0" };
const capacityLabel = { fontSize: "16px", color: "#aaa", fontWeight: "normal" };
const detailText = { margin: "5px 0", color: "#444", fontSize: "14px" };

export default Dashboard;