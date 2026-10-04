import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, StatusBar, Platform, TextInput, Alert, Modal, KeyboardAvoidingView, ScrollView, Keyboard, ActivityIndicator } from 'react-native';
import { SafeAreaView, SafeAreaProvider } from 'react-native-safe-area-context'; 
import MapView, { Marker, PROVIDER_GOOGLE } from 'react-native-maps'; 
import MapViewDirections from 'react-native-maps-directions';
import { Ionicons } from '@expo/vector-icons'; 
import ReactNativeAsyncStorage from '@react-native-async-storage/async-storage';
import { initializeApp } from "firebase/app";
import { getFirestore, collection, onSnapshot, query, where, getDocs } from "firebase/firestore";
import { initializeAuth, getReactNativePersistence, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, updateProfile } from "firebase/auth";
import * as Location from 'expo-location';
import { WebView } from 'react-native-webview';

// --- CONFIGURATION ---
const GOOGLE_MAPS_APIKEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ?? ""; 
const MEU_BUS_WEBSITE = "https://meubus.meu.edu.jo/";

const MEU_DESTINATION = { 
  latitude: 31.805630, 
  longitude: 35.920587 
};

// --- LIVENESS THRESHOLDS ---------------------------------------------------
// The old code dropped a bus from the map after 5s without a GPS ping, which
// on a mobile network means buses blink in and out constantly. Worse, a bus
// that went quiet simply vanished, so a student could not tell "no bus" from
// "bus lost signal". Three states now, re-evaluated on a timer.
const LIVE_MS   = 30_000;    // fresh
const STALE_MS  = 120_000;   // beyond this the bus leaves the map entirely
const TICK_MS   = 5_000;     // liveness re-evaluation interval

// Directions are only re-requested when the bus has actually moved this far.
// Previously every Firestore location write re-ran MapViewDirections, which
// meant a paid Directions call every 2-5 seconds per selected bus.
const REROUTE_THRESHOLD_M = 150;

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

// --- THEMES ---
const THEMES = {
  light: { background: 'white', card: 'white', text: '#333', subText: '#666', inputBg: '#F5F5F5', border: '#EEE', icon: '#333' },
  dark: { background: '#121212', card: '#1E1E1E', text: '#FFF', subText: '#AAA', inputBg: '#333', border: '#444', icon: '#FFF' }
};

// --- TRANSLATIONS ---
const TRANSLATIONS = {
  en: {
    welcome: "Welcome",
    to_campus: "To MEU Campus",
    from_campus: "From MEU Campus",
    sign_out: "Sign Out",
    settings: "Settings",
    language: "Language",
    theme: "Theme",
    dark_mode: "Dark Mode",
    light_mode: "Light Mode",
    change_name: "Change Name",
    update: "Update",
    rate_us: "Rate Us",
    version: "Version 1.0.0",
    developer: "Dev by Eng. Anas Hassan",
    search_placeholder: "Search Route (e.g. Route 1)...",
    upcoming_stops: "UPCOMING STOPS",
    bus: "Bus",
    seats: "Seats",
    full: "FULL",
    open: "OPEN",
    close: "Close",
    calculating: "Calculating times...",
    no_data: "No stops data",
    name_updated: "Name Updated Successfully!",
    schedule_title: "Bus Schedule",
    signal_lost: "Signal lost — last known position",
    route_error: "Route unavailable right now",
    loading_map: "Loading map...",
    location_off: "Location is off. Enable it to see yourself on the map."
  },
  ar: {
    welcome: "مرحباً",
    to_campus: "إلى جامعة الشرق الأوسط",
    from_campus: "من جامعة الشرق الأوسط",
    sign_out: "تسجيل خروج",
    settings: "الإعدادات",
    language: "اللغة",
    theme: "المظهر",
    dark_mode: "الوضع الداكن",
    light_mode: "الوضع الفاتح",
    change_name: "تغيير الاسم",
    update: "تحديث",
    rate_us: "قيّمنا",
    version: "الإصدار 1.0.0",
    developer: "تطوير م. أنس حسن",
    search_placeholder: "ابحث عن خط (مثال: خط 1)...",
    upcoming_stops: "المحطات القادمة",
    bus: "حافلة",
    seats: "مقاعد",
    full: "ممتلئ",
    open: "متاح",
    close: "إغلاق",
    calculating: "جاري حساب الوقت...",
    no_data: "لا توجد بيانات",
    name_updated: "تم تحديث الاسم بنجاح!",
    schedule_title: "جدول الحافلات",
    signal_lost: "انقطعت الإشارة — آخر موقع معروف",
    route_error: "المسار غير متاح حالياً",
    loading_map: "جارٍ تحميل الخريطة...",
    location_off: "الموقع مغلق. فعّله لترى موقعك على الخريطة."
  }
};

