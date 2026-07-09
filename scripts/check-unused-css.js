const fs = require('fs');
const path = require('path');

function getCSSSelectors(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  const classSelectorRegex = /\.([a-zA-Z_][a-zA-Z0-9_-]*)/g;
  const selectors = new Set();
  let match;
  while ((match = classSelectorRegex.exec(content)) !== null) {
    const sel = match[1];
    if (!/^\d/.test(sel) && sel !== 'css') {
      selectors.add(sel);
    }
  }
  return [...selectors].sort();
}

function getHTMLClasses(dir) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
  const allContent = files.map(f => {
    try {
      return fs.readFileSync(path.join(dir, f), 'utf8');
    } catch(e) { return ''; }
  }).join('\n');

  const usedClasses = new Set();

  // Extract from class="..." attributes
  const classAttrRegex = /class="([^"]*)"/g;
  let match;
  while ((match = classAttrRegex.exec(allContent)) !== null) {
    match[1].split(/\s+/).forEach(c => {
      if (c.trim()) usedClasses.add(c.trim());
    });
  }

  // Extract from inline <style> blocks
  const inlineStyleRegex = /\.([a-zA-Z_][a-zA-Z0-9_-]*)/g;
  while ((match = inlineStyleRegex.exec(allContent)) !== null) {
    const sel = match[1];
    if (!/^\d/.test(sel) && sel !== 'css') {
      usedClasses.add(sel);
    }
  }

  // Extract native JS classList.add calls
  const classListAddRegex = /classList\.add\(['"]([^'"]+)['"]\)/g;
  while ((match = classListAddRegex.exec(allContent)) !== null) {
    match[1].split(/\s+/).forEach(c => { if (c.trim()) usedClasses.add(c.trim()); });
  }

  // Extract className = `...` template literal assignments
  const classNameTLRegex = /className\s*=\s*`([^`]*)`/g;
  while ((match = classNameTLRegex.exec(allContent)) !== null) {
    // Extract all static class names from template literal (ignore ${...} interpolations)
    const staticParts = match[1].replace(/\$\{[^}]+\}/g, ' ');
    staticParts.split(/\s+/).forEach(c => { if (c.trim()) usedClasses.add(c.trim()); });
  }

  // Extract className = '...' or className = "..." assignments
  const classNameStrRegex = /className\s*=\s*'([^']*)'/g;
  while ((match = classNameStrRegex.exec(allContent)) !== null) {
    match[1].split(/\s+/).forEach(c => { if (c.trim()) usedClasses.add(c.trim()); });
  }

  // Extract all string occurrences in template literals that look like class names
  // This catches patterns like: `toast ${type}` where 'toast' is a class
  const templateLiteralRegex = /`([^`]*)`/g;
  while ((match = templateLiteralRegex.exec(allContent)) !== null) {
    const staticParts = match[1].replace(/\$\{[^}]+\}/g, ' ');
    staticParts.split(/\s+/).forEach(c => {
      if (c.trim() && !c.startsWith('$') && !c.startsWith('{') && c !== 'template') {
        usedClasses.add(c.trim());
      }
    });
  }

  // Also check for class names in onclick handlers and other event handlers
  // e.g. `btn btn-outline btn-sm`
  const allQuotedStrings = /['"`]([^'"`]*)['"`]/g;
  while ((match = allQuotedStrings.exec(allContent)) !== null) {
    // Only look for class-like patterns (short strings that look like CSS classes)
    const val = match[1];
    if (val.split(/\s+/).every(c => /^[a-zA-Z_-][a-zA-Z0-9_-]*$/.test(c)) && 
        val.length < 100 && val.length > 2) {
      val.split(/\s+/).forEach(c => { 
        if (c.trim() && /^[a-zA-Z_-]/.test(c)) usedClasses.add(c.trim()); 
      });
    }
  }

  return usedClasses;
}

function analyze(projectDir, cssFile) {
  const selectors = getCSSSelectors(cssFile);
  const usedClasses = getHTMLClasses(projectDir);
  
  console.log(`\n=== ${projectDir.toUpperCase()} ===`);
  console.log(`Stylesheet: ${cssFile}`);
  console.log(`Total selectors in CSS: ${selectors.length}`);
  console.log(`Classes used across ${projectDir} HTML files: ${usedClasses.size}`);
  
  const unused = selectors.filter(s => !usedClasses.has(s));
  
  if (unused.length === 0) {
    console.log('\n✓ No unused CSS selectors found!');
    return [];
  }
  
  console.log(`\nUnused CSS selectors (${unused.length}):`);
  unused.forEach(s => console.log(`  .${s}`));
  return unused;
}

const websiteUnused = analyze('website', 'website/styles.css');
const adminUnused = analyze('admin', 'admin/styles.css');

console.log('\n──────────────────────────────────────');
console.log('\nSUMMARY:');
console.log(`  website/styles.css: ${websiteUnused.length} potentially unused selectors`);
console.log(`  admin/styles.css:   ${adminUnused.length} potentially unused selectors`);

if (websiteUnused.length > 0) {
  console.log('\nNote: Some selectors may be intentionally reserved for future use');
  console.log('or used in ways the scanner cannot detect (e.g., dynamically constructed class names).');
}
