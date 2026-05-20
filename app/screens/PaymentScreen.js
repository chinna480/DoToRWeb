import { useRouter } from 'expo-router'
import { useState } from 'react'
import {
  Alert,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'

const PAYMENT_METHODS = [
  {
    id: 'upi',
    name: 'UPI',
    icon: '📱',
    desc: 'Google Pay, PhonePe, Paytm',
    color: '#8B5CF6',
  },
  {
    id: 'card',
    name: 'Credit / Debit Card',
    icon: '💳',
    desc: 'Visa, Mastercard, RuPay',
    color: '#3B82F6',
  },
  {
    id: 'wallet',
    name: 'DoToR Wallet',
    icon: '💰',
    desc: 'Pay using wallet balance',
    color: '#FF6B00',
  },
  {
    id: 'cod',
    name: 'Cash on Delivery',
    icon: '💵',
    desc: 'Pay when technician arrives',
    color: '#2e7d32',
  },
]

export default function PaymentScreen() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState('home')
  const [selectedMethod, setSelectedMethod] = useState(null)
  const [amount] = useState(299)
  const [showUPI, setShowUPI] = useState(false)
  const [upiId, setUpiId] = useState('dotor@upi')
  const [showCard, setShowCard] = useState(false)

  const proceedPayment = () => {
    if (!selectedMethod) {
      Alert.alert('Select Method', 'Please select a payment method')
      return
    }

    if (selectedMethod === 'cod') {
      Alert.alert(
        '✅ Cash on Delivery',
        'Pay ₹299 when the technician arrives at your doorstep.',
        [{ text: 'OK', onPress: () => router.back() }]
      )
      return
    }

    if (selectedMethod === 'upi') {
      setShowUPI(true)
      return
    }

    if (selectedMethod === 'card') {
      setShowCard(true)
      return
    }

    if (selectedMethod === 'wallet') {
      Alert.alert('💰 DoToR Wallet', 'Your wallet balance: ₹0\n\nAdd money to use wallet payments.', [
        { text: 'OK' },
      ])
      return
    }
  }

  const payWithUPI = () => {
    const upiLink = `upi://pay?pa=${upiId}&pn=DoToR&am=${amount}&cu=INR&tn=Repair Payment`
    Linking.openURL(upiLink).catch(() => {
      Alert.alert('Open UPI App', 'Please open Google Pay / PhonePe to complete payment.')
    })
  }

  const copyUPI = () => {
    Alert.alert('📱 UPI ID', `Pay to this UPI ID:\n\n${upiId}\n\nYou can copy it manually from above.`)
  }

  const CUST_TABS = [
    { key: 'home',     icon: '🏠', label: 'Home' },
    { key: 'orders',   icon: '📋', label: 'Orders' },
    { key: 'profile',  icon: '👤', label: 'Profile' },
  ]

  const switchTab = (key) => {
    if (key === 'home') { setActiveTab('home'); return }
    if (key === 'orders') { router.push('/screens/HomeScreen'); return }
    if (key === 'profile') { router.push('/screens/CustomerProfileScreen'); return }
  }

  const renderTabBar = () => (
    <View style={s.tabBar}>
      {CUST_TABS.map(tab => (
        <TouchableOpacity
          key={tab.key}
          style={[s.tabItem, activeTab === tab.key && s.tabItemActive]}
          onPress={() => switchTab(tab.key)}
        >
          <Text style={[s.tabIcon, activeTab === tab.key && s.tabIconActive]}>{tab.icon}</Text>
          <Text style={[s.tabLabel, activeTab === tab.key && s.tabLabelActive]}>{tab.label}</Text>
          {activeTab === tab.key && <View style={s.tabIndicator} />}
        </TouchableOpacity>
      ))}
    </View>
  )

  if (showUPI) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
        <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
          <View style={s.header}>
            <TouchableOpacity onPress={() => setShowUPI(false)}>
              <Text style={s.back}>←</Text>
            </TouchableOpacity>
            <Text style={s.headerTitle}>📱 UPI Payment</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={s.amountCard}>
            <Text style={s.amountLabel}>Amount to Pay</Text>
            <Text style={s.amountVal}>₹{amount}</Text>
          </View>

          <View style={s.upiCard}>
            <Text style={s.upiLabel}>Scan or enter UPI ID</Text>
            <View style={s.upiInputRow}>
              <TextInput
                style={s.upiInput}
                value={upiId}
                onChangeText={setUpiId}
                placeholder="example@upi"
                placeholderTextColor="#aaa"
                autoCapitalize="none"
              />
              <TouchableOpacity style={s.copyBtn} onPress={copyUPI}>
                <Text style={s.copyTxt}>📋</Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity style={s.payNowBtn} onPress={payWithUPI}>
              <Text style={s.payNowTxt}>Pay ₹{amount} via UPI →</Text>
            </TouchableOpacity>

            <Text style={s.upiNote}>Supported apps: Google Pay, PhonePe, Paytm, BHIM</Text>
          </View>

          <View style={{ height: 90 }} />
        </ScrollView>
        {renderTabBar()}
      </View>
    )
  }

  if (showCard) {
    return (
      <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
        <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
          <View style={s.header}>
            <TouchableOpacity onPress={() => setShowCard(false)}>
              <Text style={s.back}>←</Text>
            </TouchableOpacity>
            <Text style={s.headerTitle}>💳 Card Payment</Text>
            <View style={{ width: 40 }} />
          </View>

          <View style={s.amountCard}>
            <Text style={s.amountLabel}>Amount to Pay</Text>
            <Text style={s.amountVal}>₹{amount}</Text>
          </View>

          <View style={s.cardForm}>
            <Text style={s.formLabel}>Card Number</Text>
            <TextInput
              style={s.formInput}
              placeholder="1234 5678 9012 3456"
              placeholderTextColor="#aaa"
              keyboardType="numeric"
              maxLength={19}
            />
            <View style={s.formRow}>
              <View style={{ flex: 1 }}>
                <Text style={s.formLabel}>Expiry</Text>
                <TextInput
                  style={s.formInput}
                  placeholder="MM/YY"
                  placeholderTextColor="#aaa"
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.formLabel}>CVV</Text>
                <TextInput
                  style={s.formInput}
                  placeholder="123"
                  placeholderTextColor="#aaa"
                  keyboardType="numeric"
                  maxLength={4}
                  secureTextEntry
                />
              </View>
            </View>
            <Text style={s.formLabel}>Cardholder Name</Text>
            <TextInput
              style={s.formInput}
              placeholder="John Doe"
              placeholderTextColor="#aaa"
            />

            <TouchableOpacity style={s.payNowBtn} onPress={() => Alert.alert('✅ Payment Successful!', 'Your payment of ₹299 has been processed.')}>
              <Text style={s.payNowTxt}>Pay ₹{amount} →</Text>
            </TouchableOpacity>

            <Text style={s.secureNote}>🔒 Secured with 256-bit encryption</Text>
          </View>

          <View style={{ height: 90 }} />
        </ScrollView>
        {renderTabBar()}
      </View>
    )
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f5f5f5' }}>
      <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
        {/* HEADER */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={s.back}>←</Text>
          </TouchableOpacity>
          <Text style={s.headerTitle}>💳 Payment</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* AMOUNT */}
        <View style={s.amountCard}>
          <Text style={s.amountLabel}>Total Amount</Text>
          <Text style={s.amountVal}>₹{amount}</Text>
          <Text style={s.amountSub}>Repair service charge (inclusive of all taxes)</Text>
        </View>

        {/* PAYMENT METHODS */}
        <Text style={s.sectionTitle}>Select Payment Method</Text>
        <View style={s.methodsCard}>
          {PAYMENT_METHODS.map((method, i) => (
            <TouchableOpacity
              key={method.id}
              style={[
                s.methodItem,
                i === PAYMENT_METHODS.length - 1 && { borderBottomWidth: 0 },
                selectedMethod === method.id && s.methodItemActive,
              ]}
              onPress={() => setSelectedMethod(method.id)}
            >
              <View style={[s.methodIconBox, { backgroundColor: method.color + '20' }]}>
                <Text style={s.methodIcon}>{method.icon}</Text>
              </View>
              <View style={s.methodInfo}>
                <Text style={s.methodName}>{method.name}</Text>
                <Text style={s.methodDesc}>{method.desc}</Text>
              </View>
              <View style={[s.radioBtn, selectedMethod === method.id && s.radioBtnActive]}>
                {selectedMethod === method.id && <View style={s.radioDot} />}
              </View>
            </TouchableOpacity>
          ))}
        </View>

        {/* PROCEED */}
        <TouchableOpacity
          style={[s.proceedBtn, !selectedMethod && s.proceedBtnDisabled]}
          onPress={proceedPayment}
          disabled={!selectedMethod}
        >
          <Text style={s.proceedTxt}>
            {selectedMethod === 'cod' ? 'Confirm Cash on Delivery →' : `Pay ₹${amount} →`}
          </Text>
        </TouchableOpacity>

        {/* SECURITY */}
        <View style={s.securityNote}>
          <Text style={s.securityIcon}>🔒</Text>
          <Text style={s.securityTxt}>Your payment info is secure. We never store card details.</Text>
        </View>

        <View style={{ height: 90 }} />
      </ScrollView>
      {renderTabBar()}
    </View>
  )
}

