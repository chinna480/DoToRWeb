import sys

with open('website/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

# Technician marker
content = content.replace(
    "}).addTo(trackingMap).bindPopup('\U0001f6f5 Technician');",
    "}).addTo(trackingMap).bindTooltip('\U0001f6f5 Technician', {permanent:true, direction:'top', className:'track-label'}).bindPopup('\U0001f6f5 Technician');"
)

# Customer location marker
content = content.replace(
    "}).addTo(trackingMap).bindPopup('\U0001f3e0 Your Location');",
    "}).addTo(trackingMap).bindTooltip('\U0001f3e0 Your Location', {permanent:true, direction:'top', className:'track-label'}).bindPopup('\U0001f3e0 Your Location');"
)

# Live GPS marker (already has bindTooltip but check)
if "bindTooltip('\U0001f4cd You are here'" not in content:
    print("WARNING: Live GPS marker bindTooltip not found!")

with open('website/index.html', 'w', encoding='utf-8') as f:
    f.write(content)

print("Done - tooltips added")
