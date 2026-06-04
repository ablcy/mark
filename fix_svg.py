import re

with open('app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Fix: replace hardcoded stroke="#555" with stroke="currentColor" in getFolderIconSVG
# The function getFolderIconSVG has SVG strings with stroke="#555"
content = content.replace('stroke="#555"', 'stroke="currentColor"')

# Remove getFolderIconSVGDark function (no longer needed, currentColor handles it)
# Find and remove the entire function
dark_func_pattern = r'\nfunction getFolderIconSVGDark\(isOpen, size\) \{[^}]+\}[^}]+\}'
content = re.sub(dark_func_pattern, '', content)

# Also remove the extra closing brace that might be left
# Actually, let me be more precise - just remove the function entirely with its signature
pattern = r'\nfunction getFolderIconSVGDark\(isOpen, size\) \{[^}]*\}[^}]*\}'
content = re.sub(pattern, '', content)

# If that didn't match, try simpler approach - just find the function and remove it
if 'function getFolderIconSVGDark' in content:
    # Find start and end of function
    start = content.index('function getFolderIconSVGDark')
    # Find the end by counting braces
    brace_count = 0
    end = start
    in_func = False
    for i in range(start, len(content)):
        if content[i] == '{':
            brace_count += 1
            in_func = True
        elif content[i] == '}':
            brace_count -= 1
        if in_func and brace_count == 0:
            end = i + 1
            break
    content = content[:start] + content[end:]

with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("app.js fixed: stroke color -> currentColor, removed getFolderIconSVGDark")
