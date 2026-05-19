import fs from 'fs';
import path from 'path';

const base = path.join(process.cwd(), 'src/app/(dashboard)/merchant');

const dirsToCreate = [
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

const dirsToRemove = ['analytics', 'channels', 'tables', 'staff', 'settings', 'orders'];

const template = name => `import React from 'react';

export default function ${name.replace(/[^a-zA-Z0-9]/g, '')}Page() {
  return (
    <div className="flex h-full w-full flex-col gap-6 p-2">
      {/* Dashboard Top Header area */}
      <header className="flex w-full items-center justify-between rounded-xl bg-white p-4 shadow-sm ring-1 ring-gray-100">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold tracking-tight text-gray-900">${name}</h1>
          <span className="text-sm text-gray-500">Track and manage your ${name.toLowerCase()} operations</span>
        </div>
        <div className="flex items-center gap-3">
          <button className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 focus:ring-2 focus:ring-gray-200 disabled:opacity-50">
            Filters
          </button>
          <button className="rounded-lg bg-black px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:bg-gray-800 focus:ring-2 focus:ring-gray-200 focus:ring-offset-1">
            + Add Widget
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="col-span-1 lg:col-span-2 rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)]">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">${name} Overview</h2>
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50">
            </div>
        </div>
        <div className="col-span-1 rounded-2xl border border-gray-100 bg-white p-6 shadow-[0_2px_8px_-4px_rgba(0,0,0,0.05)]">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h2>
            <div className="flex h-64 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50/50">
            </div>
        </div>
      </div>
    </div>
  );
}
`;

// Create new routes and overwrite existing ones with clean slate
dirsToCreate.forEach(d => {
    const dirPath = path.join(base, d);
    if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true });

    let rawName = d;
    if (d === 'foh') rawName = 'Front of House';
    if (d === 'boh') rawName = 'Back of House';
    if (d === 'takeout') rawName = 'Takeout & Delivery';
    const name = rawName.charAt(0).toUpperCase() + rawName.slice(1);

    fs.writeFileSync(path.join(dirPath, 'page.tsx'), template(name));
});

// Overwrite the root dashboard page content too for clean slate
fs.writeFileSync(path.join(base, 'page.tsx'), template('Dashboard'));

// Try to remove old unused directories
dirsToRemove.forEach(d => {
    const dirPath = path.join(base, d);
if (fs.existsSync(dirPath)) {
         try {
             fs.rmSync(dirPath, { recursive: true, force: true });
             // eslint-disable-next-line no-console
             console.log('Removed ' + d);
         } catch (e) {
             // eslint-disable-next-line no-console
             console.log('Could not remove ' + d + ': ' + e.message);
         }
     }
});
// eslint-disable-next-line no-console
console.log('scaffolding done!');
