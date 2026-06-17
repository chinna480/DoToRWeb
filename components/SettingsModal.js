// SettingsModal.js — Reusable settings for both Customer & Technician profiles
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  Alert,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'

const LANGUAGES = [
  { code: 'en', label: '🇬🇧 English' },
  { code: 'hi', label: '🇮🇳 हिन्दी' },
]

export default function SettingsModal({ visible, onClose, role = 'customer' }) {
  const router = useRouter()
  const isTech = role === 'tech'
  const pfx = isTech ? 'tech' : 'cust'

  // ── Profile state ──
  const [name, setName]         = useState('')
  const [phone, setPhone]       = useState('')
  const [email, setEmail]       = useState('')
  const [location, setLocation] = useState('')
  const [pincode, setPincode]   = useState('')

  // ── Preference state ──
  const [language, setLanguage]       = useState('en')
  const [darkMode, setDarkMode]       = useState(false)
  const [notifSound, setNotifSound]   = useState(true)

  // ── Load / Save ──
  const loadSettings = async () => {
    try {
      const n  = await AsyncStorage.getItem(`${pfx}Name`)
      const p  = await AsyncStorage.getItem(`${pfx}Phone`)
      const e  = await AsyncStorage.getItem(`${pfx}Email`)
      const l  = await AsyncStorage.getItem(`${pfx}Location`)
      const pi = await AsyncStorage.getItem(`${pfx}Pincode`)
      const lang = await AsyncStorage.getItem(`${pfx}Lang`)
      const dm   = await AsyncStorage.getItem(`${pfx}DarkMode`)
      const ns   = await AsyncStorage.getItem(`${pfx}NotifSound`)

      if (n)  setName(n)
      if (p)  setPhone(p)
      if (e)  setEmail(e)
      if (l)  setLocation(l)
      if (pi) setPincode(pi)
      if (lang) setLanguage(lang)
      if (dm) setDarkMode(dm === 'true')
      if (ns) setNotifSound(ns === 'true')
    } catch (_) {}
  }

  const saveProfile = async () => {
    try {
      if (name.trim())  await AsyncStorage.setItem(`${pfx}Name`, name.trim())
      if (phone.trim()) await AsyncStorage.setItem(`${pfx}Phone`, phone.trim().replace(/[^0-9]/g, ''))
      if (email.trim()) await AsyncStorage.setItem(`${pfx}Email`, email.trim())
      if (location.trim()) await AsyncStorage.setItem(`${pfx}Location`, location.trim())
      if (pincode.trim()) await AsyncStorage.setItem(`${pfx}Pincode`, pincode.trim())

      // Save preferences
      await AsyncStorage.setItem(`${pfx}Lang`, language)
      await AsyncStorage.setItem(`${pfx}DarkMode`, String(darkMode))
      await AsyncStorage.setItem(`${pfx}NotifSound`, String(notifSound))

      Alert.alert('✅ Saved', 'Your settings have been updated!')
      onClose()
    } catch (e) {
      Alert.alert('Error', 'Failed to save settings')
    }
  }

  const handleDeleteAccount = () => {
    Alert.alert(
      '⚠️ Delete Account',
      'This will erase all your saved data from this device. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete', style: 'destructive', onPress: async () => {
            const keys = isTech
              ? ['techPhone','techName','techLocation','techPincode','techExp','techSkills','techPhoto','currentOrderId','digilockerVerified','digilockerName']
              : ['custPhone','custName','custEmail','custLocation','custPincode','custPhoto','lastOrderId','lastBrand','lastModelName','lastDescription','lastCustName','digilockerVerified','digilockerName']

            // Also clear preference keys
            const prefKeys = [`${pfx}Lang`, `${pfx}DarkMode`, `${pfx}NotifSound`]
            await AsyncStorage.multiRemove([...keys, ...prefKeys])
            router.replace('/screens/RoleScreen')
          }
        },
      ]
    )
  }

  const [activeSection, setActiveSection] = useState('profile')

  const renderProfile = () => (
    <>
      <Text style={st.sectionTitle}>👤 Edit Profile</Text>
      <View style={st.fieldGroup}>
        <Text style={st.label}>Name</Text>
        <TextInput style={st.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor="#bbb" />
      </View>
      <View style={st.fieldGroup}>
        <Text style={st.label}>Phone</Text>
        <TextInput style={[st.input, st.inputReadOnly]} value={phone} editable={false} placeholder="Phone number" placeholderTextColor="#bbb" />
        <Text style={st.hint}>Phone cannot be changed here</Text>
      </View>
      {!isTech && (
        <View style={st.fieldGroup}>
          <Text style={st.label}>Email</Text>
          <TextInput style={st.input} value={email} onChangeText={setEmail} placeholder="email@example.com" placeholderTextColor="#bbb" keyboardType="email-address" autoCapitalize="none" />
        </View>
      )}
      <View style={st.fieldGroup}>
        <Text style={st.label}>📍 Location</Text>
        <TextInput style={st.input} value={location} onChangeText={setLocation} placeholder="Your address" placeholderTextColor="#bbb" />
      </View>
      <View style={st.fieldGroup}>
        <Text style={st.label}>📮 Pincode</Text>
        <TextInput style={st.input} value={pincode} onChangeText={t => setPincode(t.replace(/[^0-9]/g, '').slice(0, 6))} placeholder="6-digit pincode" placeholderTextColor="#bbb" keyboardType="number-pad" maxLength={6} />
      </View>
    </>
  )

  const renderAccount = () => (
    <>
      <Text style={st.sectionTitle}>🔐 Account & Security</Text>
      <View style={st.infoCard}>
        <Text style={st.infoText}>
          Your account is linked to your phone number. All data is stored securely on your device and Firebase.
        </Text>
      </View>
      <TouchableOpacity style={st.dangerBtn} onPress={handleDeleteAccount}>
        <Text style={st.dangerBtnTxt}>🗑️ Delete My Account & Data</Text>
      </TouchableOpacity>
      <Text style={st.hint}>This clears all your saved data from this device.</Text>
    </>
  )

  const renderPreferences = () => (
    <>
      <Text style={st.sectionTitle}>⚙️ App Preferences</Text>

      {/* Language */}
      <Text style={st.prefLabel}>🌐 Language</Text>
      <View style={st.langRow}>
        {LANGUAGES.map(l => (
          <TouchableOpacity
            key={l.code}
            style={[st.langBtn, language === l.code && st.langBtnActive]}
            onPress={() => setLanguage(l.code)}
          >
            <Text style={[st.langBtnTxt, language === l.code && st.langBtnTxtActive]}>{l.label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Dark Mode */}
      <View style={st.prefRow}>
        <View><Text style={st.prefLabel}>🌙 Dark Mode</Text><Text style={st.prefDesc}>Use dark theme throughout the app</Text></View>
        <Switch value={darkMode} onValueChange={setDarkMode} trackColor={{ false: '#ddd', true: '#FF6B00' }} thumbColor="#fff" />
      </View>

      {/* Notification Sound */}
      <View style={st.prefRow}>
        <View><Text style={st.prefLabel}>🔔 Notification Sound</Text><Text style={st.prefDesc}>Play sound for incoming notifications</Text></View>
        <Switch value={notifSound} onValueChange={setNotifSound} trackColor={{ false: '#ddd', true: '#FF6B00' }} thumbColor="#fff" />
      </View>
    </>
  )

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose} onShow={loadSettings}>
      <View style={st.container}>
        {/* Header */}
        <View style={st.header}>
          <TouchableOpacity onPress={onClose} style={st.backBtn}><Text style={st.backTxt}>← Back</Text></TouchableOpacity>
          <Text style={st.headerTitle}>⚙️ Settings</Text>
          <View style={{ width: 60 }} />
        </View>

        {/* Tab bar */}
        <View style={st.tabRow}>
          {[
            { key: 'profile', icon: '👤', label: 'Profile' },
            { key: 'account', icon: '🔐', label: 'Security' },
            { key: 'prefs',   icon: '⚙️', label: 'Preferences' },
          ].map(tab => (
            <TouchableOpacity key={tab.key} style={[st.tab, activeSection === tab.key && st.tabActive]} onPress={() => setActiveSection(tab.key)}>
              <Text style={st.tabIcon}>{tab.icon}</Text>
              <Text style={[st.tabLabel, activeSection === tab.key && st.tabLabelActive]}>{tab.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Content */}
        <ScrollView style={st.body} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
          {activeSection === 'profile' && renderProfile()}
          {activeSection === 'account' && renderAccount()}
          {activeSection === 'prefs' && renderPreferences()}

          {/* Save Button (visible on all tabs) */}
          <TouchableOpacity style={st.saveBtn} onPress={saveProfile}>
            <Text style={st.saveBtnTxt}>💾 Save Settings</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  )
}

const st = StyleSheet.create({
  container:       { flex: 1, backgroundColor: '#f0f0f0' },
  header:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: Platform.OS === 'ios' ? 55 : 45, backgroundColor: '#FF6B00' },
  backBtn:         { padding: 6, width: 60 },
  backTxt:         { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerTitle:     { color: '#fff', fontSize: 18, fontWeight: '800', textAlign: 'center', flex: 1 },
  // Tab bar
  tabRow:          { flexDirection: 'row', backgroundColor: '#fff', paddingVertical: 8, paddingHorizontal: 10, borderBottomWidth: 1, borderBottomColor: '#eee' },
  tab:             { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 12, marginHorizontal: 4 },
  tabActive:       { backgroundColor: '#FFF5EE' },
  tabIcon:         { fontSize: 20 },
  tabLabel:        { fontSize: 11, fontWeight: '700', color: '#888', marginTop: 3 },
  tabLabelActive:  { color: '#FF6B00' },
  // Body
  body:            { flex: 1, padding: 16 },
  sectionTitle:    { fontSize: 17, fontWeight: '800', color: '#1A3A6B', marginBottom: 16 },
  // Fields
  fieldGroup:      { marginBottom: 14 },
  label:           { fontSize: 12, fontWeight: '700', color: '#888', marginBottom: 6 },
  input:           { backgroundColor: '#fff', borderRadius: 12, padding: 14, fontSize: 15, color: '#333', borderWidth: 1, borderColor: '#eee' },
  inputReadOnly:   { backgroundColor: '#f5f5f5', color: '#999' },
  hint:            { fontSize: 11, color: '#bbb', marginTop: 4, marginLeft: 2 },
  // Info card
  infoCard:        { backgroundColor: '#fff5ee', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#ffe0cc' },
  infoText:        { fontSize: 13, color: '#1A3A6B', lineHeight: 20, fontWeight: '600' },
  // Danger
  dangerBtn:       { backgroundColor: '#c62828', padding: 16, borderRadius: 14, alignItems: 'center', marginBottom: 8 },
  dangerBtnTxt:    { color: '#fff', fontSize: 15, fontWeight: '800' },
  // Preferences
  prefLabel:       { fontSize: 14, fontWeight: '700', color: '#1A3A6B', marginBottom: 8 },
  prefDesc:        { fontSize: 11, color: '#888', marginTop: 2 },
  prefRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff', borderRadius: 14, padding: 16, marginBottom: 10, elevation: 2 },
  langRow:         { flexDirection: 'row', gap: 10, marginBottom: 16 },
  langBtn:         { flex: 1, backgroundColor: '#fff', borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 2, borderColor: '#eee' },
  langBtnActive:   { borderColor: '#FF6B00', backgroundColor: '#FFF5EE' },
  langBtnTxt:      { fontSize: 14, fontWeight: '700', color: '#888' },
  langBtnTxtActive:{ color: '#FF6B00' },
  // Save
  saveBtn:         { backgroundColor: '#FF6B00', padding: 16, borderRadius: 14, alignItems: 'center', marginTop: 10, elevation: 3 },
  saveBtnTxt:      { color: '#fff', fontSize: 16, fontWeight: '800' },
})
