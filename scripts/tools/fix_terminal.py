import re

with open('src/app/(terminal)/terminal/page.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all uppercase classes with nothing
content = re.sub(r'\buppercase\b\s*', '', content)

# Replace all uppercase strings inside standard HTML text with normal case or lowercase
# The prompt says: "remove all the fonts that are all 'CAPITAL LETTERS'". Usually in React we just remove uppercase class or change text.
# Here's regex for font-black -> font-bold
content = re.sub(r'\bfont-black\b', 'font-bold', content)

# tracking-[0.18em] and tracking-[0.12em] -> remove or tracking-tight
content = re.sub(r'\btracking-\[0\.\d+em\]\b\s*', '', content)

# Make "Front Counter" and similar use standard text cases, handled by removing uppercase class mostly.
# Let's adjust sizes according to Font.md
# H1 eq (2xl -> 4xl/5xl)
content = re.sub(r'text-2xl(\s+)font-bold', r'text-3xl md:text-4xl\1font-bold tracking-tight', content)
# H2 eq (xl -> 2xl/3xl)
# text-sm -> text-[15px]
# text-xs -> text-[13px]
# text-lg -> text-xl
content = re.sub(r'\btext-xs\b', 'text-[13px]', content)
content = re.sub(r'\btext-sm\b', 'text-[15px]', content)
content = re.sub(r'\btext-base\b', 'text-[17px]', content)
content = re.sub(r'\btext-lg\b', 'text-xl', content)
content = re.sub(r'\btext-3xl\b', 'text-4xl md:text-5xl tracking-tight', content)

# Some specific elements that had tracking uppercase
# Replace tracking-tight tracking-tight with single
content = re.sub(r'(tracking-tight\s+)+', 'tracking-tight ', content)

# Write back
with open('src/app/(terminal)/terminal/page.tsx', 'w', encoding='utf-8') as f:
    f.write(content)

