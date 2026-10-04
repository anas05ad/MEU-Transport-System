import React, { useState, useEffect } from "react";
import { db } from "../firebase";
import { collection, onSnapshot, query, orderBy, deleteDoc, doc } from "firebase/firestore";

const DriverReports = () => {
  const [reports, setReports] = useState([]);

  useEffect(() => {
    // Listen for new reports, newest first
    const q = query(collection(db, "reports"), orderBy("timestamp", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setReports(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribe();
  }, []);

  const resolveReport = async (id) => {
    if (window.confirm("Mark this issue as resolved and delete it?")) {
      await deleteDoc(doc(db, "reports", id));
    }
  };

  return (
    <div style={{ padding: "20px", background: "#f9f9f9", borderRadius: "10px" }}>
      <h3 style={{ color: "#800000", marginBottom: "20px" }}>🚨 Driver Technical Reports</h3>
      
      {reports.length === 0 ? (
        <p style={{ color: "#888" }}>No active issues reported by drivers.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "15px" }}>
          {reports.map((report) => (
            <div key={report.id} style={reportCardStyle}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start" }}>
                <div>
                  <strong style={{ fontSize: "16px" }}>Bus #{report.busNo} - {report.driverName}</strong>
                  <p style={{ margin: "5px 0", color: "#666", fontSize: "14px" }}>
                    Status: <span style={{ color: report.status === 'Active' ? 'green' : 'red' }}>{report.status}</span>
                  </p>
                </div>
                <span style={{ fontSize: "12px", color: "#999" }}>
                  {report.timestamp?.toDate().toLocaleString()}
                </span>
              </div>
              
              <div style={{ marginTop: "10px", padding: "10px", background: "#fff", borderRadius: "5px", borderLeft: "4px solid #800000" }}>
                <p style={{ margin: 0, fontStyle: "italic" }}>"{report.issue}"</p>
              </div>

              <button 
                onClick={() => resolveReport(report.id)}
                style={resolveBtnStyle}
              >
                Mark as Resolved
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const reportCardStyle = {
  background: "white",
  padding: "15px",
  borderRadius: "8px",
  boxShadow: "0 2px 4px rgba(0,0,0,0.05)",
  border: "1px solid #ddd"
};

const resolveBtnStyle = {
  marginTop: "10px",
  background: "#2e7d32",
  color: "white",
  border: "none",
  padding: "8px 15px",
  borderRadius: "5px",
  cursor: "pointer",
  fontSize: "12px"
};

export default DriverReports;