import AsyncStorage from '@react-native-async-storage/async-storage'
import * as ImagePicker from 'expo-image-picker'
import { useFocusEffect } from '@react-navigation/native'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { ref, update } from 'firebase/database'
import { useCallback, useState } from 'react'
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

const SERVICE_CATEGORIES = [
  { key: 'mobile',       icon: '📱', label: 'Mobile Repair' },
  { key: 'laptop',       icon: '💻', label: 'Laptop & PC Repair' },
  { key: 'tv',           icon: '📺', label: 'TV Repair' },
  { key: 'ac',           icon: '❄️', label: 'AC Service & Repair' },
  { key: 'refrigerator', icon: '🧊', label: 'Refrigerator Repair' },
  { key: 'washing',      icon: '🧺', label: 'Washing Machine Repair' },
  { key: 'electrician',  icon: '🔌', label: 'Electrician Services' },
  { key: 'plumbing',     icon: '🚰', label: 'Plumbing Services' },
  { key: 'cctv',         icon: '📡', label: 'CCTV Installation & Service' },
  { key: 'wifi',         icon: '🌐', label: 'Wi-Fi Router Setup' },
  { key: 'ro',           icon: '💧', label: 'RO Water Purifier Service' },
  { key: 'inverter',     icon: '🔋', label: 'Inverter & UPS Service' },
]

const EXP = ['0 - 1 Year', '1 - 2 Years', '2 - 5 Years', '5+ Years']

