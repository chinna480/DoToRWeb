import AsyncStorage from '@react-native-async-storage/async-storage'
import * as ImagePicker from 'expo-image-picker'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ref, update } from 'firebase/database'
import { useEffect, useState } from 'react'
import {
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { db } from '../firebase/config'
import { registerForNotifications } from '../utils/notifications'

const SKILLS = [
  '📱 Phone Repair',
  '💻 Laptop Repair',
  '🍎 iPhone Repair',
  '🖥️ Screen Replacement',
  '🔋 Battery Replacement',
  '💾 Software Issues',
]

const EXP = ['0 - 1 Year', '1 - 2 Years', '2 - 5 Years', '5+ Years']

export default function TechLoginScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const [name, setName]           = useState('')
  const [phone, setPhone]         = useState('')
  const [location, setLocation]   = useState('')
  const [exp, setExp]             = useState('')
  const [selSkills, setSelSkills] = useState([])
  const [showExp, setShowExp]     = useState(false)
  const [certificate, setCertificate] = useState(null)
  const [aadhar, setAadhar]                 = useState(null)
  const [aadharVerified, setAadharVerified] = useState(false)
  const [aadharName, setAadharName]         = useState('')

  useEffect(() => {
    if (params.aadharVerified === 'true') {
      setAadharVerified(true)
      setAadharName(params.aadharName || 'Verified')
    }
  }, [params.aadharVerified])

  const toggleSkill = (skill) => {
    setSelSkills(prev =>
      prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
    )
  }

  const pickImage = async (type) => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Please allow access to your gallery!')
      return
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.8,
    })

    if (!result.canceled) {
      if (type === 'certificate') setCertificate(result.assets[0].uri)
      else setAadhar(result.assets[0].uri)
    }
  }

  const register = async () => {
    if (!name)                 { Alert.alert('Error', 'Enter your name!');            return }
    if (phone.length !== 10)   { Alert.alert('Error', 'Enter valid 10 digit number!'); return }
    if (!location)             { Alert.alert('Error', 'Enter your location!');        return }
    if (!exp)                  { Alert.alert('Error', 'Select your experience!');     return }
    if (selSkills.length === 0){ Alert.alert('Error', 'Select at least one skill!'); return }
    if (!certificate)          { Alert.alert('Error', 'Upload your Certificate!');   return }
    if (!aadhar && !aadharVerified) { Alert.alert('Error', 'Verify your Aadhar via DigiLocker or upload manually!'); return }

    await AsyncStorage.setItem('techName',     name)
    await AsyncStorage.setItem('techPhone',    phone)
    await AsyncStorage.setItem('techLocation', location)
    await AsyncStorage.setItem('techExp',      exp)
    await AsyncStorage.setItem('techSkills',   JSON.stringify(selSkills))

    const token = await registerForNotifications()
    if (token) {
      await AsyncStorage.setItem('pushToken', token)
      await update(ref(db, 'techs/' + phone), {
        pushToken: token,
        name,
        phone,
        location,
      })
    }

    router.replace('/screens/TechHomeScreen')
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView style={s.container} showsVerticalScrollIndicator={false}>

        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.back}>←</Text>
          </TouchableOpacity>
          <View style={s.headerCenter}>
            <Text style={s.headerIcon}>🔧</Text>
            <Text style={s.title}>Technician Login</Text>
            <Text style={s.sub}>Join DoToR and start earning!</Text>
          </View>
        </View>

        <View style={s.content}>

          <View style={s.group}>
            <Text style={s.label}>Full Name</Text>
            <View style={s.field}>
              <Text style={s.fIcon}>👤</Text>
              <TextInput style={s.input} placeholder="Enter your full name" placeholderTextColor="#aaa" value={name} onChangeText={setName} />
            </View>
          </View>

          <View style={s.group}>
            <Text style={s.label}>Phone Number</Text>
            <View style={s.field}>
              <Text style={s.fIcon}>🇮🇳 +91</Text>
              <TextInput style={s.input} placeholder="Enter 10 digit number" placeholderTextColor="#aaa" value={phone} onChangeText={setPhone} keyboardType="numeric" maxLength={10} />
            </View>
          </View>

          <View style={s.group}>
            <Text style={s.label}>Location</Text>
            <View style={s.field}>
              <Text style={s.fIcon}>📍</Text>
              <TextInput style={s.input} placeholder="Enter your area" placeholderTextColor="#aaa" value={location} onChangeText={setLocation} />
            </View>
          </View>

          <View style={s.group}>
            <Text style={s.label}>Experience</Text>
            <TouchableOpacity style={s.field} onPress={() => setShowExp(!showExp)}>
              <Text style={s.fIcon}>⭐</Text>
              <Text style={[s.input, { color: exp ? '#1A3A6B' : '#aaa' }]}>{exp || 'Select Experience'}</Text>
              <Text style={{ color: '#888' }}>{showExp ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {showExp && (
              <View style={s.dropdown}>
                {EXP.map(e => (
                  <TouchableOpacity key={e} style={[s.dropItem, exp === e && s.dropItemActive]} onPress={() => { setExp(e); setShowExp(false) }}>
                    <Text style={[s.dropTxt, exp === e && s.dropTxtActive]}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>

          <View style={s.group}>
            <Text style={s.label}>Skills</Text>
            <View style={s.skillsBox}>
              {SKILLS.map(skill => (
                <TouchableOpacity key={skill} style={s.skillRow} onPress={() => toggleSkill(skill)}>
                  <View style={[s.checkbox, selSkills.includes(skill) && s.checkboxActive]}>
                    {selSkills.includes(skill) && <Text style={s.checkmark}>✓</Text>}
                  </View>
                  <Text style={s.skillTxt}>{skill}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={s.group}>
            <Text style={s.label}>Upload Certificate</Text>
            <TouchableOpacity style={[s.uploadBox, certificate && s.uploadBoxDone]} onPress={() => pickImage('certificate')}>
              {certificate ? (
                <>
                  <Image source={{ uri: certificate }} style={s.uploadPreview} />
                  <Text style={s.uploadDoneTxt}>✅ Certificate Uploaded</Text>
                  <Text style={s.uploadChangeTxt}>Tap to change</Text>
                </>
              ) : (
                <>
                  <Text style={s.uploadIcon}>📄</Text>
                  <Text style={s.uploadTxt}>Tap to upload Certificate</Text>
                  <Text style={s.uploadSub}>JPG, PNG accepted</Text>
                </>
              )}
            </TouchableOpacity>
          </View>

          <View style={s.group}>
            <Text style={s.label}>Aadhar Verification</Text>
            <TouchableOpacity
              style={[s.digiBtn, aadharVerified && s.digiBtnDone]}
              onPress={() => {
                if (!aadharVerified) {
                  router.push({
                    pathname: '/screens/DigiLockerScreen',
                    params: { onVerified: 'tech' }
                  })
                }
              }}
            >
              <Text style={s.digiIcon}>🏛️</Text>
              <View style={{ flex: 1 }}>
                <Text style={[s.digiTxt, aadharVerified && s.digiTxtDone]}>
                  {aadharVerified
                    ? `✅ Aadhar Verified — ${aadharName}`
                    : 'Verify Aadhar via DigiLocker'}
                </Text>
                <Text style={s.digiSub}>
                  {aadharVerified
                    ? 'Identity confirmed by Government'
                    : 'Secure government verification'}
                </Text>
              </View>
              {!aadharVerified && <Text style={s.digiArrow}>→</Text>}
            </TouchableOpacity>
          </View>
          <TouchableOpacity style={s.registerBtn} onPress={register}>
            <Text style={s.registerTxt}>Register & Continue →</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={() => router.push('/screens/CustomerLoginScreen')}>
            <Text style={s.switchTxt}>Need Repair? <Text style={s.link}>Customer Login</Text></Text>
          </TouchableOpacity>

          <View style={{ height: 40 }} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#fff' },
  header:         { backgroundColor: '#1A3A6B', paddingTop: 55, paddingBottom: 25, paddingHorizontal: 20 },
  back:           { fontSize: 24, color: '#fff', fontWeight: '700', marginBottom: 15 },
  headerCenter:   { alignItems: 'center' },
  headerIcon:     { fontSize: 45 },
  title:          { fontSize: 22, fontWeight: '800', color: '#fff', marginTop: 8 },
  sub:            { fontSize: 13, color: 'rgba(255,255,255,0.8)', marginTop: 4 },
  content:        { padding: 20 },
  group:          { marginBottom: 18 },
  label:          { fontSize: 11, fontWeight: '800', color: '#1A3A6B', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 },
  field:          { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#eee', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 13, gap: 10 },
  fIcon:          { fontSize: 16, color: '#1A3A6B', fontWeight: '700' },
  input:          { flex: 1, fontSize: 14, color: '#1A3A6B', fontWeight: '600' },
  dropdown:       { borderWidth: 2, borderColor: '#eee', borderRadius: 12, marginTop: 4, overflow: 'hidden' },
  dropItem:       { padding: 14, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  dropItemActive: { backgroundColor: '#fff5ee' },
  dropTxt:        { fontSize: 14, color: '#1A3A6B', fontWeight: '600' },
  dropTxtActive:  { color: '#FF6B00', fontWeight: '800' },
  skillsBox:      { borderWidth: 2, borderColor: '#eee', borderRadius: 12, padding: 12, gap: 12 },
  skillRow:       { flexDirection: 'row', alignItems: 'center', gap: 12 },
  checkbox:       { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#eee', alignItems: 'center', justifyContent: 'center' },
  checkboxActive: { backgroundColor: '#FF6B00', borderColor: '#FF6B00' },
  checkmark:      { color: '#fff', fontSize: 13, fontWeight: '800' },
  skillTxt:       { fontSize: 14, fontWeight: '700', color: '#1A3A6B' },
  uploadBox:      { borderWidth: 2, borderColor: '#FF6B00', borderStyle: 'dashed', borderRadius: 12, padding: 20, alignItems: 'center', backgroundColor: '#fff5ee' },
  uploadBoxDone:  { borderColor: '#2e7d32', backgroundColor: '#f1f8f1', borderStyle: 'solid' },
  uploadIcon:     { fontSize: 32 },
  uploadTxt:      { fontSize: 13, fontWeight: '700', color: '#FF6B00', marginTop: 6 },
  uploadSub:      { fontSize: 11, color: '#888', marginTop: 3 },
  uploadPreview:  { width: 120, height: 80, borderRadius: 8, marginBottom: 8, resizeMode: 'cover' },
  uploadDoneTxt:  { fontSize: 13, fontWeight: '800', color: '#2e7d32' },
  uploadChangeTxt:{ fontSize: 11, color: '#888', marginTop: 3 },
  registerBtn:    { backgroundColor: '#1A3A6B', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 5, marginBottom: 15 },
  registerTxt:    { color: '#fff', fontSize: 16, fontWeight: '800' },
  switchTxt:      { textAlign: 'center', color: '#888', fontSize: 13, fontWeight: '600' },
  link:           { color: '#FF6B00', fontWeight: '800' },
  digiBtn:        { flexDirection: 'row', alignItems: 'center', borderWidth: 2, borderColor: '#1A3A6B', borderRadius: 12, padding: 14, gap: 12, backgroundColor: '#f0f4ff' },
  digiBtnDone:    { borderColor: '#2e7d32', backgroundColor: '#f1f8f1' },
  digiIcon:       { fontSize: 28 },
  digiTxt:        { fontSize: 14, fontWeight: '800', color: '#1A3A6B' },
  digiTxtDone:    { color: '#2e7d32' },
  digiSub:        { fontSize: 11, color: '#888', marginTop: 2 },
  digiArrow:      { fontSize: 18, color: '#1A3A6B', fontWeight: '800' },
})