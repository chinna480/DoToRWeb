// updateChecker.js — In-app auto-update system
// On app launch, checks the latest version from the website's version.json
// and prompts the user to download the new APK if an update is available.
//
// Usage:
//   import { useUpdateChecker } from '../utils/updateChecker'
//   const { showUpdateModal, setShowUpdateModal, checking } = useUpdateChecker()
//   ...
//   {!checking && <UpdateModal visible={showUpdateModal} onClose={() => setShowUpdateModal(false)} />}

import AsyncStorage from '@react-native-async-storage/async-storage'
import Constants from 'expo-constants'
import { useEffect, useRef, useState } from 'react'
import {
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native'

// ── Config ──────────────────────────────────────────────────────────────
const VERSION_CHECK_URL = 'https://dotor-delta.vercel.app/version.json'
const GITHUB_RELEASES_URL = 'https://github.com/chinna480/DoToRApp/actions'
const LAST_CHECK_KEY = '@DoToR_lastUpdateCheck'
const SKIPPED_VERSION_KEY = '@DoToR_skippedVersion'
// ─────────────────────────────────────────────────────────────────────────

/**
 * Parse a semver string into comparable numbers.
 * Returns 0 for invalid strings.
 */
function parseVersion(ver) {
  if (!ver || typeof ver !== 'string') return 0
  const parts = ver.trim().split('.').map(Number)
  return parts.reduce((acc, p, i) => acc + (isNaN(p) ? 0 : p * Math.pow(1000, 2 - i)), 0)
}

/**
 * Hook: checks for updates on mount and returns state for the update modal.
 */
export function useUpdateChecker() {
  const [latestVersion, setLatestVersion] = useState(null)
  const [releaseNotes, setReleaseNotes] = useState([])
  const [updateUrl, setUpdateUrl] = useState(GITHUB_RELEASES_URL)
  const [forceUpdate, setForceUpdate] = useState(false)
  const [showUpdateModal, setShowUpdateModal] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState(null)
  const checkedRef = useRef(false)

  useEffect(() => {
    if (checkedRef.current) return
    checkedRef.current = true
    checkForUpdate()
  }, [])

  async function checkForUpdate() {
    try {
      setChecking(true)
      setError(null)

      // Get current app version
      const currentVersion = getAppVersion()

      // Fetch latest version from website
      const res = await fetch(VERSION_CHECK_URL, {
        method: 'GET',
        headers: { 'Cache-Control': 'no-cache' },
      })

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`)
      }

      const data = await res.json()

      if (!data.version) {
        console.log('[UpdateChecker] Invalid version.json response')
        setChecking(false)
        return
      }

      setLatestVersion(data.version)
      setReleaseNotes(data.releaseNotes || [])
      setForceUpdate(data.forceUpdate || false)

      if (data.updateUrl) {
        setUpdateUrl(data.updateUrl)
      }

      // Compare versions
      const current = parseVersion(currentVersion)
      const latest = parseVersion(data.version)

      console.log(`[UpdateChecker] Current: ${currentVersion} (${current}), Latest: ${data.version} (${latest})`)

      if (latest > current) {
        // Check if user skipped this version
        const skippedVersion = await AsyncStorage.getItem(SKIPPED_VERSION_KEY)
        if (skippedVersion !== data.version) {
          setShowUpdateModal(true)
        }
      }

      // Save last check time
      AsyncStorage.setItem(LAST_CHECK_KEY, String(Date.now()))
    } catch (e) {
      console.warn('[UpdateChecker] Check failed:', e.message)
      setError(e.message)
    } finally {
      setChecking(false)
    }
  }

  return {
    latestVersion,
    releaseNotes,
    updateUrl,
    forceUpdate,
    showUpdateModal,
    setShowUpdateModal,
    checking,
    error,
    recheck: checkForUpdate,
  }
}

/**
 * Get the current app version from the device.
 * Works with both expo-constants and react-native-device-info.
 */
function getAppVersion() {
  try {
    // Get version from expo-constants
    if (Constants?.expoConfig?.version) {
      return Constants.expoConfig.version
    }
    if (Constants?.manifest?.version) {
      return Constants.manifest.version
    }
  } catch (_) {}
  return '1.0.0' // fallback
}

// ── Update Modal Component ────────────────────────────────────────────────

/**
 * A beautiful modal that tells users about the new update.
 *
 * @param {object} props
 * @param {boolean}  props.visible      - Show/hide the modal
 * @param {Function} props.onClose      - Called when user dismisses (non-force updates)
 * @param {string}   props.latestVersion - The new version string
 * @param {string[]} props.releaseNotes  - Array of bullet-point release notes
 * @param {string}   props.updateUrl     - URL to download the APK
 * @param {boolean}  props.forceUpdate   - If true, user CANNOT dismiss
 */
export function UpdateModal({
  visible,
  onClose,
  latestVersion = '1.0.0',
  releaseNotes = [],
  updateUrl = GITHUB_RELEASES_URL,
  forceUpdate = false,
}) {
  const handleUpdate = () => {
    Linking.openURL(updateUrl)
  }

  const handleSkip = async () => {
    try {
      await AsyncStorage.setItem(SKIPPED_VERSION_KEY, latestVersion)
    } catch (_) {}
    if (onClose) onClose()
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={forceUpdate ? undefined : onClose}>
      <View style={styles.overlay}>
        <View style={styles.modal}>
          {/* Icon */}
          <View style={styles.iconWrap}>
            <Text style={styles.icon}>📲</Text>
          </View>

          {/* Title */}
          <Text style={styles.title}>Update Available</Text>
          <Text style={styles.subtitle}>
            Version {latestVersion} is ready
          </Text>

          {/* Release Notes */}
          {releaseNotes.length > 0 && (
            <View style={styles.notesContainer}>
              <Text style={styles.notesTitle}>What's new:</Text>
              {releaseNotes.map((note, i) => (
                <View key={i} style={styles.noteRow}>
                  <Text style={styles.bullet}>•</Text>
                  <Text style={styles.noteText}>{note}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Buttons */}
          <TouchableOpacity style={styles.updateBtn} onPress={handleUpdate}>
            <Text style={styles.updateBtnTxt}>⬇️ Update Now</Text>
          </TouchableOpacity>

          {!forceUpdate && (
            <TouchableOpacity style={styles.skipBtn} onPress={handleSkip}>
              <Text style={styles.skipBtnTxt}>Maybe Later</Text>
            </TouchableOpacity>
          )}

          {forceUpdate && (
            <Text style={styles.forceNote}>
              This update is required to continue using the app
            </Text>
          )}
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  modal: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 360,
    alignItems: 'center',
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 16,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#FFF5EE',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 36,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: '#1A3A6B',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: '#FF6B00',
    fontWeight: '700',
    marginBottom: 18,
  },
  notesContainer: {
    width: '100%',
    backgroundColor: '#f9f9f9',
    borderRadius: 12,
    padding: 14,
    marginBottom: 20,
  },
  notesTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#888',
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  noteRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 6,
  },
  bullet: {
    fontSize: 13,
    color: '#FF6B00',
    fontWeight: '800',
    width: 12,
  },
  noteText: {
    fontSize: 13,
    color: '#333',
    fontWeight: '500',
    flex: 1,
    lineHeight: 18,
  },
  updateBtn: {
    backgroundColor: '#FF6B00',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 14,
    width: '100%',
    alignItems: 'center',
    elevation: 3,
    marginBottom: 10,
  },
  updateBtnTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  skipBtn: {
    paddingVertical: 10,
  },
  skipBtnTxt: {
    color: '#888',
    fontSize: 13,
    fontWeight: '700',
  },
  forceNote: {
    fontSize: 11,
    color: '#c62828',
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
})
