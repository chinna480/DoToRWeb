#!/usr/bin/env python3
import os

# Change to project root
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

path = 'website/index.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Tech marker
tech_old = "}).addTo(trackingMap).bindPopup('\U0001f6f5 Technician');"
tech_new = "}).addTo(trackingMap).bindTooltip('\U0001f6f5 Technician', {permanent:true, direction:'top', className:'track-label'}).bindPopup('\U0001f6f5 Technician');"

if tech_old in content:
    content = content.replace(tech_old, tech_new)
    print("Tech marker tooltip added")
else:
    print("Tech marker pattern NOT FOUND")

# Customer location marker
cust_old = "}).addTo(trackingMap).bindPopup('\U0001f3e0 Your Location');"
cust_new = "}).addTo(trackingMap).bindTooltip('\U0001f3e0 Your Location', {permanent:true, direction:'top', className:'track-label'}).bindPopup('\U0001f3e0 Your Location');"

if cust_old in content:
    content = content.replace(cust_old, cust_new)
    print("Cust marker tooltip added")
else:
    print("Cust marker pattern NOT FOUND")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
