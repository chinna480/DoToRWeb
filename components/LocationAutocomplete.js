import { useRef, useState } from 'react'
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View
} from 'react-native'
import { LOCATIONIQ_API_KEY } from '../app/firebase/config'

const DEBOUNCE_MS = 400

export default function LocationAutocomplete({
  value,
  onChangeText,
  placeholder = 'Search your area...',
  icon = '📍',
  onFocus,
  onLayout
}) {
  const [suggestions, setSuggestions] = useState([])
  const [showSuggestions, setShowSuggestions] = useState(false)
  const [loading, setLoading] = useState(false)
  const timerRef = useRef(null)
  const inputRef = useRef(null)

  const fetchSuggestions = async (query) => {
    if (!query || query.trim().length < 2) {
      setSuggestions([])
      setShowSuggestions(false)
      return
    }

    setLoading(true)
    try {
      const url = `https://api.locationiq.com/v1/autocomplete?key=${LOCATIONIQ_API_KEY}&q=${encodeURIComponent(query.trim())}&countrycodes=in&limit=5&dedupe=1`
      const res = await fetch(url)
      const data = await res.json()

      if (data && Array.isArray(data)) {
        setSuggestions(data)
        setShowSuggestions(data.length > 0)
      } else {
        setSuggestions([])
        setShowSuggestions(false)
      }
    } catch (e) {
      console.warn('Places autocomplete error:', e)
      setSuggestions([])
      setShowSuggestions(false)
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (text) => {
    onChangeText(text)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => fetchSuggestions(text), DEBOUNCE_MS)
  }

  const handleSelect = (item) => {
    const address = item.display_name || item.address?.name || ''
    onChangeText(address)
    setShowSuggestions(false)
    setSuggestions([])
    inputRef.current?.blur()
  }

  const handleFocus = () => {
    if (suggestions.length > 0) setShowSuggestions(true)
    onFocus?.()
  }

  const handleBlur = () => {
    // Delay hiding so the suggestion tap can register
    setTimeout(() => setShowSuggestions(false), 200)
  }

  return (
    <View style={styles.wrapper} onLayout={onLayout}>
      <View style={styles.field}>
        <Text style={styles.fIcon}>{icon}</Text>
        <TextInput
          ref={inputRef}
          style={styles.input}
          placeholder={placeholder}
          placeholderTextColor="#aaa"
          value={value}
          onChangeText={handleChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          autoCorrect={false}
          autoCapitalize="none"
        />
        {loading && <ActivityIndicator size="small" color="#FF6B00" />}
      </View>

      {showSuggestions && suggestions.length > 0 && (
        <View style={styles.dropdown}>
          <FlatList
            data={suggestions}
            keyExtractor={(item) => item.place_id || item.osm_id || item.lat + item.lon}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.suggestionItem}
                onPress={() => handleSelect(item)}
                activeOpacity={0.6}
              >
                <Text style={styles.suggestionIcon}>📍</Text>
                <View style={styles.suggestionTextWrap}>
                  <Text style={styles.suggestionMain} numberOfLines={1}>
                    {item.display_name ? item.display_name.split(',')[0] : item.address?.name || ''}
                  </Text>
                  <Text style={styles.suggestionSub} numberOfLines={1}>
                    {item.display_name ? item.display_name.split(',').slice(1, 4).join(',').trim() : item.display_place || ''}
                  </Text>
                </View>
              </TouchableOpacity>
            )}
          />
        </View>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: 16,
    zIndex: 999,
    position: 'relative',
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#eee',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 10,
    backgroundColor: '#fff',
  },
  fIcon: {
    fontSize: 18,
  },
  input: {
    flex: 1,
    fontSize: 14,
    color: '#1A3A6B',
    fontWeight: '600',
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: 4,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#eee',
    borderRadius: 12,
    maxHeight: 220,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 8,
    overflow: 'hidden',
    zIndex: 1000,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f5f5f5',
    gap: 10,
  },
  suggestionIcon: {
    fontSize: 16,
  },
  suggestionTextWrap: {
    flex: 1,
  },
  suggestionMain: {
    fontSize: 14,
    fontWeight: '700',
    color: '#1A3A6B',
  },
  suggestionSub: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
})