const COLORS = { primary: '#800000', gold: '#FFC107', white: '#FFF', grey: '#F5F5F5', green: '#2E7D32', red: '#C62828', stop: '#FF5722' };

export default function App() {
  const [user, setUser] = useState(null);
  const [currentScreen, setCurrentScreen] = useState('LOGIN'); 
  
  const [appLang, setAppLang] = useState('en'); 
  const [appTheme, setAppTheme] = useState('light'); 
  const theme = THEMES[appTheme];
  const text = TRANSLATIONS[appLang];

  // ---- PERSISTENT map state (survives cancel) ----
  const [buses, setBuses] = useState([]);          // raw, unfiltered, from Firestore
  const [now, setNow] = useState(Date.now());      // drives liveness re-evaluation
  const [locationGranted, setLocationGranted] = useState(false);
  const [searchText, setSearchText] = useState('');

  // ---- TEMPORARY map state (everything below is cleared by resetMapState) ----
  const [selectedBusId, setSelectedBusId] = useState(null);   // id only, never a stale snapshot
  const [routePackage, setRoutePackage] = useState(null);
  const [stopEtas, setStopEtas] = useState([]);
  const [totalEta, setTotalEta] = useState(null);
  const [routeLoading, setRouteLoading] = useState(false);
  const [routeError, setRouteError] = useState(false);
  const [directionsOrigin, setDirectionsOrigin] = useState(null);
  
  const [menuVisible, setMenuVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [newName, setNewName] = useState('');

  const [name, setName] = useState(''); 
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authReady, setAuthReady] = useState(false);
  
  const mapRef = useRef(null);

  // Every selection gets a token. An async result may only touch state if its
  // token is still the current one — this is what stops a cancelled or
  // superseded request from resurrecting a route (see MAP QA report R1).
  const selectionToken = useRef(0);
  const isMounted = useRef(true);
  useEffect(() => () => { isMounted.current = false; }, []);

  const sanitizeCoord = (data) => {
    if (!data) return null;
    const lat = parseFloat(data.latitude ?? data.lat);
    const lng = parseFloat(data.longitude ?? data.lng ?? data.long);
    if (isNaN(lat) || isNaN(lng)) return null;
    if (lat === 0 && lng === 0) return null;              // null island
    if (lat < -90 || lat > 90) return null;               // out of range would warp the camera
    if (lng < -180 || lng > 180) return null;
    return { latitude: lat, longitude: lng };
  };

  // metres between two coords, used to decide whether a re-route is warranted
  const distanceM = (a, b) => {
    if (!a || !b) return Infinity;
    const R = 6371000, toRad = (d) => (d * Math.PI) / 180;
    const dLat = toRad(b.latitude - a.latitude);
    const dLng = toRad(b.longitude - a.longitude);
    const h = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };

  const handleAuth = async () => {
    if(!email || !password) return Alert.alert("Error", "Enter email/password");
    setAuthLoading(true);
    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, email, password);
      } else {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(cred.user, { displayName: name });
        setUser({ ...cred.user, displayName: name });
      }
      setPassword('');
      setCurrentScreen('SELECTION');
    } catch (err) { Alert.alert("Error", err?.message || "Sign in failed"); }
    if (isMounted.current) setAuthLoading(false);
  };

  const handleLogout = async () => {
    resetMapState();
    setSearchText('');
    setMenuVisible(false);
    setSettingsVisible(false);
    try { await signOut(auth); } catch (e) { console.log("Sign out:", e?.message); }
    // onAuthStateChanged drives user/currentScreen from here.
  };

  const handleUpdateName = async () => {
    if (!newName.trim()) return;
    try {
        await updateProfile(auth.currentUser, { displayName: newName });
        setUser({ ...auth.currentUser, displayName: newName }); 
        Alert.alert("Success", text.name_updated);
        setNewName('');
    } catch (_e) {
        Alert.alert("Error", "Could not update name.");
    }
  };

  const toggleLanguage = () => {
    setAppLang(prev => prev === 'en' ? 'ar' : 'en');
  };

  const toggleTheme = () => {
    setAppTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleRateUs = () => {
    Alert.alert(text.rate_us, "Thank you for using MEU Bus! ⭐⭐⭐⭐⭐");
  };

  // Restore the persisted session. initializeAuth was already configured with
  // AsyncStorage persistence, but nothing ever read it back, so every launch
  // dropped the student on the login screen.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthReady(true);
      if (u) setCurrentScreen((prev) => (prev === 'LOGIN' ? 'SELECTION' : prev));
      else setCurrentScreen('LOGIN');
    });
    return () => unsub();
  }, []);

  // showsUserLocation does nothing on Android without a runtime grant.
  // expo-location was already a dependency and was never used.
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (!cancelled && isMounted.current) setLocationGranted(status === 'granted');
      } catch {
        if (!cancelled && isMounted.current) setLocationGranted(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Liveness must be re-evaluated on a clock, not only when some other bus
  // happens to write. Previously a bus that went offline stayed on the map
  // until an unrelated bus updated.
  useEffect(() => {
    if (currentScreen !== 'MAP') return;
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, [currentScreen]);

  // Single subscription. Stores everything; filtering is derived, never stored.
  useEffect(() => {
    if (!user) return;
    const unsub = onSnapshot(collection(db, "buses"), (snapshot) => {
      const rows = snapshot.docs.map(doc => {
        const d = doc.data();
        let lastUpdateTime = 0;
        if (d.lastUpdated && typeof d.lastUpdated.toMillis === 'function') {
          lastUpdateTime = d.lastUpdated.toMillis();
        } else if (d.lastUpdated) {
          const parsed = new Date(d.lastUpdated).getTime();
          lastUpdateTime = isNaN(parsed) ? 0 : parsed;
        }
        return {
          id: doc.id,
          ...d,
          location: sanitizeCoord(d.location),
          currentTripName: d.currentTripName || d.route || "Bus",
          lastUpdateTime,
        };
      });
      if (isMounted.current) setBuses(rows);
    }, (err) => {
      console.log("Buses subscription error:", err?.message);
    });
    return () => unsub();
  }, [user]);

  // ---- DERIVED: liveness. One source of truth, recomputed on tick. ----
  const liveBuses = useMemo(() => buses.map(b => {
    const age = now - b.lastUpdateTime;
    let state = 'live';
    if (b.status !== 'Active') state = 'gone';
    else if (!b.location) state = 'gone';
    else if (!b.route || !b.route.trim()) state = 'gone';
    else if (age > STALE_MS) state = 'gone';
    else if (age > LIVE_MS) state = 'no_signal';
    return { ...b, state, ageMs: age };
  }).filter(b => b.state !== 'gone'), [buses, now]);

  // ---- DERIVED: search. Was a second useState that the snapshot handler
  //      overwrote, so an incoming bus update briefly wiped the active filter.
  const visibleBuses = useMemo(() => {
    const term = searchText.toLowerCase().trim();
    if (!term) return liveBuses;
    return liveBuses.filter(b => (b.route || "").toLowerCase().includes(term));
  }, [liveBuses, searchText]);

  // ---- CENTRALISED CLEANUP -------------------------------------------------
  // Clears every TEMPORARY element and invalidates any in-flight request.
  // Persistent state (bus markers, user location, campus marker, search text
  // is handled separately) is deliberately untouched.
  const resetMapState = useCallback(() => {
    selectionToken.current += 1;   // any pending getDocs / onReady is now stale
    setSelectedBusId(null);
    setRoutePackage(null);
    setStopEtas([]);
    setTotalEta(null);
    setRouteLoading(false);
    setRouteError(false);
    setDirectionsOrigin(null);
  }, []);

  const handleBusPress = useCallback((bus) => {
    Keyboard.dismiss();

    // Invalidate anything already in flight, then claim a new token.
    selectionToken.current += 1;
    const myToken = selectionToken.current;

    setSelectedBusId(bus.id);
    setRoutePackage(null);
    setStopEtas([]);
    setTotalEta(null);
    setRouteError(false);
    setDirectionsOrigin(bus.location || null);
    setRouteLoading(!!bus.route);

    // Camera follows the selection. mapRef existed but was never used, so
    // selecting a bus off-screen showed a card for a bus you could not see.
    if (bus.location && mapRef.current) {
      mapRef.current.animateToRegion({
        ...bus.location, latitudeDelta: 0.05, longitudeDelta: 0.05,
      }, 400);
    }

    if (!bus.route) return;

    // Deferred so the native marker press animation completes before the
    // re-render (this was the original Android crash workaround, kept).
    requestAnimationFrame(async () => {
      try {
        const q = query(collection(db, "routes"), where("name", "==", bus.route));
        const snap = await getDocs(q);

        // GUARD: the user may have cancelled or picked another bus while this
        // was in flight. Without this check the old route reappears.
        if (!isMounted.current || selectionToken.current !== myToken) return;

        if (snap.empty) { setRouteLoading(false); setRouteError(true); return; }

        const raw = snap.docs[0].data();
        const cleanStops = (raw.stops || [])
          .map(st => { const c = sanitizeCoord(st); return c ? { name: st.name, ...c } : null; })
          .filter(Boolean);

        setRoutePackage({ ...raw, stops: cleanStops });
        setRouteLoading(false);

        if (cleanStops.length && mapRef.current) {
          mapRef.current.fitToCoordinates(
            [bus.location, ...cleanStops, MEU_DESTINATION].filter(Boolean),
            { edgePadding: { top: 120, right: 60, bottom: 380, left: 60 }, animated: true }
          );
        }
      } catch (err) {
        if (!isMounted.current || selectionToken.current !== myToken) return;
        console.log("Route Error:", err?.message);
        setRouteLoading(false);
        setRouteError(true);
      }
    });
  }, []);

  const handleClose = useCallback(() => { resetMapState(); }, [resetMapState]);

  // Leaving the map screen resets temporary state on purpose, so returning
  // never restores a stale bottom sheet / polyline / stop markers.
  const leaveMap = useCallback(() => {
    resetMapState();
    setSearchText('');
    setCurrentScreen('SELECTION');
  }, [resetMapState]);

  // ---- DERIVED selection. Never falls back to a stale snapshot object. ----
  const liveSelectedBus = useMemo(
    () => (selectedBusId ? liveBuses.find(b => b.id === selectedBusId) || null : null),
    [selectedBusId, liveBuses]
  );

  // If the selected bus leaves the map entirely, drop the selection rather
  // than leaving a frozen card describing a bus that is no longer shown.
  useEffect(() => {
    if (selectedBusId && !liveSelectedBus) resetMapState();
  }, [selectedBusId, liveSelectedBus, resetMapState]);

  // Re-request directions only when the bus has genuinely moved.
  useEffect(() => {
    if (!liveSelectedBus?.location) return;
    setDirectionsOrigin(prev =>
      distanceM(prev, liveSelectedBus.location) > REROUTE_THRESHOLD_M
        ? liveSelectedBus.location
        : prev
    );
  }, [liveSelectedBus]);

  if (!authReady) {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[styles.safeContainer, styles.center, {backgroundColor: '#f9f9f9'}]}>
          <Text style={styles.logoTextMain}>MEU</Text>
          <ActivityIndicator size="large" color={COLORS.primary} style={{marginTop: 16}} />
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (!user || currentScreen === 'LOGIN') {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={styles.safeContainer}>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} style={styles.loginContainer}>
            <View style={styles.logoBox}><Text style={styles.logoTextMain}>MEU</Text><Text style={styles.logoTextSub}>Transportation</Text></View>
            <View style={styles.card}>
              <Text style={styles.loginTitle}>{isLoginMode ? "Student Login" : "Create Account"}</Text>
              {!isLoginMode && <View style={styles.inputRow}><Ionicons name="person" size={20} color="#666" /><TextInput style={styles.inputField} placeholder="Full Name" value={name} onChangeText={setName} /></View>}
              <View style={styles.inputRow}><Ionicons name="mail-outline" size={20} color="#666" /><TextInput style={styles.inputField} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" /></View>
              <View style={styles.inputRow}><Ionicons name="lock-closed-outline" size={20} color="#666" /><TextInput style={styles.inputField} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry /></View>
              <TouchableOpacity style={styles.loginBtn} onPress={handleAuth}><Text style={styles.loginBtnText}>{authLoading ? "..." : (isLoginMode ? "LOG IN" : "SIGN UP")}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => setIsLoginMode(!isLoginMode)} style={{marginTop: 15}}><Text style={{color: COLORS.primary, textAlign:'center'}}>{isLoginMode ? "New User? Register" : "Have account? Login"}</Text></TouchableOpacity>
            </View>
          </KeyboardAvoidingView>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  if (currentScreen === 'WEBVIEW') {
    return (
        <SafeAreaProvider>
            <SafeAreaView style={[styles.safeContainer, {backgroundColor: theme.background}]}>
                <View style={[styles.headerBar, {borderBottomColor: theme.border}]}>
                    <TouchableOpacity onPress={() => setCurrentScreen('SELECTION')} style={{padding: 5}}>
                        <Ionicons name="arrow-back" size={28} color={theme.text} />
                    </TouchableOpacity>
                    <Text style={[styles.headerTitle, {color: theme.text}]}>{text.schedule_title}</Text>
                    <View style={{width: 28}} /> 
                </View>
                <WebView 
                    source={{ uri: MEU_BUS_WEBSITE }} 
                    style={{ flex: 1 }}
                    startInLoadingState={true}
                    renderLoading={() => <View style={styles.center}><ActivityIndicator size="large" color={COLORS.primary}/></View>}
                />
            </SafeAreaView>
        </SafeAreaProvider>
    );
  }

  if (currentScreen === 'SELECTION') {
    return (
      <SafeAreaProvider>
        <SafeAreaView style={[styles.safeContainer, {backgroundColor: theme.background}]}>
          <View style={styles.selectionContainer}>
            <Text style={[styles.welcomeText, {color: COLORS.primary}]}>{text.welcome}, {user?.displayName}!</Text>
            
            <TouchableOpacity style={styles.choiceBtn} onPress={() => { resetMapState(); setSearchText(''); setCurrentScreen('MAP'); }}>
              <Text style={styles.choiceBtnText}>{text.to_campus}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity style={[styles.choiceBtn, {marginTop: 20}]} onPress={() => setCurrentScreen('WEBVIEW')}>
              <Text style={styles.choiceBtnText}>{text.from_campus}</Text>
            </TouchableOpacity>
            
            <TouchableOpacity onPress={handleLogout} style={{marginTop: 50}}>
              <Text style={{color: theme.subText}}>{text.sign_out}</Text>
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </SafeAreaProvider>
    );
  }

  // Snapshot of the selection token for this render pass. MapViewDirections
  // callbacks close over it and refuse to write state if it has moved on.
  const tokenAtRender = selectionToken.current;

  return (
    <SafeAreaProvider>
      <View style={[styles.container, {backgroundColor: theme.background}]}>
        <StatusBar barStyle={appTheme === 'dark' ? "light-content" : "dark-content"} />
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE} 
          style={styles.map}
          initialRegion={{ latitude: 31.805630, longitude: 35.920587, latitudeDelta: 0.15, longitudeDelta: 0.15 }}
          onPress={handleClose}
          showsUserLocation={locationGranted}
          showsMyLocationButton={false} 
          showsCompass={false}          
          toolbarEnabled={false}        
          moveOnMarkerPress={false}     
          customMapStyle={appTheme === 'dark' ? mapDarkStyle : []} 
        >
          {liveSelectedBus && routePackage && directionsOrigin && (
            <MapViewDirections
              origin={directionsOrigin}
              destination={MEU_DESTINATION} 
              waypoints={routePackage.stops ? routePackage.stops.map(s => ({latitude: s.latitude, longitude: s.longitude})) : []}
              apikey={GOOGLE_MAPS_APIKEY}
              strokeWidth={4} strokeColor={COLORS.primary}
              onReady={result => {
                // A directions result that arrives after the selection changed
                // must not write to state.
                if (!isMounted.current || selectionToken.current !== tokenAtRender) return;

                const durVal = Number(result?.duration);
                setTotalEta(Number.isFinite(durVal) ? Math.ceil(durVal) : null);
                setRouteError(false);

                const legs = result?.legs || [];
                let accumulated = 0;
                const stops = routePackage.stops || [];
                const newEtas = [];
                for (let i = 0; i < legs.length && i < stops.length; i++) {
                  // leg.duration may be {value:<seconds>} or a plain number of
                  // minutes depending on the source. The old code fell through
                  // to Number(object) === NaN and rendered "NaN min".
                  const raw = legs[i]?.duration;
                  let mins = 0;
                  if (raw && typeof raw === 'object' && Number.isFinite(Number(raw.value))) {
                    mins = Number(raw.value) / 60;
                  } else if (Number.isFinite(Number(raw))) {
                    mins = Number(raw);
                  }
                  accumulated += mins;
                  newEtas.push({ name: stops[i].name, minutes: Math.ceil(accumulated) });
                }
                setStopEtas(newEtas);
              }}
              onError={(errorMessage) => {
                if (!isMounted.current || selectionToken.current !== tokenAtRender) return;
                console.log("Directions Error: " + errorMessage);
                setRouteError(true);
                setStopEtas([]);
                setTotalEta(null);
              }}
            />
          )}

          <Marker coordinate={MEU_DESTINATION} title="MEU Campus" tracksViewChanges={false} zIndex={1}>
             <View style={[styles.busMarker, {backgroundColor: COLORS.gold}]}><Ionicons name="school" size={20} color="white" /></View>
          </Marker>

          {/* Gated on liveSelectedBus. Previously these rendered from
              routePackage alone, so a late response after Cancel left orphaned
              stop dots on the map with no card and no way to dismiss them.
              Keyed by coordinate so switching routes cannot reuse a marker. */}
          {liveSelectedBus && routePackage?.stops?.map((stop) => (
             <Marker
               key={`stop-${stop.latitude.toFixed(5)}-${stop.longitude.toFixed(5)}`}
               coordinate={{ latitude: stop.latitude, longitude: stop.longitude }}
               title={stop.name}
               tracksViewChanges={false}
               zIndex={2}>
               <View style={styles.stopDot} />
             </Marker>
          ))}

          {/* tracksViewChanges was true for every marker, which re-rasterises
              the marker view on every frame and destroys scroll performance.
              It is enabled only until the icon has painted once. */}
          {visibleBuses.map(bus => {
            const isSelected = bus.id === selectedBusId;
            const noSignal = bus.state === 'no_signal';
            return (
              <Marker
                key={bus.id}
                identifier={bus.id}
                coordinate={bus.location}
                onPress={() => handleBusPress(bus)}
                tracksViewChanges={false}
                opacity={noSignal ? 0.55 : 1}
                zIndex={isSelected ? 200 : 100}
              >
                <View style={[
                  styles.busMarker,
                  noSignal && styles.busMarkerStale,
                  isSelected && styles.busMarkerSelected,
                ]}>
                  <Ionicons name={noSignal ? "cloud-offline" : "bus"} size={20} color="white" />
                </View>
              </Marker>
            );
          })}
        </MapView>

        <View style={styles.topSearchArea} pointerEvents="box-none">
          <TouchableOpacity onPress={leaveMap} style={{marginRight: 10}}>
             <Ionicons name="arrow-back" size={30} color={COLORS.primary} />
          </TouchableOpacity>
          
          <TouchableOpacity onPress={() => setMenuVisible(true)} style={styles.menuBtn}>
             <Ionicons name="menu" size={30} color={COLORS.primary} />
          </TouchableOpacity>
          <View style={[styles.searchBar, {backgroundColor: theme.card}]}>
            <Ionicons name="search" size={20} color={theme.subText} />
            <TextInput 
              placeholder={text.search_placeholder} 
              placeholderTextColor={theme.subText}
              style={[styles.searchInput, {color: theme.text}]} 
              value={searchText} 
              onChangeText={setSearchText}
            />
          </View>
        </View>

        {/* SIDEBAR MENU */}
        <Modal visible={menuVisible} animationType="fade" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={[styles.sidebar, {backgroundColor: COLORS.primary}]}>
              <TouchableOpacity onPress={() => setMenuVisible(false)} style={styles.closeMenu}><Ionicons name="close" size={30} color="white" /></TouchableOpacity>
              <View style={styles.menuHeader}>
                <Ionicons name="person-circle-outline" size={80} color="white" />
                <Text style={styles.menuName}>{user?.displayName}</Text>
                <Text style={styles.menuEmail}>{user?.email}</Text>
              </View>
              
              <TouchableOpacity style={styles.menuItem} onPress={() => { setMenuVisible(false); setSettingsVisible(true); }}>
                <Ionicons name="settings-outline" size={24} color="white"/>
                <Text style={styles.menuItemText}>{text.settings}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.menuItem} onPress={handleLogout}>
                <Ionicons name="log-out" size={24} color="white"/>
                <Text style={styles.menuItemText}>{text.sign_out}</Text>
              </TouchableOpacity>
            </View>
            <TouchableOpacity style={{flex:1}} onPress={() => setMenuVisible(false)} />
          </View>
        </Modal>

        {/* SETTINGS MODAL */}
        <Modal visible={settingsVisible} animationType="slide" transparent={true}>
          <View style={styles.modalOverlay}>
            <View style={[styles.settingsModal, {backgroundColor: theme.card}]}>
              <View style={styles.settingsHeader}>
                <Text style={[styles.settingsTitle, {color: theme.text}]}>{text.settings}</Text>
                <TouchableOpacity onPress={() => setSettingsVisible(false)}><Ionicons name="close" size={24} color={theme.text} /></TouchableOpacity>
              </View>

              <ScrollView>
                <Text style={[styles.settingLabel, {color: theme.subText}]}>{text.change_name}</Text>
                <View style={styles.settingRow}>
                    <TextInput 
                        style={[styles.settingInput, {backgroundColor: theme.inputBg, color: theme.text, borderColor: theme.border}]} 
                        placeholder={user?.displayName}
                        placeholderTextColor={theme.subText}
                        value={newName}
                        onChangeText={setNewName}
                    />
                    <TouchableOpacity style={styles.updateBtn} onPress={handleUpdateName}>
                        <Text style={styles.updateBtnText}>{text.update}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.divider} />

                <View style={styles.settingRow}>
                    <Text style={[styles.settingText, {color: theme.text}]}>{text.language}</Text>
                    <TouchableOpacity style={styles.toggleBtn} onPress={toggleLanguage}>
                        <Text style={styles.toggleText}>{appLang === 'en' ? 'English' : 'العربية'}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.settingRow}>
                    <Text style={[styles.settingText, {color: theme.text}]}>{text.theme}</Text>
                    <TouchableOpacity style={styles.toggleBtn} onPress={toggleTheme}>
                        <Text style={styles.toggleText}>{appTheme === 'light' ? text.light_mode : text.dark_mode}</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.divider} />

                <TouchableOpacity style={styles.rateBtn} onPress={handleRateUs}>
                    <Ionicons name="star" size={20} color="white" style={{marginRight: 10}} />
                    <Text style={styles.rateBtnText}>{text.rate_us}</Text>
                </TouchableOpacity>

                <View style={styles.creditsContainer}>
                    <Text style={[styles.creditsText, {color: theme.subText}]}>{text.version}</Text>
                    <Text style={[styles.creditsText, {color: COLORS.primary, fontWeight: 'bold'}]}>{text.developer}</Text>
                </View>
              </ScrollView>
            </View>
          </View>
        </Modal>

        {liveSelectedBus && (
          <View style={[styles.bottomCard, {backgroundColor: theme.card}]}>
            <View style={[styles.cardHeader, {borderBottomColor: theme.border}]}>
               <View style={styles.headerTitleRow}>
                  <View style={[styles.statusBadgeInline, {backgroundColor: liveSelectedBus.passengerCount >= 35 ? COLORS.red : COLORS.green}]}>
                     <Text style={styles.statusText}>{liveSelectedBus.passengerCount >= 35 ? text.full : text.open}</Text>
                  </View>
                  <Text style={styles.routeTextInline} numberOfLines={1}>{liveSelectedBus.currentTripName}</Text>
               </View>
               <Text style={[styles.busNumText, {color: theme.subText}]}>{text.bus}: {liveSelectedBus.busNumber || 'N/A'} • {liveSelectedBus.passengerCount ?? 0}/35 {text.seats}</Text>
               {liveSelectedBus.state === 'no_signal' && (
                 <View style={styles.staleBanner}>
                   <Ionicons name="cloud-offline-outline" size={14} color={COLORS.red} />
                   <Text style={styles.staleBannerText}>{text.signal_lost}</Text>
                 </View>
               )}
            </View>

            <View style={{maxHeight: 120, marginBottom: 15}}>
                <Text style={styles.sectionTitle}>{text.upcoming_stops}</Text>
                <ScrollView nestedScrollEnabled>
                    {stopEtas.length > 0 ? stopEtas.map((stop, i) => (
                        <View key={i} style={styles.stopRow}>
                            <View style={styles.timelineDot} />
                            <Text style={[styles.stopName, {color: theme.text}]}>{stop.name}</Text>
                            <Text style={[styles.stopTime, {color: theme.subText}]}>{stop.minutes} min</Text>
                        </View>
                    )) : (
                        <Text style={{color: routeError ? COLORS.red : theme.subText, fontStyle:'italic', marginVertical:5}}>
                           {routeError ? text.route_error
                             : (routeLoading || routePackage) ? text.calculating
                             : text.no_data}
                        </Text>
                    )}
                    
                    <View style={styles.stopRow}>
                        <View style={[styles.timelineDot, {backgroundColor: COLORS.gold}]} />
                        <Text style={[styles.stopName, {fontWeight: 'bold', color: theme.text}]}>MEU Campus</Text>
                        <Text style={[styles.stopTime, {color: COLORS.primary, fontWeight:'bold'}]}>
                            {totalEta !== null ? `${totalEta} min` : "..."}
                        </Text>
                    </View>
                </ScrollView>
            </View>

            <TouchableOpacity style={[styles.backBtn, {backgroundColor: theme.inputBg}]} onPress={handleClose}>
              <Text style={[styles.backBtnText, {color: COLORS.primary}]}>{text.close}</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </SafeAreaProvider>
  );
}

