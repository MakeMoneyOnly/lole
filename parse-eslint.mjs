import fs from 'fs';

const content = fs.readFileSync('eslint-output.txt', 'utf8').replace(/\\/g, '/').replace(/\r/g, '');

// Split by file path pattern
const filePattern = /[A-Z]:\//g;
const parts = content.split(filePattern);

const fileCounts = {};

for (let i = 0; i < parts.length; i++) {
  const part = parts[i];
  
  // Extract file path from the start of the part
  const lines = part.split('\n');
  let filePath = null;
  
  for (let j = 0; j < lines.length; j++) {
    const line = lines[j];
    // Check if this is a path line (starts with Users...)
    if (line.startsWith('Users/user/Desktop/lole/src/app/')) {
      filePath = 'src/app/' + line.split(/\s/)[0].replace('Users/user/Desktop/lole/src/app/', '');
      break;
    }
  }
  
  if (filePath) {
    // Count errors
    const errorStr = '@typescript-eslint/explicit-function-return-type';
    const count = (part.match(new RegExp(errorStr.replace(/\//g, '\\/'), 'g')) || []).length;
    if (count > 0) {
      fileCounts[filePath] = count;
    }
  }
}

// Sort and display top 20
const sorted = Object.entries(fileCounts).sort((a, b) => b[1] - a[1]).slice(0, 20);
// eslint-disable-next-line no-console
console.log('Top 20 App files with most @typescript-eslint/explicit-function-return-type errors:');
// eslint-disable-next-line no-console
sorted.forEach(([file, count]) => console.log(count + ' ' + file));