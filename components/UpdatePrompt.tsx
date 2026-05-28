import { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
} from 'react-native'
import * as Updates from 'expo-updates'
import { Ionicons } from '@expo/vector-icons'

export default function UpdatePrompt() {
  const [updateState, setUpdateState] = useState<
    | 'checking'
    | 'available'
    | 'downloading'
    | 'ready'
    | 'none'
    | 'error'
  >('checking')
  const [errorMsg, setErrorMsg] = useState('')
  const scaleAnim = useRef(new Animated.Value(0.8)).current
  const fadeAnim = useRef(new Animated.Value(0)).current

  useEffect(() => {
    checkUpdate()
  }, [])

  useEffect(() => {
    if (
      updateState === 'available' ||
      updateState === 'downloading' ||
      updateState === 'ready' ||
      updateState === 'error'
    ) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          useNativeDriver: true,
          friction: 8,
          tension: 40,
        }),
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start()
    }
  }, [updateState])

  const checkUpdate = async () => {
    try {
      const update = await Updates.checkForUpdateAsync()
      if (update.isAvailable) {
        setUpdateState('available')
      } else {
        setUpdateState('none')
      }
    } catch (error: any) {
      // Silently fail in dev / no network — updates work on production builds
      console.log('Update check skipped:', error.message)
      setUpdateState('none')
    }
  }

  const downloadUpdate = async () => {
    setUpdateState('downloading')
    try {
      await Updates.fetchUpdateAsync()
      setUpdateState('ready')
    } catch (error: any) {
      setErrorMsg(error.message || 'Failed to download update')
      setUpdateState('error')
    }
  }

  const reloadApp = async () => {
    try {
      await Updates.reloadAsync()
    } catch (error: any) {
      setErrorMsg(error.message || 'Failed to reload')
      setUpdateState('error')
    }
  }

  const dismiss = () => {
    setUpdateState('none')
  }

  // No update — render nothing
  if (updateState === 'checking' || updateState === 'none') {
    return null
  }

  return (
    <Modal transparent visible animationType="none" statusBarTranslucent>
      <View style={styles.overlay}>
        <Animated.View
          style={[
            styles.card,
            {
              transform: [{ scale: scaleAnim }],
              opacity: fadeAnim,
            },
          ]}
        >
          {/* Icon */}
          <View style={styles.iconContainer}>
            {updateState === 'available' && (
              <Ionicons name="cloud-download-outline" size={48} color="#FF6B00" />
            )}
            {updateState === 'downloading' && (
              <ActivityIndicator size="large" color="#FF6B00" />
            )}
            {updateState === 'ready' && (
              <Ionicons name="checkmark-circle" size={48} color="#22C55E" />
            )}
            {updateState === 'error' && (
              <Ionicons name="alert-circle" size={48} color="#EF4444" />
            )}
          </View>

          {/* Title */}
          <Text style={styles.title}>
            {updateState === 'available' && 'Update Available'}
            {updateState === 'downloading' && 'Downloading Update...'}
            {updateState === 'ready' && 'Update Ready!'}
            {updateState === 'error' && 'Update Failed'}
          </Text>

          {/* Description */}
          <Text style={styles.description}>
            {updateState === 'available' &&
              'A new version of DoToR is available. Download it now for the latest features and improvements.'}
            {updateState === 'downloading' &&
              'Please wait while we download the update...'}
            {updateState === 'ready' &&
              'The update has been downloaded. Restart the app to apply it.'}
            {updateState === 'error' &&
              `Something went wrong: ${errorMsg}. Please try again later.`}
          </Text>

          {/* Buttons */}
          <View style={styles.buttonRow}>
            {updateState === 'available' && (
              <>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={dismiss}
                >
                  <Text style={styles.secondaryButtonText}>Later</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={downloadUpdate}
                >
                  <Ionicons
                    name="download-outline"
                    size={18}
                    color="#fff"
                    style={{ marginRight: 6 }}
                  />
                  <Text style={styles.primaryButtonText}>Update Now</Text>
                </TouchableOpacity>
              </>
            )}
            {updateState === 'downloading' && (
              <TouchableOpacity style={styles.secondaryButton} disabled>
                <Text style={[styles.secondaryButtonText, { opacity: 0.5 }]}>
                  Downloading...
                </Text>
              </TouchableOpacity>
            )}
            {updateState === 'ready' && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={reloadApp}
              >
                <Ionicons
                  name="refresh-outline"
                  size={18}
                  color="#fff"
                  style={{ marginRight: 6 }}
                />
                <Text style={styles.primaryButtonText}>Restart Now</Text>
              </TouchableOpacity>
            )}
            {updateState === 'error' && (
              <>
                <TouchableOpacity
                  style={styles.secondaryButton}
                  onPress={dismiss}
                >
                  <Text style={styles.secondaryButtonText}>Dismiss</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.primaryButton}
                  onPress={checkUpdate}
                >
                  <Text style={styles.primaryButtonText}>Retry</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </Animated.View>
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
  card: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    padding: 28,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 15,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: 'rgba(255,107,0,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 10,
    textAlign: 'center',
  },
  description: {
    fontSize: 14,
    color: '#8E8E93',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  primaryButton: {
    flex: 1,
    backgroundColor: '#FF6B00',
    borderRadius: 12,
    paddingVertical: 14,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  secondaryButton: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
})
