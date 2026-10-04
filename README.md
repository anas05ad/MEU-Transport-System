# 🚌 MEU Transport System

A full-stack real-time bus tracking platform built for **Middle East University (MEU)**.  
The system consists of three interconnected applications powered by **Firebase Realtime Database** and **Google Maps**.

---

## 📁 Project Structure

```
MEU-Transport-System/
├── meu-admin-panel/        # React + Vite web dashboard (admin)
├── meu-driver-app/         # Expo React Native app (bus drivers)
├── meu-student-app/        # Expo React Native app (students)
├── MEUSense/               # Logo / brand assets
├── db/                     # Firebase database structure reference
├── docs/                   # Project documentation & reports
└── .gitignore
```

---

## 🧩 Applications Overview

### 1. 🖥️ Admin Panel — `meu-admin-panel`

A **React + Vite** web application for university administrators to manage buses, drivers, and routes in real time.

**Features:**
- Live bus tracking on Google Maps
- Manage drivers (add, edit, assign to buses)
- Manage bus routes and stops
- Monitor real-time driver status (online/offline)
- Arabic & English language support (i18n)
- Firebase Authentication for secure login

**Tech Stack:** React 18, Vite, Firebase, React Router, Google Maps API, i18next

---

### 2. 📱 Driver App — `meu-driver-app`

A **React Native (Expo)** mobile application for bus drivers.

**Features:**
- Real-time GPS location broadcasting to Firebase
- Accept/reject ride requests
- View assigned route and stops
- Background location tracking (iOS & Android)
- Arabic & English language support

**Tech Stack:** Expo, React Native, Firebase, Google Maps, expo-location, i18next

---

### 3. 📱 Student App — `meu-student-app`

A **React Native (Expo)** mobile application for MEU students.

**Features:**
- Live bus tracking on map
- Request a ride / cancel a request
- View estimated arrival time
- Real-time status updates
- Arabic & English language support

**Tech Stack:** Expo, React Native, Firebase, Google Maps, expo-location, expo-localization, i18next

---

## ⚙️ Environment Setup

### Prerequisites

| Tool | Version |
|------|---------|
| Node.js | >= 18 |
| npm | >= 9 |
| Expo CLI | Latest (`npm install -g expo-cli`) |

### Firebase Setup

1. Create a project at [Firebase Console](https://console.firebase.google.com/)
2. Enable **Realtime Database** and **Authentication** (Email/Password)
3. Copy your config keys

### Google Maps Setup

1. Enable **Maps SDK for Android**, **Maps SDK for iOS**, and **Maps JavaScript API** in [Google Cloud Console](https://console.cloud.google.com/)
2. Create an API key and restrict it by platform

---

## 🚀 Getting Started

### Admin Panel

```bash
cd meu-admin-panel

# Copy environment file and fill in your keys
cp .env.example .env

# Install dependencies
npm install

# Start development server
npm run dev
```

**Environment variables** (`.env`):
```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_GOOGLE_MAPS_API_KEY=
```

---

### Driver App

```bash
cd meu-driver-app

# Copy environment file and fill in your keys
cp .env.example .env

# Install dependencies
npm install

# Start Expo dev server
npx expo start
```

**Environment variables** (`.env`):
```env
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
```

> **Note:** Also replace the `REPLACE_WITH_YOUR_IOS_MAPS_KEY` and `REPLACE_WITH_YOUR_ANDROID_MAPS_KEY` placeholders in `app.json` with your actual Google Maps API key before building for device.

---

### Student App

```bash
cd meu-student-app

# Copy environment file and fill in your keys
cp .env.example .env

# Install dependencies
npm install

# Start Expo dev server
npx expo start
```

**Environment variables** (`.env`):
```env
EXPO_PUBLIC_FIREBASE_API_KEY=
EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN=
EXPO_PUBLIC_FIREBASE_PROJECT_ID=
EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET=
EXPO_PUBLIC_FIREBASE_SENDER_ID=
EXPO_PUBLIC_FIREBASE_APP_ID=
EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID=
EXPO_PUBLIC_GOOGLE_MAPS_API_KEY=
```

> **Note:** Also replace the `REPLACE_WITH_YOUR_IOS_MAPS_KEY` and `REPLACE_WITH_YOUR_ANDROID_MAPS_KEY` placeholders in `app.json` with your actual Google Maps API key before building for device.

---

## 🗃️ Database Structure

The Firebase Realtime Database follows this schema (see [`db/db_structure.json`](db/db_structure.json)):

```json
{
  "drivers": {
    "<driverId>": {
      "name": "string",
      "license": "string",
      "isOnline": "boolean",
      "currentOrder": { "status": "string" }
    }
  },
  "buses": {
    "<busId>": {
      "id": "string",
      "capacity": "number",
      "driver": "string"
    }
  }
}
```

---

## 🔐 Security Notes

- **Never commit `.env` files** — they are excluded in `.gitignore`
- Restrict your Google Maps API keys by HTTP referrer (web) and app bundle ID (mobile) in Google Cloud Console
- Set proper **Firebase Security Rules** to protect your Realtime Database

---

## 📄 Documentation

Project reports and assignment documents are located in the [`docs/`](docs/) folder.

---

## 🏫 About

Built as a university capstone project for **Middle East University (MEU)** to modernize the campus transportation system with real-time GPS tracking and digital ride management.
