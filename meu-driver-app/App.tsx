import 'react-native-gesture-handler';
import './i18n'; // Ensure this is imported first!
import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, Alert, ActivityIndicator, StatusBar, Platform, TextInput, Modal, Linking, I18nManager, AppState } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createDrawerNavigator, DrawerContentScrollView, DrawerItemList, DrawerItem } from '@react-navigation/drawer';
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps'; 
import MapViewDirections from 'react-native-maps-directions';
import * as Location from 'expo-location';
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from "firebase/app";
import { getFirestore, doc, updateDoc, collection, query, where, onSnapshot, getDocs, addDoc, serverTimestamp } from "firebase/firestore"; 
import { initializeAuth, getReactNativePersistence, signInWithEmailAndPassword, signOut } from "firebase/auth";
import { useTranslation } from 'react-i18next';
import * as Updates from 'expo-updates';

const GOOGLE_MAPS_APIKEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? "";
const ADMIN_PHONE_NUMBER = "+962790000000"; 

const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = initializeAuth(app, { persistence: getReactNativePersistence(ReactNativeAsyncStorage) });

const COLORS = { primary: '#800000', gold: '#FFC107', white: '#FFF', red: '#D32F2F', green: '#388E3C', routeLine: '#007AFF', stop: '#FF5722' };
const Drawer = createDrawerNavigator();

const sanitizeCoord = (data) => {
  if (!data) return null;
  const lat = parseFloat(data.latitude || data.lat);
  const lng = parseFloat(data.longitude || data.lng || data.long);
  if (isNaN(lat) || isNaN(lng) || lat === 0 || lng === 0) return null;
  return { latitude: lat, longitude: lng };
};

// --- SETTINGS SCREEN ---
function SettingsScreen() {
  const { t, i18n } = useTranslation();

  const toggleLanguage = async () => {
    const newLang = i18n.language === 'en' ? 'ar' : 'en';
    await i18n.changeLanguage(newLang);
    
    // Handle RTL Layout
    const isRTL = newLang === 'ar';
    if (I18nManager.isRTL !== isRTL) {
        I18nManager.allowRTL(isRTL);
        I18nManager.forceRTL(isRTL);
        Updates.reloadAsync();
    }
  };

  return (
    <View style={styles.settingsContainer}>
      <Text style={styles.settingsTitle}>{t('settings')}</Text>
      
      <View style={styles.settingItem}>
        <Text style={styles.settingLabel}>{t('language')}</Text>
        <TouchableOpacity style={styles.langBtn} onPress={toggleLanguage}>
          <Text style={styles.langText}>{i18n.language === 'en' ? "English" : "العربية"}</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.callAdminBtn} onPress={() => Linking.openURL(`tel:${ADMIN_PHONE_NUMBER}`)}>
        <Text style={styles.callAdminText}>📞 {t('call_admin')}</Text>
      </TouchableOpacity>
    </View>
  );
}

// --- DRAWER CONTENT ---
function CustomDrawerContent(props) {
  const { user, busData } = props;
  const { t } = useTranslation();
  const [modalVisible, setModalVisible] = useState(false);
  const [reportText, setReportText] = useState("");

  const handleLogout = () => { 
    Alert.alert(t('logout'), t('cancel') + "?", [{ text: t('cancel') }, { text: t('logout'), onPress: () => signOut(auth) }]); 
  };

  const submitReport = async () => {
    if (!reportText.trim()) return Alert.alert(t('error'), t('issue_placeholder'));
    try {
      await addDoc(collection(db, "reports"), { driver: user?.email, issue: reportText, timestamp: serverTimestamp() });
      setModalVisible(false); setReportText(""); Alert.alert(t('sent'));
    } catch (e) { Alert.alert(t('error'), "Failed."); }
  };

  return (
    <DrawerContentScrollView {...props}>
      <View style={styles.drawerHeader}>
        <View style={styles.logoCircleSmall}><Text style={styles.logoTextSmall}>MEU</Text></View>
        <Text style={styles.drawerEmail}>{user?.email}</Text>
        <Text style={styles.drawerBusInfo}>Bus: {busData?.busNumber || "..."}</Text>
      </View>
      <DrawerItemList {...props} />
      
      <DrawerItem label={t('report_error')} onPress={() => setModalVisible(true)} />
      <DrawerItem label={t('logout')} onPress={handleLogout} labelStyle={{color: 'red'}} />
      
      <Modal visible={modalVisible} transparent>
        <View style={styles.modalOverlay}>
            <View style={styles.modalContainer}>
                <Text style={styles.modalTitle}>{t('report_title')}</Text>
                <TextInput 
                  style={styles.modalInput} 
                  placeholder={t('issue_placeholder')} // Uses i18n placeholder
                  value={reportText} 
                  onChangeText={setReportText} 
                  multiline 
                />
                <TouchableOpacity style={styles.modalBtn} onPress={submitReport}>
                  <Text style={{fontWeight:'bold'}}>{t('submit')}</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[styles.modalBtn, {marginTop:10, backgroundColor:'red'}]} onPress={() => setModalVisible(false)}>
                  <Text style={{color:'white', fontWeight:'bold'}}>{t('cancel')}</Text>
                </TouchableOpacity>
            </View>
        </View>
      </Modal>
    </DrawerContentScrollView>
  );
}

