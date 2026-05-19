import fs from 'fs';
import path from 'path';

function findTsFiles(dir, files = []) {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
        if (entry.name === 'node_modules') continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            findTsFiles(fullPath, files);
        } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
            files.push(fullPath);
        }
    }
    return files;
}

const files = findTsFiles('./src');
for (const file of files) {
    let content = fs.readFileSync(file, 'utf8');
    const original = content;
    
    // Fix: "Type | void :Type | void" -> "Type" (the duplicated type annotation)
    // This handles patterns like "React.JSX.Element | void :React.JSX.Element | void"
    content = content.replace(/ \| void :[A-Za-z<>\[\]]*? \| void/g, '');
    
    // Fix: "): Type ({ " -> "({ " (duplicate return type syntax)
    content = content.replace(/: [A-Za-z<>\[\]]+\(\{/g, ' {');
    
if (content !== original) {
         fs.writeFileSync(file, content);
         // eslint-disable-next-line no-console
         console.log('Fixed:', file);
     }
}
// eslint-disable-next-line no-console
console.log('Done. Processed', files.length, 'files');