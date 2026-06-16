sfadsdfsd// MapPickerModal.js — WebView-based Leaflet map picker for the app
// Allows: search, satellite/standard toggle, draggable pin, GPS locate
import { useEffect, useRef, useState } from 'react'
import {
  ActivityIndicator,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View
} from 'react-native'
import { WebView } from 'react-native-webview'
import * as Location from 'expo-location'

const MAP_HTML = `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<style>
*{margin:0;padding:0;box-sizing:border-box}
html,body,#map{width:100%;height:100%;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif}

/* ── Top search bar ── */
.search-bar{position:absolute;top:12px;left:12px;right:12px;z-index:1000;display:flex;gap:6px;align-items:center;background:#fff;border-radius:10px;padding:6px 10px;box-shadow:0 2px 8px rgba(0,0,0,0.15)}
.search-bar input{flex:1;border:none;outline:none;font-size:14px;padding:6px 0;color:#1A3A6B;font-weight:600}
.search-bar input::placeholder{color:#aaa;font-weight:400}
.search-btn{background:#FF6B00;border:none;color:#fff;font-size:13px;font-weight:700;padding:6px 14px;border-radius:8px;cursor:pointer}

/* ── Search autocomplete ── */
.search-wrap{position:relative;flex:1}
.suggestions{position:absolute;top:100%;left:0;right:0;background:#fff;border:1px solid #ddd;border-top:none;border-radius:0 0 10px 10px;box-shadow:0 8px 24px rgba(0,0,0,0.15);z-index:2000;max-height:220px;overflow-y:auto;display:none}
.suggestions.show{display:block}
.suggestions .ac-item{display:flex;align-items:center;gap:8px;padding:9px 12px;cursor:pointer;border-bottom:1px solid #f5f5f5;transition:background 0.12s}
.suggestions .ac-item:last-child{border-bottom:none}
.suggestions .ac-item:hover,.suggestions .ac-item.highlighted{background:#fff5ee}
.suggestions .ac-icon{font-size:15px;flex-shrink:0}
.suggestions .ac-info{flex:1;min-width:0}
.suggestions .ac-name{font-size:12px;font-weight:700;color:#1A3A6B;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.suggestions .ac-addr{font-size:10px;color:#888;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px}
.suggestions .ac-msg{padding:14px;text-align:center;color:#aaa;font-size:11px;font-style:italic}

/* ── Layer toggle ── */
.layer-toggle{position:absolute;bottom:100px;right:12px;z-index:1000;display:flex;flex-direction:column;gap:4px}
.layer-btn{background:#fff;border:none;border-radius:8px;padding:7px 10px;font-size:11px;font-weight:700;color:#888;box-shadow:0 2px 6px rgba(0,0,0,0.12);cursor:pointer;text-align:center}
.layer-btn.active{background:#FF6B00;color:#fff}

/* ── My location button ── */
.my-loc-btn{position:absolute;bottom:100px;left:12px;z-index:1000;background:#fff;border:none;border-radius:8px;padding:8px 12px;font-size:12px;font-weight:700;color:#1A3A6B;box-shadow:0 2px 6px rgba(0,0,0,0.12);cursor:pointer}

/* ── Coords display ── */
.coords-bar{position:absolute;bottom:52px;left:12px;right:12px;z-index:1000;background:rgba(26,58,107,0.9);border-radius:8px;padding:8px 12px;text-align:center;color:#fff;font-size:12px;font-weight:600}
.coords-bar.hint{background:#fff5ee;color:#888;font-weight:600}
.coords-bar.hint strong{color:#FF6B00;font-weight:800}

/* ── Confirm button ── */
.confirm-btn{position:absolute;bottom:8px;left:12px;right:12px;z-index:1000;background:#FF6B00;border:none;border-radius:10px;padding:12px;font-size:15px;font-weight:800;color:#fff;cursor:pointer;box-shadow:0 3px 10px rgba(255,107,0,0.4)}
.confirm-btn:disabled{opacity:0.5;cursor:default}

/* ── Pin icon ── */
.pin-icon{display:flex;align-items:center;justify-content:center;font-size:32px;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.3))}

/* ── Animations ── */
@keyframes bounceIn{0%{transform:scale(0)}50%{transform:scale(1.25)}70%{transform:scale(0.92)}100%{transform:scale(1)}}
@keyframes pulseRing{0%{transform:scale(1);opacity:0.6}100%{transform:scale(2);opacity:0}}
@keyframes floatUp{from{transform:translateY(12px);opacity:0}to{transform:translateY(0);opacity:1}}

.animated-pin-wrapper{position:relative;display:flex;align-items:center;justify-content:center;animation:bounceIn 0.5s cubic-bezier(0.68,-0.55,0.265,1.55)}
.animated-pin-wrapper .pulse-ring{position:absolute;width:48px;height:48px;border-radius:50%;background:rgba(255,107,0,0.3);animation:pulseRing 2s ease-out infinite;pointer-events:none}
.pin-svg{filter:drop-shadow(0 3px 6px rgba(0,0,0,0.4));position:relative;z-index:1}

/* ── Marker Popup ── */
.location-popup .leaflet-popup-content-wrapper{border-radius:12px;padding:4px;box-shadow:0 4px 24px rgba(0,0,0,0.2);background:#fff;animation:floatUp 0.3s ease-out}
.location-popup .leaflet-popup-content{margin:10px 14px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif}
.location-popup .popup-title{font-size:13px;font-weight:800;color:#1A3A6B;margin-bottom:3px}
.location-popup .popup-coords{font-size:11px;color:#888;font-weight:600}
.location-popup .popup-address{font-size:12px;color:#555;margin-top:5px;padding-top:6px;border-top:1px solid #eee;font-weight:500}
.location-popup .popup-loading{font-size:11px;color:#aaa;font-style:italic;margin-top:4px}
.location-popup .leaflet-popup-tip{box-shadow:none}

/* ── Coords bar refined ── */
.coords-bar strong{color:#FF6B00;font-weight:800}


/* ── Leaflet zoom control tweaks ── */
.leaflet-control-zoom{margin-top:50px !important;margin-right:12px !important;border:none !important;border-radius:8px !important;overflow:hidden;box-shadow:0 2px 6px rgba(0,0,0,0.15) !important}
.leaflet-control-zoom a{width:32px;height:32px;line-height:32px;font-size:16px;color:#1A3A6B;font-weight:700}
.leaflet-control-attribution{display:none !important}
</style>
</head>
<body>
<div id="map"></div>

<div class="search-bar" id="searchBar">
  <div class="search-wrap">
    <input type="text" id="searchInput" placeholder="🔍 Search for a location..." autocomplete="off" />
    <div class="suggestions" id="suggestions"></div>
  </div>
  <button class="search-btn" id="searchBtn">Search</button>
</div>

<div class="layer-toggle" id="layerToggle">
  <button class="layer-btn active" id="btnStandard" onclick="switchLayer('standard')">🗺️ Map</button>
  <button class="layer-btn" id="btnSatellite" onclick="switchLayer('satellite')">🛰️ Satellite</button>
</div>

<button class="my-loc-btn" id="myLocBtn" onclick="goToMyLocation()">📍 My Location</button>

<div class="coords-bar" id="coordsBar">📍 Tap on the map to drop a pin</div>

<button class="confirm-btn" id="confirmBtn" onclick="confirmLocation()" disabled>✅ Confirm Location</button>

<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<script>
var map, marker, tileLayer, currentLayer = 'standard';
var selectedLat = null, selectedLng = null;
var isReady = false, gpsFound = false, gpsProcessing = false;

function initMap(lat, lng) {
  // If the coordinates match the default Hyderabad fallback, GPS was NOT acquired
  gpsFound = (lat !== 17.3850 || lng !== 78.4867);

  map = L.map('map', {
    zoomControl: true,
    attributionControl: false
  }).setView([lat, lng], 15);

  tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);

  // Custom animated SVG pin icon
  var pinIcon = L.divIcon({
    className: '',
    html: '<div class="animated-pin-wrapper">' +
      '<div class="pulse-ring"></div>' +
      '<svg class="pin-svg" width="28" height="38" viewBox="0 0 28 38" fill="none">' +
      '<path d="M14 0C6.27 0 0 6.27 0 14c0 10.5 14 24 14 24s14-13.5 14-24C28 6.27 21.73 0 14 0z" fill="#FF6B00" stroke="#fff" stroke-width="2.5"/>' +
      '<circle cx="14" cy="13" r="5.5" fill="#fff"/>' +
      '</svg></div>',
    iconSize: [28, 38],
    iconAnchor: [14, 38],
    popupAnchor: [0, -42],
  });

  marker = L.marker([lat, lng], {
    draggable: true,
    icon: pinIcon
  }).addTo(map);

  selectedLat = lat;
  selectedLng = lng;
  updateCoords();
  enableConfirm();

  // Bind popup with initial content
  marker.bindPopup(createPopupContent(lat, lng), {
    className: 'location-popup',
    closeButton: false,
    autoClose: false,
    closeOnClick: false,
    offset: [0, -38],
  });

  marker.on('dragend', function() {
    var pos = marker.getLatLng();
    selectedLat = pos.lat;
    selectedLng = pos.lng;
    gpsFound = true;
    updateCoords();
    enableConfirm();
    updateMarkerPopup();
    marker.openPopup();
  });

  map.on('click', function(e) {
    selectedLat = e.latlng.lat;
    selectedLng = e.latlng.lng;
    marker.setLatLng([selectedLat, selectedLng]);
    gpsFound = true;
    // Trigger bounce animation
    var pinEl = marker.getElement();
    if (pinEl) {
      var wrapper = pinEl.querySelector('.animated-pin-wrapper');
      if (wrapper) {
        wrapper.style.animation = 'none';
        void wrapper.offsetWidth;
        wrapper.style.animation = 'bounceIn 0.5s cubic-bezier(0.68, -0.55, 0.265, 1.55)';
      }
    }
    updateCoords();
    enableConfirm();
    updateMarkerPopup();
    marker.openPopup();
  });

  // Show popup after init
  setTimeout(function() {
    if (marker) {
      marker.openPopup();
      if (gpsFound) {
        updateMarkerPopup();
      } else {
        marker.setPopupContent(
          '<div class="popup-title">📍 Set Your Repair Location</div>' +
          '<div class="popup-coords" style="color:#FF6B00;">Tap the map, search, or use "My Location"</div>'
        );
      }
    }
  }, 600);

  isReady = true;
}

function createPopupContent(lat, lng) {
  return '<div class="popup-title">📍 Pinned Location</div>' +
    '<div class="popup-coords">' + lat.toFixed(5) + ', ' + lng.toFixed(5) + '</div>' +
    '<div class="popup-loading">⏳ Fetching address...</div>';
}

async function updateMarkerPopup() {
  if (!marker || !selectedLat || !selectedLng) return;
  marker.setPopupContent(createPopupContent(selectedLat, selectedLng));
  try {
    var res = await fetch('https://nominatim.openstreetmap.org/reverse?lat=' + selectedLat + '&lon=' + selectedLng + '&format=json&addressdetails=1');
    var data = await res.json();
    if (data.display_name) {
      var parts = data.display_name.split(',');
      var shortAddr = parts.slice(0, 4).join(',');
      marker.setPopupContent(
        '<div class="popup-title">📍 Pinned Location</div>' +
        '<div class="popup-coords">' + selectedLat.toFixed(5) + ', ' + selectedLng.toFixed(5) + '</div>' +
        '<div class="popup-address">' + shortAddr + '</div>'
      );
    }
  } catch(e) {}
}

function updateCoords() {
  var el = document.getElementById('coordsBar');
  if (!el) return;
  if (gpsFound && selectedLat && selectedLng) {
    el.innerHTML = '📍 <strong>' + selectedLat.toFixed(5) + ', ' + selectedLng.toFixed(5) + '</strong>';
    el.className = 'coords-bar';
  } else if (!gpsFound) {
    el.innerHTML = '📍 <strong>Tap the map or use "My Location" to set your address</strong>';
    el.className = 'coords-bar hint';
  }
}

function enableConfirm() {
  document.getElementById('confirmBtn').disabled = false;
}

function switchLayer(layer) {
  if (layer === currentLayer) return;
  currentLayer = layer;
  document.getElementById('btnStandard').classList.remove('active');
  document.getElementById('btnSatellite').classList.remove('active');
  if (layer === 'standard') {
    document.getElementById('btnStandard').classList.add('active');
    map.removeLayer(tileLayer);
    tileLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  } else {
    document.getElementById('btnSatellite').classList.add('active');
    map.removeLayer(tileLayer);
    tileLayer = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { maxZoom: 19 }).addTo(map);
  }
}

function goToMyLocation() {
  document.getElementById('myLocBtn').textContent = '⏳ Locating...';
  // Ask React Native to get GPS via expo-location (more reliable than navigator.geolocation in WebView)
  window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'REQUEST_GPS' }));
}

// ── Search Autocomplete ──
var acTimer = null, acResults = [], acHighlight = -1;
var acInput = document.getElementById('searchInput');
var acDrop = document.getElementById('suggestions');

if (acInput && acDrop) {
  acInput.addEventListener('input', function() {
    clearTimeout(acTimer);
    var q = this.value.trim();
    if (q.length < 2) { acDrop.classList.remove('show'); acDrop.innerHTML = ''; return; }
    acTimer = setTimeout(function() { fetchSuggestions(q); }, 300);
  });

  acInput.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (acResults.length===0) return; acHighlight = Math.min(acHighlight+1, acResults.length-1); highlightSuggestion(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); if (acResults.length===0) return; acHighlight = Math.max(acHighlight-1, -1); highlightSuggestion(); }
    else if (e.key === 'Enter') { if (acHighlight >= 0 && acResults[acHighlight]) { e.preventDefault(); pickSuggestion(acResults[acHighlight]); } }
    else if (e.key === 'Escape') { acDrop.classList.remove('show'); }
  });

  document.addEventListener('click', function(e) {
    if (!e.target.closest('.search-bar')) acDrop.classList.remove('show');
  });
}

async function fetchSuggestions(query) {
  if (!acDrop) return;
  acDrop.innerHTML = '<div class="ac-msg">⏳ Searching...</div>';
  acDrop.classList.add('show');
  try {
    var res = await fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(query) + '&format=json&limit=5&addressdetails=1');
    var data = await res.json();
    acResults = data;
    acHighlight = -1;
    if (data.length === 0) {
      acDrop.innerHTML = '<div class="ac-msg">No results found</div>';
    } else {
      acDrop.innerHTML = data.map(function(r, i) {
        var parts = (r.display_name || '').split(',');
        var name = parts[0] || '';
        var addr = parts.slice(1, 4).join(',').trim();
        var type = (r.type || '').toLowerCase();
        var icon = ['city','town','village','county','state'].indexOf(type) >= 0 ? '🏙️' : ['street','road','highway','neighbourhood'].indexOf(type) >= 0 ? '🛣️' : ['amenity','building','hotel','mall','hospital'].indexOf(type) >= 0 ? '🏢' : '📍';
        return '<div class="ac-item" data-index="' + i + '" onclick="pickSuggestion(acResults[' + i + '])" onmouseenter="acHighlight=' + i + ';highlightSuggestion()">' +
          '<span class="ac-icon">' + icon + '</span>' +
          '<div class="ac-info"><div class="ac-name">' + name + '</div><div class="ac-addr">' + (addr || r.lat.slice(0,6) + ', ' + r.lon.slice(0,6)) + '</div></div></div>';
      }).join('');
    }
  } catch(e) {
    acDrop.innerHTML = '<div class="ac-msg">Search failed</div>';
    acResults = []; acHighlight = -1;
  }
}

function highlightSuggestion() {
  if (!acDrop) return;
  var items = acDrop.querySelectorAll('.ac-item');
  items.forEach(function(item, i) { item.classList.toggle('highlighted', i === acHighlight); });
  if (acHighlight >= 0 && items[acHighlight]) items[acHighlight].scrollIntoView({ block: 'nearest' });
}

function pickSuggestion(result) {
  if (!result || !map) return;
  var lat = parseFloat(result.lat), lng = parseFloat(result.lon);
  if (acDrop) { acDrop.classList.remove('show'); acDrop.innerHTML = ''; }
  document.getElementById('searchInput').value = (result.display_name || '').split(',').slice(0,3).join(',').trim();
  map.flyTo([lat, lng], 16, { duration: 1.2 });
  setTimeout(function() {
    marker.setLatLng([lat, lng]);
    selectedLat = lat; selectedLng = lng;
    gpsFound = true;
    updateCoords(); enableConfirm(); updateMarkerPopup(); marker.openPopup();
  }, 300);
}

document.getElementById('searchBtn').addEventListener('click', searchLocation);
document.getElementById('searchInput').addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && acHighlight < 0) searchLocation();
});

async function searchLocation() {
  var query = document.getElementById('searchInput').value.trim();
  if (!query) return;
  document.getElementById('searchBtn').textContent = '⏳';
  document.getElementById('searchBtn').disabled = true;
  try {
    var res = await fetch('https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(query) + '&format=json&limit=5');
    var data = await res.json();
    if (data && data.length > 0) {
      var lat = parseFloat(data[0].lat);
      var lng = parseFloat(data[0].lon);
      map.flyTo([lat, lng], 16, { duration: 1.2 });
      setTimeout(function() {
        marker.setLatLng([lat, lng]);
        selectedLat = lat;
        selectedLng = lng;
        gpsFound = true;
        updateCoords();
        enableConfirm();
        updateMarkerPopup();
        marker.openPopup();
      }, 300);
      document.getElementById('searchInput').blur();
    }
  } catch(e) {}
  document.getElementById('searchBtn').textContent = 'Search';
  document.getElementById('searchBtn').disabled = false;
}

function confirmLocation() {
  if (selectedLat === null || selectedLng === null) return;
  // Send coordinates back to React Native
  window.ReactNativeWebView.postMessage(JSON.stringify({
    type: 'LOCATION_SELECTED',
    lat: selectedLat,
    lng: selectedLng
  }));
}

// Unified message handler for messages from React Native
// Register on both window and document for WebView compatibility
document.addEventListener('message', handleRNMessage);
window.addEventListener('message', handleRNMessage);
function handleRNMessage(e) {
  try {
    var data = JSON.parse(e.data);
    if (data.type === 'INIT') {
      if (!isReady) initMap(data.lat, data.lng);
    } else if (data.type === 'GPS_RESULT' && !gpsProcessing) {
      gpsProcessing = true;
      setTimeout(function() { gpsProcessing = false; }, 500);
      if (data.success && data.lat != null && data.lng != null) {
        var lat = data.lat;
        var lng = data.lng;
        map.flyTo([lat, lng], 16, { duration: 1.2 });
        setTimeout(function() {
          marker.setLatLng([lat, lng]);
          selectedLat = lat;
          selectedLng = lng;
          gpsFound = true;
          updateCoords();
          enableConfirm();
          updateMarkerPopup();
          marker.openPopup();
          document.getElementById('myLocBtn').textContent = '📍 My Location';
        }, 300);
      } else {
        document.getElementById('myLocBtn').textContent = '⚠️ GPS failed';
        setTimeout(function() {
          document.getElementById('myLocBtn').textContent = '📍 My Location';
        }, 2000);
      }
    }
  } catch(err) {}
}

// Signal to React Native that the WebView JS is ready, then it will send INIT
(function signalReady() {
  try {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'MAP_READY' }));
  } catch(e) {}
  // Fallback: init with default coords if RN doesn't respond within 1s
  setTimeout(function() {
    if (!isReady) initMap(17.3850, 78.4867);
  }, 1000);
})();
</script>
</body>
</html>`

