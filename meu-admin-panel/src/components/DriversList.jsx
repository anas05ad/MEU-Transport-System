import React, { useState, useEffect } from "react";
import { db, auth } from "../firebase"; 
import DriverReports from "./DriverReports"; 
import { collection, getDocs, updateDoc, deleteDoc, doc, setDoc } from "firebase/firestore";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { useTranslation } from 'react-i18next';
import { Search } from 'lucide-react';

const DriversList = () => {
  const { t } = useTranslation();
  const [drivers, setDrivers] = useState([]);
  const [searchTerm, setSearchTerm] = useState(""); 
  const [showModal, setShowModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentDriverId, setCurrentDriverId] = useState(null);

  const [formData, setFormData] = useState({
    name: "", phone: "", busNo: "", businessDays: "Sunday - Thursday", 
    offDay: "Friday", email: "", password: "" 
  });

  // 1. Fetch Drivers on Load
  useEffect(() => {
    const fetchDrivers = async () => {
      const querySnapshot = await getDocs(collection(db, "drivers"));
      const driversData = querySnapshot.docs.map(doc => ({ ...doc.data(), id: doc.id }));
      setDrivers(driversData);
    };
    fetchDrivers();
  }, []);

  // 2. Search & Filter Logic
  const filteredDrivers = drivers.filter((driver) => {
    const search = searchTerm.toLowerCase();
    return (
      driver.name?.toLowerCase().includes(search) || 
      driver.busNo?.toString().includes(search)
    );
  });

  // 3. Handle Input Change
  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  // 4. Submit Form (Add or Edit)
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (isEditing) {
        const driverRef = doc(db, "drivers", currentDriverId);
        await updateDoc(driverRef, {
            name: formData.name,
            phone: formData.phone,
            busNo: formData.busNo,
            businessDays: formData.businessDays,
            offDay: formData.offDay
        });
        alert(t('driver_updated_success'));
      } else {
        const generatedEmail = formData.email || `${formData.name.replace(/\s/g, '').toLowerCase()}@meu.edu.jo`;
        const generatedPassword = formData.password || "meu123456"; 

        const userCredential = await createUserWithEmailAndPassword(auth, generatedEmail, generatedPassword);
        const user = userCredential.user;

        await setDoc(doc(db, "drivers", user.uid), {
            uid: user.uid, 
            name: formData.name,
            phone: formData.phone,
            busNo: formData.busNo,
            businessDays: formData.businessDays,
            offDay: formData.offDay,
            email: generatedEmail,
            role: "driver",
            status: "active"
        });
        alert(`${t('driver_created_success')}\nEmail: ${generatedEmail}\nPassword: ${generatedPassword}`);
      }
      setShowModal(false);
      setFormData({ name: "", phone: "", busNo: "", businessDays: "", offDay: "", email: "", password: "" });
      window.location.reload(); 
    } catch (error) {
      console.error("Error: ", error);
      alert(t('error_generic') + ": " + error.message);
    }
  };

  const handleEdit = (driver) => {
    setFormData(driver);
    setCurrentDriverId(driver.id); 
    setIsEditing(true);
    setShowModal(true);
  };

  const handleDelete = async (id) => {
    if (!window.confirm(t('confirm_delete_driver'))) return;
    try {
      await deleteDoc(doc(db, "drivers", id));
      setDrivers(drivers.filter((driver) => driver.id !== id));
      alert(t('driver_deleted_success'));
    } catch (error) {
      alert(t('error_deleting_driver'));
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      
      {/* --- TOP HEADER --- */}
      <div style={headerContainer}>
        <h2 style={{ margin: 0, color: "#800000" }}>{t('drivers_management')}</h2>
        
        {/* CENTERED SEARCH BAR (Light Grey) */}
        <div style={searchWrapper}>
          <Search size={18} style={searchIcon} />
          <input 
            type="text" 
            placeholder={t('search_placeholder')} 
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
          onClick={() => { setShowModal(true); setIsEditing(false); setFormData({name:"", phone:"", busNo:"", businessDays:"", offDay:"", email:"", password:""}); }}
          style={addBtnStyle}
        >
          + {t('add_new_driver')}
        </button>
      </div>

      {/* --- CONTENT GRID --- */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 350px", gap: "25px", alignItems: "start" }}>
        
        {/* LEFT: TABLE */}
        <div style={tableContainer}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f4f4f4", textAlign: "left" }}>
                <th style={thStyle}>{t('name')}</th>
                <th style={thStyle}>{t('bus_no')}</th>
                <th style={thStyle}>{t('phone')}</th>
                <th style={thStyle}>{t('off_day')}</th>
                <th style={thStyle}>{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredDrivers.length > 0 ? (
                filteredDrivers.map((driver) => (
                  <tr key={driver.id} style={trStyle}>
                    <td style={tdStyle}>{driver.name}</td>
                    <td style={tdStyle}>{driver.busNo}</td>
                    <td style={tdStyle}>{driver.phone}</td>
                    <td style={tdStyle}>{driver.offDay}</td>
                    <td style={tdStyle}>
                      <button onClick={() => handleEdit(driver)} style={editBtnStyle}>{t('edit')}</button>
                      <button onClick={() => handleDelete(driver.id)} style={deleteBtnStyle}>{t('delete')}</button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" style={{ textAlign: "center", padding: "20px", color: "#999" }}>
                    No drivers found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* RIGHT: REPORTS */}
        <div style={{ position: "sticky", top: "20px" }}>
          <div style={sidebarWrapper}>
             <DriverReports />
          </div>
        </div>
      </div>

      {/* --- MODAL --- */}
      {showModal && (
        <div style={modalOverlay}>
          <div style={modalContent}>
            <h3>{isEditing ? t('edit_driver') : t('add_new_driver')}</h3>
            <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <input name="name" placeholder={t('full_name')} value={formData.name} onChange={handleChange} required style={inputStyle} />
              <input name="phone" placeholder={t('phone_number')} value={formData.phone} onChange={handleChange} required style={inputStyle} />
              <input name="busNo" placeholder={t('bus_number')} value={formData.busNo} onChange={handleChange} required style={inputStyle} />
              
              <label style={{fontSize: "13px", fontWeight: "bold"}}>{t('business_days')}:</label>
              <select name="businessDays" value={formData.businessDays} onChange={handleChange} style={inputStyle}>
                <option value="Sunday - Thursday">Sunday - Thursday</option>
                <option value="Saturday - Thursday">Saturday - Thursday</option>
              </select>

              <label style={{fontSize: "13px", fontWeight: "bold"}}>{t('off_day')}:</label>
              <select name="offDay" value={formData.offDay} onChange={handleChange} style={inputStyle}>
                <option value="Friday">Friday</option>
                <option value="Saturday">Saturday</option>
                <option value="Sunday">Sunday</option>
              </select>

              {!isEditing && (
                <>
                  <hr />
                  <p style={{fontSize:"11px", color:"gray"}}>{t('auth_credentials_hint')}</p>
                  <input name="email" type="email" placeholder={t('email_optional')} value={formData.email} onChange={handleChange} style={inputStyle} />
                  <input name="password" type="password" placeholder={t('password_optional')} value={formData.password} onChange={handleChange} style={inputStyle} />
                </>
              )}

              <div style={{ marginTop: "20px", display: "flex", gap: "10px" }}>
                <button type="submit" style={{ ...formBtn, background: "green" }}>{isEditing ? t('update') : t('create')}</button>
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
const headerContainer = { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "30px", background: "white", padding: "15px 25px", borderRadius: "12px", boxShadow: "0 2px 10px rgba(0,0,0,0.05)" };
const searchWrapper = { position: "relative", width: "40%", display: "flex", alignItems: "center" };
const searchIcon = { position: "absolute", left: "12px", color: "#888", zIndex: 1 };
const searchInput = { width: "100%", padding: "10px 15px 10px 40px", borderRadius: "8px", border: "1px solid #e0e0e0", background: "#f5f5f5", fontSize: "14px", color: "#333", outline: "none", transition: "all 0.3s ease" };
const addBtnStyle = { background: "#800000", color: "white", padding: "10px 20px", border: "none", borderRadius: "8px", cursor: "pointer", fontWeight: "bold" };
const tableContainer = { background: "white", padding: "20px", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" };
const sidebarWrapper = { background: "white", padding: "20px", borderRadius: "10px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" };
const thStyle = { padding: "12px", borderBottom: "2px solid #eee" };
const trStyle = { borderBottom: "1px solid #eee" };
const tdStyle = { padding: "12px" };
const editBtnStyle = { background: "#007bff", color: "white", padding: "5px 10px", border: "none", borderRadius: "4px", cursor: "pointer", marginRight: "10px" };
const deleteBtnStyle = { background: "#dc3545", color: "white", padding: "5px 10px", border: "none", borderRadius: "4px", cursor: "pointer" };
const modalOverlay = { position: "fixed", top: "0", left: "0", width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center", zIndex: 1000 };
const modalContent = { background: "white", padding: "30px", borderRadius: "10px", width: "400px" };
const inputStyle = { padding: "10px", borderRadius: "5px", border: "1px solid #ccc" };
const formBtn = { flex: 1, padding: "10px", color: "white", border: "none", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" };

export default DriversList;