// --- MAIN MAP SCREEN ---
function MainMapScreen({ location, isTracking, setIsTracking, passengerCount, setPassengerCount, routePackage, statusMessage, mapRef, recenterMap }) {
  const { t } = useTranslation();
  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" />
      {location ? (
        <View style={{flex: 1}}>
            <MapView 
                ref={mapRef} 
                provider={PROVIDER_GOOGLE}
                style={styles.map} 
                showsUserLocation={false} 
                initialRegion={{ latitude: location.latitude, longitude: location.longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 }}
            >
                <Marker coordinate={location} title="My Bus"><View style={styles.busPin}><Text style={{fontSize: 25}}>🚌</Text></View></Marker>
                
                {routePackage?.stops?.map((stop, index) => (
                    <Marker key={index} coordinate={stop} title={`${index+1}: ${stop.name}`}>
                        <View style={styles.stopMarker}><Text style={styles.stopText}>{index + 1}</Text></View>
                    </Marker>
                ))}

                {routePackage?.destination && <Marker coordinate={routePackage.destination} title="End"><View style={styles.stopBadge}><Text style={styles.endText}>END</Text></View></Marker>}
                
                {routePackage?.destination && location && (
                    <MapViewDirections 
                        origin={location} 
                        destination={routePackage.destination} 
                        waypoints={routePackage.stops || []}
                        apikey={GOOGLE_MAPS_APIKEY} 
                        strokeWidth={5} 
                        strokeColor={COLORS.routeLine} 
                    />
                )}
            </MapView>
            <TouchableOpacity style={styles.recenterBtn} onPress={recenterMap}><Text style={{fontSize: 20}}>🎯</Text></TouchableOpacity>
            
            {isTracking && (
                <View style={styles.liveIndicator}>
                    <View style={[styles.dot, {backgroundColor: COLORS.green}]} />
                    <Text style={styles.liveText}>{t('broadcasting_live')}</Text>
                </View>
            )}
        </View>
      ) : <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary} /><Text>{t('finding_gps')}</Text></View>}
      
      <View style={styles.bottomSheet}>
        <View style={styles.routeDisplay}>
          <Text style={styles.label}>{t('assignment')}</Text>
          <Text style={styles.routeTitle}>{routePackage ? routePackage.tripName : t('no_active_route')}</Text>
          <Text style={styles.subText}>{statusMessage}</Text>
        </View>
        <View style={styles.counterRow}>
          <TouchableOpacity style={styles.roundBtn} onPress={() => setPassengerCount(Math.max(0, passengerCount - 1))}><Text style={styles.btnSymbol}>-</Text></TouchableOpacity>
          <Text style={styles.bigNumber}>{passengerCount}</Text>
          <TouchableOpacity style={[styles.roundBtn, {backgroundColor: COLORS.primary}]} onPress={() => setPassengerCount(passengerCount + 1)}><Text style={[styles.btnSymbol, {color: 'white'}]}>+</Text></TouchableOpacity>
        </View>
        <TouchableOpacity style={[styles.mainBtn, {backgroundColor: isTracking ? COLORS.red : COLORS.green}]} onPress={() => setIsTracking(!isTracking)}>
          <Text style={styles.mainBtnText}>{isTracking ? t('stop_trip') : t('start_trip')}</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// --- APP COMPONENT ---
