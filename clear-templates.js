import fs from 'fs';
import path from 'path';

const base = path.join(process.cwd(), 'src/app/(dashboard)/merchant');

const dirs = [
    'reports',
    'foh',
    'boh',
    'takeout',
    'team',
    'marketing',
    'integrations',
    'setup',
    'guests',
    'menu',
];

dirs.forEach(d => {
    const dirPath = path.join(base, d);
    const filePath = path.join(dirPath, 'page.tsx');
    if (fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, `export default function Page() {\n  return null;\n}\n`);
    }
});
// eslint-disable-next-line no-console
console.log('Cleared terrible templates');
