// src/components/FleetMap.jsx
import React from 'react';
import { MapContainer, TileLayer, Marker, Polyline, Popup } from 'react-leaflet';
import { getRandomColor, getRandomShapeIcon } from '../utils/mapStyles'; // Note the '../' to go up one level
import 'leaflet/dist/leaflet.css';

const FleetMap = ({ buses }) => {
  return (
    <div className="map-container" style={{ height: "400px", width: "100%", borderRadius: "10px", overflow: "hidden", border: "1px solid #333" }}>
      <MapContainer 
        center={[31.9539, 35.9106]} // Amman coordinates
        zoom={12} 
        style={{ height: "100%", width: "100%" }}
      >
        {/* Dark Mode Map Tiles */}
       <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />

        {buses.map((bus) => {
          // If the bus doesn't have a color assigned yet, generate one
          const busColor = bus.color || getRandomColor(); 
          const busIcon = getRandomShapeIcon(busColor);

          return (
            <React.Fragment key={bus.id}>
              {/* Draw the route line if coordinates exist */}
              {bus.route && (
                <Polyline 
                  positions={bus.route} 
                  pathOptions={{ color: busColor, weight: 4, opacity: 0.7 }} 
                />
              )}

              {/* Draw the bus pin */}
              <Marker position={bus.position || [31.95, 35.91]} icon={busIcon}>
                <Popup>
                  <div style={{ color: 'black', textAlign: 'center' }}>
                    <strong>{bus.busNumber || bus.name}</strong><br/>
                    Status: Active
                  </div>
                </Popup>
              </Marker>
            </React.Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
};

export default FleetMap;