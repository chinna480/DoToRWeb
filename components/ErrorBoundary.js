import { Component } from 'react'
import { Text, View, TouchableOpacity, StyleSheet } from 'react-native'

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.warn('ErrorBoundary caught:', error?.message, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      // Render a fallback UI
      const fallback = this.props.fallback
      if (fallback) return fallback

      return (
        <View style={[styles.wrapper, this.props.style]}>
          <Text style={styles.icon}>⚠️</Text>
          <Text style={styles.text}>
            {this.props.errorMessage || 'Something went wrong displaying this section.'}
          </Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={() => this.setState({ hasError: false, error: null })}
          >
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )
    }

    return this.props.children
  }
}

const styles = StyleSheet.create({
  wrapper: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    marginHorizontal: 15,
    marginBottom: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ffcdd2',
    elevation: 2,
  },
  icon: {
    fontSize: 28,
    marginBottom: 8,
  },
  text: {
    fontSize: 13,
    color: '#c62828',
    fontWeight: '600',
    textAlign: 'center',
    marginBottom: 10,
  },
  retryBtn: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 20,
    paddingVertical: 8,
    borderRadius: 10,
  },
  retryText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '800',
  },
})
