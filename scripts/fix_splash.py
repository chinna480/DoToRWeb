import os
os.chdir(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

path = 'website/index.html'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# The broken line has:
# mlb.innerHTML = "<span class="dot-pulse"></span> 📍 Show My Location";
# The inner quotes around "dot-pulse" are unescaped, breaking the string

# Fix: replace the inner double quotes with escaped ones
old_broken = 'mlb.innerHTML = "<span class="dot-pulse"></span> 📍 Show My Location"'
new_fixed = "mlb.innerHTML = '<span class=\\\"dot-pulse\\\"></span> 📍 Show My Location'"

if old_broken in content:
    content = content.replace(old_broken, new_fixed)
    print("Fixed broken string!")
else:
    print("Pattern not found - checking alternatives...")
    # Try to find any line with mlb.innerHTML
    for i, line in enumerate(content.split('\n')):
        if 'mlb.innerHTML' in line and 'dot-pulse' in line:
            print(f"Found at line {i+1}: {repr(line.strip())}")

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print("Done")
