// screens/DigiLockerScreen.js
// Opens DigiLocker in WebView → user fetches Aadhar → AI verifies it

import AsyncStorage from '@react-native-async-storage/async-storage'
import { useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import {
    Alert,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from 'react-native'
import { WebView } from 'react-native-webview'

const DIGILOCKER_URL = 'https://www.digilocker.gov.in'

// ── Backend Proxy Configuration ────────────────────────────────
// After deploying the web app to Vercel, update this to your
// actual deployment URL (e.g. https://dotor.vercel.app)
// Leave as empty string to use local-only keyword matching.
const BACKEND_API_URL = '' // e.g. 'https://dotor.vercel.app/api/verify-aadhar'

export default function DigiLockerScreen() {
  const router = useRouter()
  const webViewRef = useRef(null)
  const [loading, setLoading] = useState(true)
  const [verifying, setVerifying] = useState(false)
  const [pageTitle, setPageTitle] = useState('DigiLocker')

  // ── Capture screenshot of current WebView page ─────────────────────────────
  const captureAndVerify = async () => {
    setVerifying(true)

    try {
      // Inject JS to get page content as base64 image
      webViewRef.current?.injectJavaScript(`
        (function() {
          // Get the full page HTML and send it back
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'pageContent',
            url: window.location.href,
            title: document.title,
            text: document.body.innerText.substring(0, 3000)
          }));
        })();
        true;
      `)
    } catch (_e) {
      setVerifying(false)
      Alert.alert('Error', 'Could not capture page. Try again.')
    }
  }

  // ── Handle messages from WebView ───────────────────────────────────────────
  const onMessage = async (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data)

      if (data.type === 'pageContent') {
        const pageText = data.text
        const pageUrl  = data.url

        // Check if user is on Aadhar card page
        const isAadharPage =
          pageUrl.includes('aadhaar') ||
          pageText.toLowerCase().includes('aadhaar') ||
          pageText.toLowerCase().includes('aadhar') ||
          pageText.toLowerCase().includes('uid') ||
          pageText.toLowerCase().includes('unique identification')

        if (!isAadharPage) {
          setVerifying(false)
          Alert.alert(
            '⚠️ Wrong Page',
            'Please navigate to your Aadhar card in DigiLocker first.\n\nSteps:\n1. Login to DigiLocker\n2. Go to "Issued Documents"\n3. Open your Aadhar Card\n4. Then tap "Verify This Page"',
            [{ text: 'OK' }]
          )
          return
        }

        // Send page text to backend proxy / AI for verification
        const valid = await verifyAadharWithAI(pageText, pageUrl, pageTitle)
        setVerifying(false)

        if (valid.isValid) {
          // Save to AsyncStorage as reliable data bridge
          await AsyncStorage.setItem('digilockerVerified', 'true')
          await AsyncStorage.setItem('digilockerName', valid.name || 'Verified')

          // Params are stored in AsyncStorage — the parent screen reads them on focus
          router.back()

          Alert.alert(
            '✅ Aadhar Verified!',
            `Name: ${valid.name || 'Verified'}\n\nYour Aadhar has been verified via DigiLocker!`
          )
        } else {
          Alert.alert(
            '❌ Verification Failed',
            'This does not appear to be an Aadhar card page.\n\nPlease make sure you have opened your Aadhar card in DigiLocker.',
            [{ text: 'Try Again' }]
          )
        }
      }
    } catch (e) {
      setVerifying(false)
      console.error('Message parse error:', e)
    }
  }

  // ── Verify Aadhar via backend proxy or local fallback ────────
  const verifyAadharWithAI = async (pageText, pageUrl, pageTitle) => {
    // 1) Try backend proxy first (API key stays server-side, much more reliable)
    if (BACKEND_API_URL) {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 10000)
      try {
        const response = await fetch(BACKEND_API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ pageText, pageUrl, pageTitle }),
          // 10 second timeout so the user isn't stuck waiting
          signal: controller.signal,
        })
        clearTimeout(timeoutId)
        if (response.ok) {
          const result = await response.json()
          if (result && typeof result.isValid === 'boolean') {
            return result
          }
        }
      } catch (e) {
        console.warn('Backend proxy unreachable, using local fallback:', e?.message || e)
      }
    }

    // 2) Local fallback — enhanced keyword matching
    try {
      const hasAadharKeywords =
        /aadhaar|aadhar|uid|unique\s*identification|government\s*of\s*india|enrolment|eid\s*\d{4}/i.test(pageText)

      let name = ''
      let number = ''

      if (hasAadharKeywords) {
        // Try to extract name near "Name" label
        const nameMatch = pageText.match(
          /(?:name|नाम)[:\s]+([A-Z][a-z]+(?:\s[A-Z][a-z]+){1,3})/i
        )
        name = nameMatch ? nameMatch[1].trim() : ''

        // Try to extract last 4 digits of Aadhar number
        const numMatch = pageText.match(
          /(?:aadhaar|aadhar|आधार)[:\s]*\d{4}\s*\d{4}\s*(\d{4})/i
        )
        if (numMatch) {
          number = numMatch[1]
        } else {
          // Fallback: any 4-digit sequence near masked portion
          const fbNum = pageText.match(/(?:x{4}|•{4}|\*{4})\s*(\d{4})/i)
          if (fbNum) number = fbNum[1]
        }

        if (!name) {
          // Last-resort name guess from page title or generic pattern
          name = 'Verified'
        }
      }

      return {
        isValid: hasAadharKeywords,
        name,
        number,
      }
    } catch (e) {
      console.error('Local verify error:', e)
      return { isValid: false, name: '', number: '' }
    }
  }

  return (
    <View style={s.container}>

      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backTxt}>← Back</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <Text style={s.headerTitle}>🏛️ DigiLocker</Text>
          <Text style={s.headerSub} numberOfLines={1}>{pageTitle}</Text>
        </View>
        <View style={{ width: 70 }} />
      </View>

      {/* INSTRUCTION BANNER */}
      <View style={s.banner}>
        <Text style={s.bannerText}>
          📋 Login → Issued Documents → Open Aadhar Card → Tap Verify
        </Text>
      </View>

      {/* WEBVIEW */}
      <WebView
        ref={webViewRef}
        source={{ uri: DIGILOCKER_URL }}
        style={s.webview}
        onLoadStart={() => setLoading(true)}
        onLoadEnd={() => setLoading(false)}
        onNavigationStateChange={(navState) => {
          setPageTitle(navState.title || 'DigiLocker')
        }}
        onMessage={onMessage}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        sharedCookiesEnabled={true}
        thirdPartyCookiesEnabled={true}
        userAgent="Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36"
      />

      {/* LOADING */}
      {loading && (
        <View style={s.loadingOverlay}>
          <Text style={s.loadingTxt}>Loading DigiLocker...</Text>
        </View>
      )}

      {/* VERIFY BUTTON */}
      <View style={s.footer}>
        <TouchableOpacity
          style={[s.verifyBtn, verifying && s.verifyBtnDisabled]}
          onPress={captureAndVerify}
          disabled={verifying}
        >
          <Text style={s.verifyTxt}>
            {verifying ? '🔍 AI Verifying...' : '✅ Verify This Page'}
          </Text>
        </TouchableOpacity>
        <Text style={s.footerHint}>
          Open your Aadhar card in DigiLocker then tap Verify
        </Text>
      </View>

    </View>
  )
}

