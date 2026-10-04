import React, { useState, useEffect } from "react";
import { useTranslation } from 'react-i18next';
import '../i18n';
import { db } from "../firebase";
import { collection, onSnapshot, query, orderBy, limit, getDocs, writeBatch, doc } from "firebase/firestore";
import SeedRoutes from "./SeedRoutes";

const Settings = () => {
  const { t, i18n } = useTranslation();
  const [logs, setLogs] = useState([]);

  // Handle Language Change and Layout Direction
  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
    // Change document direction for Arabic support
    document.body.dir = lng === 'ar' ? 'rtl' : 'ltr';
  };

  useEffect(() => {
    const q = query(collection(db, "system_logs"), orderBy("timestamp", "desc"), limit(20));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const clearReports = async () => {
    if (window.confirm(t('confirm_clear_reports'))) {
      const q = query(collection(db, "reports"));
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      snapshot.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
      alert(t('reports_cleared_success'));
    }
  };

  return (
    <div style={settingsContainer}>
      <h2 style={{ color: "#800000", marginBottom: "20px" }}>{t('system_settings')}</h2>

      <div style={grid}>
        {/* --- LEFT COLUMN: CONTROLS --- */}
        <div style={card}>
          {/* NEW: Language Switcher Section */}
          <h3 style={cardTitle}>{t('language_options')}</h3>
          <div style={languageRow}>
            <button 
              onClick={() => changeLanguage('en')} 
              style={{...lngBtn, backgroundColor: i18n.language === 'en' ? '#800000' : '#eee', color: i18n.language === 'en' ? 'white' : '#333'}}
            >
              English
            </button>
            <button 
              onClick={() => changeLanguage('ar')} 
              style={{...lngBtn, backgroundColor: i18n.language === 'ar' ? '#800000' : '#eee', color: i18n.language === 'ar' ? 'white' : '#333'}}
            >
              العربية
            </button>
          </div>

          <hr style={divider} />

          <h3 style={cardTitle}>{t('database_fleet_tools')}</h3>
          <p style={description}>{t('db_description')}</p>
          
          <div style={toolRow}>
            <span>{t('route_sync')}:</span>
            <SeedRoutes /> 
          </div>

          <div style={toolRow}>
            <span>{t('maintenance')}:</span>
            <button onClick={clearReports} style={secondaryBtn}>{t('clear_reports')}</button>
          </div>
          
          <hr style={divider} />
          
          <h3 style={cardTitle}>{t('system_standards')}</h3>
          <div style={toolRow}>
            <span>{t('tracking_interval')}:</span>
            <select style={selectStyle}>
              <option>{t('freq_high')}</option>
              <option>{t('freq_std')}</option>
              <option>{t('freq_battery')}</option>
            </select>
          </div>
        </div>

        {/* --- RIGHT COLUMN: LOGS --- */}
        <div style={card}>
          <h3 style={cardTitle}>{t('activity_logs')}</h3>
          <div style={logContainer}>
            {logs.length === 0 ? (
              <p style={{ color: "#999", textAlign: "center", marginTop: "20px" }}>{t('no_logs')}</p>
            ) : (
              logs.map(log => (
                <div key={log.id} style={logItem}>
                  <span style={{ color: log.type === 'error' ? '#d32f2f' : '#388E3C', fontWeight: 'bold' }}>
                    [{log.type?.toUpperCase()}]
                  </span>
                  <span style={logTime}>{log.timestamp?.toDate().toLocaleString()}</span>
                  <p style={logMessage}>{log.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// --- UPDATED STYLES ---
const settingsContainer = { padding: "30px", backgroundColor: "#f9f9f9", minHeight: "90vh" };
const grid = { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "25px" };
const card = { background: "white", padding: "20px", borderRadius: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" };
const cardTitle = { margin: "0 0 10px 0", fontSize: "18px", color: "#800000", fontWeight: 'bold' };
const description = { fontSize: "13px", color: "#666", marginBottom: "20px" };
const toolRow = { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 0", borderBottom: "1px solid #eee" };
const secondaryBtn = { padding: "8px 15px", backgroundColor: "#333", color: "white", border: "none", borderRadius: "6px", cursor: "pointer" };
const divider = { margin: "20px 0", border: "0", borderTop: "1px solid #eee" };
const selectStyle = { padding: "6px", borderRadius: "4px", border: "1px solid #ccc" };

// Language specific styles
const languageRow = { display: "flex", gap: "10px", marginBottom: "15px" };
const lngBtn = { flex: 1, padding: "10px", border: "1px solid #ddd", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", transition: "0.3s" };

const logContainer = { 
  height: "400px", 
  overflowY: "auto", 
  background: "#f5f5f5", 
  color: "#333", 
  padding: "15px", 
  borderRadius: "8px", 
  fontFamily: "monospace", 
  fontSize: "12px",
  border: "1px solid #e0e0e0" 
};

const logItem = { marginBottom: "10px", borderBottom: "1px solid #e0e0e0", paddingBottom: "8px" };
const logTime = { marginLeft: "10px", color: "#666", fontSize: '11px' };
const logMessage = { margin: "5px 0 0 0", color: "#444", lineHeight: '1.4' };

export default Settings;