import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="screens/SplashScreen" />
      <Stack.Screen name="screens/RoleScreen" />
      <Stack.Screen name="screens/CustomerLoginScreen" />
      <Stack.Screen name="screens/HomeScreen" />
      <Stack.Screen name="screens/CustomerProfileScreen" />
      <Stack.Screen name="screens/TrackingScreen" />
      <Stack.Screen name="screens/ReviewScreen" />
      <Stack.Screen name="screens/TechLoginScreen" />
      <Stack.Screen name="screens/TechHomeScreen" />
      <Stack.Screen name="screens/TechProfileScreen" />
      <Stack.Screen name="screens/ChatScreen" />
      <Stack.Screen name="screens/DigiLockerScreen" />
      <Stack.Screen name="screens/JobHistoryScreen" />
    </Stack>
  );
}