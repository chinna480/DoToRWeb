# DoToR - Home Service Provider App

A React Native (Expo) app connecting customers with home service technicians. Features real-time tracking, chat, scheduling, and payments.

## Tech Stack

- **Framework:** Expo (React Native)
- **Navigation:** Expo Router (file-based routing)
- **Backend:** Firebase (Realtime DB, Auth, Storage)
- **Maps:** react-native-maps with Google Maps
- **Notifications:** expo-notifications

## Features

- 🔐 Role-based login (Customer / Technician)
- 📍 Real-time technician tracking on map
- 💬 In-app chat between customer and technician
- 📅 Service scheduling
- 💳 Payment integration
- ⭐ Reviews & ratings
- 🔔 Push notifications

## Screens

### Customer
- Home screen with nearby technicians
- Tracking screen for real-time updates
- Chat screen for communication
- Schedule & payment screens
- Profile management

### Technician
- Tech Home with job assignments
- Navigation & tracking
- Chat & profile management

## Getting Started

```bash
# Install dependencies
npm install

# Start the Expo dev server
npx expo start
```

## Environment Setup

This project requires the following secrets configured in GitHub Actions:

- `GOOGLE_SERVICES_JSON` - Firebase `google-services.json` content
- `GOOGLE_MAPS_API_KEY` - Google Maps API key with Maps SDK for Android enabled

## Build Android APK

The GitHub Action workflow automatically builds an Android APK on push to `main` or `newmain` branches. You can also trigger it manually from the Actions tab.
