// 用户和书签数据（本地存储模拟）
let users = JSON.parse(localStorage.getItem('mark_users') || '{}');
let currentUser = null;
let bookmarks = [];

// DOM 元素
const loginTab = document.getElementById('login-tab');
const registerTab = document.getElementById('register-tab');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const authContainer = document.getElementById('auth-container');
const mainContainer = document.getElementById('main-container');
const importBtn = document.getElementById('import-btn');
const exportBtn = document.getElementById('export-btn');
const addFolderBtn = document.getElementById('add-folder-btn');
const logoutBtn = document.getElementById('logout-btn');
const changelogBtn = document.getElementById('changelog-btn');
const fileInput = document.getElementById('file-input');
const bookmarksTree = document.getElementById('bookmarks-tree');
const changelogModal = document.getElementById('changelog-modal');
const closeModalBtn = document.getElementById('close-modal');

// 切换登录/注册标签
loginTab.addEventListener('click', () => {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.classList.remove('hidden');
    registerForm.classList.add('hidden');
});

registerTab.addEventListener('click', () => {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerForm.classList.remove('hidden');
    loginForm.classList.add('hidden');
});

// 注册功能
registerForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;

    if (password !== confirm) {
        alert('两次输入的密码不一致！');
        return;
    }

    if (users[username]) {
        alert('用户名已存在！');
        return;
    }

    users[username] = { password, bookmarks: [] };
    localStorage.setItem('mark_users', JSON.stringify(users));
    alert('注册成功！请登录');
    
    registerForm.reset();
    loginTab.click();
});

// 登录功能
loginForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    if (!users[username] || users[username].password !== password) {
        alert('用户名或密码错误！');
        return;
    }

    currentUser = username;
    bookmarks = users[username].bookmarks;
    localStorage.setItem('mark_current_user', currentUser);
    showMainContainer();
    renderBookmarks();
});

// 退出登录
logoutBtn.addEventListener('click', () => {
    saveBookmarks();
    localStorage.removeItem('mark_current_user');
    currentUser = null;
    bookmarks = [];
    showAuthContainer();
    loginForm.reset();
});

// 更新日志
changelogBtn.addEventListener('click', () => {
    changelogModal.classList.remove('hidden');
});

closeModalBtn.addEventListener('click', () => {
    changelogModal.classList.add('hidden');
});

// 点击模态框外部关闭
changelogModal.addEventListener('click', (e) => {
    if (e.target === changelogModal) {
        changelogModal.classList.add('hidden');
    }
});

// 显示认证界面
function showAuthContainer() {
    authContainer.classList.remove('hidden');
    mainContainer.classList.add('hidden');
}

// 显示主界面
function showMainContainer() {
    authContainer.classList.add('hidden');
    mainContainer.classList.remove('hidden');
}

// 导入书签
importBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
        const html = event.target.result;
        const importedBookmarks = parseBookmarksHTML(html);
        bookmarks = mergeBookmarks(bookmarks, importedBookmarks);
        saveBookmarks();
        renderBookmarks();
        alert('书签导入成功！');
    };
    reader.readAsText(file);
    fileInput.value = '';
});

// 解析书签 HTML 文件
function parseBookmarksHTML(html) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const root = [];
    
    // 递归处理节点
    function processNode(node) {
        const result = [];
        let currentNode = node.firstChild;
        
        while (currentNode) {
            if (currentNode.nodeType === Node.ELEMENT_NODE) {
                if (currentNode.tagName === 'DT') {
                    const h3 = currentNode.querySelector('h3');
                    const a = currentNode.querySelector('a');
                    
                    if (h3) {
                        // 这是一个文件夹
                        const folder = {
                            type: 'folder',
                            name: h3.textContent.trim(),
                            dateAdded: h3.getAttribute('add_date'),
                            children: []
                        };
                        
                        // 查找下一个 DL 元素（跳过中间的 p 标签和文本节点）
                        let sibling = currentNode.nextSibling;
                        while (sibling) {
                            if (sibling.nodeType === Node.ELEMENT_NODE && sibling.tagName === 'DL') {
                                folder.children = processNode(sibling);
                                break;
                            }
                            sibling = sibling.nextSibling;
                        }
                        
                        result.push(folder);
                    } else if (a) {
                        // 这是一个书签
                        result.push({
                            type: 'bookmark',
                            title: a.textContent.trim() || a.getAttribute('href'),
                            url: a.getAttribute('href'),
                            dateAdded: a.getAttribute('add_date')
                        });
                    }
                } else if (currentNode.tagName === 'DL') {
                    // 处理 DL 标签内的内容
                    const dlContent = processNode(currentNode);
                    result.push(...dlContent);
                }
            }
            currentNode = currentNode.nextSibling;
        }
        return result;
    }
    
    const firstDL = doc.querySelector('dl');
    if (firstDL) {
        const parsed = processNode(firstDL);
        return parsed;
    }
    
    return root;
}

