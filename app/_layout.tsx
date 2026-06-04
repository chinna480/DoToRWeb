import { Stack } from 'expo-router';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Component, type ReactNode } from 'react';

// ── Top-level error boundary catches any unhandled React crash ──────────
// Without this, a crash anywhere in the app produces a blank white screen.
interface AppErrorBoundaryState { hasError: boolean; error: Error | null }
interface AppErrorBoundaryProps { children: ReactNode }
class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { hasError: false, error: null }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error } }
  componentDidCatch(error: Error) { console.error('App crash:', error?.message) }
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.crash}>
          <Text style={styles.crashIcon}>💥</Text>
          <Text style={styles.crashTitle}>Something went wrong</Text>
          <Text style={styles.crashMsg}>{this.state.error?.message || 'An unexpected error occurred.'}</Text>
          <TouchableOpacity style={styles.crashBtn} onPress={() => this.setState({ hasError: false, error: null })}>
            <Text style={styles.crashBtnTxt}>🔄 Retry</Text>
          </TouchableOpacity>
        </View>
      )
    }
    return this.props.children
  }
}

const styles = StyleSheet.create({
  crash:      { flex: 1, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center', padding: 30 },
  crashIcon:  { fontSize: 60, marginBottom: 16 },
  crashTitle: { fontSize: 20, fontWeight: '800', color: '#1A3A6B', marginBottom: 8 },
  crashMsg:   { fontSize: 13, color: '#888', textAlign: 'center', marginBottom: 24 },
  crashBtn:   { backgroundColor: '#FF6B00', paddingHorizontal: 30, paddingVertical: 12, borderRadius: 12 },
  crashBtnTxt:{ color: '#fff', fontSize: 14, fontWeight: '800' },
})

export default function RootLayout() {
  return (
    <AppErrorBoundary>
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
    </AppErrorBoundary>
  );
}