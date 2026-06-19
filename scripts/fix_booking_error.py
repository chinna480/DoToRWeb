# Fix booking error bug: order saved to Firebase but "Booking failed" shown
# because post-order ops (notifications, AsyncStorage) throw errors.

import sys

path = r'C:\Users\chinn\Desktop\DoToRApp\app\screens\HomeScreen.js'

with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Find the submitOrder function
start = content.find('const submitOrder = async () => {')
if start == -1:
    print('ERROR: submitOrder not found')
    sys.exit(1)

# Find matching closing brace of the function
brace_count = 0
i = start
while i < len(content):
    if content[i] == '{':
        brace_count += 1
    elif content[i] == '}':
        brace_count -= 1
        if brace_count == 0:
            end = i + 1
            break
    i += 1
else:
    print('ERROR: could not find function end')
    sys.exit(1)

old_func = content[start:end]

# Build new function without emoji chars to avoid surrogate issues
CHECK_EMOJI = chr(0x2705)
CHAT_EMOJI = chr(0x1F4AC)

new_func_lines = [
    "  const submitOrder = async () => {",
    "    const svc = SERVICE_CATEGORIES.find(s => s.key === selectedDevice)",
    "    const deviceFlow = svc ? svc.hasDeviceFlow : false",
    "",
    "    if (!selectedDevice || !issueDesc.trim()) {",
    '      Alert.alert("Missing info", "Please select a service and describe the issue.")',
    "      return",
    "    }",
    "    if (deviceFlow && (!selectedBrand || !modelName.trim())) {",
    '      Alert.alert("Missing info", "Please fill in brand, model, and issue.")',
    "      return",
    "    }",
    "    if (!locationInput.trim()) {",
    '      Alert.alert("Missing location", "Please enter your location.")',
    "      return",
    "    }",
    "    setIsSubmitting(true)",
    "    let orderId = null",
    "    let orderSaved = false",
    "    try {",
    "      const name              = custName || 'Customer'",
    "      const phone             = custPhone || ''",
    "      const customerPushToken = await AsyncStorage.getItem('pushToken') || ''",
    "",
    "      const tempOrderId = Date.now().toString()",
    "      let imageUrls = null",
    "      if (deviceImages.length > 0) {",
    "        imageUrls = await uploadImages(deviceImages.map(uri => ({ uri })), tempOrderId)",
    "      }",
    "      let videoUrls = null",
    "      if (deviceVideos.length > 0) {",
    "        videoUrls = await uploadVideos(deviceVideos.map(uri => ({ uri })), tempOrderId)",
    "      }",
    "",
    "      const svcCat = SERVICE_CATEGORIES.find(s => s.key === selectedDevice)",
    "      const order = {",
    "        customerName:       name,",
    "        customerPhone:      phone,",
    "        customerPushToken,",
    "        location:           locationInput.trim(),",
    "        pincode:            pincodeInput.trim(),",
    "        serviceCategory:    selectedDevice,",
    "        serviceLabel:       svcCat?.label || selectedDevice,",
    "        device:             svcCat?.hasDeviceFlow ? selectedDevice : null,",
    "        brand:              svcCat?.hasDeviceFlow ? selectedBrand : null,",
    "        modelName:          svcCat?.hasDeviceFlow ? modelName.trim() : null,",
    "        description:        issueDesc.trim(),",
    "        images:             imageUrls || null,",
    "        videos:             videoUrls || null,",
    "        status:             'pending',",
    "        time:               new Date().toLocaleTimeString(),",
    "        createdAt:          Date.now(),",
    "      }",
    "      if (custLat != null && custLng != null) {",
    "        order.custLat = custLat",
    "        order.custLng = custLng",
    "      }",
    "",
    "      // Save order to Firebase (critical path)",
    "      const newOrderRef = await push(ref(db, 'orders'), order)",
    "      orderId = newOrderRef.key",
    "      orderSaved = true",
    "",
    "      // Post-order: AsyncStorage + notifications (log failures, don't show error)",
    "      try {",
    "        await AsyncStorage.setItem('lastOrderId', orderId)",
    "        await AsyncStorage.setItem('lastBrand', selectedBrand)",
    "        await AsyncStorage.setItem('lastModelName', modelName.trim())",
    "        await AsyncStorage.setItem('lastDescription', issueDesc.trim())",
    "        await AsyncStorage.setItem('lastCustName', name)",
    "        if (pincodeInput) await AsyncStorage.setItem('custPincode', pincodeInput.trim())",
    "        if (locationInput) await AsyncStorage.setItem('custLocation', locationInput.trim())",
    "",
    "        await notifyCustomerBookingConfirmed(svcCat?.label || selectedBrand, modelName.trim() || issueDesc.trim())",
    "        await notifyTechsForNewOrder(order, orderId)",
    "      } catch (postErr) {",
    "        console.error('Post-order ops failed (order saved):', postErr?.message || postErr)",
    "      }",
    "",
    "      resetWizard()",
    "      const checkEmoji = String.fromCodePoint(0x2705)",
    "      Alert.alert(",
    "        checkEmoji + ' Booking Confirmed!',",
    "        (svcCat?.label || 'Service') + ': ' + (selectedBrand ? selectedBrand + ' ' : '') + (modelName || issueDesc) + '\\n\\nTrack your technician?',",
    "        [",
    "          { text: 'Track Now', onPress: () => router.push('/screens/TrackingScreen') },",
    "          { text: String.fromCodePoint(0x1F4AC) + ' Chat', onPress: () => router.push('/screens/ChatScreen?orderId=' + orderId + '&role=cust&customerName=' + encodeURIComponent(name) + '&techName=') },",
    "          { text: 'Later' }",
    "        ]",
    "      )",
    "    } catch (e) {",
    "      if (orderSaved) {",
    "        console.error('Order saved but success display failed:', e?.message || e)",
    "        Alert.alert(",
    "          String.fromCodePoint(0x2705) + ' Booking Confirmed!',",
    "          'Your order was created successfully. You can view it in My Orders.'",
    "        )",
    "      } else {",
    "        console.error('Booking error:', e?.message || e)",
    "        Alert.alert('Error', 'Booking failed! Try again.')",
    "      }",
    "    } finally {",
    "      setIsSubmitting(false)",
    "    }",
    "  }",
]

new_func = '\n'.join(new_func_lines)
content = content[:start] + new_func + content[end:]

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('SUCCESS')
print(f'Old function: {len(old_func)} chars')
print(f'New function: {len(new_func)} chars')
