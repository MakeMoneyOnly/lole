#!/usr/bin/env python
import re

with open('docs/reference/api-spec.yaml', 'r') as f:
    content = f.read()

lines = content.split('\n')
output_lines = []

i = 0
while i < len(lines):
    line = lines[i]
    stripped = line.lstrip()
    
    # Track if we're in components/schemas
    if stripped == 'schemas:':
        # Find the indentation of schemas: and add it
        indent = len(line) - len(stripped)
        output_lines.append(line)
        i += 1
        
        # Now process all schema definitions until next section
        while i < len(lines):
            s = lines[i]
            s_stripped = s.lstrip()
            
            # Check if we've reached another top-level key or paths
            if s_stripped and not s_stripped.startswith('#'):
                if s[0] not in ' \t' and s_stripped.endswith(':'):
                    break
            
            # Check if this is a schema name (no leading dash, has colon, not a property)
            if s_stripped and not s_stripped.startswith('#') and ':' in s_stripped:
                # Count current indentation
                curr_indent = len(s) - len(s_stripped)
                
                # If it has 6+ spaces, it's likely a mis-indented schema name
                if curr_indent >= 6:
                    output_lines.append('  ' + s_stripped)
                elif curr_indent == 0 and s_stripped[0].isupper():
                    # Schema name with no indent
                    output_lines.append('  ' + s_stripped)
                elif curr_indent == 4 and s_stripped[0] == '#':
                    # Comment with 4 spaces
                    output_lines.append('  ' + s_stripped)
                else:
                    output_lines.append(s)
            else:
                output_lines.append(s)
            i += 1
        continue
    
    # Handle paths section
    elif stripped == 'paths:':
        output_lines.append(line)
        i += 1
        
        while i < len(lines):
            s = lines[i]
            s_stripped = s.lstrip()
            
            # Check if we've reached end of file or another major section
            if s_stripped and s[0] not in ' \t' and s_stripped.endswith(':'):
                break
            
            # Path definition starts with / - should have 2 spaces
            if s_stripped.startswith('/'):
                curr_indent = len(s) - len(s_stripped)
                # Fix to 2-space indent
                output_lines.append('  ' + s_stripped)
            # Category comment like "# Guest Portal Endpoints"
            elif s_stripped.startswith('#') and not s.startswith('  '):
                output_lines.append('  ' + s_stripped)
            else:
                output_lines.append(s)
            i += 1
        continue
    
    output_lines.append(line)
    i += 1

with open('docs/reference/api-spec.yaml', 'w') as f:
    f.write('\n'.join(output_lines))

print("Fixed!")