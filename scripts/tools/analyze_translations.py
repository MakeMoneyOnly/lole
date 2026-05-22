import re

with open('src/lib/i18n/translations.ts', 'r', encoding='utf-8') as f:
    content = f.read()

def find_matching_brace(text, start_pos):
    brace_count = 0
    in_string = False
    string_char = ''
    
    i = start_pos
    while i < len(text):
        c = text[i]
        if not in_string:
            if c in '"\'':
                in_string = True
                string_char = c
            elif c == '{':
                brace_count += 1
            elif c == '}':
                brace_count -= 1
                if brace_count == 0:
                    return i
        else:
            if c == string_char:
                in_string = False
        i += 1
    return -1

def extract_keys(text):
    keys = []
    lines = text.split('\n')
    path = []
    
    for line in lines:
        t = line.strip()
        if not t or t.startswith('//') or t in ('...', '{', '}'):
            continue
        for _ in range(t.count('}')):
            if path:
                path.pop()
        m = re.match(r"^([a-zA-Z_][a-zA-Z0-9_]*):\s*['\"](?:[^'\"\\n]|\.)*['\"]", t)
        if m:
            keys.append('.'.join(path + [m.group(1)]))
        om = re.match(r"^([a-zA-Z_][a-zA-Z0-9_]*):\s*\{", t)
        if om:
            path.append(om.group(1))
    return keys

# Extract commonTranslations
cs = content.find('const commonTranslations = {')
ce = content.find('// ============================================\n// ENGLISH TRANSLATIONS', cs)
common_keys = extract_keys(content[cs:ce])

# Extract enTranslations
es = content.find('const enTranslations = {')
am_pos = content.find('const amTranslations', es)
en_keys = extract_keys(content[es:am_pos])

# Extract amTranslations
am_open = content.find('{', am_pos)
am_close = find_matching_brace(content, am_open)
am_keys = extract_keys(content[am_pos:am_close + 1])

# Total English (common + en, no duplicates)
all_en_keys = list(set(common_keys + en_keys))

print('=== TRANSLATION COVERAGE ANALYSIS ===')
print('commonTranslations keys:', len(common_keys))
print('enTranslations (own) keys:', len(en_keys))
print('Total unique English keys:', len(all_en_keys))
print()
print('amTranslations keys:', len(am_keys))
print()
coverage = (len(am_keys) / len(all_en_keys) * 100) if all_en_keys else 0
print('Coverage:', round(coverage, 2), '%')
print()

missing = sorted([k for k in all_en_keys if k not in am_keys])
print('Missing Amharic keys (' + str(len(missing)) + '):')
for k in missing:
    print('  -', k)