// 合并书签
function mergeBookmarks(existing, imported) {
    const merged = [...existing];
    for (const item of imported) {
        if (!findItem(merged, item)) {
            merged.push(item);
        }
    }
    return merged;
}

// 查找是否已存在相同项
function findItem(list, item) {
    for (const existing of list) {
        if (existing.type === item.type) {
            if (existing.type === 'bookmark' && existing.url === item.url) {
                return true;
            }
            if (existing.type === 'folder' && existing.name === item.name) {
                return true;
            }
        }
    }
    return false;
}

// 导出书签
exportBtn.addEventListener('click', () => {
    const html = generateBookmarksHTML(bookmarks);
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'bookmarks.html';
    a.click();
    URL.revokeObjectURL(url);
});

// 生成书签 HTML
function generateBookmarksHTML(bookmarks) {
    let html = '<!DOCTYPE NETSCAPE-Bookmark-file-1>\n';
    html += '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">\n';
    html += '<TITLE>Bookmarks</TITLE>\n';
    html += '<H1>Bookmarks</H1>\n';
    html += '<DL><p>\n';
    
    function generateItems(items, indent = 2) {
        let result = '';
        const spaces = ' '.repeat(indent);
        for (const item of items) {
            if (item.type === 'folder') {
                const date = item.dateAdded || Math.floor(Date.now() / 1000);
                result += `${spaces}<DT><H3 ADD_DATE="${date}">${escapeHTML(item.name)}</H3>\n`;
                result += `${spaces}<DL><p>\n`;
                if (item.children) {
                    result += generateItems(item.children, indent + 4);
                }
                result += `${spaces}</DL><p>\n`;
            } else if (item.type === 'bookmark') {
                const date = item.dateAdded || Math.floor(Date.now() / 1000);
                result += `${spaces}<DT><A HREF="${escapeHTML(item.url)}" ADD_DATE="${date}">${escapeHTML(item.title)}</A>\n`;
            }
        }
        return result;
    }
    
    html += generateItems(bookmarks);
    html += '</DL><p>\n';
    return html;
}

// 转义 HTML
function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

// 新建文件夹
addFolderBtn.addEventListener('click', () => {
    const name = prompt('请输入文件夹名称：');
    if (name) {
        bookmarks.push({
            type: 'folder',
            name: name,
            dateAdded: Math.floor(Date.now() / 1000),
            children: []
        });
        saveBookmarks();
        renderBookmarks();
    }
});

// 保存书签
function saveBookmarks() {
    if (currentUser && users[currentUser]) {
        users[currentUser].bookmarks = bookmarks;
        localStorage.setItem('mark_users', JSON.stringify(users));
    }
}

// 渲染书签树
function renderBookmarks() {
    bookmarksTree.innerHTML = '';
    renderItems(bookmarks, bookmarksTree);
}

// 渲染列表项
function renderItems(items, container) {
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type === 'folder') {
            renderFolder(item, container, items, i);
        } else if (item.type === 'bookmark') {
            renderBookmark(item, container, items, i);
        }
    }
}

