// MiniMap.js — WebView-based Leaflet mini map for live tracking (like Swiggy/Rapido)
// Supports two modes:
//   Static (default) — like Rapido/Swiggy tracking card, tap to open Maps
//   Interactive — full zoom/pan controls for tech navigation
// Both modes have an expand button [⛶] and double-tap to open full-screen.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react'
import {
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  SafeAreaView,
  StatusBar,
} from 'react-native'
import { WebView } from 'react-native-webview'

// ── HTML Template ────────────────────────────────────────────────────────
// Injected at two zoom levels — with zoom controls (interactive) or without (static)
// Initial position/label data is embedded directly so the map starts correctly
// without relying on postMessage (which can be unreliable in RN WebView).
function buildHTML(interactive, initData) {
  const initMyLat      = initData?.myLat ?? null
  const initMyLng      = initData?.myLng ?? null
  const initTargetLat  = initData?.targetLat ?? null
  const initTargetLng  = initData?.targetLng ?? null
  const initMyLabel    = initData?.myLabel || 'You'
  const initTargetLabel = initData?.targetLabel || 'Destination'
  const zoomControlsCSS = interactive
    ? '/* show zoom controls */ .leaflet-control-zoom { display: flex !important; border-radius: 8px !important; overflow: hidden !important; border: 2px solid rgba(0,0,0,0.08) !important; box-shadow: 0 2px 8px rgba(0,0,0,0.12) !important; } .leaflet-control-zoom a { width: 36px !important; height: 36px !important; line-height: 36px !important; font-size: 18px !important; font-weight: 700 !important; color: #1A3A6B !important; background: #fff !important; } .leaflet-control-zoom a:hover { background: #f5f5f5 !important; } .leaflet-control-zoom a.leaflet-control-zoom-in { border-bottom: 1px solid #eee !important; }'
    : '.leaflet-control-zoom{display:none !important}'

  const touchAction = interactive ? 'auto' : 'none'

  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=5,user-scalable=${interactive ? 'yes' : 'no'}">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body,#map{width:100%;height:100%;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}
body{-webkit-user-select:${interactive ? 'auto' : 'none'};user-select:${interactive ? 'auto' : 'none'};touch-action:${touchAction}}

/* ── Custom Marker Icons ── */
.marker-wrapper{display:flex;align-items:center;justify-content:center}
.marker-pin{width:24px;height:32px;display:flex;align-items:center;justify-content:center;position:relative}
.marker-pin svg{position:absolute;top:0;left:0}
.marker-label{position:absolute;top:-20px;white-space:nowrap;font-size:10px;font-weight:800;color:#fff;padding:3px 8px;border-radius:10px;letter-spacing:0.3px;box-shadow:0 2px 6px rgba(0,0,0,0.3)}

/* ── Popup ── */
.popup-content{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.popup-content .name{font-size:12px;font-weight:800;color:#1A3A6B}
.popup-content .coords{font-size:10px;color:#888;font-weight:600;margin-top:2px}

/* ── Leaflet tweaks ── */
${zoomControlsCSS}
.leaflet-control-attribution{display:none !important}
.leaflet-popup-content-wrapper{border-radius:12px;padding:4px;box-shadow:0 4px 16px rgba(0,0,0,0.15)}
.leaflet-popup-content{margin:8px 12px}
.leaflet-popup-tip{display:none !important}

/* ── Animate marker updates ── */
@keyframes bouncePop{0%{transform:scale(0.6)}50%{transform:scale(1.25)}100%{transform:scale(1)}}
.bounce{animation:bouncePop 0.35s cubic-bezier(0.68,-0.55,0.265,1.55)}
@keyframes pulse{0%{opacity:0.6;transform:scale(1)}50%{opacity:1;transform:scale(1.15)}100%{opacity:0.6;transform:scale(1)}}
.pulse{animation:pulse 2s ease-in-out infinite}
</style>
</head>
<body>
<div id="map"></div>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map, routePolyline, fallbackLine, myMarker, targetMarker;
var myLat = ${initMyLat}, myLng = ${initMyLng}, targetLat = ${initTargetLat}, targetLng = ${initTargetLng};
var myLabel = '${initMyLabel}', targetLabel = '${initTargetLabel}';
var isReady = false;
var isInteractive = ${interactive ? 'true' : 'false'};
var lastRouteFetch = 0;

// ── Icon factories ──
function createMyIcon(label) {
  return L.divIcon({
    className: '',
    html: '<div class="marker-wrapper bounce">' +
      '<div class="marker-label" style="background:#FF6B00">' + label + '</div>' +
      '<div class="marker-pin">' +
        '<svg width="24" height="32" viewBox="0 0 24 32" fill="none">' +
          '<path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20C24 5.37 18.63 0 12 0z" fill="#FF6B00" stroke="#fff" stroke-width="2.5"/>' +
          '<circle cx="12" cy="11" r="5" fill="#fff"/>' +
        '</svg>' +
      '</div></div>',
    iconSize: [24, 32],
    iconAnchor: [12, 32],
    popupAnchor: [0, -38],
  })
}

function createTargetIcon(label) {
  return L.divIcon({
    className: '',
    html: '<div class="marker-wrapper pulse">' +
      '<div class="marker-label" style="background:#1A3A6B">' + label + '</div>' +
      '<div class="marker-pin">' +
        '<svg width="24" height="32" viewBox="0 0 24 32" fill="none">' +
          '<path d="M12 0C5.37 0 0 5.37 0 12c0 9 12 20 12 20s12-11 12-20C24 5.37 18.63 0 12 0z" fill="#1A3A6B" stroke="#fff" stroke-width="2.5"/>' +
          '<circle cx="12" cy="11" r="5" fill="#fff"/>' +
        '</svg>' +
      '</div></div>',
    iconSize: [24, 32],
    iconAnchor: [12, 32],
    popupAnchor: [0, -38],
  })
}

function initMap() {
  map = L.map('map', {
    zoomControl: ${interactive ? 'true' : 'false'},
    attributionControl: false,
    dragging: ${interactive ? 'true' : 'false'},
    tap: ${interactive ? 'true' : 'false'},
  }).setView([20, 0], 2)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map)

  if (${interactive ? 'true' : 'false'}) {
    map.zoomControl.setPosition('topright')
  }

  isReady = true
  updateAll()
}

// ── Update handler — called directly via injectJavaScript (reliable) ──
// Also registered as a message listener below (backup channel).
function handleUpdate(data) {
  try {
    if (data.type === 'INIT') {
      if (data.myLabel) myLabel = data.myLabel
      if (data.targetLabel) targetLabel = data.targetLabel
      if (data.myLat != null && data.myLng != null) { myLat = data.myLat; myLng = data.myLng }
      if (data.targetLat != null && data.targetLng != null) { targetLat = data.targetLat; targetLng = data.targetLng }
      if (!isReady) { initMap(); return }
      updateAll()
    } else if (data.type === 'UPDATE_POSITIONS') {
      var changed = false
      if (data.myLat != null && data.myLng != null) {
        myLat = data.myLat; myLng = data.myLng; changed = true
      }
      if (data.targetLat != null && data.targetLng != null) {
        targetLat = data.targetLat; targetLng = data.targetLng; changed = true
      }
      if (changed) {
        if (!isReady) { initMap(); return }
        updateAll()
      }
    } else if (data.type === 'UPDATE_LABELS') {
      if (data.myLabel) myLabel = data.myLabel
      if (data.targetLabel) targetLabel = data.targetLabel
      if (!isReady) { initMap(); return }
      updateAll()
    }
  } catch(e) {}
}

// ── Listen for messages from React Native (both channels for reliability) ──
// RN WebView may dispatch on window or document depending on version.
window.addEventListener('message', function(e) { try { handleUpdate(JSON.parse(e.data)) } catch(e) {} });
document.addEventListener('message', function(e) { try { handleUpdate(JSON.parse(e.data)) } catch(e) {} });

// Also expose globally so injectJavaScript() can call it directly
window.handleUpdate = handleUpdate;

function updateMarkers() {
  if (myLat != null && myLng != null) {
    var pos = [myLat, myLng]
    if (!myMarker) {
      myMarker = L.marker(pos, { icon: createMyIcon(myLabel) }).addTo(map)
      myMarker.bindPopup('<div class="popup-content"><div class="name">' + myLabel + '</div><div class="coords">' + myLat.toFixed(5) + ', ' + myLng.toFixed(5) + '</div></div>')
    } else {
      myMarker.setLatLng(pos)
      myMarker.setIcon(createMyIcon(myLabel))
      myMarker.setPopupContent('<div class="popup-content"><div class="name">' + myLabel + '</div><div class="coords">' + myLat.toFixed(5) + ', ' + myLng.toFixed(5) + '</div></div>')
    }
  }

  if (targetLat != null && targetLng != null) {
    var tPos = [targetLat, targetLng]
    if (!targetMarker) {
      targetMarker = L.marker(tPos, { icon: createTargetIcon(targetLabel) }).addTo(map)
      targetMarker.bindPopup('<div class="popup-content"><div class="name">' + targetLabel + '</div><div class="coords">' + targetLat.toFixed(5) + ', ' + targetLng.toFixed(5) + '</div></div>')
    } else {
      targetMarker.setLatLng(tPos)
      targetMarker.setIcon(createTargetIcon(targetLabel))
      targetMarker.setPopupContent('<div class="popup-content"><div class="name">' + targetLabel + '</div><div class="coords">' + targetLat.toFixed(5) + ', ' + targetLng.toFixed(5) + '</div></div>')
    }
  }

  if (myLat == null && myMarker) { map.removeLayer(myMarker); myMarker = null }
  if (targetLat == null && targetMarker) { map.removeLayer(targetMarker); targetMarker = null }
}

// ── OSRM Route Fetching ──────────────────────────────────────────────────
// Fetches actual driving route from OSRM and draws it as a solid polyline.
// Falls back to a dashed straight line if the route fetch fails.
// Debounced to at most once every 5 seconds to avoid excessive API calls.
function fetchRoute() {
  var now = Date.now()
  if (now - lastRouteFetch < 5000) return // debounce 5s
  if (myLat == null || myLng == null || targetLat == null || targetLng == null) return
  lastRouteFetch = now

  var url = 'https://router.project-osrm.org/route/v1/driving/' +
    myLng + ',' + myLat + ';' + targetLng + ',' + targetLat +
    '?geometries=geojson&overview=full&alternatives=false&steps=false'

  var xhr = new XMLHttpRequest()
  xhr.open('GET', url, true)
  xhr.timeout = 8000
  xhr.onload = function() {
    if (xhr.status !== 200) { showFallbackLine(); return }
    try {
      var data = JSON.parse(xhr.responseText)
      if (!data || data.code !== 'Ok' || !data.routes || data.routes.length === 0) {
        showFallbackLine()
        return
      }
      var coords = data.routes[0].geometry.coordinates
      // GeoJSON gives [lng, lat] — convert to [lat, lng] for Leaflet
      var latlngs = coords.map(function(c) { return [c[1], c[0]] })
      drawRoutePolyline(latlngs)
    } catch(e) {
      showFallbackLine()
    }
  }
  xhr.onerror = function() { showFallbackLine() }
  xhr.ontimeout = function() { showFallbackLine() }
  xhr.send()
}

// Draw the actual driving route (solid line)
function drawRoutePolyline(latlngs) {
  if (routePolyline) {
    routePolyline.setLatLngs(latlngs)
  } else {
    routePolyline = L.polyline(latlngs, {
      color: '#FF6B00',
      weight: 4,
      opacity: 0.9,
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(map)
  }
  // Remove fallback dashed line if it was shown
  if (fallbackLine) {
    map.removeLayer(fallbackLine)
    fallbackLine = null
  }
}

// Fallback: dashed straight line if OSRM route fetch fails
function showFallbackLine() {
  // Remove route polyline if it was showing
  if (routePolyline) {
    map.removeLayer(routePolyline)
    routePolyline = null
  }
  var points = []
  if (myLat != null && myLng != null) points.push([myLat, myLng])
  if (targetLat != null && targetLng != null) points.push([targetLat, targetLng])

  if (points.length === 2) {
    if (!fallbackLine) {
      fallbackLine = L.polyline(points, {
        color: '#FF6B00',
        weight: 3,
        opacity: 0.6,
        dashArray: '8, 8',
        lineCap: 'round',
        lineJoin: 'round',
      }).addTo(map)
    } else {
      fallbackLine.setLatLngs(points)
    }
  } else {
    if (fallbackLine) { map.removeLayer(fallbackLine); fallbackLine = null }
  }
}

function fitBounds() {
  var points = []
  if (myLat != null && myLng != null) points.push([myLat, myLng])
  if (targetLat != null && targetLng != null) points.push([targetLat, targetLng])

  if (points.length >= 2) {
    var bounds = L.latLngBounds(points)
    map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15, duration: 0.8 })
  } else if (points.length === 1) {
    map.setView(points[0], 14)
  }
}

function updateAll() {
  if (!isReady || !map) return
  updateMarkers()
  // Try OSRM route first; falls back to dashed line
  fetchRoute()
  fitBounds()
}

// Signal ready
(function signalReady() {
  try {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
  } catch(e) {}
  setTimeout(function() {
    if (!isReady) initMap();
  }, 1000);
})();
</script>
</body>
</html>`
}

// ── Component ────────────────────────────────────────────────────────────
const MiniMap = forwardRef(function MiniMap({
  myLat,
  myLng,
  targetLat,
  targetLng,
  myLabel = 'You',
  targetLabel = 'Destination',
  myAddress,
  targetAddress,
  distance,
  eta,
  interactive = false,
  onPress,
}, ref) {
  const webViewRef = useRef(null)
  const fsWebViewRef = useRef(null)
  const initSent = useRef(false)
  const fsInitSent = useRef(false)
  const lastTapRef = useRef(0)
  const singleTapTimer = useRef(null)
  const [fullscreen, setFullscreen] = useState(false)

  // Expose openFullScreen to parent via ref
  useImperativeHandle(ref, () => ({
    openFullScreen: () => setFullscreen(true),
  }), [])

  // Build HTML with initial positions embedded directly
  // Note: on first render positions may be null (GPS not yet acquired),
  // but this ensures the map starts correctly when they ARE available.
  const initData = useMemo(() => ({
    myLat, myLng, targetLat, targetLng, myLabel, targetLabel,
  }), []) // empty deps: capture initial values only; updates use injectJavaScript

  const mapHTML = useMemo(() => buildHTML(interactive, initData), [interactive, initData])
  const fullscreenHTML = useMemo(() => buildHTML(true, initData), [initData])

  // ── Reliable message sender: uses injectJavaScript (direct JS execution)
  // instead of postMessage (event dispatch, unreliable in RN WebView).
  // Falls back to postMessage if injectJavaScript is unavailable.
  const sendUpdate = useCallback((ref, data) => {
    if (!ref.current) return
    const json = JSON.stringify(data)
    const script = `window.handleUpdate(${json}); true;`
    try {
      ref.current.injectJavaScript(script)
    } catch (e) {
      // Fallback to postMessage if injectJavaScript isn't available
      try { ref.current.postMessage(json) } catch(e2) {}
    }
  }, [])

  const sendPositions = useCallback((ref) => {
    sendUpdate(ref, {
      type: 'UPDATE_POSITIONS',
      myLat,
      myLng,
      targetLat,
      targetLng,
    })
  }, [myLat, myLng, targetLat, targetLng, sendUpdate])

  const sendLabels = useCallback((ref) => {
    sendUpdate(ref, {
      type: 'UPDATE_LABELS',
      myLabel,
      targetLabel,
    })
  }, [myLabel, targetLabel, sendUpdate])

  // ── WebView onLoad: fires when the page finishes loading (reliable).
  // Sends INIT with current positions + labels so the map starts correctly.
  const handleLoad = useCallback(() => {
    initSent.current = true
    sendUpdate(webViewRef, {
      type: 'INIT',
      myLat, myLng, targetLat, targetLng,
      myLabel, targetLabel,
    })
  }, [myLat, myLng, targetLat, targetLng, myLabel, targetLabel, sendUpdate])

  // ── Full-screen WebView: same approach ──
  const handleFsLoad = useCallback(() => {
    fsInitSent.current = true
    sendUpdate(fsWebViewRef, {
      type: 'INIT',
      myLat, myLng, targetLat, targetLng,
      myLabel, targetLabel,
    })
  }, [myLat, myLng, targetLat, targetLng, myLabel, targetLabel, sendUpdate])

  // Sync positions/labels whenever they change (for BOTH card and full-screen)
  useEffect(() => {
    if (!initSent.current) return
    sendPositions(webViewRef)
  }, [myLat, myLng, targetLat, targetLng, sendPositions])

  useEffect(() => {
    if (!fsInitSent.current) return
    sendPositions(fsWebViewRef)
  }, [myLat, myLng, targetLat, targetLng, sendPositions])

  useEffect(() => {
    if (!initSent.current) return
    sendLabels(webViewRef)
  }, [myLabel, targetLabel, sendLabels])

  useEffect(() => {
    if (!fsInitSent.current) return
    sendLabels(fsWebViewRef)
  }, [myLabel, targetLabel, sendLabels])

  // ── Double-tap detection ──
  // Single tap → open Google Maps (after 360ms if no second tap follows)
  // Double tap (within 350ms) → open full-screen modal
  const handlePress = useCallback(() => {
    const now = Date.now()
    if (now - lastTapRef.current < 350) {
      // Double tap → full-screen, cancel any pending single-tap
      if (singleTapTimer.current) clearTimeout(singleTapTimer.current)
      singleTapTimer.current = null
      setFullscreen(true)
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
      singleTapTimer.current = setTimeout(() => {
        onPress?.()
        singleTapTimer.current = null
      }, 360)
    }
  }, [onPress])

  const hasTarget = targetLat != null && targetLng != null

  // ── Expand button (shared by both modes) ──
  const expandBtn = (
    <TouchableOpacity
      style={styles.expandBtn}
      onPress={() => setFullscreen(true)}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
      activeOpacity={0.7}
    >
      <Text style={styles.expandBtnTxt}>⛶</Text>
    </TouchableOpacity>
  )

  // ── Full-screen Modal ──
  const renderFullScreen = () => (
    <Modal visible={fullscreen} animationType="slide" statusBarTranslucent>
      <SafeAreaView style={styles.fsSafeArea}>
        <StatusBar barStyle="light-content" backgroundColor="#1A3A6B" />

        {/* Header bar */}
        <View style={styles.fsHeader}>
          <TouchableOpacity
            style={styles.fsCloseBtn}
            onPress={() => setFullscreen(false)}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
          >
            <Text style={styles.fsCloseTxt}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.fsTitle}>📍 Live Map</Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Address info panel */}
        <View style={styles.fsAddressPanel}>
          <View style={styles.fsAddressRow}>
            <Text style={styles.fsAddressIcon}>📍</Text>
            <View style={styles.fsAddressTextWrap}>
              <Text style={styles.fsAddressLabel}>Customer</Text>
              <Text style={styles.fsAddressValue} numberOfLines={3}>{targetAddress || targetLabel || 'Waiting...'}</Text>
            </View>
          </View>
          <View style={styles.fsAddressDivider} />
          <View style={styles.fsAddressRow}>
            <Text style={styles.fsAddressIcon}>🛵</Text>
            <View style={styles.fsAddressTextWrap}>
              <Text style={styles.fsAddressLabel}>Your Location</Text>
              <Text style={styles.fsAddressValue} numberOfLines={1}>{myAddress || myLabel || 'You'}</Text>
            </View>
          </View>
        </View>            {/* Full-screen interactive map */}
          <View style={styles.fsMapWrap}>
            <WebView
              ref={fsWebViewRef}
              source={{ html: fullscreenHTML }}
              style={styles.fsWebView}
              onLoad={handleFsLoad}
              javaScriptEnabled
              domStorageEnabled
              geolocationEnabled
              allowFileAccess
              mixedContentMode="always"
              originWhitelist={['*']}
              scrollEnabled={false}
              bounces={false}
            />

          {/* Distance/ETA bar */}
          <View style={styles.fsInfoBar}>
            <View style={styles.fsInfoLeft}>
              <Text style={styles.fsInfoIcon}>📍</Text>
              <View>
                <Text style={styles.fsInfoLabel}>
                  {hasTarget ? 'Distance to destination' : 'Waiting for location...'}
                </Text>
                <Text style={styles.fsInfoValue}>{distance || '--'} · {eta || '--'}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.fsNavBtn} onPress={onPress}>
              <Text style={styles.fsNavBtnIcon}>🗺️</Text>
              <Text style={styles.fsNavBtnTxt}>Open Maps</Text>
            </TouchableOpacity>
          </View>
        </View>
      </SafeAreaView>
    </Modal>
  )

  // ── Static Mode (like Swiggy/Rapido card) ──
  if (!interactive) {
    return (
      <>
        <TouchableOpacity
          activeOpacity={0.9}
          onPress={handlePress}
          style={styles.wrapper}
        >
          <View style={styles.container}>
            <WebView
              ref={webViewRef}
              source={{ html: mapHTML }}
              style={styles.webview}
              onLoad={handleLoad}
              javaScriptEnabled
              domStorageEnabled
              geolocationEnabled
              allowFileAccess
              mixedContentMode="always"
              originWhitelist={['*']}
              scrollEnabled={false}
              bounces={false}
              pointerEvents="none"
            />

            {/* Expand button at top-right */}
            {expandBtn}

            {/* Info overlay at bottom — like Swiggy/Rapido */}
            <View style={styles.infoOverlay}>
              <View style={styles.infoRow}>
                <View style={styles.infoLeft}>
                  <Text style={styles.infoStatus}>
                    {hasTarget ? '🛵 Technician on the way' : '⏳ Waiting for technician...'}
                  </Text>
                  {distance ? (
                    <Text style={styles.infoDist}>{distance} · {eta}</Text>
                  ) : null}
                </View>
                <View style={styles.mapsBtn}>
                  <Text style={styles.mapsBtnIcon}>🗺️</Text>
                  <Text style={styles.mapsBtnTxt}>Open</Text>
                </View>
              </View>
            </View>
          </View>
        </TouchableOpacity>

        {renderFullScreen()}
      </>
    )
  }

  // ── Interactive Mode (tech navigation) ──
  return (
    <>
      <View style={styles.wrapper}>
        <View style={styles.container}>
          <WebView
            ref={webViewRef}
            source={{ html: mapHTML }}
            style={styles.webview}
            onLoad={handleLoad}
            javaScriptEnabled
            domStorageEnabled
            geolocationEnabled
            allowFileAccess
            mixedContentMode="always"
            originWhitelist={['*']}
            scrollEnabled={false}
            bounces={false}
          />

          {/* Expand button at top-right */}
          {expandBtn}

          {/* Distance/ETA info bar at bottom with Open Maps button */}
          <View style={styles.interactiveInfoBar}>
            <View style={styles.interactiveInfoLeft}>
              <Text style={styles.interactiveInfoIcon}>📍</Text>
              <View>
                <Text style={styles.interactiveInfoLabel}>Distance to Customer</Text>
                <Text style={styles.interactiveInfoValue}>{distance || '--'} · {eta || '--'}</Text>
              </View>
            </View>
            <TouchableOpacity style={styles.interactiveMapsBtn} onPress={onPress} activeOpacity={0.7}>
              <Text style={styles.interactiveMapsBtnIcon}>🗺️</Text>
              <Text style={styles.interactiveMapsBtnTxt}>Open Maps</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>

      {renderFullScreen()}
    </>
  )
})

export default MiniMap

const styles = StyleSheet.create({
  wrapper: {
    width: '100%',
    height: 240,
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 12,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
  },
  container: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#e8e4df',
  },

  // ── Static Mode Info Overlay (like Swiggy/Rapido) ──
  infoOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(26, 58, 107, 0.92)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  infoLeft: {
    flex: 1,
  },
  infoStatus: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  infoDist: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 11,
    fontWeight: '700',
    marginTop: 2,
  },
  mapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FF6B00',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  mapsBtnIcon: {
    fontSize: 14,
  },
  mapsBtnTxt: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },

  // ── Interactive Mode Info Bar ──
  interactiveInfoBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(26, 58, 107, 0.9)',
    paddingHorizontal: 14,
    paddingVertical: 10,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  interactiveInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  interactiveInfoIcon: {
    fontSize: 18,
  },
  interactiveInfoLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  interactiveInfoValue: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
  interactiveMapsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FF6B00',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  interactiveMapsBtnIcon: {
    fontSize: 14,
  },
  interactiveMapsBtnTxt: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '800',
  },

  // ── Expand Button (top-right corner) ──
  expandBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  expandBtnTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },

  // ── Full-Screen Modal ──
  fsSafeArea: {
    flex: 1,
    backgroundColor: '#1A3A6B',
  },
  fsHeader: {
    backgroundColor: '#1A3A6B',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 35,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fsCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fsCloseTxt: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
  },
  fsTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  // ── Address Panel (full-screen) ──
  fsAddressPanel: {
    backgroundColor: '#fff',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  fsAddressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    paddingVertical: 4,
  },
  fsAddressIcon: {
    fontSize: 16,
    marginTop: 2,
  },
  fsAddressTextWrap: {
    flex: 1,
  },
  fsAddressLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#888',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  fsAddressValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#1A3A6B',
    marginTop: 1,
  },
  fsAddressDivider: {
    height: 1,
    backgroundColor: '#f0f0f0',
    marginVertical: 4,
    marginLeft: 26,
  },

  fsMapWrap: {
    flex: 1,
    backgroundColor: '#e8e4df',
    position: 'relative',
  },
  fsWebView: {
    flex: 1,
    backgroundColor: '#e8e4df',
  },
  fsInfoBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(26, 58, 107, 0.92)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    paddingBottom: Platform.OS === 'ios' ? 30 : 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fsInfoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  fsInfoIcon: {
    fontSize: 22,
  },
  fsInfoLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  fsInfoValue: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    marginTop: 1,
  },
  fsNavBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#FF6B00',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
  },
  fsNavBtnIcon: {
    fontSize: 16,
  },
  fsNavBtnTxt: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
})