export default function MapPickerModal({ visible, onClose, onLocationSelected, initialLat, initialLng }) {
  const [loading, setLoading] = useState(true)
  const [webviewError, setWebviewError] = useState(false)
  const webViewRef = useRef(null)
  const [webviewKey, setWebviewKey] = useState(0)

  // Safety timeout: if WebView doesn't signal MAP_READY within 10s, clear loading
  const loadingTimeoutRef = useRef(null)
  useEffect(() => {
    if (visible) {
      setLoading(true)
      setWebviewError(false)
      setWebviewKey(k => k + 1)
      loadingTimeoutRef.current = setTimeout(() => setLoading(false), 10000)
    }
    return () => {
      if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
    }
  }, [visible])

  const handleMessage = (event) => {
    try {
      const data = JSON.parse(event.nativeEvent.data)
      if (data.type === 'LOCATION_SELECTED') {
        onLocationSelected(data.lat, data.lng)
        onClose()
      } else if (data.type === 'MAP_READY') {
        // WebView JS is ready — now send the INIT with coordinates
        setLoading(false)
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
        if (webViewRef.current) {
          const msg = JSON.stringify({
            type: 'INIT',
            lat: initialLat || 17.3850,
            lng: initialLng || 78.4867,
          })
          webViewRef.current.postMessage(msg)
        }
      } else if (data.type === 'REQUEST_GPS') {
        // WebView requests GPS — use expo-location (more reliable than navigator.geolocation in WebView)
        handleRequestGPS()
      }
    } catch (e) {
      console.warn('MapPickerModal message error:', e)
    }
  }

  const handleRequestGPS = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync()
      if (status !== 'granted') {
        sendGPSResult(false)
        return
      }
      // Try high-accuracy first, fall back to balanced
      let pos
      try {
        pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High })
      } catch (_) {
        pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      }
      sendGPSResult(true, pos.coords.latitude, pos.coords.longitude)
    } catch (e) {
      console.warn('MapPickerModal GPS error:', e)
      sendGPSResult(false)
    }
  }

  const sendGPSResult = (success, lat, lng) => {
    if (!webViewRef.current) return
    const msg = JSON.stringify({
      type: 'GPS_RESULT',
      success,
      lat: lat != null ? lat : null,
      lng: lng != null ? lng : null,
    })
    webViewRef.current.postMessage(msg)
  }

  const handleWebviewError = () => {
    setLoading(false)
    setWebviewError(true)
    if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current)
  }

  const retryWebview = () => {
    setWebviewError(false)
    setLoading(true)
    setWebviewKey(k => k + 1)
    loadingTimeoutRef.current = setTimeout(() => setLoading(false), 10000)
  }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📍 Select Repair Location</Text>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeTxt}>✕</Text>
          </TouchableOpacity>
        </View>

        {/* Map */}
        <View style={styles.mapContainer}>
          {loading && (
            <View style={styles.loadingOverlay}>
              <ActivityIndicator size="large" color="#FF6B00" />
              <Text style={styles.loadingTxt}>Loading map...</Text>
            </View>
          )}
          {webviewError && (
            <View style={styles.errorOverlay}>
              <Text style={styles.errorIcon}>⚠️</Text>
              <Text style={styles.errorTxt}>Failed to load map</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={retryWebview}>
                <Text style={styles.retryTxt}>Tap to retry</Text>
              </TouchableOpacity>
            </View>
          )}
          <WebView
            key={webviewKey}
            ref={webViewRef}
            source={{ html: MAP_HTML }}
            style={styles.webview}
            onMessage={handleMessage}
            onError={handleWebviewError}
            onHttpError={handleWebviewError}
            javaScriptEnabled
            domStorageEnabled
            geolocationEnabled
            allowFileAccess
            mixedContentMode="always"
            originWhitelist={['*']}
          />
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    backgroundColor: '#FF6B00',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 55 : 45,
    paddingBottom: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#fff',
  },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  mapContainer: {
    flex: 1,
    position: 'relative',
  },
  webview: {
    flex: 1,
    backgroundColor: '#1A3A6B',
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1A3A6B',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  loadingTxt: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
    marginTop: 12,
  },
  errorOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#1A3A6B',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  errorIcon: {
    fontSize: 40,
    marginBottom: 10,
  },
  errorTxt: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
  },
  retryBtn: {
    marginTop: 14,
    backgroundColor: '#FF6B00',
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryTxt: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '800',
  },
})