// 渲染文件夹
function renderFolder(folder, container, parentArray, index) {
    const div = document.createElement('div');
    div.className = 'folder';
    
    const header = document.createElement('div');
    header.className = 'folder-header';
    
    const toggle = document.createElement('span');
    toggle.className = 'folder-toggle';
    toggle.textContent = '▼'; // 默认展开
    toggle.onclick = (e) => {
        e.stopPropagation();
        const content = div.querySelector('.folder-content');
        if (content.style.display === 'none') {
            content.style.display = 'block';
            toggle.textContent = '▼';
        } else {
            content.style.display = 'none';
            toggle.textContent = '▶';
        }
    };
    
    const icon = document.createElement('span');
    icon.className = 'folder-icon';
    icon.textContent = '📁';
    
    const name = document.createElement('span');
    name.className = 'folder-name';
    name.textContent = folder.name;
    
    const actions = document.createElement('div');
    actions.className = 'folder-actions';
    
    const addBookmarkBtn = document.createElement('button');
    addBookmarkBtn.className = 'action-btn';
    addBookmarkBtn.textContent = '+ 书签';
    addBookmarkBtn.onclick = (e) => {
        e.stopPropagation();
        const title = prompt('请输入书签标题：');
        const url = prompt('请输入书签 URL：');
        if (title && url) {
            if (!folder.children) folder.children = [];
            folder.children.push({
                type: 'bookmark',
                title: title,
                url: url.startsWith('http') ? url : 'https://' + url,
                dateAdded: Math.floor(Date.now() / 1000)
            });
            saveBookmarks();
            renderBookmarks();
        }
    };
    
    const addSubfolderBtn = document.createElement('button');
    addSubfolderBtn.className = 'action-btn';
    addSubfolderBtn.textContent = '+ 子文件夹';
    addSubfolderBtn.onclick = (e) => {
        e.stopPropagation();
        const name = prompt('请输入文件夹名称：');
        if (name) {
            if (!folder.children) folder.children = [];
            folder.children.push({
                type: 'folder',
                name: name,
                dateAdded: Math.floor(Date.now() / 1000),
                children: []
            });
            saveBookmarks();
            renderBookmarks();
        }
    };
    
    const renameBtn = document.createElement('button');
    renameBtn.className = 'action-btn';
    renameBtn.textContent = '重命名';
    renameBtn.onclick = (e) => {
        e.stopPropagation();
        const newName = prompt('请输入新名称：', folder.name);
        if (newName) {
            folder.name = newName;
            saveBookmarks();
            renderBookmarks();
        }
    };
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn delete';
    deleteBtn.textContent = '删除';
    deleteBtn.onclick = (e) => {
        e.stopPropagation();
        if (confirm('确定要删除这个文件夹及其所有内容吗？')) {
            parentArray.splice(index, 1);
            saveBookmarks();
            renderBookmarks();
        }
    };
    
    actions.appendChild(addBookmarkBtn);
    actions.appendChild(addSubfolderBtn);
    actions.appendChild(renameBtn);
    actions.appendChild(deleteBtn);
    
    header.appendChild(toggle);
    header.appendChild(icon);
    header.appendChild(name);
    header.appendChild(actions);
    
    const content = document.createElement('div');
    content.className = 'folder-content';
    if (folder.children) {
        renderItems(folder.children, content);
    }
    
    div.appendChild(header);
    div.appendChild(content);
    container.appendChild(div);
}

// 渲染书签
function renderBookmark(bookmark, container, parentArray, index) {
    const a = document.createElement('a');
    a.className = 'bookmark-item';
    a.href = bookmark.url;
    a.target = '_blank';
    
    const icon = document.createElement('img');
    icon.className = 'bookmark-icon';
    icon.src = `https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}&sz=32`;
    icon.onerror = () => {
        icon.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="%23667eea" stroke-width="2"><path d="M13.5 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.5"/><polyline points="14 3 21 10"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
    };
    
    const title = document.createElement('span');
    title.className = 'bookmark-title';
    title.textContent = bookmark.title;
    
    const actions = document.createElement('div');
    actions.className = 'bookmark-actions';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'action-btn';
    editBtn.textContent = '编辑';
    editBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const newTitle = prompt('请输入新标题：', bookmark.title);
        const newUrl = prompt('请输入新 URL：', bookmark.url);
        if (newTitle && newUrl) {
            bookmark.title = newTitle;
            bookmark.url = newUrl;
            saveBookmarks();
            renderBookmarks();
        }
    };
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn delete';
    deleteBtn.textContent = '删除';
    deleteBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (confirm('确定要删除这个书签吗？')) {
            parentArray.splice(index, 1);
            saveBookmarks();
            renderBookmarks();
        }
    };
    
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    
    a.appendChild(icon);
    a.appendChild(title);
    a.appendChild(actions);
    container.appendChild(a);
}

// 检查是否有已登录用户
const savedUser = localStorage.getItem('mark_current_user');
if (savedUser && users[savedUser]) {
    currentUser = savedUser;
    bookmarks = users[currentUser].bookmarks;
    showMainContainer();
    renderBookmarks();
}
