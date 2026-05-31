import { useRef, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Animated,
  Dimensions,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'

const { width } = Dimensions.get('window')

// Simulated Aadhaar data (in production, this comes from DigiLocker API)
const MOCK_AADHAAR_DATA = {
  '123412341234': {
    name: 'Rahul Sharma',
    dob: '15/08/1995',
    gender: 'Male',
    address: '42, MG Road, Indiranagar, Bangalore - 560038',
    phone: '9876543210',
  },
  '567856785678': {
    name: 'Priya Patel',
    dob: '22/03/1998',
    gender: 'Female',
    address: '7, Lake View Apartments, Koramangala, Bangalore - 560034',
    phone: '8765432109',
  },
  '901290129012': {
    name: 'Amit Kumar',
    dob: '10/11/1992',
    gender: 'Male',
    address: '15, Gandhi Nagar, Hyderabad - 500080',
    phone: '9988776655',
  },
}

const DEFAULT_AADHAAR = {
  name: 'Verified User',
  dob: '01/01/1995',
  gender: 'Male',
  address: 'DigiLocker Verified Address, India',
  phone: '9876543210',
}

export default function DigiLockerVerification({ onVerified, buttonStyle, buttonTextStyle }) {
  const [modalVisible, setModalVisible] = useState(false)
  const [step, setStep] = useState('consent') // consent → aadhaar → verifying → verified
  const [aadhaarNumber, setAadhaarNumber] = useState('')
  const [verifiedData, setVerifiedData] = useState(null)

  const scaleAnim = useRef(new Animated.Value(0)).current
  const pulseAnim = useRef(new Animated.Value(1)).current

  const openModal = () => {
    setModalVisible(true)
    setStep('consent')
    setAadhaarNumber('')
    setVerifiedData(null)
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start()
  }

  const closeModal = () => {
    Animated.timing(scaleAnim, {
      toValue: 0,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      setModalVisible(false)
      setStep('consent')
    })
  }

  const proceedToAadhaar = () => {
    setStep('aadhaar')
  }

  const startVerification = () => {
    if (aadhaarNumber.length !== 12) {
      Alert.alert('Error', 'Enter a valid 12-digit Aadhaar number')
      return
    }

    setStep('verifying')

    // Start pulse animation for the loading state
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.6,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    ).start()

    // Simulate API call to DigiLocker
    setTimeout(() => {
      pulseAnim.stopAnimation()
      pulseAnim.setValue(1)

      // Get mock data or default
      const data = MOCK_AADHAAR_DATA[aadhaarNumber] || DEFAULT_AADHAAR
      setVerifiedData(data)
      setStep('verified')

      // Auto-close after showing success briefly
      setTimeout(() => {
        closeModal()
        if (onVerified) {
          onVerified({
            ...data,
            digilockerVerified: true,
            aadhaarLast4: aadhaarNumber.slice(-4),
          })
        }
      }, 1500)
    }, 2500)
  }

  const renderConsent = () => (
    <View style={s.stepContainer}>
      <View style={s.govBadge}>
        <Text style={s.govBadgeText}>GOVERNMENT OF INDIA</Text>
      </View>

      <View style={s.digilockerIconContainer}>
        <Text style={s.digilockerIcon}>🔐</Text>
      </View>

      <Text style={s.digilockerTitle}>DigiLocker</Text>
      <Text style={s.digilockerSub}>Digital Document Wallet</Text>

      <View style={s.divider} />

      <Text style={s.consentTitle}>Requesting access to:</Text>

      <View style={s.permissionList}>
        <View style={s.permissionItem}>
          <Text style={s.permissionIcon}>✅</Text>
          <Text style={s.permissionText}>Verify your identity</Text>
        </View>
        <View style={s.permissionItem}>
          <Text style={s.permissionIcon}>✅</Text>
          <Text style={s.permissionText}>Fetch Aadhaar details (Name, DOB, Address)</Text>
        </View>
        <View style={s.permissionItem}>
          <Text style={s.permissionIcon}>✅</Text>
          <Text style={s.permissionText}>Retrieve registered mobile number</Text>
        </View>
      </View>

      <Text style={s.consentNote}>
        Your data will only be used for this verification and will not be stored without your consent.
      </Text>

      <View style={s.consentButtons}>
        <TouchableOpacity style={s.consentAllowBtn} onPress={proceedToAadhaar}>
          <Text style={s.consentAllowText}>Allow & Continue →</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.consentDenyBtn} onPress={closeModal}>
          <Text style={s.consentDenyText}>Cancel</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  const renderAadhaarInput = () => (
    <View style={s.stepContainer}>
      <View style={s.govBadge}>
        <Text style={s.govBadgeText}>GOVERNMENT OF INDIA</Text>
      </View>

      <View style={s.digilockerIconContainer}>
        <Text style={s.digilockerIcon}>🆔</Text>
      </View>

      <Text style={s.digilockerTitle}>Verify with Aadhaar</Text>
      <Text style={s.digilockerSub}>Enter your 12-digit Aadhaar number</Text>

      <View style={s.divider} />

      <View style={s.aadhaarInputBox}>
        <Text style={s.aadhaarInputIcon}>🆔</Text>
        <TextInput
          style={s.aadhaarInput}
          placeholder="XXXX XXXX XXXX"
          placeholderTextColor="#999"
          value={aadhaarNumber}
          onChangeText={(t) => setAadhaarNumber(t.replace(/[^0-9]/g, '').slice(0, 12))}
          keyboardType="numeric"
          maxLength={12}
        />
      </View>

      <Text style={s.aadhaarHint}>
        Demo: Try 123412341234, 567856785678, or any 12-digit number
      </Text>

      <View style={s.aadhaarButtons}>
        <TouchableOpacity
          style={[s.verifyBtn, aadhaarNumber.length !== 12 && s.verifyBtnDisabled]}
          onPress={startVerification}
          disabled={aadhaarNumber.length !== 12}
        >
          <Text style={s.verifyBtnText}>Verify with DigiLocker →</Text>
        </TouchableOpacity>
        <TouchableOpacity style={s.backBtn} onPress={() => setStep('consent')}>
          <Text style={s.backBtnText}>← Back</Text>
        </TouchableOpacity>
      </View>
    </View>
  )

  const renderVerifying = () => (
    <View style={s.stepContainer}>
      <View style={s.govBadge}>
        <Text style={s.govBadgeText}>GOVERNMENT OF INDIA</Text>
      </View>

      <Animated.View style={[s.loadingCircle, { opacity: pulseAnim }]}>
        <Text style={s.loadingIcon}>🔐</Text>
      </Animated.View>

      <Text style={s.verifyingTitle}>Verifying with DigiLocker...</Text>
      <Text style={s.verifyingSub}>Fetching your Aadhaar details</Text>

      <View style={s.verifyingSteps}>
        <View style={s.verifyingStep}>
          <Text style={s.verifyingStepIcon}>⟳</Text>
          <Text style={s.verifyingStepText}>Connecting to DigiLocker</Text>
        </View>
        <View style={s.verifyingStep}>
          <Text style={s.verifyingStepIcon}>⟳</Text>
          <Text style={s.verifyingStepText}>Authenticating Aadhaar</Text>
        </View>
        <View style={s.verifyingStep}>
          <Text style={s.verifyingStepIcon}>⟳</Text>
          <Text style={s.verifyingStepText}>Fetching documents</Text>
        </View>
      </View>

      <ActivityIndicator size="small" color="#1A3A6B" style={{ marginTop: 10 }} />
    </View>
  )

  const renderVerified = () => (
    <View style={s.stepContainer}>
      <View style={s.govBadge}>
        <Text style={s.govBadgeText}>GOVERNMENT OF INDIA</Text>
      </View>

      <View style={s.successCircle}>
        <Text style={s.successIcon}>✅</Text>
      </View>

      <Text style={s.verifiedTitle}>Verified Successfully!</Text>
      <Text style={s.verifiedSub}>Aadhaar details fetched from DigiLocker</Text>

      <View style={s.divider} />

      {verifiedData && (
        <View style={s.dataRows}>
          <DataRow label="Name" value={verifiedData.name} />
          <DataRow label="DOB" value={verifiedData.dob} />
          <DataRow label="Gender" value={verifiedData.gender} />
          <DataRow label="Address" value={verifiedData.address} />
          <DataRow label="Phone" value={verifiedData.phone} />
        </View>
      )}

      <Text style={s.successNote}>
        ✓ DigiLocker Verified | Aadhaar XXXXXXXX{verifiedData ? aadhaarNumber.slice(-4) : 'XXXX'}
      </Text>
    </View>
  )

  return (
    <>
      <TouchableOpacity
        style={[s.digilockerBtn, buttonStyle]}
        onPress={openModal}
        activeOpacity={0.85}
      >
        <Text style={s.digilockerBtnIcon}>🔐</Text>
        <Text style={[s.digilockerBtnText, buttonTextStyle]}>Verify via DigiLocker</Text>
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeModal}
      >
        <View style={s.overlay}>
          <Animated.View
            style={[
              s.modalContent,
              { transform: [{ scale: scaleAnim }] },
            ]}
          >
            {/* Close button */}
            {step !== 'verifying' && step !== 'verified' && (
              <TouchableOpacity style={s.modalClose} onPress={closeModal}>
                <Text style={s.modalCloseText}>✕</Text>
              </TouchableOpacity>
            )}

            {step === 'consent' && renderConsent()}
            {step === 'aadhaar' && renderAadhaarInput()}
            {step === 'verifying' && renderVerifying()}
            {step === 'verified' && renderVerified()}
          </Animated.View>
        </View>
      </Modal>
    </>
  )
}

