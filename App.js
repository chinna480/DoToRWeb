import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import * as Notifications from 'expo-notifications'
import { useEffect, useRef } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'

// ── Screens ────────────────────────────────────────────────────────────────
import CustomerLoginScreen from './app/screens/CustomerLoginScreen'
import CustomerProfileScreen from './app/screens/CustomerProfileScreen'
import HomeScreen from './app/screens/HomeScreen'
import OTPVerifyScreen from './app/screens/OTPVerifyScreen'
import ReviewScreen from './app/screens/ReviewScreen'
import RoleScreen from './app/screens/RoleScreen'
import SplashScreen from './app/screens/SplashScreen'
import TechHomeScreen from './app/screens/TechHomeScreen'
import TechLoginScreen from './app/screens/TechLoginScreen'
import TechProfileScreen from './app/screens/TechProfileScreen'
import TrackingScreen from './app/screens/TrackingScreen'

// ── Notification handler ───────────────────────────────────────────────────
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge:  true,
  }),
})

const Stack = createStackNavigator()

export default function App() {
  const navigationRef = useRef(null)
  const notifSubRef   = useRef(null)

  useEffect(() => {
    // Handle notification tap → navigate to correct screen
    notifSubRef.current = Notifications.addNotificationResponseReceivedListener(response => {
      const screen = response?.notification?.request?.content?.data?.screen
      if (screen && navigationRef.current) {
        navigationRef.current.navigate(screen)
      }
    })
    return () => {
      if (notifSubRef.current) notifSubRef.current.remove()
    }
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator
          initialRouteName="Splash"
          screenOptions={{ headerShown: false, gestureEnabled: false }}
        >
          {/* ── AUTH FLOW ── */}
          <Stack.Screen name="Splash"           component={SplashScreen} />
          <Stack.Screen name="Role"             component={RoleScreen} />

          {/* ── CUSTOMER FLOW ── */}
          <Stack.Screen name="CustomerLogin"    component={CustomerLoginScreen} />
          <Stack.Screen name="OTPVerify"        component={OTPVerifyScreen} />
          <Stack.Screen name="Home"             component={HomeScreen} />
          <Stack.Screen name="Tracking"         component={TrackingScreen} />
          <Stack.Screen name="Review"           component={ReviewScreen} />
          <Stack.Screen name="CustomerProfile"  component={CustomerProfileScreen} />

          {/* ── TECHNICIAN FLOW ── */}
          <Stack.Screen name="TechLogin"        component={TechLoginScreen} />
          <Stack.Screen name="TechHome"         component={TechHomeScreen} />
          <Stack.Screen name="TechProfile"      component={TechProfileScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  )
}