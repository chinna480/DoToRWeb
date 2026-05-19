export default {
  expo: {
    name: "DoToR",
    slug: "dotor",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/images/logo.png",
    scheme: "dotor",
    userInterfaceStyle: "light",
    splash: {
      image: "./assets/images/logo.png",
      resizeMode: "contain",
      backgroundColor: "#ffffff"
    },
    android: {
      adaptiveIcon: {
        foregroundImage: "./assets/images/logo.png",
        backgroundColor: "#ffffff"
      },
      package: "com.dotor.app",
      googleServicesFile: "./google-services.json",
      config: {
        googleMaps: {
          apiKey: process.env.GOOGLE_MAPS_API_KEY
        }
      },
      permissions: [
        "ACCESS_FINE_LOCATION",
        "ACCESS_COARSE_LOCATION",
        "CAMERA",
        "READ_EXTERNAL_STORAGE",
        "WRITE_EXTERNAL_STORAGE",
        "VIBRATE",
        "RECEIVE_BOOT_COMPLETED"
      ]
    },
    ios: {
      supportsTablet: true,
      bundleIdentifier: "com.dotor.app",
      config: {
        googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY
      },
      infoPlist: {
        NSLocationWhenInUseUsageDescription: "DoToR needs your location to show technician tracking",
        NSCameraUsageDescription: "DoToR needs camera to upload photos",
        NSPhotoLibraryUsageDescription: "DoToR needs gallery access to upload photos"
      }
    },
    plugins: [
      "expo-router",
      "expo-location",
      "expo-image-picker",
      [
        "expo-notifications",
        {
          color: "#FF6B00",
          sounds: []
        }
      ],
      [
        "react-native-maps",
        {
          googleMapsApiKey: process.env.GOOGLE_MAPS_API_KEY
        }
      ]
    ],
    experiments: {
      typedRoutes: true
    }
  }
}