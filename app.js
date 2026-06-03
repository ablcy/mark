// 当前版本号 - 每次发布时自动更新
const CURRENT_VERSION = 'v3.0.0';

function showToast(msg) {
    let toast = document.getElementById('toast');
    if (!toast) {
        toast = document.createElement('div');
        toast.id = 'toast';
        toast.className = 'toast';
        document.body.appendChild(toast);
    }
    toast.textContent = msg;
    toast.classList.add('toast--show');
    clearTimeout(toast._timeout);
    toast._timeout = setTimeout(() => toast.classList.remove('toast--show'), 3500);
}

// 全选（挂到 window 供 onclick 调用）
function toggleSelectAll() { if (window._markToggleSelectAll) window._markToggleSelectAll(); }

document.addEventListener('DOMContentLoaded', () => {
    const API_URL = '/api';

    let currentUser = null;
    let currentUserId = null;
    let bookmarks = [];
    let selectedFolder = null;

    // 多选状态
    let multiSelectMode = false;
    let selectedItems = []; // {type: 'folder'|'bookmark', item: ..., parentArray: ...}

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
    const logoutBtn = document.getElementById('logout-btn');
    const changelogBtn = document.getElementById('changelog-btn');
    const folderTree = document.getElementById('folder-tree');
    const bookmarksList = document.getElementById('bookmarks-list');
    const selectedFolderName = document.getElementById('selected-folder-name');
    const changelogModal = document.getElementById('changelog-modal');
    const adminBtn = document.getElementById('admin-btn');
    const sharesBtn = document.getElementById('shares-btn');
    const sharesModal = document.getElementById('shares-modal');
    const sharesModalClose = document.getElementById('shares-modal-close');
    const sharesList = document.getElementById('shares-list');
    const searchInput = document.querySelector('.search-input');
    const searchModeBtn = document.getElementById('search-mode-btn');
    const contentActions = document.getElementById('content-actions');
    const langBtn = document.getElementById('lang-btn');
    const themeBtn = document.getElementById('theme-btn');

    // ====== 语言与主题切换 ======
    let currentLang = localStorage.getItem('mark_lang') || 'zh';
    let currentTheme = localStorage.getItem('mark_theme') || 'light';
    let searchMode = 'bookmark';    // 'bookmark' | 'bing'

    // 偏好管理
    async function loadPreferences() {
        if (!currentUserId) return;
        try {
            const resp = await fetch(`${API_URL}/preferences/${currentUserId}`);
            if (!resp.ok) return;
            const data = await resp.json();
            if (data.success && data.preferences) {
                if (data.preferences.searchMode) {
                    searchMode = data.preferences.searchMode;
                    updateSearchModeUI();
                }
            }
        } catch (e) {
            console.log('加载偏好失败');
        }
    }

    async function savePreference(key, value) {
        if (!currentUserId) return;
        try {
            await fetch(`${API_URL}/save-preference`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ userId: currentUserId, key, value })
            });
        } catch (e) {
            console.log('保存偏好失败');
        }
    }

    function updateSearchModeUI() {
        const t = i18n[currentLang];
        if (searchMode === 'bing') {
            searchModeBtn.textContent = 'Bing';
            searchModeBtn.classList.add('bing-mode');
            searchInput.placeholder = '搜索 Bing...';
        } else {
            searchModeBtn.textContent = '书签';
            searchModeBtn.classList.remove('bing-mode');
            searchInput.placeholder = t.searchPlaceholder;
        }
    }

    const i18n = {
        zh: {
            searchPlaceholder: '搜索书签...',
            login: '登录',
            register: '注册',
            loginBtn: '登录',
            registerBtn: '注册',
            username: '用户名',
            password: '密码',
            confirmPassword: '确认密码',
            multiSelect: '多选',
            shares: '短链接',
            admin: '管理',
            logout: '退出',
            rootFolder: '根文件夹',
            allBookmarks: '全部书签',
            addBookmark: '添加链接',
            addSubfolder: '新建子文件夹',
            addSibling: '新建同级文件夹',
            import: '导入',
            export: '导出',
            rename: '修改名称',
            flatten: '去层',
            deleteFolder: '删除收藏夹',
            sync: '同步',
            selectAll: '全选',
            selectedCount: '已选',
            delete: '删除',
            copy: '拷贝',
            move: '移动',
            share: '分享',
            cancel: '取消',
            noContent: '暂无内容',
            searchPrefix: '全局搜索',
            changelogTitle: '更新日志',
            shareTitle: '短链接管理',
            loading: '加载中...',
            versionBadgeTitle: '点击查看更新日志'
        },
        en: {
            searchPlaceholder: 'Search bookmarks...',
            login: 'Login',
            register: 'Register',
            loginBtn: 'Login',
            registerBtn: 'Register',
            username: 'Username',
            password: 'Password',
            confirmPassword: 'Confirm Password',
            multiSelect: 'Multi',
            shares: 'Shares',
            admin: 'Admin',
            logout: 'Logout',
            rootFolder: 'Root',
            allBookmarks: 'All Bookmarks',
            addBookmark: 'Add Link',
            addSubfolder: 'New Subfolder',
            addSibling: 'New Sibling',
            import: 'Import',
            export: 'Export',
            rename: 'Rename',
            flatten: 'Flatten',
            deleteFolder: 'Delete Folder',
            sync: 'Sync',
            selectAll: 'Select All',
            selectedCount: 'Selected',
            delete: 'Delete',
            copy: 'Copy',
            move: 'Move',
            share: 'Share',
            cancel: 'Cancel',
            noContent: 'No content',
            searchPrefix: 'Search',
            changelogTitle: 'Changelog',
            shareTitle: 'Share Links',
            loading: 'Loading...',
            versionBadgeTitle: 'Click to view changelog'
        }
    };

    function applyLanguage() {
        const t = i18n[currentLang];
        if (searchInput) {
            if (searchMode !== 'bing') {
                searchInput.placeholder = t.searchPlaceholder;
            }
        }
        if (loginTab) loginTab.textContent = t.login;
        if (registerTab) registerTab.textContent = t.register;
        if (loginForm) loginForm.querySelector('button').textContent = t.loginBtn;
        if (registerForm) registerForm.querySelector('button').textContent = t.registerBtn;
        if (loginForm) loginForm.querySelector('input[type="text"]').placeholder = t.username;
        if (loginForm) loginForm.querySelector('input[type="password"]').placeholder = t.password;
        if (registerForm) {
            const regInputs = registerForm.querySelectorAll('input');
            if (regInputs[0]) regInputs[0].placeholder = t.username;
            if (regInputs[1]) regInputs[1].placeholder = t.password;
            if (regInputs[2]) regInputs[2].placeholder = t.confirmPassword;
        }
        if (langBtn) langBtn.textContent = currentLang === 'zh' ? '中' : 'En';
        if (multiSelectNavBtn) multiSelectNavBtn.textContent = t.multiSelect;
        if (sharesBtn) sharesBtn.textContent = t.shares;
        if (adminBtn) adminBtn.textContent = t.admin;
        if (logoutBtn) logoutBtn.textContent = t.logout;
        if (versionDisplay) versionDisplay.title = t.versionBadgeTitle;
        // 侧边栏标题
        const sidebarTitle = document.querySelector('.sidebar-title');
        if (sidebarTitle) {
            sidebarTitle.innerHTML = `<span class="folder-icon">📂</span>${t.rootFolder}`;
        }
        // 菜单项
        const menuAddBookmark = document.getElementById('menu-add-bookmark-btn');
        const menuAddSubfolder = document.getElementById('menu-add-subfolder-btn');
        const menuAddSibling = document.getElementById('menu-add-sibling-btn');
        const menuImport = document.getElementById('menu-import-btn');
        const menuExport = document.getElementById('menu-export-btn');
        const menuRename = document.getElementById('menu-rename-btn');
        const menuFlatten = document.getElementById('menu-flatten-btn');
        const menuDelete = document.getElementById('menu-delete-btn');
        const menuSync = document.getElementById('menu-sync-btn');
        if (menuAddBookmark) menuAddBookmark.textContent = t.addBookmark;
        if (menuAddSubfolder) menuAddSubfolder.textContent = t.addSubfolder;
        if (menuAddSibling) menuAddSibling.textContent = t.addSibling;
        if (menuImport) menuImport.textContent = t.import;
        if (menuExport) menuExport.textContent = t.export;
        if (menuRename) menuRename.textContent = t.rename;
        if (menuFlatten) menuFlatten.textContent = t.flatten;
        if (menuDelete) menuDelete.textContent = t.deleteFolder;
        if (menuSync) menuSync.textContent = t.sync;
        // 多选栏
        const selectAllLabel = document.querySelector('.multi-select-all-label');
        if (selectAllLabel) {
            const cb = selectAllLabel.querySelector('input');
            selectAllLabel.innerHTML = '';
            if (cb) selectAllLabel.appendChild(cb);
            selectAllLabel.appendChild(document.createTextNode(' ' + t.selectAll));
        }
        if (multiDeleteBtn) multiDeleteBtn.textContent = t.delete;
        if (multiCopyBtn) multiCopyBtn.textContent = t.copy;
        if (multiMoveBtn) multiMoveBtn.textContent = t.move;
        if (multiShareBtn) multiShareBtn.textContent = t.share;
        if (multiCancelBtn) multiCancelBtn.textContent = t.cancel;
        // 更新当前显示
        if (!searchInput || !searchInput.value.trim()) {
            if (selectedFolder) {
                selectedFolderName.textContent = selectedFolder.name;
            } else {
                selectedFolderName.textContent = t.allBookmarks;
            }
        }
    }

    function applyTheme() {
        document.documentElement.setAttribute('data-theme', currentTheme);
        if (themeBtn) {
            const isLight = currentTheme === 'light';
            themeBtn.innerHTML = isLight
                ? '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/></svg>'
                : '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
            themeBtn.title = isLight ? 'Switch to dark' : 'Switch to light';
        }
    }

    if (langBtn) {
        langBtn.addEventListener('click', () => {
            currentLang = currentLang === 'zh' ? 'en' : 'zh';
            localStorage.setItem('mark_lang', currentLang);
            applyLanguage();
        });
    }

    if (themeBtn) {
        themeBtn.addEventListener('click', () => {
            currentTheme = currentTheme === 'light' ? 'dark' : 'light';
            localStorage.setItem('mark_theme', currentTheme);
            applyTheme();
        });
    }

    // 多选操作栏
    const multiSelectBar = document.getElementById('multi-select-bar');
    const multiSelectCount = document.getElementById('multi-select-count');
    const multiDeleteBtn = document.getElementById('multi-delete-btn');
    const multiCopyBtn = document.getElementById('multi-copy-btn');
    const multiMoveBtn = document.getElementById('multi-move-btn');
    const multiShareBtn = document.getElementById('multi-share-btn');
    const multiCancelBtn = document.getElementById('multi-cancel-btn');
    // ====== 通用输入对话框 ======
    const inputModal = document.getElementById('input-modal');
    const inputModalTitle = document.getElementById('input-modal-title');
    const inputModalField1 = document.getElementById('input-modal-field1');
    const inputModalField2 = document.getElementById('input-modal-field2');
    const inputModalCancel = document.getElementById('input-modal-cancel');
    const inputModalConfirm = document.getElementById('input-modal-confirm');

    let _inputModalResolve = null;

    /**
     * 显示通用输入对话框
     * @param {string} title       对话框标题
     * @param {string} placeholder1  第一个输入框占位符
     * @param {string} placeholder2  第二个输入框占位符（传 null 则隐藏）
     * @param {string} default1    第一个输入框默认值
     * @param {string} default2    第二个输入框默认值
     * @returns {Promise<{v1:string, v2:string}|null>}  点取消返回 null
     */
    function showInputModal(title, placeholder1, placeholder2, default1 = '', default2 = '') {
        return new Promise((resolve) => {
            _inputModalResolve = resolve;
            inputModalTitle.textContent = title;
            inputModalField1.placeholder = placeholder1 || '';
            inputModalField1.value = default1;
            if (placeholder2) {
                inputModalField2.placeholder = placeholder2;
                inputModalField2.value = default2;
                inputModalField2.classList.remove('hidden');
            } else {
                inputModalField2.classList.add('hidden');
                inputModalField2.value = '';
            }
            inputModal.classList.remove('hidden');
            inputModalField1.focus();
        });
    }

    function _closeInputModal(result) {
        inputModal.classList.add('hidden');
        if (_inputModalResolve) {
            _inputModalResolve(result);
            _inputModalResolve = null;
        }
    }

    inputModalCancel.addEventListener('click', () => _closeInputModal(null));
    inputModal.addEventListener('click', (e) => { if (e.target === inputModal) _closeInputModal(null); });
    inputModalConfirm.addEventListener('click', () => {
        const v1 = inputModalField1.value.trim();
        const v2 = inputModalField2.value.trim();
        if (!v1) { inputModalField1.focus(); return; }
        _closeInputModal({ v1, v2 });
    });
    // Enter 键确认
    [inputModalField1, inputModalField2].forEach(el => {
        el.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                const v1 = inputModalField1.value.trim();
                const v2 = inputModalField2.value.trim();
                if (!v1) { inputModalField1.focus(); return; }
                _closeInputModal({ v1, v2 });
            }
            if (e.key === 'Escape') _closeInputModal(null);
        });
    });

    // 搜索模式切换按钮
    if (searchModeBtn) {
        searchModeBtn.addEventListener('click', () => {
            searchMode = searchMode === 'bookmark' ? 'bing' : 'bookmark';
            updateSearchModeUI();
            savePreference('searchMode', searchMode);
            hideSuggestions();
            // 切换回书签模式时恢复当前目录显示
            if (searchMode === 'bookmark') {
                searchInput.value = '';
                if (selectedFolder) {
                    selectedFolderName.textContent = selectedFolder.name;
                    updateBookmarksList(selectedFolder.children || []);
                } else {
                    selectedFolderName.textContent = '根文件夹';
                    updateBookmarksList(getAllBookmarks(bookmarks));
                }
            }
        });
    }

    // ==== Bing 搜索联想 ====
    const suggestionsDropdown = document.getElementById('suggestions-dropdown');
    let suggestionList = [];
    let activeSuggestionIdx = -1;
    let suggestionTimer = null;

    function hideSuggestions() {
        suggestionsDropdown.classList.remove('show');
        suggestionsDropdown.innerHTML = '';
        suggestionList = [];
        activeSuggestionIdx = -1;
    }

    function showSuggestions(html) {
        suggestionsDropdown.innerHTML = html;
        suggestionsDropdown.classList.add('show');
        activeSuggestionIdx = -1;
    }

    function isURL(str) {
        // 带协议头的完整 URL
        if (/^https?:\/\//i.test(str)) return true;
        // domain.tld 格式 (如 github.com, baidu.com)
        if (/^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?)+(:\d+)?(\/.*)?$/.test(str)) return true;
        // localhost
        if (/^localhost(:\d+)?(\/.*)?$/i.test(str)) return true;
        // IP 地址
        if (/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}(:\d+)?(\/.*)?$/.test(str)) return true;
        return false;
    }

    function doBingSearch(query) {
        if (!query) return;
        if (isURL(query)) {
            let url = query.trim();
            if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
            window.open(url, '_blank');
        } else {
            window.open(`https://www.bing.com/search?q=${encodeURIComponent(query)}`, '_blank');
        }
        hideSuggestions();
        searchInput.value = '';
        // 保存到搜索历史
        saveSearchHistory(query);
    }

    // 搜索历史（localStorage）
    const MAX_HISTORY = 6;
    function getSearchHistory() {
        try {
            return JSON.parse(localStorage.getItem('mark_bing_history') || '[]');
        } catch { return []; }
    }
    function saveSearchHistory(query) {
        let hist = getSearchHistory();
        hist = hist.filter(h => h !== query);
        hist.unshift(query);
        if (hist.length > MAX_HISTORY) hist = hist.slice(0, MAX_HISTORY);
        localStorage.setItem('mark_bing_history', JSON.stringify(hist));
    }
    function clearSearchHistory() {
        localStorage.removeItem('mark_bing_history');
        hideSuggestions();
    }

    async function fetchBingSuggestions(query) {
        try {
            const resp = await fetch(`${API_URL}/bing-suggestions?query=${encodeURIComponent(query)}`);
            if (!resp.ok) return [];
            const data = await resp.json();
            return Array.isArray(data) ? data : [];
        } catch {
            return [];
        }
    }

    function renderSuggestions(suggestions, query) {
        const history = getSearchHistory();
        let html = '';

        // 搜索历史
        if (!query && history.length > 0) {
            html += '<div class="suggestion-section-label">搜索历史</div>';
            history.forEach(item => {
                html += `<div class="suggestion-item" data-query="${escapeAttr(item)}">
                    <span class="suggestion-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg></span>
                    <span class="suggestion-text">${escapeHtml(item)}</span>
                </div>`;
            });
            html += '<div class="suggestion-footer" data-action="clear-history">清除搜索历史</div>';
            html += '<div class="suggestion-divider"></div>';
        }

        // Bing 联想词
        if (suggestions.length > 0) {
            if (history.length > 0 || !query) {
                html += '<div class="suggestion-section-label">联想搜索</div>';
            }
            suggestions.forEach(s => {
                html += `<div class="suggestion-item" data-query="${escapeAttr(s)}">
                    <span class="suggestion-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
                    <span class="suggestion-text">${escapeHtml(s)}</span>
                </div>`;
            });
        }

        // 直接搜索当前输入
        if (query && suggestions.length === 0) {
            html += `<div class="suggestion-item" data-query="${escapeAttr(query)}">
                <span class="suggestion-icon"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></span>
                <span class="suggestion-text">搜索 "${escapeHtml(query)}"</span>
            </div>`;
        }

        return html || '<div class="suggestion-item" style="color:#999;cursor:default;">无建议</div>';
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function escapeAttr(str) {
        return str.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/'/g,'&#39;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    }

    function updateActiveSuggestion(delta) {
        const items = suggestionsDropdown.querySelectorAll('.suggestion-item');
        if (items.length === 0) return;
        items.forEach(item => item.classList.remove('active'));
        activeSuggestionIdx = Math.max(-1, Math.min(items.length - 1, activeSuggestionIdx + delta));
        if (activeSuggestionIdx >= 0) {
            items[activeSuggestionIdx].classList.add('active');
            items[activeSuggestionIdx].scrollIntoView({ block: 'nearest' });
        }
    }

    function getActiveQuery() {
        const items = suggestionsDropdown.querySelectorAll('.suggestion-item');
        if (activeSuggestionIdx >= 0 && activeSuggestionIdx < items.length) {
            return items[activeSuggestionIdx].dataset.query;
        }
        return null;
    }

    // 搜索输入事件
    if (searchInput) {
        searchInput.addEventListener('input', async () => {
            if (searchMode !== 'bing') {
                // 书签模式：本地搜索
                const keyword = searchInput.value.trim().toLowerCase();
                if (!keyword) {
                    if (selectedFolder) {
                        selectedFolderName.textContent = selectedFolder.name;
                        updateBookmarksList(selectedFolder.children || []);
                    } else {
                        selectedFolderName.textContent = '根文件夹';
                        updateBookmarksList(getAllBookmarks(bookmarks));
                    }
                    return;
                }
                const allItems = getAllBookmarks(bookmarks);
                const filtered = allItems.filter(item =>
                    item.type === 'bookmark' && (
                        item.title.toLowerCase().includes(keyword) ||
                        item.url.toLowerCase().includes(keyword)
                    )
                );
                const matchedFolders = bookmarks.filter(item =>
                    item.type === 'folder' && item.name.toLowerCase().includes(keyword)
                );
                const allFiltered = [...matchedFolders, ...filtered];
                selectedFolderName.textContent = `全局搜索："${searchInput.value.trim()}"`;
                updateBookmarksList(allFiltered, keyword);
                return;
            }

            // Bing 模式：联想搜索
            clearTimeout(suggestionTimer);
            const query = searchInput.value.trim();
            if (!query) {
                const html = await renderSuggestions([], '');
                if (html) showSuggestions(html);
                else hideSuggestions();
                return;
            }

            suggestionTimer = setTimeout(async () => {
                const suggestions = await fetchBingSuggestions(query);
                const html = await renderSuggestions(suggestions, query);
                showSuggestions(html);
            }, 200);
        });

        // 聚焦时显示搜索历史
        searchInput.addEventListener('focus', async () => {
            if (searchMode !== 'bing') return;
            const query = searchInput.value.trim();
            if (!query) {
                const html = await renderSuggestions([], '');
                if (html) showSuggestions(html);
            }
        });

        // Enter / Arrow 键导航
        searchInput.addEventListener('keydown', (e) => {
            if (searchMode !== 'bing') {
                if (e.key !== 'Enter') return;
                const keyword = searchInput.value.trim();
                if (!keyword) return;
                // 书签模式下 Enter 无特殊行为，仅触发过滤
                return;
            }

            if (e.key === 'Escape') {
                hideSuggestions();
                return;
            }

            if (e.key === 'ArrowDown') {
                e.preventDefault();
                updateActiveSuggestion(1);
                return;
            }

            if (e.key === 'ArrowUp') {
                e.preventDefault();
                updateActiveSuggestion(-1);
                return;
            }

            if (e.key === 'Enter') {
                e.preventDefault();
                const active = getActiveQuery();
                const keyword = active || searchInput.value.trim();
                if (keyword) doBingSearch(keyword);
            }
        });

        // 点击联想项
        suggestionsDropdown.addEventListener('click', (e) => {
            const item = e.target.closest('.suggestion-item');
            const footer = e.target.closest('.suggestion-footer');

            if (footer && footer.dataset.action === 'clear-history') {
                clearSearchHistory();
                return;
            }

            if (item && item.dataset.query) {
                doBingSearch(item.dataset.query);
            }
        });

        // 点击外部关闭
        document.addEventListener('click', (e) => {
            if (!suggestionsDropdown.contains(e.target) && e.target !== searchInput && e.target !== searchModeBtn) {
                hideSuggestions();
            }
        });
    }

    // 添加链接（从文件夹菜单触发，添加到当前选中文件夹内）
    async function addBookmarkToCurrentFolder() {
        const result = await showInputModal('添加链接', '标题', '链接地址（https://...）');
        if (!result || !result.v1) return;
        const title = result.v1;
        let url = result.v2.trim();
        if (!url) return;
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
    }

    // 新建子文件夹（在选中文件夹内创建）
    async function addSubfolderToCurrentFolder() {
        const name = prompt('子文件夹名称：');
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
    }

    // 新建同级文件夹（在选中文件夹的父级中创建）
    async function addSiblingFolder() {
        if (!selectedFolder) {
            alert('请先在左侧选中一个文件夹！');
            return;
        }
        const name = prompt('同级文件夹名称：');
        if (!name) return;

        const newFolder = {
            type: 'folder',
            name: name,
            dateAdded: Math.floor(Date.now() / 1000),
            children: []
        };

        // 找 selectedFolder 所在的父级数组
        function findParentArray(items, target) {
            for (const item of items) {
                if (item.type === 'folder' && item.children) {
                    if (item.children.includes(target)) return item.children;
                    const found = findParentArray(item.children, target);
                    if (found) return found;
                }
            }
            return null;
        }

        const parentArray = findParentArray(bookmarks, selectedFolder)
            || (bookmarks.includes(selectedFolder) ? bookmarks : null);

        if (parentArray) {
            const idx = parentArray.indexOf(selectedFolder);
            parentArray.splice(idx + 1, 0, newFolder);
        } else {
            // fallback: 加到根级
            bookmarks.push(newFolder);
        }

        await saveBookmarks();
        renderFolderTree();
        // 保持当前选中不变，刷新内容区
        if (selectedFolder) {
            updateBookmarksList(selectedFolder.children || []);
        }
    }

    // 三点菜单
    const moreMenuBtn = document.getElementById('more-menu-btn');
    const moreMenuDropdown = document.getElementById('more-menu-dropdown');
    const menuImportBtn = document.getElementById('menu-import-btn');
    const menuExportBtn = document.getElementById('menu-export-btn');
    const menuRenameBtn = document.getElementById('menu-rename-btn');
    const multiSelectNavBtn = document.getElementById('multi-select-nav-btn');

    // 初始化语言和主题
    applyLanguage();
    applyTheme();

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

    // 菜单-添加链接
    const menuAddBookmarkBtn = document.getElementById('menu-add-bookmark-btn');
    if (menuAddBookmarkBtn) {
        menuAddBookmarkBtn.addEventListener('click', () => {
            moreMenuDropdown.classList.add('hidden');
            addBookmarkToCurrentFolder();
        });
    }

    // 菜单-新建子文件夹
    const menuAddSubfolderBtn = document.getElementById('menu-add-subfolder-btn');
    if (menuAddSubfolderBtn) {
        menuAddSubfolderBtn.addEventListener('click', () => {
            moreMenuDropdown.classList.add('hidden');
            addSubfolderToCurrentFolder();
        });
    }

    // 菜单-新建同级文件夹
    const menuAddSiblingBtn = document.getElementById('menu-add-sibling-btn');
    if (menuAddSiblingBtn) {
        menuAddSiblingBtn.addEventListener('click', () => {
            moreMenuDropdown.classList.add('hidden');
            addSiblingFolder();
        });
    }

    // 菜单-导入
    if (menuImportBtn) {
        menuImportBtn.addEventListener('click', () => {
            moreMenuDropdown.classList.add('hidden');
            importBookmarks();
        });
    }

    // 菜单-导出（仅导出当前选中文件夹的内容）
    if (menuExportBtn) {
        menuExportBtn.addEventListener('click', () => {
            moreMenuDropdown.classList.add('hidden');
            exportBookmarks();
        });
    }

    // 菜单-修改名称
    if (menuRenameBtn) {
        menuRenameBtn.addEventListener('click', async () => {
            moreMenuDropdown.classList.add('hidden');
            if (!selectedFolder) {
                alert('请在左侧选中要修改名称的文件夹！');
                return;
            }
            const newName = prompt('请输入新的文件夹名称：', selectedFolder.name);
            if (!newName || newName.trim() === '') return;
            selectedFolder.name = newName.trim();
            await saveBookmarks();
            renderFolderTree();
            selectedFolderName.textContent = selectedFolder.name;
            // 刷新内容区
            updateBookmarksList(selectedFolder.children || []);
        });
    }

    // 菜单-去层（把选中文件夹的所有子内容提升到父文件夹，然后删除该文件夹壳）
    const menuFlattenBtn = document.getElementById('menu-flatten-btn');
    if (menuFlattenBtn) {
        menuFlattenBtn.addEventListener('click', async () => {
            moreMenuDropdown.classList.add('hidden');
            if (!selectedFolder) {
                alert('请在左侧选中要去层的文件夹！');
                return;
            }
            if (selectedFolder.name === '根文件夹') {
                alert('根文件夹不能去层！');
                return;
            }

            // 找到父级数组（selectedFolder 在哪个 children 里）
            function findParentArray(items, target) {
                for (const item of items) {
                    if (item.type === 'folder' && item.children) {
                        if (item.children.includes(target)) return item.children;
                        const found = findParentArray(item.children, target);
                        if (found) return found;
                    }
                }
                return null;
            }

            const parentArray = findParentArray(bookmarks, selectedFolder)
                || (bookmarks.includes(selectedFolder) ? bookmarks : null);

            if (!parentArray) {
                alert('找不到父文件夹，操作失败！');
                return;
            }

            const folderName = selectedFolder.name;
            if (!confirm(`确定要去层文件夹「${folderName}」？\n其所有子内容将提升到上一级，文件夹本身将被删除。`)) return;

            // 找到 selectedFolder 在 parentArray 中的位置
            const idx = parentArray.indexOf(selectedFolder);
            // 把 selectedFolder 的 children 展开插入到同一位置
            const children = selectedFolder.children || [];
            parentArray.splice(idx, 1, ...children);

            await saveBookmarks();
            renderFolderTree();
            // 去层后选中父文件夹或回到根文件夹
            selectDefaultFolder();
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
            if (selectedFolder.name === '根文件夹') {
                alert('根文件夹不能删除！');
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
                showToast('成功导入 ' + countBookmarks(importedBookmarks) + ' 个书签');
            };
            reader.onerror = () => {
                showToast('文件读取失败');
            };
            reader.readAsText(file);
            document.body.removeChild(input);
        });

        document.body.appendChild(input);
        input.click();
    }

    // 导出书签（只导出当前选中文件夹的内容）
    function exportBookmarks() {
        const target = selectedFolder ? selectedFolder.children || [] : bookmarks;
        const html = generateBookmarksHTML(target);
        const blob = new Blob([html], { type: 'text/html' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        const fileName = selectedFolder ? selectedFolder.name : 'bookmarks';
        a.download = fileName + '.html';
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
                // 加载用户偏好（搜索引擎等）
                loadPreferences();
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

    // 点击版本号显示更新日志
    if (versionDisplay) {
        versionDisplay.addEventListener('click', () => {
            changelogModal.classList.remove('hidden');
        });
        versionDisplay.style.cursor = 'pointer';
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

    // 管理
    if (adminBtn) {
        adminBtn.addEventListener('click', () => {
            window.open('/admin', '_blank');
        });
    }

    // 导航栏多选
    if (multiSelectNavBtn) {
        multiSelectNavBtn.addEventListener('click', () => {
            if (multiSelectMode) {
                exitMultiSelectMode();
            } else {
                enterMultiSelectMode();
            }
        });
    }

    // 短链接管理
    if (sharesBtn) {
        sharesBtn.addEventListener('click', () => {
            sharesModal.classList.remove('hidden');
            loadMyShares();
        });
    }
    if (sharesModalClose) {
        sharesModalClose.addEventListener('click', () => {
            sharesModal.classList.add('hidden');
        });
    }
    if (sharesModal) {
        sharesModal.addEventListener('click', (e) => {
            if (e.target === sharesModal) {
                sharesModal.classList.add('hidden');
            }
        });
    }

    // 加载我的短链接（复用 admin API，前端过滤当前用户）
    async function loadMyShares() {
        if (!currentUserId) {
            sharesList.innerHTML = '<div class="empty-state">请先登录</div>';
            return;
        }
        sharesList.innerHTML = '<div class="loading">加载中...</div>';
        try {
            const res = await fetch('/api/admin/shares');
            if (!res.ok) {
                sharesList.innerHTML = `<div class="empty-state">加载失败 (${res.status})</div>`;
                return;
            }
            const data = await res.json();
            if (data.success && data.shares) {
                const myShares = data.shares.filter(s => s.user_id === currentUserId);
                if (myShares.length > 0) {
                    let html = '';
                    myShares.forEach(s => {
                        const date = new Date(s.created_at);
                        const formattedDate = date.toLocaleString('zh-CN');
                        const fullUrl = `https://mark.lcy.app/${s.code}`;
                        html += `
                        <div class="share-item">
                            <div class="share-item-info">
                                <div class="share-item-title">${s.title || '未命名'}</div>
                                <div class="share-item-url">${fullUrl}</div>
                                <div class="share-item-time">${formattedDate}</div>
                            </div>
                            <div class="share-item-actions">
                                <button class="share-item-btn" onclick="navigator.clipboard.writeText('${fullUrl}');showToast('已复制：${fullUrl}')">复制</button>
                                <button class="share-item-btn" onclick="editMyShare(${s.id}, '${s.code}')">改短码</button>
                                <button class="share-item-btn share-item-btn--danger" onclick="deleteMyShare(${s.id}, '${s.code}')">删除</button>
                            </div>
                        </div>`;
                    });
                    sharesList.innerHTML = html;
                } else {
                    sharesList.innerHTML = '<div class="empty-state">暂无短链接</div>';
                }
            } else {
                sharesList.innerHTML = `<div class="empty-state">加载失败: ${data.error || '未知错误'}</div>`;
            }
        } catch (err) {
            sharesList.innerHTML = `<div class="empty-state">网络错误: ${err.message}</div>`;
        }
    }

    // 删除短链接（复用 admin API）
    async function deleteMyShare(id, code) {
        if (!confirm(`确定删除短链接 "${code}" 吗？`)) return;
        try {
            const res = await fetch(`/api/admin/shares/${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                loadMyShares();
            } else {
                alert(data.error || '删除失败');
            }
        } catch (err) {
            alert('网络错误');
        }
    }
    window.deleteMyShare = deleteMyShare;

    // 修改短码
    async function editMyShare(id, currentCode) {
        const newCode = prompt('mark.lcy.app/', currentCode);
        if (newCode === null || newCode.trim() === '' || newCode.trim() === currentCode) return;
        try {
            const res = await fetch(`/api/admin/shares/${id}/domain`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ domain: newCode.trim() })
            });
            const data = await res.json();
            if (data.success) {
                loadMyShares();
            } else {
                alert(data.error || '修改失败');
            }
        } catch (err) {
            alert('网络错误');
        }
    }
    window.editMyShare = editMyShare;

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

                // 同步后重新定位 selectedFolder（引用可能已失效）
                if (selectedFolder) {
                    const found = findFolderByName(bookmarks, selectedFolder.name);
                    if (found) {
                        selectedFolder = found;
                        selectedFolderName.textContent = found.name;
                        updateBookmarksList(found.children || []);
                        updateSelectedStateByFolder(found);
                    } else {
                        // 文件夹已不存在，回到默认
                        selectDefaultFolder();
                    }
                } else {
                    selectDefaultFolder();
                }
            }
        } catch (err) {
            console.log('后台同步失败', err);
        }
    }

    // 在文件夹树中按名称查找文件夹对象
    function findFolderByName(items, name) {
        for (const item of items) {
            if (item.type === 'folder' && item.name === name) return item;
            if (item.type === 'folder' && item.children) {
                const found = findFolderByName(item.children, name);
                if (found) return found;
            }
        }
        return null;
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

        // 多选模式 checkbox（放在 header 内部）
        if (multiSelectMode) {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'select-checkbox';
            // 检查是否已选中
            const isSelected = selectedItems.some(s => s.item === folder);
            if (isSelected) checkbox.checked = true;
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleSelectItem('folder', folder, parentArray, checkbox);
            });
            header.appendChild(checkbox);
        }
        
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
        
        header.onclick = (e) => {
            if (multiSelectMode && e.target.tagName === 'INPUT') return;
            if (multiSelectMode) return;
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

    function updateBookmarksList(items, highlightKeyword) {
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

        // 再渲染书签，传入 items 作为 parentArray（用于删除/插入定位）
        const bookmarkArray = items.filter(item => item.type === 'bookmark');
        for (let i = 0; i < bookmarkArray.length; i++) {
            fragment.appendChild(renderBookmarkItem(bookmarkArray[i], items, highlightKeyword));
        }

        bookmarksList.appendChild(fragment);
    }

    // ====== 多选功能 ======

    function enterMultiSelectMode() {
        if (multiSelectMode) return;
        multiSelectMode = true;
        selectedItems = [];
        multiSelectBar.classList.remove('hidden');
        // 重新渲染左侧文件夹树和右侧内容区以显示 checkbox
        renderFolderTree();
        if (selectedFolder) {
            updateBookmarksList(selectedFolder.children || []);
        }
        updateMultiSelectUI();
    }

    function exitMultiSelectMode() {
        multiSelectMode = false;
        selectedItems = [];
        multiSelectBar.classList.add('hidden');
        // 关闭所有书签菜单
        document.querySelectorAll('.bookmark-dropdown').forEach(d => d.classList.add('hidden'));
        // 重新渲染左侧文件夹树和右侧内容区以移除 checkbox
        renderFolderTree();
        if (selectedFolder) {
            updateBookmarksList(selectedFolder.children || []);
        }
        updateMultiSelectUI();
    }

    function updateMultiSelectUI() {
        multiSelectCount.textContent = `已选 ${selectedItems.length} 项`;
        const selectAllCheckbox = document.getElementById('multi-select-all-check');
        if (selectAllCheckbox) {
            const allItems = getAllSelectableItems();
            selectAllCheckbox.checked = allItems.length > 0 && selectedItems.length === allItems.length;
            selectAllCheckbox.indeterminate = selectedItems.length > 0 && selectedItems.length < allItems.length;
        }
    }

    // 获取当前视图所有可选项
    function getAllSelectableItems() {
        const items = [];
        // 递归收集所有文件夹
        function collectFolders(arr, parentArr) {
            for (const item of arr) {
                if (item.type !== 'folder') continue;
                items.push({ type: 'folder', item: item, parentArray: parentArr });
                if (item.children) {
                    collectFolders(item.children, item.children);
                }
            }
        }
        collectFolders(bookmarks, bookmarks);
        // 当前选中文件夹下的书签
        if (selectedFolder && selectedFolder.children) {
            selectedFolder.children.forEach(bm => {
                if (bm.type === 'bookmark') {
                    items.push({ type: 'bookmark', item: bm, parentArray: selectedFolder.children });
                }
            });
        }
        return items;
    }

    // 全选/取消全选
    function toggleSelectAll() {
        const allItems = getAllSelectableItems();
        if (selectedItems.length === allItems.length) {
            // 取消全选
            selectedItems = [];
            document.querySelectorAll('.select-checkbox').forEach(cb => cb.checked = false);
        } else {
            // 全选
            selectedItems = allItems.map(a => ({ type: a.type, item: a.item, parentArray: a.parentArray || null }));
            document.querySelectorAll('.select-checkbox').forEach(cb => cb.checked = true);
        }
        updateMultiSelectUI();
    }
    window._markToggleSelectAll = toggleSelectAll;

    function toggleSelectItem(type, item, parentArray, checkboxEl) {
        const idx = selectedItems.findIndex(s => s.item === item);
        if (idx !== -1) {
            selectedItems.splice(idx, 1);
            if (checkboxEl) checkboxEl.checked = false;
        } else {
            selectedItems.push({ type, item, parentArray });
            if (checkboxEl) checkboxEl.checked = true;
        }
        updateMultiSelectUI();
    }

    async function batchDelete() {
        if (selectedItems.length === 0) return;
        if (!confirm(`确定要删除选中的 ${selectedItems.length} 项吗？此操作不可撤销。`)) return;

        for (const sel of selectedItems) {
            if (sel.type === 'folder') {
                removeFolderFromTree(sel.item);
            } else {
                const arr = sel.parentArray || (selectedFolder && selectedFolder.children);
                if (arr) {
                    const idx = arr.indexOf(sel.item);
                    if (idx !== -1) arr.splice(idx, 1);
                }
            }
        }
        await saveBookmarks();
        exitMultiSelectMode();
        renderFolderTree();
        if (selectedFolder) {
            updateBookmarksList(selectedFolder.children || []);
        }
        showToast('删除成功');
    }

    function removeFolderFromTree(target) {
        function removeFrom(items) {
            for (let i = items.length - 1; i >= 0; i--) {
                if (items[i] === target) {
                    items.splice(i, 1);
                    return true;
                }
                if (items[i].type === 'folder' && items[i].children) {
                    if (removeFrom(items[i].children)) return true;
                }
            }
            return false;
        }
        removeFrom(bookmarks);
    }

    async function batchMove() {
        if (selectedItems.length === 0) return;
        // 弹出文件夹树选择器
        const target = await showFolderPicker();
        if (!target) return;

        for (const sel of selectedItems) {
            const srcArr = sel.parentArray || (selectedFolder && selectedFolder.children);
            if (!srcArr) continue;
            const idx = srcArr.indexOf(sel.item);
            if (idx === -1) continue;
            // 不能移动到自己的子文件夹里
            if (sel.type === 'folder' && isDescendant(target, sel.item)) {
                showToast(`不能将「${sel.item.name}」移动到其子文件夹中`);
                continue;
            }
            srcArr.splice(idx, 1);
            target.children.push(sel.item);
        }
        await saveBookmarks();
        exitMultiSelectMode();
        renderFolderTree();
        if (selectedFolder) {
            updateBookmarksList(selectedFolder.children || []);
        }
        showToast('移动成功');
    }

    async function batchCopy() {
        if (selectedItems.length === 0) return;
        const target = await showFolderPicker();
        if (!target) return;

        for (const sel of selectedItems) {
            if (sel.type === 'folder' && isDescendant(target, sel.item)) {
                showToast(`不能将「${sel.item.name}」拷贝到其子文件夹中`);
                continue;
            }
            const clone = deepCloneItem(sel.item);
            target.children.push(clone);
        }
        await saveBookmarks();
        exitMultiSelectMode();
        renderFolderTree();
        if (selectedFolder) {
            updateBookmarksList(selectedFolder.children || []);
        }
        showToast('拷贝成功');
    }

    function deepCloneItem(item) {
        if (item.type === 'bookmark') {
            return { type: 'bookmark', title: item.title, url: item.url, favicon: item.favicon };
        }
        if (item.type === 'folder') {
            return {
                type: 'folder',
                name: item.name,
                children: (item.children || []).map(c => deepCloneItem(c))
            };
        }
        return JSON.parse(JSON.stringify(item));
    }

    function isDescendant(parent, folder) {
        if (parent === folder) return true;
        if (!parent.children) return false;
        for (const child of parent.children) {
            if (child.type === 'folder' && isDescendant(child, folder)) return true;
        }
        return false;
    }

    function showFolderPicker() {
        return new Promise((resolve) => {
            const overlay = document.createElement('div');
            overlay.className = 'modal';
            overlay.innerHTML = `
                <div class="modal-content folder-picker-content">
                    <h3>选择目标文件夹</h3>
                    <div class="folder-picker-tree" id="folder-picker-tree"></div>
                    <div class="input-modal-actions" style="margin-top:16px">
                        <button class="input-modal-btn input-modal-btn--cancel" id="fp-cancel">取消</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const treeContainer = overlay.querySelector('#folder-picker-tree');
            renderFolderPickerTree(treeContainer, bookmarks, 0);

            overlay.querySelector('#fp-cancel').addEventListener('click', () => {
                document.body.removeChild(overlay);
                resolve(null);
            });
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    document.body.removeChild(overlay);
                    resolve(null);
                }
            });
        });
    }

    function renderFolderPickerTree(container, folders, depth) {
        folders.forEach(folder => {
            if (folder.type !== 'folder') return;
            const item = document.createElement('div');
            item.className = 'folder-picker-item';
            item.style.paddingLeft = `${depth * 16 + 12}px`;
            item.innerHTML = `<span style="font-size:16px">&#x1F4C1;</span> ${folder.name}`;
            item.addEventListener('click', () => {
                // 关闭弹窗
                const overlay = item.closest('.modal');
                if (overlay) document.body.removeChild(overlay);
                // resolve 被外层闭包捕获，这里用事件方式传递
                resolveFolderPicker(folder);
            });
            container.appendChild(item);
            if (folder.children) {
                renderFolderPickerTree(container, folder.children, depth + 1);
            }
        });
    }

    // 全局变量传递 folder picker 结果
    let _folderPickerResolve = null;
    function resolveFolderPicker(folder) {
        if (_folderPickerResolve) {
            _folderPickerResolve(folder);
            _folderPickerResolve = null;
        }
    }

    // 修改 showFolderPicker 使用全局 resolve
    // 覆盖之前的 showFolderPicker
    const _origShowFolderPicker = showFolderPicker;
    showFolderPicker = function() {
        return new Promise((resolve) => {
            _folderPickerResolve = resolve;
            const overlay = document.createElement('div');
            overlay.className = 'modal';
            overlay.innerHTML = `
                <div class="modal-content folder-picker-content">
                    <h3>选择目标文件夹</h3>
                    <div class="folder-picker-tree" id="folder-picker-tree"></div>
                    <div class="input-modal-actions" style="margin-top:16px">
                        <button class="input-modal-btn input-modal-btn--cancel" id="fp-cancel">取消</button>
                    </div>
                </div>
            `;
            document.body.appendChild(overlay);

            const treeContainer = overlay.querySelector('#folder-picker-tree');
            renderFolderPickerTree(treeContainer, bookmarks, 0);

            overlay.querySelector('#fp-cancel').addEventListener('click', () => {
                document.body.removeChild(overlay);
                _folderPickerResolve = null;
                resolve(null);
            });
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    document.body.removeChild(overlay);
                    _folderPickerResolve = null;
                    resolve(null);
                }
            });
        });
    };

    async function batchShare() {
        if (selectedItems.length === 0) return;
        const res = await showInputModal('分享', '输入短码（字母或数字）', null, '');
        if (!res || !res.v1) return;
        const code = res.v1.trim();
        if (!code) return;

        // 构建分享内容
        const shareItems = selectedItems.map(s => {
            if (s.type === 'folder') {
                return { type: 'folder', name: s.item.name, children: s.item.children || [] };
            }
            return { type: 'bookmark', title: s.item.title, url: s.item.url };
        });

        try {
            const resp = await fetch(`${API_URL}/share/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: currentUserId,
                    code: code,
                    title: selectedFolder ? selectedFolder.name : '书签分享',
                    content: shareItems
                })
            });
            const data = await resp.json();
            if (!resp.ok) {
                showToast(data.error || '创建分享失败');
                return;
            }
            const shareUrl = `https://mark.lcy.app/${code}`;
            if (navigator.clipboard) {
                await navigator.clipboard.writeText(shareUrl);
            } else {
                const ta = document.createElement('textarea');
                ta.value = shareUrl;
                ta.style.position = 'fixed'; ta.style.left = '-9999px';
                document.body.appendChild(ta);
                ta.select();
                document.execCommand('copy');
                document.body.removeChild(ta);
            }
            showToast(`已复制：${shareUrl}`);
            exitMultiSelectMode();
        } catch (err) {
            showToast('创建分享失败');
        }
    }

    // 多选操作栏事件绑定
    if (multiCancelBtn) {
        multiCancelBtn.addEventListener('click', exitMultiSelectMode);
    }
    if (multiDeleteBtn) {
        multiDeleteBtn.addEventListener('click', batchDelete);
    }
    if (multiCopyBtn) {
        multiCopyBtn.addEventListener('click', batchCopy);
    }
    if (multiMoveBtn) {
        multiMoveBtn.addEventListener('click', batchMove);
    }
    if (multiShareBtn) {
        multiShareBtn.addEventListener('click', batchShare);
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

        // 多选模式 checkbox
        if (multiSelectMode) {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'select-checkbox';
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleSelectItem('folder', folder, null, checkbox);
            });
            div.insertBefore(checkbox, div.firstChild);
            div.classList.add('multi-select-item');
        }

        div.onclick = (e) => {
            if (multiSelectMode && e.target.tagName === 'INPUT') return;
            if (multiSelectMode) return;
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

    function renderBookmarkItem(bookmark, parentArray, highlightKeyword) {
        const div = document.createElement('a');
        div.className = 'bookmark-item';
        div.href = bookmark.url;
        div.target = '_blank';

        const favicon = document.createElement('img');
        favicon.className = 'bookmark-favicon';
        // 初始状态：透明占位，不显示任何默认图标
        favicon.style.opacity = '0';

        try {
            const urlObj = new URL(bookmark.url);
            const googleFavicon = 'https://www.google.com/s2/favicons?domain=' + urlObj.hostname + '&sz=32';
            const fallbackFavicon = urlObj.origin + '/favicon.ico';

            // 先用 Google favicon，加载成功后显示
            const img = new Image();
            img.onload = function() {
                favicon.src = googleFavicon;
                favicon.style.opacity = '1';
            };
            img.onerror = function() {
                // Google 失败，尝试 fallback
                const img2 = new Image();
                img2.onload = function() {
                    favicon.src = fallbackFavicon;
                    favicon.style.opacity = '1';
                };
                img2.onerror = function() {
                    // 都失败，保持透明与背景融为一体
                };
                img2.src = fallbackFavicon;
            };
            img.src = googleFavicon;
        } catch (e) {
            // URL 解析失败，保持透明
        }

        const info = document.createElement('div');
        info.className = 'bookmark-info';

        // 高亮匹配关键词
        function highlightText(text, keyword) {
            if (!keyword) return text;
            const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`(${escaped})`, 'gi');
            return text.replace(regex, '<mark class="search-highlight">$1</mark>');
        }

        const title = document.createElement('h3');
        title.innerHTML = highlightKeyword ? highlightText(bookmark.title, highlightKeyword) : bookmark.title;
        const url = document.createElement('p');
        url.innerHTML = highlightKeyword ? highlightText(bookmark.url, highlightKeyword) : bookmark.url;
        info.appendChild(title);
        info.appendChild(url);

        div.appendChild(favicon);
        div.appendChild(info);

        // 多选模式 checkbox
        if (multiSelectMode) {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'select-checkbox';
            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                toggleSelectItem('bookmark', bookmark, parentArray, checkbox);
            });
            div.insertBefore(checkbox, div.firstChild);
            div.classList.add('multi-select-item');
            // 多选模式下禁止跳转链接
            div.addEventListener('click', (e) => {
                if (e.target.tagName !== 'INPUT') {
                    e.preventDefault();
                }
            });
        }

        // ====== 书签菜单栏 ======
        const menuBtn = document.createElement('button');
        menuBtn.className = 'bookmark-menu-btn';
        menuBtn.textContent = '...';
        menuBtn.title = '更多操作';

        const dropdown = document.createElement('div');
        dropdown.className = 'bookmark-dropdown dropdown-menu hidden';

        const menuItems = [
            { label: '修改标题', action: 'rename-title' },
            { label: '修改链接', action: 'rename-url' },
            { label: '复制链接', action: 'share' },
            { divider: true },
            { label: '在此下方添加链接', action: 'add-below' },
            { divider: true },
            { label: '删除', action: 'delete', danger: true },
        ];

        menuItems.forEach(item => {
            if (item.divider) {
                const d = document.createElement('div');
                d.className = 'dropdown-divider';
                dropdown.appendChild(d);
                return;
            }
            const btn = document.createElement('button');
            btn.className = 'dropdown-item' + (item.danger ? ' dropdown-item--danger' : '');
            btn.textContent = item.label;
            btn.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();
                dropdown.classList.add('hidden');

                if (item.action === 'rename-title') {
                    const res = await showInputModal('修改标题', '新标题', null, bookmark.title);
                    if (!res || !res.v1) return;
                    bookmark.title = res.v1;
                    title.textContent = res.v1;
                    await saveBookmarks();
                }
                else if (item.action === 'rename-url') {
                    const res = await showInputModal('修改链接', '新链接地址', null, bookmark.url);
                    if (!res || !res.v1) return;
                    let newUrl = res.v1.trim();
                    if (!/^https?:\/\//i.test(newUrl) && !/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(newUrl)) {
                        newUrl = 'https://' + newUrl;
                    }
                    bookmark.url = newUrl;
                    url.textContent = newUrl;
                    div.href = newUrl;
                    await saveBookmarks();
                }
                else if (item.action === 'share') {
                    if (navigator.clipboard) {
                        await navigator.clipboard.writeText(bookmark.url);
                    } else {
                        const ta = document.createElement('textarea');
                        ta.value = bookmark.url;
                        ta.style.position = 'fixed';
                        ta.style.left = '-9999px';
                        document.body.appendChild(ta);
                        ta.select();
                        document.execCommand('copy');
                        document.body.removeChild(ta);
                    }
                    showToast('已复制到剪贴板');
                }
                else if (item.action === 'add-below') {
                    const res = await showInputModal('在此下方添加链接', '标题', '链接地址（https://...）');
                    if (!res || !res.v1) return;
                    let newUrl = res.v2.trim();
                    if (!newUrl) return;
                    if (!/^https?:\/\//i.test(newUrl) && !/^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(newUrl)) {
                        newUrl = 'https://' + newUrl;
                    }
                    const newBookmark = {
                        type: 'bookmark',
                        title: res.v1,
                        url: newUrl,
                        dateAdded: Math.floor(Date.now() / 1000)
                    };
                    // 插入到 bookmark 的后面
                    if (parentArray) {
                        const idx = parentArray.indexOf(bookmark);
                        if (idx !== -1) {
                            parentArray.splice(idx + 1, 0, newBookmark);
                        } else {
                            parentArray.push(newBookmark);
                        }
                    } else if (selectedFolder && selectedFolder.children) {
                        const idx = selectedFolder.children.indexOf(bookmark);
                        if (idx !== -1) {
                            selectedFolder.children.splice(idx + 1, 0, newBookmark);
                        } else {
                            selectedFolder.children.push(newBookmark);
                        }
                    }
                    await saveBookmarks();
                    // 刷新当前视图
                    if (selectedFolder) {
                        updateBookmarksList(selectedFolder.children || []);
                    }
                }
                else if (item.action === 'delete') {
                    if (!confirm(`确定要删除书签「${bookmark.title}」吗？`)) return;
                    // 从 parentArray 或 selectedFolder.children 中删除
                    const arr = parentArray || (selectedFolder && selectedFolder.children);
                    if (arr) {
                        const idx = arr.indexOf(bookmark);
                        if (idx !== -1) arr.splice(idx, 1);
                    }
                    await saveBookmarks();
                    div.remove();
                }
            });
            dropdown.appendChild(btn);
        });

        // 三点按钮切换菜单
        menuBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            // 关闭其他所有书签菜单
            document.querySelectorAll('.bookmark-dropdown').forEach(d => {
                if (d !== dropdown) d.classList.add('hidden');
            });
            dropdown.classList.toggle('hidden');
        });

        div.appendChild(menuBtn);
        div.appendChild(dropdown);

        // 点击页面其他地方关闭
        document.addEventListener('click', () => {
            dropdown.classList.add('hidden');
        }, { once: false });

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
                loadPreferences();
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