// 当前版本号 - 每次发布时自动更新
const CURRENT_VERSION = 'V1.0.17';

document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api';

    let currentUser = null;
    let currentUserId = null;
    let bookmarks = [];
    let selectedFolder = null;

    // 初始化版本号显示
    const versionDisplay = document.getElementById('version-display');
    if (versionDisplay) {
        versionDisplay.textContent = CURRENT_VERSION;
    }

    // 初始化DOM元素
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
    const folderTree = document.getElementById('folder-tree');
    const bookmarksList = document.getElementById('bookmarks-list');
    const selectedFolderName = document.getElementById('selected-folder-name');
    const changelogModal = document.getElementById('changelog-modal');
    const syncBtn = document.getElementById('sync-btn');
    const adminBtn = document.getElementById('admin-btn');
    const searchInput = document.querySelector('.search-input');
    const contentActions = document.getElementById('content-actions');
    const addBookmarkBtn = document.getElementById('add-bookmark-btn');
    const addSubfolderBtn = document.getElementById('add-subfolder-btn');

    // 搜索功能
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const keyword = searchInput.value.trim().toLowerCase();
            if (!keyword) {
                // 搜索框为空，恢复当前选中文件夹的显示
                if (selectedFolder) {
                    selectedFolderName.textContent = selectedFolder.name;
                    updateBookmarksList(selectedFolder.children || []);
                } else {
                    selectedFolderName.textContent = '根文件夹';
                    updateBookmarksList(getAllBookmarks(bookmarks));
                }
                return;
            }
            // 在当前视图范围内搜索
            const source = selectedFolder
                ? (selectedFolder.children || [])
                : getAllBookmarks(bookmarks);
            const filtered = source.filter(item =>
                item.type === 'bookmark' && (
                    item.title.toLowerCase().includes(keyword) ||
                    item.url.toLowerCase().includes(keyword)
                )
            );
            // 同时搜索文件夹名称
            const matchedFolders = source.filter(item =>
                item.type === 'folder' && item.name.toLowerCase().includes(keyword)
            );
            const allFiltered = [...matchedFolders, ...filtered];
            selectedFolderName.textContent = `搜索："${searchInput.value.trim()}"`;
            updateBookmarksList(allFiltered);
        });
    }

    // 添加链接
    if (addBookmarkBtn) {
        addBookmarkBtn.addEventListener('click', async () => {
            const title = prompt('链接标题：');
            if (!title) return;
            const rawUrl = prompt('链接地址：');
            if (!rawUrl) return;
            // 自动补全协议
            let url = rawUrl.trim();
            if (!/^https?:\/\//i.test(url) && !/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(url)) {
                url = 'https://' + url;
            }
            const parent = selectedFolder;
            const newBookmark = {
                type: 'bookmark',
                title: title,
                url: url,
                dateAdded: Math.floor(Date.now() / 1000)
            };
            if (parent) {
                if (!parent.children) parent.children = [];
                parent.children.push(newBookmark);
            } else {
                bookmarks.push(newBookmark);
            }
            await saveBookmarks();
            renderFolderTree();
            if (parent) {
                selectedFolderName.textContent = parent.name;
                updateBookmarksList(parent.children || []);
            } else {
                selectedFolderName.textContent = '根文件夹';
                updateBookmarksList(getAllBookmarks(bookmarks));
            }
        });
    }

    // 添加子文件夹
    if (addSubfolderBtn) {
        addSubfolderBtn.addEventListener('click', async () => {
            const name = prompt('文件夹名称：');
            if (!name) return;
            const parent = selectedFolder;
            const newFolder = {
                type: 'folder',
                name: name,
                dateAdded: Math.floor(Date.now() / 1000),
                children: []
            };
            if (parent) {
                if (!parent.children) parent.children = [];
                parent.children.push(newFolder);
            } else {
                bookmarks.push(newFolder);
            }
            await saveBookmarks();
            renderFolderTree();
            if (parent) {
                selectedFolderName.textContent = parent.name;
                updateBookmarksList(parent.children || []);
            } else {
                selectedFolderName.textContent = '根文件夹';
                updateBookmarksList(getAllBookmarks(bookmarks));
            }
        });
    }

    // 三点菜单
    const moreMenuBtn = document.getElementById('more-menu-btn');
    const moreMenuDropdown = document.getElementById('more-menu-dropdown');
    const menuImportBtn = document.getElementById('menu-import-btn');
    const menuExportBtn = document.getElementById('menu-export-btn');

    if (moreMenuBtn && moreMenuDropdown) {
        // 点击三点按钮切换菜单
        moreMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            moreMenuDropdown.classList.toggle('hidden');
        });
        // 点击页面其他地方关闭菜单
        document.addEventListener('click', () => {
            moreMenuDropdown.classList.add('hidden');
        });
        moreMenuDropdown.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }

    // 菜单-导入收藏夹
    if (menuImportBtn) {
        menuImportBtn.addEventListener('click', () => {
            moreMenuDropdown.classList.add('hidden');
            importBookmarks();
        });
    }

    // 菜单-导出收藏夹
    if (menuExportBtn) {
        menuExportBtn.addEventListener('click', () => {
            moreMenuDropdown.classList.add('hidden');
            exportBookmarks();
        });
    }

    // 菜单-删除收藏夹
    const menuDeleteBtn = document.getElementById('menu-delete-btn');
    if (menuDeleteBtn) {
        menuDeleteBtn.addEventListener('click', async () => {
            moreMenuDropdown.classList.add('hidden');
            if (!selectedFolder) {
                alert('请在左侧选中要删除的文件夹！');
                return;
            }
            const folderName = selectedFolder.name;
            const confirmMsg = '确定要删除文件夹「' + folderName + '」及其所有内容吗？此操作不可恢复！';
            if (!confirm(confirmMsg)) return;

            function removeFromTree(items, target) {
                for (let i = items.length - 1; i >= 0; i--) {
                    if (items[i] === target) {
                        items.splice(i, 1);
                        return true;
                    }
                    if (items[i].type === 'folder' && items[i].children) {
                        if (removeFromTree(items[i].children, target)) return true;
                    }
                }
                return false;
            }

            removeFromTree(bookmarks, selectedFolder);
            await saveBookmarks();
            renderFolderTree();
            selectDefaultFolder();
        });
    }

    // 导入书签（可复用函数）
    function importBookmarks() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.html';
        input.style.display = 'none';

        input.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = async (event) => {
                const html = event.target.result;
                const importedBookmarks = parseBookmarksHTML(html);

                if (importedBookmarks.length === 0) {
                    alert('未解析到任何书签，请确保文件格式正确！');
                    return;
                }

                // 如果选中了文件夹，导入到该文件夹内
                if (selectedFolder) {
                    if (!selectedFolder.children) selectedFolder.children = [];
                    selectedFolder.children = mergeBookmarks(selectedFolder.children, importedBookmarks);
                } else {
                    bookmarks = mergeBookmarks(bookmarks, importedBookmarks);
                }
                await saveBookmarks();
                renderFolderTree();
                if (selectedFolder) {
                    selectedFolderName.textContent = selectedFolder.name;
                    updateBookmarksList(selectedFolder.children || []);
                } else {
                    updateBookmarksList(getAllBookmarks(bookmarks));
                }
                alert('成功导入 ' + countBookmarks(importedBookmarks) + ' 个书签！');
            };
            reader.onerror = () => {
                alert('文件读取失败！');
            };
            reader.readAsText(file);
            document.body.removeChild(input);
        });

        document.body.appendChild(input);
        input.click();
    }

    // 导出书签（可复用函数）
    function exportBookmarks() {
        const html = generateBookmarksHTML(bookmarks);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'bookmarks.html';
        a.click();
        URL.revokeObjectURL(url);
    }

    // 登录/注册标签切换
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

    // 注册
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
            
            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                alert('服务器响应错误，请稍后重试');
                return;
            }
            
            if (data.success) {
                alert('注册成功！请登录');
                registerForm.reset();
                loginTab.click();
            } else {
                alert(data.error || '注册失败');
            }
        } catch (err) {
            alert('网络错误，请稍后重试');
        }
    });

    // 登录
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
            
            const text = await response.text();
            let data;
            try {
                data = JSON.parse(text);
            } catch (e) {
                alert('服务器响应错误，请稍后重试');
                return;
            }
            
            if (data.success) {
                currentUser = data.user.username;
                currentUserId = data.user.id;
                bookmarks = data.bookmarks || [];
                localStorage.setItem('mark_current_user', JSON.stringify({ username: currentUser, id: currentUserId }));
                showMainContainer();
                // 新用户默认创建"收藏夹"文件夹
                initDefaultFolder();
                renderFolderTree();
                // 默认选中收藏夹
                selectDefaultFolder();
            } else {
                alert(data.error || '登录失败');
            }
        } catch (err) {
            alert('网络错误，请稍后重试');
        }
    });

    // 退出登录
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

    // 更新日志模态框
    if (changelogBtn) {
        changelogBtn.addEventListener('click', () => {
            changelogModal.classList.remove('hidden');
        });
    }

    const closeBtn = changelogModal.querySelector('.close');
    if (closeBtn) {
        closeBtn.addEventListener('click', () => {
            changelogModal.classList.add('hidden');
        });
    }

    if (changelogModal) {
        changelogModal.addEventListener('click', (e) => {
            if (e.target === changelogModal) {
                changelogModal.classList.add('hidden');
            }
        });
    }

    // 同步
    if (syncBtn) {
        syncBtn.addEventListener('click', async () => {
            await syncBookmarks();
        });
    }

    // 管理
    if (adminBtn) {
        adminBtn.addEventListener('click', () => {
            window.open('/admin', '_blank');
        });
    }

    // 导入书签
    if (importBtn) {
        importBtn.addEventListener('click', () => {
            importBookmarks();
        });
    }

    // 导出书签
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            exportBookmarks();
        });
    }
    // 新建文件夹
    if (addFolderBtn) {
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
    }

    // 辅助函数
    function showAuthContainer() {
        authContainer.classList.remove('hidden');
        mainContainer.classList.add('hidden');
    }

    function showMainContainer() {
        authContainer.classList.add('hidden');
        mainContainer.classList.remove('hidden');
    }

    // 初始化默认文件夹（新用户无数据时创建"根文件夹"）
    function initDefaultFolder() {
        if (!bookmarks || bookmarks.length === 0) {
            bookmarks = [{
                type: 'folder',
                name: '根文件夹',
                dateAdded: Math.floor(Date.now() / 1000),
                children: []
            }];
            saveBookmarks();
        }
    }

    // 默认选中根文件夹（效果等于显示全部书签）
    function selectDefaultFolder() {
        const defaultFolder = bookmarks.find(b => b.type === 'folder' && b.name === '根文件夹');
        if (defaultFolder) {
            selectedFolder = defaultFolder;
            selectedFolderName.textContent = defaultFolder.name;
            updateBookmarksList(defaultFolder.children || []);
            if (contentActions) contentActions.classList.remove('hidden');
        } else {
            // 没有根文件夹时显示全部书签（扁平列表）
            selectedFolder = null;
            selectedFolderName.textContent = '全部书签';
            updateBookmarksList(getAllBookmarks(bookmarks));
            if (contentActions) contentActions.classList.add('hidden');
        }
    }

    async function saveBookmarks() {
        if (currentUserId) {
            try {
                await fetch(`${API_URL}/save-bookmarks`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ userId: currentUserId, bookmarks })
                });
            } catch (err) {
                console.log('保存到服务器失败');
            }
        }
    }

    async function syncBookmarks() {
        if (!currentUserId) return;
        
        try {
            const response = await fetch(`${API_URL}/get-bookmarks/${currentUserId}`);
            const data = await response.json();
            
            if (data.success) {
                const serverBookmarks = data.bookmarks || [];
                const merged = mergeBookmarks(bookmarks, serverBookmarks);
                bookmarks = merged;
                await saveBookmarks();
                renderFolderTree();
                // 同步后刷新右侧内容区
                if (selectedFolder) {
                    selectedFolderName.textContent = selectedFolder.name;
                    updateBookmarksList(selectedFolder.children || []);
                } else {
                    selectDefaultFolder();
                }
                alert('同步成功！');
            } else {
                alert('同步失败');
            }
        } catch (err) {
            alert('同步失败，请检查网络连接');
        }
    }

    // 书签解析函数
    function countBookmarks(arr) {
        let count = 0;
        for (let item of arr) {
            if (item.type === 'bookmark') {
                count++;
            } else if (item.type === 'folder' && item.children) {
                count += countBookmarks(item.children);
            }
        }
        return count;
    }

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
        const merged = JSON.parse(JSON.stringify(existing));
        
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
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // 渲染函数
    function renderFolderTree() {
        folderTree.innerHTML = '';

        // 渲染用户导入的文件夹树
        const topFolders = bookmarks.filter(item => item.type === 'folder');
        for (let i = 0; i < topFolders.length; i++) {
            const childItem = renderFolderItem(topFolders[i], topFolders, i);
            folderTree.appendChild(childItem);
        }
    }

    function renderFolderItem(folder, parentArray, index) {
        const div = document.createElement('div');
        div.className = 'folder-item';

        // 存储 DOM 引用，供高亮使用
        folder._domElement = div;

        const header = document.createElement('div');
        header.className = 'folder-header';
        
        const toggle = document.createElement('span');
        toggle.className = 'folder-toggle';
        if (folder.children && folder.children.some(child => child.type === 'folder')) {
            toggle.textContent = '▼'; // 默认展开
            toggle.onclick = (e) => {
                e.stopPropagation();
                const content = div.querySelector('.subfolders');
                if (content) {
                    if (content.style.display === 'none') {
                        content.style.display = 'block';
                        toggle.textContent = '▼';
                    } else {
                        content.style.display = 'none';
                        toggle.textContent = '▶';
                    }
                }
            };
        }
        header.appendChild(toggle);
        
        const icon = document.createElement('span');
        icon.className = 'folder-icon';
        icon.textContent = '📂';
        
        const name = document.createElement('span');
        name.className = 'folder-name';
        name.textContent = folder.name;
        
        header.appendChild(icon);
        header.appendChild(name);
        
        header.onclick = () => {
            selectedFolder = folder;
            selectedFolderName.textContent = folder.name;
            updateBookmarksList(folder.children || []);
            updateSelectedState(div);
            if (contentActions) contentActions.classList.remove('hidden');
        };
        
        if (selectedFolder === folder) {
            div.classList.add('selected');
        }
        
        div.appendChild(header);
        
        if (folder.children && folder.children.some(child => child.type === 'folder')) {
            const subfolders = document.createElement('div');
            subfolders.className = 'subfolders';
            subfolders.style.display = 'block'; // 默认展开
            
            for (let i = 0; i < folder.children.length; i++) {
                const child = folder.children[i];
                if (child.type === 'folder') {
                    const childItem = renderFolderItem(child, folder.children, i);
                    subfolders.appendChild(childItem);
                }
            }
            
            div.appendChild(subfolders);
        }
        
        return div;
    }

    function updateSelectedState(element) {
        document.querySelectorAll('.folder-item').forEach(item => item.classList.remove('selected'));
        element.classList.add('selected');
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

        if (!items || items.length === 0) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'empty-state';
            emptyMsg.textContent = '暂无内容';
            bookmarksList.appendChild(emptyMsg);
            return;
        }

        const fragment = document.createDocumentFragment();

        // 先渲染子文件夹（如果有）
        const folders = items.filter(item => item.type === 'folder');
        for (let i = 0; i < folders.length; i++) {
            fragment.appendChild(renderContentFolderItem(folders[i]));
        }

        // 再渲染书签
        const bookmarkArray = items.filter(item => item.type === 'bookmark');
        for (let i = 0; i < bookmarkArray.length; i++) {
            fragment.appendChild(renderBookmarkItem(bookmarkArray[i]));
        }

        bookmarksList.appendChild(fragment);
    }

    // 渲染内容区的子文件夹（可点击进入）
    function renderContentFolderItem(folder) {
        const div = document.createElement('div');
        div.className = 'content-folder-item';

        const icon = document.createElement('span');
        icon.className = 'content-folder-icon';
        icon.textContent = '📂';

        const name = document.createElement('span');
        name.className = 'content-folder-name';
        name.textContent = folder.name;

        const count = document.createElement('span');
        count.className = 'content-folder-count';
        const bookmarkCount = countBookmarks([folder]);
        count.textContent = bookmarkCount + ' 个书签';

        div.appendChild(icon);
        div.appendChild(name);
        div.appendChild(count);

        div.onclick = () => {
            selectedFolder = folder;
            selectedFolderName.textContent = folder.name;
            updateBookmarksList(folder.children || []);
            updateSelectedStateByFolder(folder);
            if (contentActions) contentActions.classList.remove('hidden');
        };

        return div;
    }

    // 根据 folder 对象高亮左侧对应项
    function updateSelectedStateByFolder(folder) {
        document.querySelectorAll('.folder-item').forEach(item => item.classList.remove('selected'));
        if (folder && folder._domElement) {
            folder._domElement.classList.add('selected');
        }
    }

    function renderBookmarkItem(bookmark) {
        const div = document.createElement('a');
        div.className = 'bookmark-item';
        div.href = bookmark.url;
        div.target = '_blank';

        const favicon = document.createElement('img');
        favicon.className = 'bookmark-favicon';
        // 默认显示内置SVG，Google API加载成功后再替换
        favicon.src = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="#3498db"><path d="M13.5 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.5"/><polyline points="14 3 21 10"/><line x1="10" y1="14" x2="21" y2="3"/></svg>');

        try {
            const urlObj = new URL(bookmark.url);
            const googleFavicon = 'https://www.google.com/s2/favicons?domain=' + urlObj.hostname + '&sz=32';
            const fallbackFavicon = urlObj.origin + '/favicon.ico';

            // 先用 Google API，失败则尝试网站原生 favicon
            favicon.onerror = function() {
                if (favicon.src === googleFavicon) {
                    favicon.src = fallbackFavicon;
                }
                // 二次失败就保留内置SVG，不再重试
                favicon.onerror = null;
            };
            favicon.src = googleFavicon;
        } catch (e) {
            // URL 解析失败，保持默认SVG
        }

        const info = document.createElement('div');
        info.className = 'bookmark-info';
        
        const title = document.createElement('h3');
        title.textContent = bookmark.title;
        
        const url = document.createElement('p');
        url.textContent = bookmark.url;
        
        info.appendChild(title);
        info.appendChild(url);
        
        div.appendChild(favicon);
        div.appendChild(info);
        
        return div;
    }

    // 检查是否有保存的登录信息
    const savedUser = localStorage.getItem('mark_current_user');
    if (savedUser) {
        try {
            const userData = JSON.parse(savedUser);
            currentUser = userData.username;
            currentUserId = userData.id;
            showMainContainer();
            // 先同步服务器数据，再渲染
            syncBookmarks().then(() => {
                initDefaultFolder();
                renderFolderTree();
                selectDefaultFolder();
            }).catch(() => {
                initDefaultFolder();
                renderFolderTree();
                selectDefaultFolder();
            });
        } catch (err) {
            console.log('无法解析保存的用户信息');
        }
    }
});