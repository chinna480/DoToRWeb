import { NavigationContainer } from '@react-navigation/native'
import { createStackNavigator } from '@react-navigation/stack'
import { useEffect, useRef } from 'react'
import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { setupNotificationListeners } from './app/utils/pushNotifications'

import CustomerLoginScreen from './app/screens/CustomerLoginScreen'
import HomeScreen from './app/screens/HomeScreen'
import OTPVerifyScreen from './app/screens/OTPVerifyScreen'
import ReviewScreen from './app/screens/ReviewScreen'
import RoleScreen from './app/screens/RoleScreen'
import SplashScreen from './app/screens/SplashScreen'
import TechHomeScreen from './app/screens/TechHomeScreen'
import TechLoginScreen from './app/screens/TechLoginScreen'
import TrackingScreen from './app/screens/TrackingScreen'

const Stack = createStackNavigator()

export default function App() {
  const navigationRef = useRef(null)
  const notifSubRef   = useRef(null)

  useEffect(() => {
    if (navigationRef.current) {
      notifSubRef.current = setupNotificationListeners(navigationRef.current)
    }
    return () => { if (notifSubRef.current) notifSubRef.current.remove() }
  }, [])

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer ref={navigationRef}>
        <Stack.Navigator initialRouteName="Splash" screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Splash"        component={SplashScreen} />
          <Stack.Screen name="Role"          component={RoleScreen} />
          <Stack.Screen name="CustomerLogin" component={CustomerLoginScreen} />
          <Stack.Screen name="OTPVerify"     component={OTPVerifyScreen} />
          <Stack.Screen name="Home"          component={HomeScreen} />
          <Stack.Screen name="Tracking"      component={TrackingScreen} />
          <Stack.Screen name="Review"        component={ReviewScreen} />
          <Stack.Screen name="TechLogin"     component={TechLoginScreen} />
          <Stack.Screen name="TechHome"      component={TechHomeScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  )
}