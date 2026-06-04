import sys

# 读取文件
with open('app.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

content = ''.join(lines)

# === 1. 版本号 ===
content = content.replace("const CURRENT_VERSION = 'v3.0.4'", "const CURRENT_VERSION = 'v3.0.5'")

# === 2. 在文件顶部（CURRENT_VERSION 之后）插入 SVG 辅助函数 ===
# 找到 CURRENT_VERSION 行之后的位置插入
insert_marker = "const CURRENT_VERSION = 'v3.0.5'\n"
func_code = """\n// 文件夹 SVG 图标（方案 A：前盖翻开）
function getFolderIconSVG(isOpen, size) {
    const w = size || 16;
    const s = size || 16;
    if (isOpen) {
        return '<svg width="' + w + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 8v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l2 2h7a2 2 0 0 1 2 2v1Z"/><path d="M2 8h20"/><path d="M4 8l1.5 3h13L20 8"/></svg>';
    }
    return '<svg width="' + w + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6a2 2 0 0 1 2-2h7l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Z"/></svg>';
}

function getFolderIconSVGDark(isOpen, size) {
    const w = size || 16;
    const s = size || 16;
    if (isOpen) {
        return '<svg width="' + w + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="#bbb" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M22 8v11a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l2 2h7a2 2 0 0 1 2 2v1Z"/><path d="M2 8h20"/><path d="M4 8l1.5 3h13L20 8"/></svg>';
    }
    return '<svg width="' + w + '" height="' + s + '" viewBox="0 0 24 24" fill="none" stroke="#bbb" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6a2 2 0 0 1 2-2h7l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Z"/></svg>';
}
"""

# 在 CURRENT_VERSION 行后插入
if insert_marker in content:
    content = content.replace(insert_marker, insert_marker + func_code, 1)

# === 3. sidebarTitle 图标替换（applyLanguage 函数内） ===
old_sidebar = '<span class="folder-icon">\ud83d\udcc2</span>${t.rootFolder}'
new_sidebar = '<span class="folder-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#555" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6a2 2 0 0 1 2-2h7l2 2h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6Z"/></svg></span>${t.rootFolder}'
content = content.replace(old_sidebar, new_sidebar)

# === 4. renderFolderItem 中 icon.textContent = '...' 替换为 SVG ===
# 第一个在 renderFolderItem 里（line ~1685）
old_icon1 = "        icon.textContent = '\ud83d\udcc2';"
new_icon1 = "        icon.innerHTML = getFolderIconSVG(false, 16);"
content = content.replace(old_icon1, new_icon1, 1)

# === 5. renderContentFolderItem 中 icon.textContent = '...' 替换 ===
# 第二个在 renderContentFolderItem 里（line ~2159）
content = content.replace(old_icon1, new_icon1, 1)

# === 6. 移除 renderFolderItem 中的 toggle 相关代码 ===
old_toggle = """        const toggle = document.createElement('span');
        toggle.className = 'folder-toggle';
        if (folder.children && folder.children.some(child => child.type === 'folder')) {
            toggle.textContent = '\u25bc'; // 默认展开
            toggle.onclick = (e) => {
                e.stopPropagation();
                const content = div.querySelector('.subfolders');
                if (content) {
                    if (content.style.display === 'none') {
                        content.style.display = 'block';
                        toggle.textContent = '\u25bc';
                    } else {
                        content.style.display = 'none';
                        toggle.textContent = '\u25b6';
                    }
                }
            };
        }
        header.appendChild(toggle);"""

content = content.replace(old_toggle, '')

# === 7. renderFolderItem 中 header.onclick 加入展开/收起逻辑 ===
old_onclick = """        header.onclick = (e) => {
            if (multiSelectMode && e.target.tagName === 'INPUT') return;
            if (multiSelectMode) return;
            selectedFolder = folder;
            selectedFolderName.textContent = folder.name;
            updateBookmarksList(folder.children || []);
            updateSelectedState(div);
            if (contentActions) contentActions.classList.remove('hidden');
        };"""

new_onclick = """        header.onclick = (e) => {
            if (multiSelectMode && e.target.tagName === 'INPUT') return;
            if (multiSelectMode) return;
            // 展开/收起子文件夹
            if (folder.children && folder.children.some(child => child.type === 'folder')) {
                const subfoldersEl = div.querySelector('.subfolders');
                if (subfoldersEl) {
                    if (subfoldersEl.style.display === 'none') {
                        subfoldersEl.style.display = 'block';
                        folder._isOpen = true;
                    } else {
                        subfoldersEl.style.display = 'none';
                        folder._isOpen = false;
                    }
                    // 更新图标
                    const iconEl = header.querySelector('.folder-icon');
                    if (iconEl) iconEl.innerHTML = getFolderIconSVG(folder._isOpen, 16);
                }
            }
            selectedFolder = folder;
            selectedFolderName.textContent = folder.name;
            updateBookmarksList(folder.children || []);
            updateSelectedState(div);
            if (contentActions) contentActions.classList.remove('hidden');
        };"""

content = content.replace(old_onclick, new_onclick)

# === 8. 默认展开：subfolders.style.display = 'block' 后加 folder._isOpen = true ===
old_display = "            subfolders.style.display = 'block'; // 默认展开"
new_display = "            subfolders.style.display = 'block'; // 默认展开\n            folder._isOpen = true;"
content = content.replace(old_display, new_display)

# === 9. renderContentFolderItem 中移除 count 相关代码 ===
old_count = """        const count = document.createElement('span');
        count.className = 'content-folder-count';
        const bookmarkCount = countBookmarks([folder]);
        count.textContent = bookmarkCount + ' \u4e2a\u4e66\u7b7e';

        div.appendChild(icon);
        div.appendChild(name);
        div.appendChild(count);"""
new_count = """        div.appendChild(icon);
        div.appendChild(name);"""
content = content.replace(old_count, new_count)

# 写回文件
with open('app.js', 'w', encoding='utf-8') as f:
    f.write(content)

print("app.js 修改完成")