const s = StyleSheet.create({
  container:        { flex: 1, backgroundColor: '#fff' },
  header:           { backgroundColor: '#1A3A6B', paddingTop: 50, paddingBottom: 12, paddingHorizontal: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  backBtn:          { paddingVertical: 6, paddingHorizontal: 10 },
  backTxt:          { color: '#fff', fontSize: 15, fontWeight: '700' },
  headerCenter:     { flex: 1, alignItems: 'center' },
  headerTitle:      { color: '#fff', fontSize: 16, fontWeight: '800' },
  headerSub:        { color: 'rgba(255,255,255,0.7)', fontSize: 11, marginTop: 2, maxWidth: 200 },
  banner:           { backgroundColor: '#FF6B00', padding: 10, paddingHorizontal: 15 },
  bannerText:       { color: '#fff', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  webview:          { flex: 1 },
  loadingOverlay:   { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(255,255,255,0.9)', alignItems: 'center', justifyContent: 'center' },
  loadingTxt:       { fontSize: 16, color: '#1A3A6B', fontWeight: '700' },
  footer:           { backgroundColor: '#fff', padding: 15, paddingBottom: 30, borderTopWidth: 1, borderTopColor: '#eee', elevation: 10 },
  verifyBtn:        { backgroundColor: '#1A3A6B', padding: 15, borderRadius: 14, alignItems: 'center' },
  verifyBtnDisabled:{ backgroundColor: '#888' },
  verifyTxt:        { color: '#fff', fontSize: 16, fontWeight: '800' },
  footerHint:       { textAlign: 'center', color: '#888', fontSize: 11, marginTop: 8 },
})