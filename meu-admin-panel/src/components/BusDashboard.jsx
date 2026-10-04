import React, { useState, useEffect } from "react";
import { db } from "../firebase"; 
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, getDocs } from "firebase/firestore";
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';

const BusDashboard = () => {
  const { t } = useTranslation();

  const [rawBuses, setRawBuses] = useState([]); // Store raw DB data
  const [buses, setBuses] = useState([]);       // Store processed "Live" data
  const [drivers, setDrivers] = useState([]); 
  const [routes, setRoutes] = useState([]);   
  const [searchTerm, setSearchTerm] = useState(""); 
  
  // Pulse Timer State
  const [currentTime, setCurrentTime] = useState(Date.now());

  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentBusId, setCurrentBusId] = useState(null);

  const [formData, setFormData] = useState({
    busNumber: "",
    driverId: "", 
    driverName: "", 
    route: "",
    capacity: ""
  });

  // --- 1. FETCH RAW DATA ---
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, "buses"), (snapshot) => {
      const data = snapshot.docs.map(doc => {
        const d = doc.data();
        
        // Normalize Timestamp
        let lastUpdateTime = 0;
        if (d.lastUpdated && typeof d.lastUpdated.toMillis === 'function') {
            lastUpdateTime = d.lastUpdated.toMillis();
        } else if (d.lastUpdated) {
            lastUpdateTime = new Date(d.lastUpdated).getTime();
        }

        return { id: doc.id, ...d, lastUpdateTime };
      });
      setRawBuses(data);
    });
    return () => unsubscribe();
  }, []);

  // --- 2. PULSE TICKER (Runs every 1 second) ---
  useEffect(() => {
    const interval = setInterval(() => {
        setCurrentTime(Date.now());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // --- 3. CALCULATE STATUS (Runs on every Tick) ---
  useEffect(() => {
    const STALE_LIMIT = 5000; // 5 Seconds Timeout

    const processed = rawBuses.map(bus => {
        const isFresh = (currentTime - bus.lastUpdateTime) < STALE_LIMIT;
        
        // If DB says "Active" but it's old -> Force "Offline"
        const displayStatus = (bus.status === 'Active' && isFresh) ? 'Active' : 'Offline';

        return { ...bus, status: displayStatus };
    });

    setBuses(processed);
  }, [currentTime, rawBuses]);

  // Fetch Drivers & Routes
  useEffect(() => {
    const fetchData = async () => {
      const drvSnap = await getDocs(collection(db, "drivers"));
      setDrivers(drvSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      const rtSnap = await getDocs(collection(db, "routes"));
      setRoutes(rtSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    };
    fetchData();
  }, []);

  // --- SEARCH LOGIC ---
  const filteredBuses = buses.filter((bus) => {
    const search = searchTerm.toLowerCase();
    return (
      bus.busNumber?.toString().includes(search) || 
      bus.route?.toLowerCase().includes(search) ||
      bus.driverName?.toLowerCase().includes(search)
    );
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleDriverSelect = (e) => {
    const selectedDriverId = e.target.value;
    const selectedDriverObj = drivers.find(d => d.id === selectedDriverId);
    setFormData({
      ...formData,
      driverId: selectedDriverId,
      driverName: selectedDriverObj ? selectedDriverObj.name : ""
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        await updateDoc(doc(db, "buses", currentBusId), formData);
        alert(t('bus_updated'));
      } else {
        await addDoc(collection(db, "buses"), { ...formData, status: "Active", passengerCount: 0 });
        alert(t('new_bus_added'));
      }
      setShowModal(false);
      setFormData({ busNumber: "", driverId: "", driverName: "", route: "", capacity: "" });
    } catch (error) {
      console.error("Error saving bus:", error);
    }
  };

  const handleEdit = (bus) => {
    setFormData(bus);
    setCurrentBusId(bus.id);
    setIsEditing(true);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (window.confirm(t('confirm_delete_bus'))) {
      await deleteDoc(doc(db, "buses", id));
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <div style={headerContainer}>
        <h2 style={{ margin: 0, color: "#800000" }}>{t('bus_management')}</h2>
        
        <div style={searchWrapper}>
          <Search size={18} style={searchIcon} />
          <input 
            type="text" 
            placeholder={t('search_bus_placeholder')} 
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={searchInput}
            onFocus={(e) => {
              e.target.style.background = "#fff";
              e.target.style.borderColor = "#800000";
            }}
            onBlur={(e) => {
              e.target.style.background = "#f5f5f5";
              e.target.style.borderColor = "#e0e0e0";
            }}
          />
        </div>

        <button 
          onClick={() => { setShowModal(true); setIsEditing(false); setFormData({ busNumber: "", driverId: "", driverName: "", route: "", capacity: "" }); }} 
          style={addBtnStyle}
        >
          + {t('add_new_bus')}
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "25px" }}>
        {filteredBuses.map(bus => (
          <div key={bus.id} style={cardStyle}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "10px" }}>
              <h3 style={{ margin: 0 }}>{t('bus')} #{bus.busNumber}</h3>
              
              <span style={{ 
                fontSize: "12px", 
                background: bus.status === 'Active' ? "#d1fae5" : "#fee2e2", 
                color: bus.status === 'Active' ? "#065f46" : "#991b1b", 
                padding: "4px 10px", 
                borderRadius: "20px",
                fontWeight: "bold"
              }}>
                {bus.status === 'Active' ? t('active') : t('offline')}
              </span>
            </div>

            <div style={passengerBox}>
               <span style={passengerLabel}>{t('live_passengers')}</span>
               <div style={passengerValue}>
                 {bus.passengerCount || 0} <span style={{ fontSize: "16px", color: "#aaa", fontWeight: "normal" }}>/ {bus.capacity || 50}</span>
               </div>
            </div>

            <p style={detailText}><strong>{t('driver')}:</strong> {bus.driverName || t('unassigned')}</p>
            <p style={detailText}><strong>{t('route')}:</strong> {bus.route || t('none')}</p>

            <div style={{ marginTop: "15px", display: "flex", gap: "10px" }}>
              <button onClick={() => handleEdit(bus)} style={editBtn}>{t('edit')}</button>
              <button onClick={() => handleDelete(bus.id)} style={deleteBtn}>{t('delete')}</button>
            </div>
          </div>
        ))}
      </div>

      {showModal && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3>{isEditing ? t('edit_bus') : t('add_new_bus')}</h3>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input name="busNumber" placeholder={t('bus_number')} value={formData.busNumber} onChange={handleChange} required style={inputStyle} />
              <input name="capacity" placeholder={t('capacity')} value={formData.capacity} onChange={handleChange} required style={inputStyle} />
              <label>{t('assign_driver')}:</label>
              <select name="driverId" value={formData.driverId} onChange={handleDriverSelect} style={inputStyle} required>
                <option value="">-- {t('select_driver')} --</option>
                {drivers.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              <label>{t('assign_route')}:</label>
              <select name="route" value={formData.route} onChange={handleChange} style={inputStyle} required>
                <option value="">-- {t('select_route')} --</option>
                {routes.map(r => <option key={r.id} value={r.name}>{r.name}</option>)}
              </select>
              <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
                <button type="submit" style={{ ...formBtn, background: "green" }}>{isEditing ? t('save_changes') : t('create_bus')}</button>
                <button type="button" onClick={() => setShowModal(false)} style={{ ...formBtn, background: "red" }}>{t('cancel')}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

// --- STYLES ---
const headerContainer = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", background: "white", padding: "15px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" };
const searchWrapper = { position: "relative", width: "40%", display: "flex", alignItems: "center" };
const searchIcon = { position: "absolute", left: "12px", color: "#888", zIndex: 1 };
const searchInput = { width: "100%", padding: "10px 15px 10px 40px", borderRadius: "8px", border: "1px solid #e0e0e0", background: "#f5f5f5", fontSize: "14px", color: "#333", outline: "none", transition: "all 0.3s ease" };
const addBtnStyle = { background: "#800000", color: "white", padding: "10px 20px", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const cardStyle = { background: "white", border: "1px solid #ddd", padding: "15px", borderRadius: "12px", boxShadow: "0 4px 10px rgba(0,0,0,0.05)" };
const passengerBox = { background: "#f8f9fa", padding: "15px", borderRadius: "8px", textAlign: "center", marginBottom: "15px", border: "1px solid #eee" };
const passengerLabel = { fontSize: "11px", color: "#666", textTransform: "uppercase", letterSpacing: "1px" };
const passengerValue = { fontSize: "28px", fontWeight: "bold", color: "#800000", marginTop: "5px" };
const detailText = { color: "#555", margin: "8px 0", fontSize: "14px" };
const editBtn = { flex: 1, background: "#3b82f6", color: "white", padding: "8px", border: "none", borderRadius: "6px", cursor: "pointer" };
const deleteBtn = { flex: 1, background: "#ef4444", color: "white", padding: "8px", border: "none", borderRadius: "6px", cursor: "pointer" };
const modalOverlay = { position: "fixed", top: "0", left: "0", width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 };
const modalContent = { background: "white", padding: "30px", borderRadius: "10px", width: "400px" };
const inputStyle = { padding: "10px", borderRadius: "5px", border: "1px solid #ccc" };
const formBtn = { flex: 1, padding: "10px", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" };

export default BusDashboard;