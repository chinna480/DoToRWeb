// Fix submitOrder function: once order is in Firebase, always show success
// Post-order ops (notifications, AsyncStorage) failures logged but not shown to user

const fs = require('fs');
const path = 'C:/Users/chinn/Desktop/DoToRApp/app/screens/HomeScreen.js';

let content = fs.readFileSync(path, 'utf8');

// Find the function
const funcStart = content.indexOf('const submitOrder = async () => {');
if (funcStart === -1) {
  console.error('ERROR: submitOrder function not found');
  process.exit(1);
}

// Find matching closing brace
let braceCount = 0;
let funcEnd = funcStart;
for (let i = funcStart; i < content.length; i++) {
  if (content[i] === '{') braceCount++;
  else if (content[i] === '}') {
    braceCount--;
    if (braceCount === 0) { funcEnd = i + 1; break; }
  }
}

const oldFunc = content.substring(funcStart, funcEnd);
console.log('Found function: ' + oldFunc.length + ' chars');

const newFunc = [
  '  const submitOrder = async () => {',
  '    const svc = SERVICE_CATEGORIES.find(s => s.key === selectedDevice)',
  '    const deviceFlow = svc ? svc.hasDeviceFlow : false',
  '',
  "    if (!selectedDevice || !issueDesc.trim()) {",
  "      Alert.alert('Missing info', 'Please select a service and describe the issue.')",
  '      return',
  '    }',
  "    if (deviceFlow && (!selectedBrand || !modelName.trim())) {",
  "      Alert.alert('Missing info', 'Please fill in brand, model, and issue.')",
  '      return',
  '    }',
  "    if (!locationInput.trim()) {",
  "      Alert.alert('Missing location', 'Please enter your location.')",
  '      return',
  '    }',
  '    setIsSubmitting(true)',
  '    let orderId = null',
  '    let orderSaved = false',
  '    try {',
  "      const name              = custName || 'Customer'",
  "      const phone             = custPhone || ''",
  "      const customerPushToken = await AsyncStorage.getItem('pushToken') || ''",
  '',
  "      const tempOrderId = Date.now().toString()",
  '      let imageUrls = null',
  '      if (deviceImages.length > 0) {',
  "        imageUrls = await uploadImages(deviceImages.map(uri => ({ uri })), tempOrderId)",
  '      }',
  '      let videoUrls = null',
  '      if (deviceVideos.length > 0) {',
  "        videoUrls = await uploadVideos(deviceVideos.map(uri => ({ uri })), tempOrderId)",
  '      }',
  '',
  "      const svcCat = SERVICE_CATEGORIES.find(s => s.key === selectedDevice)",
  '      const order = {',
  '        customerName:       name,',
  '        customerPhone:      phone,',
  '        customerPushToken,',
  "        location:           locationInput.trim(),",
  "        pincode:            pincodeInput.trim(),",
  '        serviceCategory:    selectedDevice,',
  "        serviceLabel:       svcCat?.label || selectedDevice,",
  '        device:             svcCat?.hasDeviceFlow ? selectedDevice : null,',
  '        brand:              svcCat?.hasDeviceFlow ? selectedBrand : null,',
  '        modelName:          svcCat?.hasDeviceFlow ? modelName.trim() : null,',
  '        description:        issueDesc.trim(),',
  '        images:             imageUrls || null,',
  '        videos:             videoUrls || null,',
  "        status:             'pending',",
  "        time:               new Date().toLocaleTimeString(),",
  '        createdAt:          Date.now(),',
  '      }',
  '      if (custLat != null && custLng != null) {',
  '        order.custLat = custLat',
  '        order.custLng = custLng',
  '      }',
  '',
  "      // Save order to Firebase (critical path)",
  "      const newOrderRef = await push(ref(db, 'orders'), order)",
  '      orderId = newOrderRef.key',
  '      orderSaved = true',
  '',
  "      // Post-order: AsyncStorage + notifications (log failures, don't show error)",
  '      try {',
  "        await AsyncStorage.setItem('lastOrderId', orderId)",
  "        await AsyncStorage.setItem('lastBrand', selectedBrand)",
  "        await AsyncStorage.setItem('lastModelName', modelName.trim())",
  "        await AsyncStorage.setItem('lastDescription', issueDesc.trim())",
  "        await AsyncStorage.setItem('lastCustName', name)",
  "        if (pincodeInput) await AsyncStorage.setItem('custPincode', pincodeInput.trim())",
  "        if (locationInput) await AsyncStorage.setItem('custLocation', locationInput.trim())",
  '',
  '        await notifyCustomerBookingConfirmed(svcCat?.label || selectedBrand, modelName.trim() || issueDesc.trim())',
  '        await notifyTechsForNewOrder(order, orderId)',
  '      } catch (postErr) {',
  "        console.error('Post-order ops failed (order saved):', postErr?.message || postErr)",
  '      }',
  '',
  '      resetWizard()',
  '',
  "      Alert.alert(",
  "        '\\u2705 Booking Confirmed!',",
  "        (svcCat?.label || 'Service') + ': ' + (selectedBrand ? selectedBrand + ' ' : '') + (modelName || issueDesc) + '\\n\\nTrack your technician?',",
  '        [',
  "          { text: 'Track Now', onPress: () => router.push('/screens/TrackingScreen') },",
  "          { text: '\\u{1F4AC} Chat', onPress: () => router.push('/screens/ChatScreen?orderId=' + orderId + '&role=cust&customerName=' + encodeURIComponent(name) + '&techName=') },",
  "          { text: 'Later' }",
  '        ]',
  '      )',
  '    } catch (e) {',
  '      if (orderSaved) {',
  "        console.error('Order saved but success display failed:', e?.message || e)",
  '        Alert.alert(',
  "          '\\u2705 Booking Confirmed!',",
  "          'Your order was created successfully. You can view it in My Orders.'",
  '        )',
  '      } else {',
  "        console.error('Booking error:', e?.message || e)",
  "        Alert.alert('Error', 'Booking failed! Try again.')",
  '      }',
  '    } finally {',
  '      setIsSubmitting(false)',
  '    }',
  '  }',
].join('\n');

content = content.substring(0, funcStart) + newFunc + content.substring(funcEnd);
fs.writeFileSync(path, content, 'utf8');
console.log('SUCCESS: submitOrder function replaced!');
console.log('Old: ' + oldFunc.length + ' chars -> New: ' + newFunc.length + ' chars');
