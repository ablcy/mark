import re

with open('styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

# 1. Fix .sidebar-title .folder-icon to use color: inherit (so it follows parent color in dark mode)
# Already has font-size: 18px, need to add color: inherit
old_sidebar_icon = """.sidebar-title .folder-icon {
    font-size: 18px;
}"""
new_sidebar_icon = """.sidebar-title .folder-icon {
    font-size: 18px;
    color: inherit;
}"""
css = css.replace(old_sidebar_icon, new_sidebar_icon, 1)

# 2. Add dark theme color for .folder-icon and .content-folder-icon
# Find [data-theme="dark"] .bookmark-menu-btn { and add before it
dark_icon_rule = """
[data-theme="dark"] .folder-icon,
[data-theme="dark"] .content-folder-icon {
    color: #bbb;
}
"""
# Insert before [data-theme="dark"] .folder-menu-btn
marker = "[data-theme="dark"] .folder-menu-btn,"
if marker in css and "data-theme="dark"] .folder-icon" not in css:
    css = css.replace(marker, dark_icon_rule + "\n" + marker)

# 3. Remove [data-theme="dark"] .folder-toggle rule (now display:none always)
css = re.sub(r'\n\[data-theme="dark"\] \.folder-toggle \{[^}]*\}\n?', '\n', css)

# 4. Remove [data-theme="dark"] .content-folder-count rule (now display:none always)
css = re.sub(r'\n\[data-theme="dark"\] \.content-folder-count \{[^}]*\}\n?', '\n', css)

# 5. Remove .sidebar-title and .content-header display rules in dark theme (already display:none in main)
# They're already display:none in main CSS, dark theme override is unnecessary but harmless
# Leave them for safety

with open('styles.css', 'w', encoding='utf-8') as f:
    f.write(css)

print("styles.css fixed")
