#!/bin/bash
# Insert tracking GPS functions and update existing code
cd website

# 1. Create the tracking functions in a temp file
cat > /tmp/track_fns.js << 'ENDOFFUNCTIONS'

  // ── Customer's Live GPS (My Location) on Tracking Map ────
  window.trackMyLocation = function() {
    if (!navigator.geolocation) { showToast('GPS not supported', 'error'); return; }

    // Toggle off if already active
    if (trackMyActive) {
      if (trackMyWatchId != null) {
        navigator.geolocation.clearWatch(trackMyWatchId);
        trackMyWatchId = null;
      }
      trackMyActive = false;
      trackMyLat = null; trackMyLng = null;
      const btn = document.getElementById('trackMyLocBtn');
      if (btn) { btn.classList.remove('active'); btn.innerHTML = '<span class="dot-pulse" id="trackMyLocDot"></span> 📍 Show My Location'; }
      if (trackMyMarker && trackingMap) { trackingMap.removeLayer(trackMyMarker); trackMyMarker = null; }
      if (trackMyAccCircle && trackingMap) { trackingMap.removeLayer(trackMyAccCircle); trackMyAccCircle = null; }
      showToast('📍 Live location turned off', 'success');
      return;
    }

    const btn = document.getElementById('trackMyLocBtn');
    if (btn) { btn.innerHTML = '<span class="dot-pulse" id="trackMyLocDot"></span> ⏳ Getting your location...'; }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        trackMyLat = pos.coords.latitude;
        trackMyLng = pos.coords.longitude;
        trackMyAccuracy = pos.coords.accuracy;
        trackMyActive = true;

        if (btn) {
          btn.classList.add('active');
          btn.innerHTML = '<span class="dot-pulse" id="trackMyLocDot"></span> 📍 Live: Tracking...';
        }

        showTrackMyLocation();
        updateDistanceAndEta();

        if (trackMyWatchId != null) navigator.geolocation.clearWatch(trackMyWatchId);
        trackMyWatchId = navigator.geolocation.watchPosition(
          (newPos) => {
            trackMyLat = newPos.coords.latitude;
            trackMyLng = newPos.coords.longitude;
            trackMyAccuracy = newPos.coords.accuracy;
            showTrackMyLocation();
            updateDistanceAndEta();
          },
          (err) => { console.warn('GPS watch error:', err.message); },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
        );
      },
      (err) => {
        showToast('⚠️ Could not get location: ' + err.message, 'error');
        if (btn) { btn.classList.remove('active'); btn.innerHTML = '<span class="dot-pulse" id="trackMyLocDot"></span> 📍 Show My Location'; }
      },
      { timeout: 10000, enableHighAccuracy: true }
    );
  };

  function showTrackMyLocation() {
    if (!trackMyLat || !trackMyLng || !trackingMap) return;

    const blueDotHtml = '<div style="display:flex;align-items:center;justify-content:center;">'
      + '<div style="width:16px;height:16px;background:#4285F4;border:3px solid #fff;border-radius:50%;box-shadow:0 0 6px rgba(0,0,0,0.3);animation:pulse 1.8s ease infinite;"></div></div>';

    if (trackMyMarker) {
      trackMyMarker.setLatLng([trackMyLat, trackMyLng]);
    } else {
      trackMyMarker = L.marker([trackMyLat, trackMyLng], {
        icon: L.divIcon({ className: '', html: blueDotHtml, iconSize: [22, 22], iconAnchor: [11, 11] }),
        zIndexOffset: 1000
      }).addTo(trackingMap).bindPopup('📍 You are here');
    }

    if (trackMyAccuracy != null) {
      if (trackMyAccCircle) {
        trackMyAccCircle.setLatLng([trackMyLat, trackMyLng]);
        trackMyAccCircle.setRadius(trackMyAccuracy);
      } else {
        trackMyAccCircle = L.circle([trackMyLat, trackMyLng], {
          radius: trackMyAccuracy,
          color: '#4285F4',
          fillColor: '#4285F4',
          fillOpacity: 0.1,
          weight: 1,
          opacity: 0.3
        }).addTo(trackingMap);
      }
    }

    const allBounds = [[trackMyLat, trackMyLng]];
    if (trackTechLat && trackTechLng) allBounds.push([trackTechLat, trackTechLng]);
    if (trackCustLat && trackCustLng) allBounds.push([trackCustLat, trackCustLng]);
    if (allBounds.length > 1) {
      trackingMap.fitBounds(allBounds, { padding: [40, 40], maxZoom: 15 });
    } else {
      trackingMap.setView([trackMyLat, trackMyLng], 14);
    }
  }

ENDOFFUNCTIONS

# 2. Insert functions before line 2038 (updateDistanceAndEta)
# Using sed with r (read) command
sed -i '2037r /tmp/track_fns.js' index.html

# 3. Update updateDistanceAndEta to use live GPS when available
sed -i 's/function updateDistanceAndEta() {/function updateDistanceAndEta() {\n    \/\/ Use live GPS position when available\n    const custLat = trackMyLat || trackCustLat;\n    const custLng = trackMyLng || trackCustLng;\n    if (!trackTechLat || !trackTechLng || !custLat || !custLng) return;\n    const d = parseFloat(calcDistance(trackTechLat, trackTechLng, custLat, custLng));/' index.html

# 4. Update startTracking to clean up GPS watch
sed -i 's/    if (trackUnsubOrder) trackUnsubOrder();/    if (trackUnsubOrder) trackUnsubOrder();\n    \/\/ Clean up live GPS\n    if (trackMyWatchId != null) { navigator.geolocation.clearWatch(trackMyWatchId); trackMyWatchId = null; }\n    trackMyActive = false; trackMyLat = null; trackMyLng = null;\n    const myLocBtn = document.getElementById("trackMyLocBtn");\n    if (myLocBtn) { myLocBtn.classList.remove("active"); myLocBtn.innerHTML = '\''<span class="dot-pulse" id="trackMyLocDot"></span> 📍 Show My Location'\''; }\n    if (trackMyMarker && trackingMap) { trackingMap.removeLayer(trackMyMarker); trackMyMarker = null; }\n    if (trackMyAccCircle && trackingMap) { trackingMap.removeLayer(trackMyAccCircle); trackMyAccCircle = null; }/' index.html

# 5. Update hideOverlay to clean up GPS watch
sed -i 's/function hideOverlay() {/function hideOverlay() {\n    \/\/ Stop live GPS tracking\n    if (trackMyWatchId != null) { navigator.geolocation.clearWatch(trackMyWatchId); trackMyWatchId = null; }\n    trackMyActive = false;/' index.html

echo "✅ All tracking JS updates applied"
