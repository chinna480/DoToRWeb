import AsyncStorage from '@react-native-async-storage/async-storage'
import { useLocalSearchParams, useRouter } from 'expo-router'
import { onValue, push, ref, set } from 'firebase/database'
import { useEffect, useRef, useState } from 'react'
import {
  Alert,
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

export default function ChatScreen() {
  const router = useRouter()
  const { orderId, customerName, techName, role } = useLocalSearchParams()

  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [myName, setMyName] = useState('')
  const [otherPersonName, setOtherPersonName] = useState(role === 'cust' ? (techName || 'Technician') : (customerName || 'Customer'))
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState('chat')

  const scrollRef = useRef(null)
  const mounted = useRef(true)

  // Safety: if no orderId, go back
  useEffect(() => {
    if (!orderId) {
      Alert.alert('Error', 'No order found. Please go back.')
      router.back()
    }
  }, [orderId])

  useEffect(() => {
    if (!orderId) return
    mounted.current = true
    loadUser()
    // Listen for order updates to get the correct tech name dynamically
    let orderUnsub
    if (role === 'cust') {
      orderUnsub = onValue(ref(db, 'orders/' + orderId), snap => {
        if (!mounted.current || !snap.exists()) return
        const order = snap.val()
        if (order.techName) {
          setOtherPersonName(order.techName)
        }
      })
    } else if (role === 'tech') {
      // Technician side: listen for customer name updates too
      orderUnsub = onValue(ref(db, 'orders/' + orderId), snap => {
        if (!mounted.current || !snap.exists()) return
        const order = snap.val()
        if (order.customerName) {
          setOtherPersonName(order.customerName)
        }
      })
    }
    return () => {
      mounted.current = false
      if (orderUnsub) orderUnsub()
    }
  }, [orderId])

  useEffect(() => {
    if (!orderId) return
    const unsub = onValue(ref(db, `chats/${orderId}/messages`), snap => {
      setLoading(false)
      if (!snap.exists()) {
        setMessages([])
        return
      }
      const msgs = []
      snap.forEach(child => {
        msgs.push({ id: child.key, ...child.val() })
      })
      setMessages(msgs)
      // Auto-scroll to bottom
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100)
    })
    return () => unsub()
  }, [orderId])

  const loadUser = async () => {
    // Read the correct name based on role
    // Customer: 'custName' key, Technician: 'techName' key
    let n = null
    if (role === 'cust') {
      n = await AsyncStorage.getItem('custName')
    } else if (role === 'tech') {
      n = await AsyncStorage.getItem('techName')
    }
    setMyName(n || (role === 'cust' ? 'Customer' : 'Technician'))
  }
  const sendMessage = async () => {
    const text = inputText.trim()
    if (!text || !orderId) return

    const msgRef = ref(db, `chats/${orderId}/messages`)
    const metaRef = ref(db, `chats/${orderId}/metadata`)

    try {
      await push(msgRef, {
        text,
        senderRole: role,
        senderName: myName,
        timestamp: Date.now(),
        read: false,
      })

      await set(metaRef, {
        lastMessage: text,
        lastSender: role,
        lastTime: Date.now(),
        customerName: customerName || '',
        techName: techName || '',
      })

      setInputText('')
    } catch (e) {
      Alert.alert('Error', 'Failed to send message. Please try again.')
    }
  }

  const formatTime = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    const hours = d.getHours().toString().padStart(2, '0')
    const mins = d.getMinutes().toString().padStart(2, '0')
    return `${hours}:${mins}`
  }

  const formatDate = (ts) => {
    if (!ts) return ''
    const d = new Date(ts)
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)

    if (d.toDateString() === today.toDateString()) return 'Today'
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
    return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  }

  // Group messages by date
  const groupedMessages = []
  let lastDate = ''
  messages.forEach(msg => {
    const dateLabel = formatDate(msg.timestamp)
    if (dateLabel !== lastDate) {
      groupedMessages.push({ type: 'date', label: dateLabel })
      lastDate = dateLabel
    }
    groupedMessages.push({ type: 'msg', ...msg })
  })

  const otherName = otherPersonName

  // Tab navigation
  const isCust = role === 'cust'
  const TABS = isCust
    ? [
        { key: 'chat',      label: 'Chat',   icon: '💬' },
        { key: 'home',      label: 'Home',   icon: '🏠' },
        { key: 'orders',    label: 'Orders', icon: '📋' },
        { key: 'profile',   label: 'Profile',icon: '👤' },
      ]
    : [
        { key: 'chat',      label: 'Chat',   icon: '💬' },
        { key: 'home',      label: 'Home',   icon: '🏠' },
        { key: 'pending',   label: 'Pending',icon: '⏳' },
        { key: 'completed', label: 'Done',   icon: '✅' },
        { key: 'profile',   label: 'Profile',icon: '👤' },
      ]

  const switchTab = (key) => {
    if (key === 'chat') { setActiveTab('chat'); return }
    if (key === 'home') {
      router.replace(isCust ? '/' : '/screens/TechHomeScreen')
    } else if (key === 'orders') {
      router.replace('/')
    } else if (key === 'pending' || key === 'completed') {
      // Navigate to TechHomeScreen with a pending redirect note
      router.replace('/screens/TechHomeScreen')
    } else if (key === 'profile') {
      router.replace(isCust ? '/screens/CustomerProfileScreen' : '/screens/TechProfileScreen')
    }
  }

  // ── Render a single message ──────────────────────────────────────────
  const renderMessage = (item) => {
    const isMyMsg = item.senderRole === role
    return (
      <View
        key={item.id}
        style={[
          s.msgBubble,
          isMyMsg ? s.myMsg : s.otherMsg,
        ]}
      >
        {!isMyMsg && (
          <Text style={s.senderName}>{item.senderName}</Text>
        )}
        {item.text ? (
          <Text style={[s.msgText, isMyMsg && s.myMsgText]}>
            {item.text}
          </Text>
        ) : null}
        <Text style={[s.msgTime, isMyMsg && s.myMsgTime]}>
          {formatTime(item.timestamp)}
          {isMyMsg && ` ${item.read ? '✓✓' : '✓'}`}
        </Text>
      </View>
    )
  }

  return (
    <KeyboardAvoidingView
      style={s.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 0 : 0}
    >
      {/* HEADER */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Text style={s.backArrow}>←</Text>
        </TouchableOpacity>
        <View style={s.headerCenter}>
          <View style={s.avatarSmall}>
            <Text style={s.avatarTxt}>{role === 'cust' ? '🔧' : '👤'}</Text>
          </View>
          <View>
            <Text style={s.headerName}>{otherName}</Text>
            <Text style={s.headerStatus}>🟢 Online</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* MESSAGES */}
      <ScrollView
        ref={scrollRef}
        style={s.msgList}
        contentContainerStyle={s.msgListContent}
        showsVerticalScrollIndicator={false}
      >
        {loading ? (
          <View style={s.loadingContainer}>
            <Text style={s.loadingDots}>⏳ Loading messages...</Text>
          </View>
        ) : groupedMessages.length === 0 ? (
          <View style={s.emptyContainer}>
            <Text style={s.emptyIcon}>💬</Text>
            <Text style={s.emptyTxt}>No messages yet</Text>
            <Text style={s.emptySub}>Send a message to start chatting!</Text>
          </View>
        ) : (
          groupedMessages.map((item, i) =>
            item.type === 'date' ? (
              <View key={`date-${i}`} style={s.dateBadge}>
                <Text style={s.dateTxt}>{item.label}</Text>
              </View>
            ) : renderMessage(item)
          )
        )}
      </ScrollView>

      {/* INPUT */}
      <View style={s.inputBar}>
        <View style={s.inputRow}>
          <TextInput
            style={s.input}
            placeholder="Type a message..."
            placeholderTextColor="#999"
            value={inputText}
            onChangeText={setInputText}
            multiline
            maxLength={500}
          />
          <TouchableOpacity
            style={[s.sendBtn, !inputText.trim() && s.sendBtnDisabled]}
            onPress={sendMessage}
            disabled={!inputText.trim()}
          >
            <Text style={s.sendTxt}>➤</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* BOTTOM TAB BAR */}
      <View style={s.tabBar}>
        {TABS.map(tab => (
          <TouchableOpacity
            key={tab.key}
            style={[
              s.tabItem,
              activeTab === tab.key && s.tabItemActive,
            ]}
            onPress={() => switchTab(tab.key)}
          >
            <Text style={[s.tabIcon, activeTab === tab.key && s.tabIconActive]}>
              {tab.icon}
            </Text>
            <Text style={[s.tabLabel, activeTab === tab.key && s.tabLabelActive]}>
              {tab.label}
            </Text>
            {activeTab === tab.key && <View style={s.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </View>
    </KeyboardAvoidingView>
  )
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f0f0f0' },

  // Header
  header: {
    backgroundColor: '#1A3A6B',
    paddingTop: Platform.OS === 'ios' ? 55 : 45,
    paddingBottom: 14,
    paddingHorizontal: 15,
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: { width: 40 },
  backArrow: { fontSize: 24, color: '#fff', fontWeight: '700' },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    justifyContent: 'center',
  },
  avatarSmall: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { fontSize: 18 },
  headerName: { fontSize: 16, fontWeight: '800', color: '#fff' },
  headerStatus: { fontSize: 11, color: '#8bc34a', fontWeight: '700' },

  // Messages
  msgList: { flex: 1 },
  msgListContent: { padding: 15, paddingBottom: 10 },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 60 },
  loadingDots: { fontSize: 14, color: '#888', fontWeight: '600' },
  emptyContainer: { alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyIcon: { fontSize: 50 },
  emptyTxt: { fontSize: 16, fontWeight: '800', color: '#1A3A6B', marginTop: 12 },
  emptySub: { fontSize: 13, color: '#888', marginTop: 5 },

  // Date badges
  dateBadge: {
    alignSelf: 'center',
    backgroundColor: '#ddd',
    paddingHorizontal: 14,
    paddingVertical: 5,
    borderRadius: 12,
    marginVertical: 10,
  },
  dateTxt: { fontSize: 11, fontWeight: '700', color: '#555' },

  // Message bubbles
  msgBubble: {
    maxWidth: '78%',
    padding: 12,
    borderRadius: 16,
    marginBottom: 8,
  },
  myMsg: {
    alignSelf: 'flex-end',
    backgroundColor: '#FF6B00',
    borderBottomRightRadius: 4,
  },
  otherMsg: {
    alignSelf: 'flex-start',
    backgroundColor: '#fff',
    borderBottomLeftRadius: 4,
    elevation: 1,
  },
  senderName: { fontSize: 11, fontWeight: '800', color: '#FF6B00', marginBottom: 3 },
  msgText: { fontSize: 14, color: '#1A3A6B', fontWeight: '500', lineHeight: 20 },
  myMsgText: { color: '#fff' },
  msgTime: { fontSize: 10, color: '#999', marginTop: 4, alignSelf: 'flex-end' },
  myMsgTime: { color: 'rgba(255,255,255,0.7)' },

  // Input
  inputBar: {
    backgroundColor: '#fff',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: '#e0e0e0',
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
  },
  input: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    borderRadius: 22,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    color: '#1A3A6B',
    maxHeight: 100,
    fontWeight: '600',
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF6B00',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendBtnDisabled: { backgroundColor: '#ddd' },
  sendTxt: { fontSize: 18, color: '#fff' },

  // Bottom Tab Bar
  tabBar: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#e8e8e8',
    paddingBottom: 25,
    paddingTop: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    position: 'relative',
  },
  tabItemActive: {},
  tabIcon: { fontSize: 20, opacity: 0.5 },
  tabIconActive: { opacity: 1 },
  tabLabel: {
    fontSize: 10,
    fontWeight: '600',
    color: '#999',
    marginTop: 2,
  },
  tabLabelActive: { color: '#FF6B00', fontWeight: '800' },
  tabIndicator: {
    position: 'absolute',
    top: 0,
    width: 24,
    height: 3,
    borderRadius: 2,
    backgroundColor: '#FF6B00',
  },
})
