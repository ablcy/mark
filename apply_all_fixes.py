import re

# ============ Fix styles.css ============
with open('styles.css', 'r', encoding='utf-8') as f:
    css = f.read()

# 1. .sidebar-title .folder-icon - add color: inherit
old1 = """.sidebar-title .folder-icon {
    font-size: 18px;
}"""
new1 = """.sidebar-title .folder-icon {
    font-size: 18px;
    color: inherit;
}"""
css = css.replace(old1, new1, 1)

# 2. Add dark theme icon color BEFORE [data-theme="dark"] .folder-menu-btn
dark_rule = """
[data-theme="dark"] .folder-icon,
[data-theme="dark"] .content-folder-icon {
    color: #bbb;
}
"""
if '[data-theme="dark"] .folder-icon' not in css:
    css = css.replace('[data-theme="dark"] .folder-menu-btn,', dark_rule + '    [data-theme="dark"] .folder-menu-btn,', 1)

# 3. Remove [data-theme="dark"] .folder-toggle rule
css = re.sub(r'\n\[data-theme="dark"\] \.folder-toggle \{[^}]*\}\n?', '\n', css)

# 4. Remove [data-theme="dark"] .content-folder-count rule
css = re.sub(r'\n\[data-theme="dark"\] \.content-folder-count \{[^}]*\}\n?', '\n', css)

with open('styles.css', 'w', encoding='utf-8') as f:
    f.write(css)
print("styles.css fixed")

# ============ Fix index.html ============
with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Replace 📂 in sidebar title with SVG icon
old_html = '<span class="folder-icon">📂</span>'
new_html = '<span class="folder-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6a2 2 0 0 1 2-2h7l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Z"/></svg></span>'
html = html.replace(old_html, new_html, 1)

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("index.html fixed")