const mapDarkStyle = [
  { "elementType": "geometry", "stylers": [{ "color": "#212121" }] },
  { "elementType": "labels.icon", "stylers": [{ "visibility": "off" }] },
  { "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "elementType": "labels.text.stroke", "stylers": [{ "color": "#212121" }] },
  { "featureType": "administrative", "elementType": "geometry", "stylers": [{ "color": "#757575" }] },
  { "featureType": "poi", "elementType": "labels.text.fill", "stylers": [{ "color": "#757575" }] },
  { "featureType": "road", "elementType": "geometry.fill", "stylers": [{ "color": "#2c2c2c" }] },
  { "featureType": "road", "elementType": "labels.text.fill", "stylers": [{ "color": "#8a8a8a" }] },
  { "featureType": "water", "elementType": "geometry", "stylers": [{ "color": "#000000" }] }
];

const styles = StyleSheet.create({
  safeContainer: { flex: 1 },
  loginContainer: { flex: 1, justifyContent: 'center', padding: 20, backgroundColor: '#f9f9f9' },
  logoBox: { alignItems: 'center', marginBottom: 40 },
  logoTextMain: { fontSize: 40, fontWeight: 'bold', color: COLORS.primary },
  logoTextSub: { fontSize: 18, color: '#666' },
  card: { backgroundColor: 'white', padding: 25, borderRadius: 25, shadowColor: "#000", shadowOffset: {width: 0, height: 2}, shadowOpacity: 0.1, shadowRadius: 10, elevation: 5 },
  loginTitle: { fontSize: 24, fontWeight: 'bold', marginBottom: 25, color: '#333' },
  inputRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#F5F5F5', borderRadius: 12, paddingHorizontal: 15, height: 55, marginBottom: 15 },
  inputField: { flex: 1, height: '100%', fontSize: 16, color: '#333', marginLeft: 10 }, 
  loginBtn: { backgroundColor: COLORS.primary, padding: 18, borderRadius: 12, alignItems: 'center', marginTop: 10 },
  loginBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  selectionContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 },
  welcomeText: { fontSize: 30, fontWeight: 'bold', marginBottom: 10, textAlign:'center' },
  choiceBtn: { backgroundColor: '#E0E0E0', width: '90%', padding: 22, borderRadius: 18, alignItems: 'center' },
  choiceBtnText: { fontSize: 18, fontWeight: 'bold', color: '#333' },
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  topSearchArea: { position: 'absolute', top: Platform.OS === 'ios' ? 60 : 50, left: 20, right: 20, flexDirection: 'row', alignItems: 'center', zIndex: 10 },
  menuBtn: { marginRight: 10 },
  searchBar: { flex: 1, flexDirection: 'row', alignItems: 'center', borderRadius: 25, paddingHorizontal: 15, height: 50, elevation: 5, shadowColor: '#000', shadowOpacity: 0.1, shadowRadius: 5 },
  searchInput: { flex: 1, marginLeft: 10, fontSize: 16 },
  busMarker: { padding: 8, borderRadius: 20, borderWidth: 2, borderColor: 'white', backgroundColor: COLORS.primary, justifyContent: 'center', alignItems: 'center' },
  busMarkerStale: { backgroundColor: '#8A8A8A', borderStyle: 'dashed' },
  busMarkerSelected: { borderWidth: 3, borderColor: COLORS.gold, transform: [{ scale: 1.15 }] },
  staleBanner: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: '#FDECEA' },
  staleBannerText: { color: COLORS.red, fontSize: 12, fontWeight: 'bold', marginLeft: 6, flex: 1 },
  stopDot: { width: 14, height: 14, borderRadius: 7, backgroundColor: COLORS.stop, borderWidth: 2, borderColor: 'white' },
  bottomCard: { position: 'absolute', bottom: 0, width: '100%', borderTopLeftRadius: 30, borderTopRightRadius: 30, padding: 24, paddingBottom: Platform.OS === 'ios' ? 40 : 24, elevation: 30, shadowColor: "#000", shadowOffset: {width: 0, height: -5}, shadowOpacity: 0.2, shadowRadius: 15, zIndex: 100 },
  cardHeader: { marginBottom: 15, borderBottomWidth: 1, paddingBottom: 15 },
  headerTitleRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  statusBadgeInline: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, marginRight: 12 },
  routeTextInline: { fontSize: 20, fontWeight: 'bold', color: COLORS.primary, flex: 1 },
  statusText: { color: 'white', fontWeight: 'bold', fontSize: 12 },
  busNumText: { fontSize: 15, marginTop: 4 },
  sectionTitle: { fontSize: 12, fontWeight: 'bold', color: '#999', marginBottom: 10 },
  stopRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  timelineDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#CCC', marginRight: 10 },
  stopName: { flex: 1, fontSize: 16 },
  stopTime: { fontSize: 16, fontWeight: 'bold' },
  backBtn: { alignItems: 'center', padding: 16, borderRadius: 16 },
  backBtnText: { fontWeight: 'bold', fontSize: 16 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', flexDirection: 'row' },
  sidebar: { width: '75%', height: '100%', padding: 20, paddingTop: 60 },
  closeMenu: { position: 'absolute', top: 40, right: 20 },
  menuHeader: { alignItems: 'center', marginBottom: 40 },
  menuName: { color: 'white', fontSize: 22, fontWeight: 'bold', marginTop: 10 },
  menuEmail: { color: '#DDD', fontSize: 12 },
  menuItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  menuItemText: { color: 'white', fontSize: 18, marginLeft: 15 },
  
  settingsModal: { width: '100%', height: '70%', marginTop: 'auto', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 },
  settingsHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  settingsTitle: { fontSize: 22, fontWeight: 'bold' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 10 },
  settingLabel: { fontSize: 12, marginBottom: 5 },
  settingInput: { flex: 1, padding: 10, borderRadius: 8, borderWidth: 1, marginRight: 10 },
  updateBtn: { backgroundColor: COLORS.primary, paddingVertical: 10, paddingHorizontal: 15, borderRadius: 8 },
  updateBtnText: { color: 'white', fontWeight: 'bold' },
  settingText: { fontSize: 16, fontWeight: 'bold' },
  toggleBtn: { backgroundColor: '#E0E0E0', padding: 8, borderRadius: 8 },
  toggleText: { fontSize: 14, fontWeight: 'bold', color: '#333' },
  divider: { height: 1, backgroundColor: '#EEE', marginVertical: 15 },
  rateBtn: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', backgroundColor: COLORS.gold, padding: 12, borderRadius: 8, marginBottom: 20 },
  rateBtnText: { color: 'white', fontWeight: 'bold', fontSize: 16 },
  creditsContainer: { alignItems: 'center', marginTop: 10, paddingBottom: 20 },
  creditsText: { fontSize: 12, marginBottom: 4 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  headerBar: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 15, paddingTop: Platform.OS === 'ios' ? 50 : 20, borderBottomWidth: 1 },
  headerTitle: { fontSize: 20, fontWeight: 'bold' },
});