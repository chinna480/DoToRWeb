/**
 * Clean unused CSS from styles.css files
 * 
 * Usage: node scripts/clean-unused-css.js <project-dir> <css-file>
 * Example: node scripts/clean-unused-css.js website website/styles.css
 */

const fs = require('fs');
const path = require('path');

// ── 1. Get all used class names from HTML files ───────────────────
function getUsedClasses(dir) {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.html'));
  const allContent = files.map(f => {
    try { return fs.readFileSync(path.join(dir, f), 'utf8'); }
    catch(e) { return ''; }
  }).join('\n');

  const used = new Set();

  // class="..." attributes
  const classAttrRegex = /class="([^"]*)"/g;
  let m;
  while ((m = classAttrRegex.exec(allContent)) !== null) {
    m[1].split(/\s+/).forEach(c => { if (c.trim()) used.add(c.trim()); });
  }

  // Inline <style> blocks
  const styleRegex = /\.([a-zA-Z_][a-zA-Z0-9_-]*)/g;
  while ((m = styleRegex.exec(allContent)) !== null) {
    const s = m[1];
    if (!/^\d/.test(s) && s !== 'css') used.add(s);
  }

  // classList.add('...')
  const clAddRegex = /classList\.add\(['"]([^'"]+)['"]\)/g;
  while ((m = clAddRegex.exec(allContent)) !== null) {
    m[1].split(/\s+/).forEach(c => { if (c.trim()) used.add(c.trim()); });
  }

  // className = `...` and className = '...'
  const cnTLRegex = /className\s*=\s*`([^`]*)`/g;
  while ((m = cnTLRegex.exec(allContent)) !== null) {
    const parts = m[1].replace(/\$\{[^}]+\}/g, ' ');
    parts.split(/\s+/).forEach(c => { if (c.trim()) used.add(c.trim()); });
  }
  const cnStrRegex = /className\s*=\s*'([^']*)'/g;
  while ((m = cnStrRegex.exec(allContent)) !== null) {
    m[1].split(/\s+/).forEach(c => { if (c.trim()) used.add(c.trim()); });
  }

  // Template literals (catches `toast ${type}` etc.)
  const tlRegex = /`([^`]*)`/g;
  while ((m = tlRegex.exec(allContent)) !== null) {
    const parts = m[1].replace(/\$\{[^}]+\}/g, ' ');
    parts.split(/\s+/).forEach(c => {
      if (c.trim() && !c.startsWith('$')) used.add(c.trim());
    });
  }

  return used;
}

// ── 2. Parse CSS into blocks ──────────────────────────────────────
function parseCSSBlocks(css) {
  const blocks = [];
  let i = 0;
  
  while (i < css.length) {
    // Skip whitespace and comments
    const beforeWS = i;
    while (i < css.length && (css[i] === ' ' || css[i] === '\n' || css[i] === '\t' || css[i] === '\r')) i++;
    
    // Skip comments /* ... */
    if (css[i] === '/' && css[i+1] === '*') {
      const end = css.indexOf('*/', i + 2);
      if (end !== -1) {
        blocks.push({ type: 'comment', content: css.slice(i, end + 2), start: i, end: end + 2 });
        i = end + 2;
        continue;
      }
    }
    
    if (i >= css.length) break;
    
    // Check if this is a media query / keyframes / at-rule
    if (css[i] === '@') {
      const braceStart = css.indexOf('{', i);
      if (braceStart === -1) { i++; continue; }
      
      // Find matching closing brace
      let depth = 1;
      let braceEnd = braceStart + 1;
      while (depth > 0 && braceEnd < css.length) {
        if (css[braceEnd] === '{') depth++;
        else if (css[braceEnd] === '}') depth--;
        braceEnd++;
      }
      
      const header = css.slice(i, braceStart).trim();
      const innerContent = css.slice(braceStart + 1, braceEnd - 1);
      
      // Parse inner blocks for media queries
      if (header.startsWith('@media')) {
        const innerBlocks = parseCSSBlocks(innerContent);
        blocks.push({
          type: 'media',
          header,
          innerBlocks,
          content: css.slice(i, braceEnd),
          start: i,
          end: braceEnd
        });
      } else {
        // Other at-rules (keyframes, etc.) - keep as-is
        blocks.push({
          type: 'atrule',
          header,
          content: css.slice(i, braceEnd),
          start: i,
          end: braceEnd
        });
      }
      
      i = braceEnd;
      continue;
    }
    
    // Regular CSS rule: selectors { declarations }
    const braceStart = css.indexOf('{', i);
    if (braceStart === -1) { i++; continue; }
    
    let depth = 1;
    let braceEnd = braceStart + 1;
    while (depth > 0 && braceEnd < css.length) {
      if (css[braceEnd] === '{') depth++;
      else if (css[braceEnd] === '}') depth--;
      braceEnd++;
    }
    
    const selector = css.slice(i, braceStart).trim();
    const declarations = css.slice(braceStart + 1, braceEnd - 1).trim();
    
    blocks.push({
      type: 'rule',
      selector,
      declarations,
      content: css.slice(i, braceEnd),
      start: i,
      end: braceEnd
    });
    
    i = braceEnd;
  }
  
  return blocks;
}