export default function TechLoginScreen() {
  const router = useRouter()
  const params = useLocalSearchParams()
  const [name, setName]           = useState('')
  const [phone, setPhone]         = useState('')
  const [location, setLocation]   = useState('')
  const [pincode, setPincode]     = useState('')
  const [exp, setExp]             = useState('')
  const [selCategories, setSelCategories] = useState([])
  const [showExp, setShowExp]     = useState(false)
  const [showCatPicker, setShowCatPicker] = useState(false)
  const [certificate, setCertificate] = useState(null)
  const [aadhar, setAadhar]                 = useState(null)
  const [aadharVerified, setAadharVerified] = useState(false)
  const [aadharName, setAadharName]         = useState('')

  useFocusEffect(
    useCallback(() => {
      const syncVerification = async () => {
        if (params.aadharVerified === 'true') {
          setAadharVerified(true)
          setAadharName(params.aadharName || 'Verified')
          return
        }

        // Fallback: check AsyncStorage (used when coming back from DigiLockerScreen)
        const storedVerified = await AsyncStorage.getItem('digilockerVerified')
        if (storedVerified === 'true') {
          setAadharVerified(true)
          const storedName = await AsyncStorage.getItem('digilockerName')
          if (storedName) setAadharName(storedName)
        }
      }
      syncVerification()
    }, [params.aadharVerified])
  )

  const toggleCategory = (catKey) => {
    setSelCategories(prev =>
      prev.includes(catKey) ? prev.filter(c => c !== catKey) : [...prev, catKey]
    )
  }

  const getSelectedLabels = () => {
    if (selCategories.length === 0) return 'Select service categories...'
    return selCategories.map(k => SERVICE_CATEGORIES.find(c => c.key === k)?.label).filter(Boolean).join(', ')
  }

  const pickImage = async (type) => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync()
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please allow access to your gallery!')
        return
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      })

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const uri = result.assets[0].uri
        if (type === 'certificate') setCertificate(uri)
        else setAadhar(uri)
      }
    } catch (error) {
      console.warn('ImagePicker error:', error)
      Alert.alert('Upload Failed', 'Could not pick image. Please try again or check permissions.')
    }
  }

  const register = async () => {
    if (!name)                 { Alert.alert('Error', 'Enter your name!');            return }
    if (phone.length !== 10)   { Alert.alert('Error', 'Enter valid 10 digit number!'); return }
    if (!location)             { Alert.alert('Error', 'Enter your location!');        return }
    if (!/^\d{6}$/.test(pincode))   { Alert.alert('Error', 'Enter a valid 6-digit pincode!'); return }
    if (!exp)                  { Alert.alert('Error', 'Select your experience!');     return }
    if (selCategories.length === 0){ Alert.alert('Error', 'Select at least one service category!'); return }
    if (!certificate)          { Alert.alert('Error', 'Upload your Certificate!');   return }
    if (!aadhar && !aadharVerified) { Alert.alert('Error', 'Verify your Aadhar via DigiLocker or upload manually!'); return }

    try {
      await AsyncStorage.setItem('techName',     name)
      await AsyncStorage.setItem('techPhone',    phone)
      await AsyncStorage.setItem('techLocation', location)
      await AsyncStorage.setItem('techPincode', pincode)
      await AsyncStorage.setItem('techExp',      exp)
      await AsyncStorage.setItem('techCategories',    JSON.stringify(selCategories))

      const token = await registerForNotifications()
      if (token) {
        await AsyncStorage.setItem('pushToken', token)
        // Save to multiple paths so Cloud Functions can find the token
        await update(ref(db, 'techs/' + phone), {
          pushToken: token,
          name,
          phone,
          location,
          pincode,
          exp,
        })
        // These paths are used by the newOrderNotification Cloud Function
        await update(ref(db, 'techUsers/' + phone), { pushToken: token, name, phone, location, pincode, exp, serviceCategories: selCategories })
        await update(ref(db, 'pushTokens/' + phone), token)
      }
    } catch (e) {
      console.warn('Registration save error (data already saved locally):', e.message)
    }

    router.replace('/screens/TechHomeScreen')
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView
        style={s.container}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >

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
            <Text style={s.label}>Pincode</Text>
            <View style={s.field}>
              <Text style={s.fIcon}>📮</Text>
              <TextInput style={s.input} placeholder="Enter 6-digit pincode" placeholderTextColor="#aaa" value={pincode} onChangeText={(t) => setPincode(t.replace(/[^0-9]/g, '').slice(0, 6))} keyboardType="numeric" maxLength={6} />
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
            <Text style={s.label}>🔧 Service Categories</Text>
            <Text style={s.hint}>Select which services you want to receive orders for</Text>
            <TouchableOpacity style={s.field} onPress={() => setShowCatPicker(!showCatPicker)}>
              <Text style={s.fIcon}>📋</Text>
              <Text style={[s.input, { color: selCategories.length > 0 ? '#1A3A6B' : '#aaa' }]} numberOfLines={1}>
                {selCategories.length > 0 ? `${selCategories.length} selected` : 'Select service categories...'}
              </Text>
              <Text style={{ color: '#888', fontSize: 11 }}>{showCatPicker ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {selCategories.length > 0 && (
              <Text style={s.catSelectedHint} numberOfLines={2}>{getSelectedLabels()}</Text>
            )}
            {showCatPicker && (
              <View style={s.dropdown}>
                {SERVICE_CATEGORIES.map(cat => {
                  const isSelected = selCategories.includes(cat.key)
                  return (
                    <TouchableOpacity key={cat.key} style={[s.catDropItem, isSelected && s.catDropItemActive]} onPress={() => { toggleCategory(cat.key) }}>
                      <View style={[s.catDropCheck, isSelected && s.catDropCheckActive]}>
                        {isSelected && <Text style={s.catDropCheckmark}>✓</Text>}
                      </View>
                      <Text style={s.catDropIcon}>{cat.icon}</Text>
                      <Text style={[s.catDropLabel, isSelected && s.catDropLabelActive]}>{cat.label}</Text>
                    </TouchableOpacity>
                  )
                })}
                <TouchableOpacity style={s.catDoneBtn} onPress={() => setShowCatPicker(false)}>
                  <Text style={s.catDoneTxt}>✅ Done ({selCategories.length} selected)</Text>
                </TouchableOpacity>
              </View>
            )}
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
  hint:           { fontSize: 11, color: '#888', fontWeight: '600', marginBottom: 8 },
  catSelectedHint:{ fontSize: 11, color: '#FF6B00', fontWeight: '700', marginTop: 4, marginLeft: 2 },
  catDropItem:    { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  catDropItemActive:{ backgroundColor: '#FFF5EE' },
  catDropCheck:   { width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: '#ddd', alignItems: 'center', justifyContent: 'center' },
  catDropCheckActive:{ backgroundColor: '#FF6B00', borderColor: '#FF6B00' },
  catDropCheckmark:{ color: '#fff', fontSize: 12, fontWeight: '800' },
  catDropIcon:    { fontSize: 18 },
  catDropLabel:   { fontSize: 13, fontWeight: '700', color: '#1A3A6B', flex: 1 },
  catDropLabelActive:{ color: '#FF6B00' },
  catDoneBtn:     { padding: 14, alignItems: 'center', backgroundColor: '#FF6B00' },
  catDoneTxt:     { color: '#fff', fontSize: 14, fontWeight: '800' },
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