const API_URL = 'http://localhost:3000/api';

let currentUser = null;
let currentUserId = null;
let bookmarks = [];
let selectedFolder = null;

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
const folderTree = document.getElementById('folder-tree');
const bookmarksList = document.getElementById('bookmarks-list');
const selectedFolderName = document.getElementById('selected-folder-name');
const changelogModal = document.getElementById('changelog-modal');
const closeModalBtn = document.getElementById('close-modal');
const syncBtn = document.getElementById('sync-btn');

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

registerForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;

    if (password !== confirm) {
        alert('两次输入的密码不一致！');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        
        if (data.success) {
            alert('注册成功！请登录');
            registerForm.reset();
            loginTab.click();
        } else {
            alert(data.error);
        }
    } catch (err) {
        alert('网络错误，请检查后端服务是否启动');
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    try {
        const response = await fetch(`${API_URL}/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await response.json();
        
        if (data.success) {
            currentUser = data.user.username;
            currentUserId = data.user.id;
            bookmarks = data.bookmarks;
            localStorage.setItem('mark_current_user', JSON.stringify({ username: currentUser, id: currentUserId }));
            showMainContainer();
            renderFolderTree();
            updateBookmarksList([]);
        } else {
            alert(data.error);
        }
    } catch (err) {
        alert('网络错误，请检查后端服务是否启动');
    }
});

logoutBtn.addEventListener('click', async () => {
    await saveBookmarks();
    localStorage.removeItem('mark_current_user');
    currentUser = null;
    currentUserId = null;
    bookmarks = [];
    selectedFolder = null;
    showAuthContainer();
    loginForm.reset();
});

changelogBtn.addEventListener('click', () => {
    changelogModal.classList.remove('hidden');
});

closeModalBtn.addEventListener('click', () => {
    changelogModal.classList.add('hidden');
});

changelogModal.addEventListener('click', (e) => {
    if (e.target === changelogModal) {
        changelogModal.classList.add('hidden');
    }
});

syncBtn.addEventListener('click', async () => {
    await syncBookmarks();
});

async function syncBookmarks() {
    try {
        const response = await fetch(`${API_URL}/get-bookmarks/${currentUserId}`);
        const data = await response.json();
        
        if (data.success) {
            const serverBookmarks = data.bookmarks;
            
            const merged = mergeBookmarks(bookmarks, serverBookmarks);
            bookmarks = merged;
            
            await saveBookmarks();
            renderFolderTree();
            updateBookmarksList(selectedFolder ? getFolderChildren(selectedFolder) : []);
            alert('同步成功！');
        }
    } catch (err) {
        alert('同步失败，请检查网络连接');
    }
}

function showAuthContainer() {
    authContainer.classList.remove('hidden');
    mainContainer.classList.add('hidden');
}

function showMainContainer() {
    authContainer.classList.add('hidden');
    mainContainer.classList.remove('hidden');
}

importBtn.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        const html = event.target.result;
        const importedBookmarks = parseBookmarksHTML(html);
        bookmarks = mergeBookmarks(bookmarks, importedBookmarks);
        await saveBookmarks();
        renderFolderTree();
        updateBookmarksList(selectedFolder ? getFolderChildren(selectedFolder) : []);
        alert('书签导入成功！');
    };
    reader.readAsText(file);
    fileInput.value = '';
});

function parseBookmarksHTML(html) {
    const result = [];
    const stack = [];
    let currentParent = result;
    let currentItem = null;
    
    const lines = html.split('\n');
    
    for (let line of lines) {
        line = line.trim();
        
        if (line.startsWith('<DT><H3')) {
            const nameMatch = line.match(/>([^<]+)<\/H3>/i);
            const addDateMatch = line.match(/ADD_DATE="?([^"]+)"?/i);
            
            currentItem = {
                type: 'folder',
                name: nameMatch ? nameMatch[1].trim() : '',
                dateAdded: addDateMatch ? addDateMatch[1] : null,
                children: []
            };
        }
        else if (line.includes('</DL>')) {
            if (stack.length > 0) {
                currentParent = stack.pop();
            }
        }
        else if (line.includes('<DL>') && !line.includes('</DL>')) {
            if (currentItem && currentItem.type === 'folder') {
                currentParent.push(currentItem);
                stack.push(currentParent);
                currentParent = currentItem.children;
                currentItem = null;
            }
        }
        else if (line.startsWith('<DT><A ')) {
            const hrefMatch = line.match(/HREF="?([^"]+)"?/i);
            const addDateMatch = line.match(/ADD_DATE="?([^"]+)"?/i);
            const titleMatch = line.match(/>([^<]+)<\/A>/i);
            
            currentParent.push({
                type: 'bookmark',
                title: titleMatch ? titleMatch[1].trim() : (hrefMatch ? hrefMatch[1] : ''),
                url: hrefMatch ? hrefMatch[1] : '',
                dateAdded: addDateMatch ? addDateMatch[1] : null
            });
        }
    }
    
    return result;
}

function mergeBookmarks(existing, imported) {
    const merged = [...existing];
    
    function mergeRecursive(existingItems, importedItems) {
        for (const item of importedItems) {
            let found = false;
            
            for (const existingItem of existingItems) {
                if (existingItem.type === item.type) {
                    if (existingItem.type === 'bookmark' && existingItem.url === item.url) {
                        found = true;
                        break;
                    }
                    if (existingItem.type === 'folder' && existingItem.name === item.name) {
                        found = true;
                        if (item.children && existingItem.children) {
                            mergeRecursive(existingItem.children, item.children);
                        }
                        break;
                    }
                }
            }
            
            if (!found) {
                existingItems.push(JSON.parse(JSON.stringify(item)));
            }
        }
    }
    
    mergeRecursive(merged, imported);
    return merged;
}

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

function escapeHTML(str) {
    if (!str) return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

addFolderBtn.addEventListener('click', async () => {
    const name = prompt('请输入文件夹名称：');
    if (name) {
        bookmarks.push({
            type: 'folder',
            name: name,
            dateAdded: Math.floor(Date.now() / 1000),
            children: []
        });
        await saveBookmarks();
        renderFolderTree();
    }
});

async function saveBookmarks() {
    if (currentUserId) {
        try {
            await fetch(`${API_URL}/save-bookmarks`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUserId, bookmarks })
            });
        } catch (err) {
            console.log('保存到服务器失败，继续使用本地存储');
        }
    }
}

function renderFolderTree() {
    folderTree.innerHTML = '';
    
    const allBookmarksItem = document.createElement('div');
    allBookmarksItem.className = 'folder-item all-bookmarks';
    allBookmarksItem.innerHTML = '<span class="folder-icon">📚</span><span class="folder-name">全部书签</span>';
    allBookmarksItem.onclick = () => {
        selectedFolder = null;
        selectedFolderName.textContent = '全部书签';
        const allBookmarks = getAllBookmarks(bookmarks);
        updateBookmarksList(allBookmarks);
    };
    
    if (!selectedFolder) {
        allBookmarksItem.classList.add('selected');
        selectedFolderName.textContent = '全部书签';
    }
    
    folderTree.appendChild(allBookmarksItem);

    for (let i = 0; i < bookmarks.length; i++) {
        const item = bookmarks[i];
        if (item.type === 'folder') {
            const folderItem = renderFolderItem(item, bookmarks, i, '');
            folderTree.appendChild(folderItem);
        } else if (item.type === 'bookmark') {
            const bookmarkItem = document.createElement('div');
            bookmarkItem.className = 'folder-item bookmark-leaf';
            bookmarkItem.innerHTML = `<span class="bookmark-icon-sm">🔗</span><span class="folder-name">${escapeHTML(item.title)}</span>`;
            bookmarkItem.onclick = () => {
                selectedFolder = null;
                selectedFolderName.textContent = '全部书签';
                updateBookmarksList([item]);
            };
            folderTree.appendChild(bookmarkItem);
        }
    }
}

function renderFolderItem(folder, parentArray, index, indent) {
    const div = document.createElement('div');
    div.className = 'folder-item';
    
    const header = document.createElement('div');
    header.className = 'folder-header';
    
    if (folder.children && folder.children.length > 0) {
        const toggle = document.createElement('span');
        toggle.className = 'folder-toggle';
        toggle.textContent = '▶';
        toggle.onclick = (e) => {
            e.stopPropagation();
            const content = div.querySelector('.subfolders');
            if (content.style.display === 'none') {
                content.style.display = 'block';
                toggle.textContent = '▼';
            } else {
                content.style.display = 'none';
                toggle.textContent = '▶';
            }
        };
        header.appendChild(toggle);
    }
    
    const icon = document.createElement('span');
    icon.className = 'folder-icon';
    icon.textContent = '📁';
    
    const name = document.createElement('span');
    name.className = 'folder-name';
    name.textContent = folder.name;
    
    header.appendChild(icon);
    header.appendChild(name);
    
    header.onclick = () => {
        selectedFolder = folder;
        selectedFolderName.textContent = folder.name;
        updateBookmarksList(folder.children || []);
        document.querySelectorAll('.folder-item').forEach(item => item.classList.remove('selected'));
        div.classList.add('selected');
    };
    
    if (selectedFolder === folder) {
        div.classList.add('selected');
    }
    
    div.appendChild(header);
    
    if (folder.children && folder.children.length > 0) {
        const subfolders = document.createElement('div');
        subfolders.className = 'subfolders';
        
        for (let i = 0; i < folder.children.length; i++) {
            const child = folder.children[i];
            if (child.type === 'folder') {
                const childItem = renderFolderItem(child, folder.children, i, indent + '  ');
                subfolders.appendChild(childItem);
            } else if (child.type === 'bookmark') {
                const bookmarkItem = document.createElement('div');
                bookmarkItem.className = 'folder-item bookmark-leaf';
                bookmarkItem.innerHTML = `<span class="bookmark-icon-sm">🔗</span><span class="folder-name">${escapeHTML(child.title)}</span>`;
                bookmarkItem.onclick = () => {
                    selectedFolder = folder;
                    selectedFolderName.textContent = folder.name;
                    updateBookmarksList([child]);
                };
                subfolders.appendChild(bookmarkItem);
            }
        }
        
        div.appendChild(subfolders);
    }
    
    return div;
}

function getAllBookmarks(items) {
    const result = [];
    for (const item of items) {
        if (item.type === 'bookmark') {
            result.push(item);
        } else if (item.type === 'folder' && item.children) {
            result.push(...getAllBookmarks(item.children));
        }
    }
    return result;
}

function getFolderChildren(folder) {
    if (!folder || !folder.children) return [];
    return folder.children.filter(item => item.type === 'bookmark');
}

function updateBookmarksList(items) {
    bookmarksList.innerHTML = '';
    
    if (items.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-message';
        emptyMsg.textContent = '该文件夹暂无书签';
        bookmarksList.appendChild(emptyMsg);
        return;
    }
    
    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.type === 'bookmark') {
            const bookmarkElement = renderBookmarkItem(item, items, i);
            bookmarksList.appendChild(bookmarkElement);
        }
    }
}

function renderBookmarkItem(bookmark, parentArray, index) {
    const div = document.createElement('div');
    div.className = 'bookmark-card';
    
    const link = document.createElement('a');
    link.href = bookmark.url;
    link.target = '_blank';
    
    const favicon = document.createElement('img');
    favicon.className = 'bookmark-favicon';
    favicon.src = `https://www.google.com/s2/favicons?domain=${new URL(bookmark.url).hostname}&sz=64`;
    favicon.onerror = () => {
        favicon.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="%23667eea" stroke-width="2"><path d="M13.5 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.5"/><polyline points="14 3 21 10"/><line x1="10" y1="14" x2="21" y2="3"/></svg>';
    };
    
    const info = document.createElement('div');
    info.className = 'bookmark-info';
    
    const title = document.createElement('h3');
    title.className = 'bookmark-title';
    title.textContent = bookmark.title;
    
    const url = document.createElement('p');
    url.className = 'bookmark-url';
    url.textContent = bookmark.url;
    
    info.appendChild(title);
    info.appendChild(url);
    
    link.appendChild(favicon);
    link.appendChild(info);
    
    const actions = document.createElement('div');
    actions.className = 'bookmark-actions';
    
    const editBtn = document.createElement('button');
    editBtn.className = 'action-btn';
    editBtn.innerHTML = '✏️';
    editBtn.title = '编辑';
    editBtn.onclick = async (e) => {
        e.preventDefault();
        const newTitle = prompt('请输入新标题：', bookmark.title);
        const newUrl = prompt('请输入新 URL：', bookmark.url);
        if (newTitle && newUrl) {
            bookmark.title = newTitle;
            bookmark.url = newUrl.startsWith('http') ? newUrl : 'https://' + newUrl;
            await saveBookmarks();
            updateBookmarksList(selectedFolder ? getFolderChildren(selectedFolder) : getAllBookmarks(bookmarks));
        }
    };
    
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'action-btn delete';
    deleteBtn.innerHTML = '🗑️';
    deleteBtn.title = '删除';
    deleteBtn.onclick = async (e) => {
        e.preventDefault();
        if (confirm('确定要删除这个书签吗？')) {
            parentArray.splice(index, 1);
            await saveBookmarks();
            updateBookmarksList(selectedFolder ? getFolderChildren(selectedFolder) : getAllBookmarks(bookmarks));
        }
    };
    
    actions.appendChild(editBtn);
    actions.appendChild(deleteBtn);
    
    div.appendChild(link);
    div.appendChild(actions);
    
    return div;
}

const savedUser = localStorage.getItem('mark_current_user');
if (savedUser) {
    try {
        const userData = JSON.parse(savedUser);
        currentUser = userData.username;
        currentUserId = userData.id;
        showMainContainer();
        syncBookmarks();
    } catch (err) {
        console.log('无法解析保存的用户信息');
    }
}