// ── 3. Extract class names from a selector string ─────────────────
function extractClasses(selector) {
  const classes = new Set();
  const regex = /\.([a-zA-Z_][a-zA-Z0-9_-]*)/g;
  let m;
  while ((m = regex.exec(selector)) !== null) {
    const cls = m[1];
    if (!/^\d/.test(cls) && cls !== 'css') classes.add(cls);
  }
  return classes;
}

// ── 4. Check if a block should be kept ────────────────────────────
function shouldKeep(block, usedClasses) {
  if (block.type === 'comment') return false; // remove standalone comments
  if (block.type === 'atrule') {
    // Keep keyframes (referenced by animation names, not class selectors)
    if (block.header.startsWith('@keyframes') || block.header.startsWith('@font-face')) return true;
    return true; // Keep other at-rules to be safe
  }
  if (block.type === 'media') {
    // Check inner blocks
    const keptInner = block.innerBlocks.filter(b => shouldKeep(b, usedClasses));
    return keptInner.length > 0;
  }
  if (block.type === 'rule') {
    // Skip keyframe selectors like "from", "to", "0%", "100%"
    if (/^(from|to|\d+%)$/.test(block.selector.trim())) return true;
    
    const classes = extractClasses(block.selector);
    // If selector has no classes (e.g., element selector like "body", "h1"), keep it
    if (classes.size === 0) return true;
    // If ANY class in the selector is used, keep the rule
    for (const cls of classes) {
      if (usedClasses.has(cls)) return true;
    }
    return false;
  }
  return true;
}

// ── 5. Generate cleaned CSS ───────────────────────────────────────
function generateCleanCSS(blocks, usedClasses) {
  let result = '';
  
  for (const block of blocks) {
    if (block.type === 'comment') continue;
    
    if (block.type === 'media') {
      const keptInner = block.innerBlocks.filter(b => shouldKeep(b, usedClasses));
      if (keptInner.length === 0) continue;
      
      result += block.header + ' {\n';
      for (const inner of keptInner) {
        if (inner.type === 'rule' && !inner.declarations.includes('/* removed by cleaner */')) {
          result += '  ' + inner.selector + ' {\n';
          result += '    ' + inner.declarations + '\n';
          result += '  }\n\n';
        }
      }
      result = result.replace(/\n+$/, '') + '\n}\n\n';
      continue;
    }
    
    if (block.type === 'atrule') {
      result += block.content + '\n\n';
      continue;
    }
    
    if (block.type === 'rule' && shouldKeep(block, usedClasses)) {
      result += block.selector + ' {\n';
      result += '  ' + block.declarations + '\n';
      result += '}\n\n';
    }
  }
  
  return result.trim() + '\n';
}

// ── Main ──────────────────────────────────────────────────────────
function cleanCSS(projectDir, cssFile) {
  console.log(`\nCleaning ${cssFile} based on HTML files in ${projectDir}/`);

  const css = fs.readFileSync(cssFile, 'utf8');
  const usedClasses = getUsedClasses(projectDir);
  const blocks = parseCSSBlocks(css);
  
  const keptRules = blocks.filter(b => shouldKeep(b, usedClasses));
  const removedCount = blocks.filter(b => b.type === 'rule' && !shouldKeep(b, usedClasses)).length;
  
  const cleanCSS = generateCleanCSS(blocks, usedClasses);
  fs.writeFileSync(cssFile, cleanCSS, 'utf8');
  
  console.log(`  Removed ${removedCount} unused CSS rules`);
  console.log(`  Kept ${keptRules.length} rules`);
  console.log(`  File saved to ${cssFile}`);
  
  return removedCount;
}

// Run
const projectDir = process.argv[2];
const cssFile = process.argv[3];

if (!projectDir || !cssFile) {
  console.error('Usage: node scripts/clean-unused-css.js <project-dir> <css-file>');
  process.exit(1);
}

cleanCSS(projectDir, cssFile);