function DataRow({ label, value }) {
  return (
    <View style={s.dataRow}>
      <Text style={s.dataLabel}>{label}</Text>
      <Text style={s.dataValue}>{value}</Text>
    </View>
  )
}

const s = StyleSheet.create({
  // --- Main Button ---
  digilockerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1A237E',
    padding: 14,
    borderRadius: 12,
    gap: 10,
    borderWidth: 1.5,
    borderColor: '#3F51B5',
    marginTop: 8,
  },
  digilockerBtnIcon: {
    fontSize: 18,
  },
  digilockerBtnText: {
    fontSize: 14,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.3,
  },

  // --- Modal ---
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    width: width - 40,
    maxHeight: 560,
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 24,
    paddingTop: 28,
    position: 'relative',
  },
  modalClose: {
    position: 'absolute',
    top: 12,
    right: 14,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#f0f0f0',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  modalCloseText: {
    fontSize: 14,
    color: '#666',
    fontWeight: '700',
  },

  // --- Common ---
  stepContainer: {
    alignItems: 'center',
  },
  govBadge: {
    backgroundColor: '#FF9933',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 4,
    marginBottom: 14,
  },
  govBadgeText: {
    fontSize: 10,
    fontWeight: '900',
    color: '#fff',
    letterSpacing: 1,
  },
  digilockerIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#1A237E',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  digilockerIcon: {
    fontSize: 28,
  },
  digilockerTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A237E',
  },
  digilockerSub: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  divider: {
    width: '80%',
    height: 1,
    backgroundColor: '#eee',
    marginVertical: 16,
  },

  // --- Consent ---
  consentTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#333',
    marginBottom: 12,
  },
  permissionList: {
    width: '100%',
    gap: 10,
    marginBottom: 12,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8f9ff',
    padding: 12,
    borderRadius: 10,
  },
  permissionIcon: {
    fontSize: 14,
  },
  permissionText: {
    fontSize: 13,
    color: '#444',
    fontWeight: '600',
    flex: 1,
  },
  consentNote: {
    fontSize: 11,
    color: '#999',
    textAlign: 'center',
    marginBottom: 16,
    lineHeight: 16,
  },
  consentButtons: {
    width: '100%',
    gap: 10,
  },
  consentAllowBtn: {
    backgroundColor: '#1A237E',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  consentAllowText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  consentDenyBtn: {
    padding: 10,
    alignItems: 'center',
  },
  consentDenyText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
  },

  // --- Aadhaar Input ---
  aadhaarInputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#3F51B5',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    width: '100%',
    marginTop: 8,
    backgroundColor: '#f8f9ff',
  },
  aadhaarInputIcon: {
    fontSize: 20,
  },
  aadhaarInput: {
    flex: 1,
    fontSize: 18,
    color: '#1A237E',
    fontWeight: '700',
    letterSpacing: 3,
  },
  aadhaarHint: {
    fontSize: 11,
    color: '#999',
    marginTop: 8,
    textAlign: 'center',
  },
  aadhaarButtons: {
    width: '100%',
    gap: 10,
    marginTop: 16,
  },
  verifyBtn: {
    backgroundColor: '#1A237E',
    padding: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  verifyBtnDisabled: {
    backgroundColor: '#aaa',
  },
  verifyBtnText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  backBtn: {
    padding: 10,
    alignItems: 'center',
  },
  backBtnText: {
    color: '#888',
    fontSize: 13,
    fontWeight: '600',
  },

  // --- Verifying ---
  loadingCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#f0f0ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    borderWidth: 3,
    borderColor: '#3F51B5',
  },
  loadingIcon: {
    fontSize: 32,
  },
  verifyingTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#1A237E',
    marginBottom: 4,
  },
  verifyingSub: {
    fontSize: 13,
    color: '#666',
    marginBottom: 16,
  },
  verifyingSteps: {
    width: '100%',
    gap: 8,
  },
  verifyingStep: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#f8f9ff',
    padding: 12,
    borderRadius: 10,
  },
  verifyingStepIcon: {
    fontSize: 14,
    color: '#3F51B5',
  },
  verifyingStepText: {
    fontSize: 13,
    color: '#555',
    fontWeight: '600',
  },

  // --- Verified ---
  successCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#e8f5e9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  successIcon: {
    fontSize: 32,
  },
  verifiedTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#2e7d32',
  },
  verifiedSub: {
    fontSize: 12,
    color: '#666',
    marginTop: 2,
  },
  dataRows: {
    width: '100%',
    gap: 8,
    marginBottom: 12,
  },
  dataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fafafa',
    padding: 10,
    borderRadius: 8,
  },
  dataLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dataValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A237E',
    flex: 1,
    textAlign: 'right',
    marginLeft: 10,
  },
  successNote: {
    fontSize: 11,
    color: '#2e7d32',
    fontWeight: '700',
    backgroundColor: '#e8f5e9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    overflow: 'hidden',
  },
})