export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [passengerCount, setPassengerCount] = useState(0);
  const [isTracking, setIsTracking] = useState(false);
  const [location, setLocation] = useState(null);
  const [myBusId, setMyBusId] = useState(null); 
  const [busData, setBusData] = useState(null); 
  const [routePackage, setRoutePackage] = useState(null); 
  const [statusMessage, setStatusMessage] = useState("");
  const mapRef = useRef(null);
  const locationRef = useRef(null);
  
  const { t } = useTranslation(); // THIS ENABLES DYNAMIC TITLES

  useEffect(() => { const u = auth.onAuthStateChanged(setUser); return u; }, []);
  const handleLogin = async () => { try { const c = await signInWithEmailAndPassword(auth, email, password); setUser(c.user); } catch (e) { Alert.alert("Error", e.message); } };

  useEffect(() => { setStatusMessage(t('initializing')); }, [t]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "buses"), where("driverId", "==", user.uid));
    const unsub = onSnapshot(q, async (snap) => {
      if (!snap.empty) {
        const d = snap.docs[0];
        setBusData(d.data());
        setMyBusId(d.id);
        if (d.data().route) {
          const rQuery = query(collection(db, "routes"), where("name", "==", d.data().route));
          const rSnap = await getDocs(rQuery);
          if (!rSnap.empty) {
            const rData = rSnap.docs[0].data();
            const cleanDest = sanitizeCoord(rData.endLocation);
            const cleanStops = (rData.stops || []).map(s => ({ name: s.name, ...sanitizeCoord(s) })).filter(s => s.latitude);
            if (cleanDest) {
                setRoutePackage({ tripName: rData.name, destination: cleanDest, stops: cleanStops });
                setStatusMessage(`${t('ready')}: ${rData.name}`);
            }
          }
        }
      }
    });
    return () => unsub();
  }, [user, t]);

  useEffect(() => {
    let sub;
    const start = async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return Alert.alert("Permission Denied", "Allow GPS");
      sub = await Location.watchPositionAsync({ accuracy: Location.Accuracy.BestForNavigation, timeInterval: 1000, distanceInterval: 0 }, (loc) => {
        setLocation(loc.coords);
        locationRef.current = loc.coords;
      });
    };
    if (user) start();
    return () => sub?.remove();
  }, [user]);

  // Handle App Close / Background -> Mark Offline
  useEffect(() => {
    if (!myBusId) return;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        updateDoc(doc(db, "buses", myBusId), {
          status: "Offline",
          lastUpdated: serverTimestamp()
        }).catch(e => console.error("Error setting offline on app background:", e));
      } else if (nextAppState === 'active' && isTracking) {
        updateDoc(doc(db, "buses", myBusId), {
          status: "Active",
          lastUpdated: serverTimestamp()
        }).catch(e => console.error("Error setting active on app resume:", e));
      }
    });

    return () => {
      subscription.remove();
    };
  }, [myBusId, isTracking]);

  useEffect(() => {
    if (!myBusId) return;

    if (!isTracking) {
      // Force status to Offline in Firestore as soon as tracking is turned off
      updateDoc(doc(db, "buses", myBusId), {
        status: "Offline",
        lastUpdated: serverTimestamp()
      }).catch(e => console.error("Error setting offline:", e));
      return;
    }

    const currentLoc = locationRef.current;
    const updatePayload: any = {
      status: "Active",
      lastUpdated: serverTimestamp()
    };
    if (currentLoc && currentLoc.latitude) {
      updatePayload.location = { latitude: currentLoc.latitude, longitude: currentLoc.longitude };
    }

    updateDoc(doc(db, "buses", myBusId), updatePayload).catch(e => console.error("Immediate status error:", e));

    const interval = setInterval(async () => {
        const loc = locationRef.current;
        if (loc && loc.latitude) {
            try {
                await updateDoc(doc(db, "buses", myBusId), {
                    location: { latitude: loc.latitude, longitude: loc.longitude },
                    status: "Active", 
                    lastUpdated: serverTimestamp() 
                });
            } catch(e) {}
        }
    }, 1000); 
    return () => clearInterval(interval);
  }, [isTracking, myBusId]);

  useEffect(() => { if (myBusId) updateDoc(doc(db, "buses", myBusId), { passengerCount }).catch(e => {}); }, [passengerCount]); 

  const recenterMap = () => mapRef.current?.animateToRegion({ ...location, latitudeDelta: 0.005, longitudeDelta: 0.005 }, 1000);

  if (!user) return (<View style={styles.loginContainer}><View style={styles.logoCircle}><Text style={styles.logoText}>MEU</Text></View><TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail}/><TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry /><TouchableOpacity style={styles.loginBtn} onPress={handleLogin}><Text style={styles.btnText}>LOGIN</Text></TouchableOpacity></View>);

  return (
    <NavigationContainer>
      <Drawer.Navigator drawerContent={(p) => <CustomDrawerContent {...p} user={user} busData={busData} />}>
        {/* DYNAMIC TITLES USING t() */}
        <Drawer.Screen 
            name="Tracking" 
            options={{ title: t('tracking') }} // This makes "Tracking" translate
        >
            {() => <MainMapScreen location={location} isTracking={isTracking} setIsTracking={setIsTracking} passengerCount={passengerCount} setPassengerCount={setPassengerCount} routePackage={routePackage} statusMessage={statusMessage} mapRef={mapRef} recenterMap={recenterMap} />}
        </Drawer.Screen>
        
        <Drawer.Screen 
            name="Settings" 
            component={SettingsScreen} 
            options={{ title: t('settings') }} // This makes "Settings" translate
        />
      </Drawer.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f2f2f2' }, 
  map: { width: '100%', height: '100%' }, 
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' }, 
  busPin: { backgroundColor: 'white', padding: 8, borderRadius: 30, borderWidth: 2, borderColor: COLORS.primary }, 
  stopBadge: { backgroundColor: COLORS.gold, width: 30, height: 30, borderRadius: 15, justifyContent: 'center', alignItems: 'center' }, 
  endText: { fontSize: 10, fontWeight: 'bold' }, 
  loginContainer: { flex: 1, backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center', padding: 20 }, 
  logoCircle: { width: 100, height: 100, borderRadius: 50, backgroundColor: COLORS.gold, justifyContent: 'center', alignItems: 'center', marginBottom: 20 }, 
  logoText: { fontSize: 32, fontWeight: 'bold' }, 
  input: { width: '100%', backgroundColor: 'white', padding: 15, borderRadius: 8, marginBottom: 15 }, 
  loginBtn: { width: '100%', backgroundColor: COLORS.gold, padding: 15, borderRadius: 8, alignItems: 'center' }, 
  btnText: { fontWeight: 'bold' }, 
  bottomSheet: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: 'white', padding: 25, borderTopLeftRadius: 25, borderTopRightRadius: 25 }, 
  routeDisplay: { alignItems: 'center', marginBottom: 20 }, 
  label: { fontSize: 12, color: '#888' }, 
  routeTitle: { fontSize: 22, fontWeight: 'bold', color: COLORS.primary }, 
  subText: { fontSize: 12 }, 
  counterRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }, 
  roundBtn: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#eee', justifyContent: 'center', alignItems: 'center' }, 
  btnSymbol: { fontSize: 28 }, 
  bigNumber: { fontSize: 40, fontWeight: 'bold' }, 
  mainBtn: { padding: 18, borderRadius: 12, alignItems: 'center' }, 
  mainBtnText: { color: 'white', fontWeight: 'bold' }, 
  recenterBtn: { position: 'absolute', bottom: 270, right: 20, backgroundColor: 'white', width: 50, height: 50, borderRadius: 25, justifyContent: 'center', alignItems: 'center' }, 
  drawerHeader: { padding: 20, alignItems: 'center' }, 
  logoCircleSmall: { width: 60, height: 60, borderRadius: 30, backgroundColor: COLORS.gold, justifyContent: 'center', alignItems: 'center' }, 
  logoTextSmall: { fontWeight: 'bold' }, 
  drawerEmail: { fontWeight: 'bold' }, 
  drawerBusInfo: { fontSize: 12 }, 
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' }, 
  modalContainer: { width: '85%', backgroundColor: 'white', padding: 20, borderRadius: 15 }, 
  modalTitle: { fontSize: 18, fontWeight: 'bold', marginBottom: 10, color: COLORS.primary }, 
  modalInput: { height: 100, backgroundColor: '#f9f9f9', padding: 10, marginBottom: 20, borderRadius: 8, borderWidth: 1, borderColor: '#eee' }, 
  modalBtn: { width: '100%', padding: 12, borderRadius: 8, alignItems: 'center', backgroundColor: COLORS.gold },
  stopMarker: { backgroundColor: COLORS.stop, width: 24, height: 24, borderRadius: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 2, borderColor: 'white' },
  stopText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  
  settingsContainer: { flex: 1, padding: 20, backgroundColor: 'white' },
  settingsTitle: { fontSize: 28, fontWeight: 'bold', color: COLORS.primary, marginBottom: 30, marginTop: 10 },
  settingItem: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#eee' },
  settingLabel: { fontSize: 18, color: '#333' },
  langBtn: { padding: 8, backgroundColor: '#eee', borderRadius: 8 },
  langText: { fontSize: 16, fontWeight: 'bold', color: COLORS.primary },
  callAdminBtn: { marginTop: 30, backgroundColor: COLORS.gold, padding: 15, borderRadius: 12, alignItems: 'center' },
  callAdminText: { fontSize: 18, fontWeight: 'bold', color: 'black' },
  liveIndicator: { position: 'absolute', top: 50, left: 20, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.9)', padding: 8, borderRadius: 20, elevation: 5 },
  dot: { width: 10, height: 10, borderRadius: 5, marginRight: 6 },
  liveText: { fontSize: 12, fontWeight: 'bold', color: '#333' }
});