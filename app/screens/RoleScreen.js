import { useRouter } from 'expo-router'
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export default function RoleScreen() {
  const router = useRouter()

  return (
    <View style={s.container}>
      <Text style={s.brand}>🔧 DoToR</Text>
      <Text style={s.brandSub}>DOOR-TO-DOOR REPAIR</Text>
      <Text style={s.question}>Who are you?</Text>

      <TouchableOpacity style={s.customerBtn} onPress={() => router.push('/screens/CustomerLoginScreen')} activeOpacity={0.85}>
        <Text style={s.btnIcon}>👤</Text>
        <Text style={s.btnTitle}>I need Repair</Text>
        <Text style={s.btnSub}>Customer Login</Text>
      </TouchableOpacity>

      <TouchableOpacity style={s.techBtn} onPress={() => router.push('/screens/TechLoginScreen')} activeOpacity={0.85}>
        <Text style={s.btnIcon}>🔧</Text>
        <Text style={s.btnTitle}>I am a Technician</Text>
        <Text style={s.btnSub}>Technician Login</Text>
      </TouchableOpacity>
    </View>
  )
}

const s = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', padding: 30 },
  logo:        { width: 120, height: 120, marginBottom: 10 },
  brand:       { fontSize: 40, color: '#FF6B00', fontWeight: '800' },
  brandSub:    { fontSize: 12, color: '#1A3A6B', letterSpacing: 2, fontWeight: '700', marginTop: 4 },
  question:    { fontSize: 22, color: '#1A3A6B', fontWeight: '800', marginTop: 25, marginBottom: 35 },
  customerBtn: { width: '100%', backgroundColor: '#FF6B00', padding: 22, borderRadius: 18, alignItems: 'center', marginBottom: 15 },
  techBtn:     { width: '100%', backgroundColor: '#1A3A6B', padding: 22, borderRadius: 18, alignItems: 'center' },
  btnIcon:     { fontSize: 36 },
  btnTitle:    { fontSize: 18, fontWeight: '800', color: '#fff', marginTop: 5 },
  btnSub:      { fontSize: 12, color: 'rgba(255,255,255,0.7)', marginTop: 2 },
})