const s = StyleSheet.create({
  container:     { flex: 1, backgroundColor: '#f5f5f5' },
  header:        { backgroundColor: '#1A3A6B', padding: 20, paddingTop: Platform.OS === 'ios' ? 55 : 45, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  back:          { fontSize: 24, color: '#fff', fontWeight: '700' },
  headerTitle:   { fontSize: 18, fontWeight: '800', color: '#fff' },

  // Amount
  amountCard:    { backgroundColor: '#fff', borderRadius: 18, margin: 15, padding: 22, alignItems: 'center', elevation: 3 },
  amountLabel:   { fontSize: 12, color: '#888', fontWeight: '700', letterSpacing: 1 },
  amountVal:     { fontSize: 40, fontWeight: '800', color: '#1A3A6B', marginTop: 6 },
  amountSub:     { fontSize: 11, color: '#aaa', marginTop: 5, textAlign: 'center' },

  // Payment methods
  sectionTitle:  { fontSize: 16, fontWeight: '800', color: '#1A3A6B', marginHorizontal: 15, marginTop: 10, marginBottom: 10 },
  methodsCard:   { backgroundColor: '#fff', borderRadius: 18, marginHorizontal: 15, overflow: 'hidden', elevation: 2 },
  methodItem:    { flexDirection: 'row', alignItems: 'center', padding: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5' },
  methodItemActive: { backgroundColor: '#fafafa' },
  methodIconBox: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  methodIcon:    { fontSize: 22 },
  methodInfo:    { flex: 1, marginLeft: 14 },
  methodName:    { fontSize: 15, fontWeight: '800', color: '#1A3A6B' },
  methodDesc:    { fontSize: 11, color: '#888', marginTop: 2 },
  radioBtn:      { width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: '#ddd', alignItems: 'center', justifyContent: 'center' },
  radioBtnActive:{ borderColor: '#FF6B00' },
  radioDot:      { width: 12, height: 12, borderRadius: 6, backgroundColor: '#FF6B00' },

  // Proceed
  proceedBtn:    { backgroundColor: '#FF6B00', padding: 16, borderRadius: 14, alignItems: 'center', marginHorizontal: 15, marginTop: 15 },
  proceedBtnDisabled: { backgroundColor: '#ddd' },
  proceedTxt:    { color: '#fff', fontSize: 16, fontWeight: '800' },
  securityNote:  { flexDirection: 'row', alignItems: 'center', gap: 8, justifyContent: 'center', marginTop: 15, paddingHorizontal: 30 },
  securityIcon:  { fontSize: 16 },
  securityTxt:   { fontSize: 11, color: '#888', fontWeight: '600', textAlign: 'center' },

  // UPI
  upiCard:       { backgroundColor: '#fff', borderRadius: 18, margin: 15, padding: 20, elevation: 3 },
  upiLabel:      { fontSize: 13, fontWeight: '700', color: '#1A3A6B', marginBottom: 12 },
  upiInputRow:   { flexDirection: 'row', gap: 10, marginBottom: 18 },
  upiInput:      { flex: 1, borderWidth: 2, borderColor: '#eee', borderRadius: 12, padding: 12, fontSize: 14, color: '#1A3A6B', fontWeight: '600' },
  copyBtn:       { width: 44, height: 44, borderRadius: 12, backgroundColor: '#f5f5f5', alignItems: 'center', justifyContent: 'center' },
  copyTxt:       { fontSize: 20 },
  payNowBtn:     { backgroundColor: '#FF6B00', padding: 15, borderRadius: 14, alignItems: 'center' },
  payNowTxt:     { color: '#fff', fontSize: 16, fontWeight: '800' },
  upiNote:       { textAlign: 'center', fontSize: 11, color: '#888', marginTop: 12, fontWeight: '600' },

  // Card
  cardForm:      { backgroundColor: '#fff', borderRadius: 18, margin: 15, padding: 20, elevation: 3 },
  formLabel:     { fontSize: 11, fontWeight: '800', color: '#1A3A6B', letterSpacing: 1, marginBottom: 6, marginTop: 10, textTransform: 'uppercase' },
  formInput:     { borderWidth: 2, borderColor: '#eee', borderRadius: 12, padding: 12, fontSize: 14, color: '#1A3A6B', fontWeight: '600' },
  formRow:       { flexDirection: 'row', gap: 12 },
  secureNote:    { textAlign: 'center', fontSize: 12, color: '#888', marginTop: 15, fontWeight: '600' },

  // ── Bottom Tab Bar ──
  tabBar:        { position: 'absolute', bottom: 0, left: 0, right: 0, flexDirection: 'row', backgroundColor: '#fff', paddingBottom: 25, paddingTop: 8, elevation: 10, borderTopWidth: 1, borderTopColor: '#eee' },
  tabItem:       { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 4, position: 'relative' },
  tabItemActive: {},
  tabIcon:       { fontSize: 22, opacity: 0.5 },
  tabIconActive: { opacity: 1 },
  tabLabel:      { fontSize: 10, fontWeight: '600', color: '#888', marginTop: 2 },
  tabLabelActive:{ color: '#FF6B00', fontWeight: '800' },
  tabIndicator:  { position: 'absolute', top: -1, width: 24, height: 3, backgroundColor: '#FF6B00', borderRadius: 2, alignSelf: 'center' },
})
