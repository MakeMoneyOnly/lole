import re

with open('src/app/(terminal)/terminal/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Backgrounds
content = content.replace('bg-stone-950', 'bg-slate-50')
content = content.replace('bg-white/5', 'bg-white shadow-sm')
content = content.replace('bg-white/10', 'bg-gray-100')
content = content.replace('bg-black/25', 'bg-slate-50')
content = content.replace('bg-black/20', 'bg-slate-50')
content = content.replace('bg-stone-900', 'bg-white')

# Emerald/green states
content = content.replace('border-emerald-400/40', 'border-green-500 outline outline-1 outline-green-500')
content = content.replace('bg-emerald-500/15', 'bg-green-50 text-green-900')
content = content.replace('text-emerald-300', 'text-green-600')
content = content.replace('text-emerald-400', 'text-green-600')
content = content.replace('bg-emerald-400', 'bg-green-600')

# Text colors
content = content.replace('text-white/40', 'text-gray-400')
content = content.replace('text-white/50', 'text-gray-500')
content = content.replace('text-white/60', 'text-gray-500')
content = content.replace('text-white/70', 'text-gray-600')
content = re.sub(r'\btext-white\b', 'text-gray-900', content)

# Buttons that were bg-white text-stone-950 (now white text on dark for primary action)
content = content.replace('bg-white text-stone-950', 'bg-gray-900 text-white hover:bg-gray-800')

# Borders
content = content.replace('border-white/10', 'border-gray-200')

# Hover states
content = content.replace('hover:bg-white/10', 'hover:bg-gray-50')
content = content.replace('hover:bg-white/5', 'hover:bg-gray-50')

# Re-fix any text-gray-900 on primary buttons we just messed up
content = content.replace('bg-gray-900 text-gray-900', 'bg-gray-900 text-white')

# Specific fixes
content = content.replace('border-dashed border-gray-200', 'border-dashed border-gray-300 text-gray-500')
content = content.replace('hover:bg-gray-100/10', 'hover:bg-gray-100') # in case of double replace

with open('src/app/(terminal)/terminal/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)
