// meu-driver-app/screens/HomeScreen.js

import React, { useEffect, useState } from "react";
import { View, Text, ActivityIndicator, StyleSheet, Alert } from "react-native";
import { getAuth } from "firebase/auth";
import { getFirestore, collection, query, where, getDocs } from "firebase/firestore";
// If you haven't initialized firebase in App.js, import your firebase config file here
// import '../firebaseConfig'; 

const db = getFirestore();
const auth = getAuth();

const DriverHomeScreen = () => {
  const [myBus, setMyBus] = useState(null);
  const [myRoute, setMyRoute] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchDriverAssignment = async () => {
      try {
        const user = auth.currentUser;
        if (!user) {
            setLoading(false);
            return;
        }

        console.log("Checking assignments for Driver ID:", user.uid);

        // --- STEP 1: Find the Bus assigned to this Driver ---
        const q = query(collection(db, "buses"), where("driverId", "==", user.uid));
        const busSnapshot = await getDocs(q);

        if (busSnapshot.empty) {
          console.log("No bus assigned.");
          setLoading(false);
          return;
        }

        const busData = busSnapshot.docs[0].data();
        const busId = busSnapshot.docs[0].id;
        setMyBus({ id: busId, ...busData });

        // --- STEP 2: Find the Route Details ---
        if (busData.route) {
          const routeQuery = query(collection(db, "routes"), where("name", "==", busData.route));
          const routeSnapshot = await getDocs(routeQuery);

          if (!routeSnapshot.empty) {
            const routeData = routeSnapshot.docs[0].data();
            setMyRoute(routeData);
          }
        }

      } catch (error) {
        console.error("Error:", error);
        Alert.alert("Error", "Could not fetch assignment.");
      } finally {
        setLoading(false);
      }
    };

    fetchDriverAssignment();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading assignment...</Text>
      </View>
    );
  }

  if (!myBus) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>⛔ No Active Assignment</Text>
        <Text>Please ask the Admin to assign you to a bus.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* HEADER INFO */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>🚍 Bus #{myBus.busNumber}</Text>
        <Text style={styles.headerText}>Route: {myBus.route}</Text>
        <Text style={styles.headerText}>Capacity: {myBus.capacity}</Text>
      </View>

      {/* MAP PLACEHOLDER */}
      <View style={styles.mapContainer}>
         <Text>Map Component will go here.</Text>
         {myRoute ? (
             <Text style={styles.successText}>✅ Route Loaded: {myRoute.name}</Text>
         ) : (
             <Text>Loading Route Data...</Text>
         )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: { padding: 20, backgroundColor: '#333' },
  headerTitle: { fontSize: 24, fontWeight: 'bold', color: 'white', marginBottom: 5 },
  headerText: { color: '#ccc', fontSize: 16 },
  errorText: { fontSize: 20, fontWeight: 'bold', color: 'red', marginBottom: 10 },
  mapContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#e0e0e0' },
  successText: { marginTop: 10, color: 'green', fontWeight: 'bold' }
});

export default DriverHomeScreen;