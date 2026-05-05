// ========== dock.js ==========
const DockManager = {
    config: {
        animationDuration: 400,
        bounceDuration: 600,
        indicatorColor: '#007aff',
        minimizedIndicatorColor: '#ff9f0a'
    },

    runningApps: new Map(),
    fixedApps: [],

    init() {
        this.fixedPanel = document.getElementById('dock-panel-fixed');
        this.dynamicPanel = document.getElementById('dock-panel-dynamic');
        this.placeholder = document.getElementById('dock-placeholder');
        
        if (!this.fixedPanel || !this.dynamicPanel) {
            console.error('Dock panels not found');
            return;
        }
        
        // 自动检测固定应用列表
        this.detectFixedApps();
        
        this.initFixedDock();
        this.bindGlobalEvents();
        this.updatePlaceholder();
        console.log('双dock启动');
    },

    // 自动检测固定应用
    detectFixedApps() {
        const fixedItems = this.fixedPanel.querySelectorAll('.dock-item-fixed[data-app]');
        this.fixedApps = Array.from(fixedItems).map(item => item.dataset.app);
    },

    initFixedDock() {
        const fixedItems = this.fixedPanel.querySelectorAll('.dock-item-fixed');
        fixedItems.forEach(item => {
            const appName = item.dataset.app;
            
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.handleFixedDockClick(appName);
            });
            
            item.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                this.handleFixedDockContextMenu(appName, e);
            });
        });
    },

    bindGlobalEvents() {
        window.addEventListener('appOpened', (e) => {
            this.onAppOpened(e.detail.appName, e.detail.windowId);
        });
        window.addEventListener('appClosed', (e) => {
            this.onAppClosed(e.detail.appName, e.detail.windowId);
        });
        window.addEventListener('windowMinimized', (e) => {
            this.onWindowMinimized(e.detail.appName, e.detail.windowId);
        });
        window.addEventListener('windowRestored', (e) => {
            this.onWindowRestored(e.detail.appName, e.detail.windowId);
        });
        window.addEventListener('windowFocused', (e) => {
            this.onWindowFocused(e.detail.appName, e.detail.windowId);
        });
    },

    onAppOpened(appName, windowId) {
        if (this.fixedApps.includes(appName)) {
            const fixedItem = this.fixedPanel.querySelector(`[data-app="${appName}"]`);
            if (fixedItem) {
                const indicator = fixedItem.querySelector('.dock-indicator');
                if (indicator) indicator.classList.add('active');
            }
            return;
        }
        
        let appState = this.runningApps.get(appName);

        if (!appState) {
            const dockItem = this.createDynamicDockItem(appName);
            if (!dockItem) return;
            
            appState = {
                windows: [windowId],
                dockItem: dockItem,
                state: 'normal'
            };
            this.runningApps.set(appName, appState);
        } else {
            if (!appState.windows.includes(windowId)) {
                appState.windows.push(windowId);
            }
        }
        
        this.updateDockItemState(appState);
        this.updatePlaceholder();
    },

    onAppClosed(appName, windowId) {
        if (this.fixedApps.includes(appName)) {
            const hasWindows = window.windows && window.windows.some(w => w.app === appName);
            if (!hasWindows) {
                const fixedItem = this.fixedPanel.querySelector(`[data-app="${appName}"]`);
                if (fixedItem) {
                    const indicator = fixedItem.querySelector('.dock-indicator');
                    if (indicator) indicator.classList.remove('active');
                    fixedItem.classList.remove('dock-item-active');
                }
            }
            return;
        }
        
        const appState = this.runningApps.get(appName);
        if (!appState) return;

        appState.windows = appState.windows.filter(id => id !== windowId);

        if (appState.windows.length === 0) {
            this.animateItemRemove(appState.dockItem, () => {
                if (appState.dockItem.parentNode) {
                    appState.dockItem.remove();
                }
                this.runningApps.delete(appName);
                this.updatePlaceholder();
            });
        } else {
            this.updateDockItemState(appState);
        }
    },

    onWindowMinimized(appName, windowId) {
        if (this.fixedApps.includes(appName)) {
            const allMinimized = this.checkAllWindowsMinimized(appName);
            const dockItem = this.fixedPanel.querySelector(`[data-app="${appName}"]`);
            if (dockItem && allMinimized) {
                dockItem.classList.add('dock-item-minimized');
            }
            return;
        }
        
        const appState = this.runningApps.get(appName);
        if (!appState) return;

        const allMinimized = this.checkAllWindowsMinimized(appName);
        if (allMinimized) {
            appState.state = 'minimized';
            this.updateDockItemState(appState);
        }
    },

    onWindowRestored(appName, windowId) {
        if (this.fixedApps.includes(appName)) {
            const dockItem = this.fixedPanel.querySelector(`[data-app="${appName}"]`);
            if (dockItem) {
                dockItem.classList.remove('dock-item-minimized');
            }
            return;
        }
        
        const appState = this.runningApps.get(appName);
        if (!appState) return;
        
        appState.state = 'normal';
        this.updateDockItemState(appState);
    },

    onWindowFocused(appName, windowId) {
        // 清除所有 Dock 项的焦点状态
        document.querySelectorAll('.dock-item').forEach(item => {
            item.classList.remove('dock-item-active');
        });

        // 设置当前焦点
        let dockItem;
        if (this.fixedApps.includes(appName)) {
            dockItem = this.fixedPanel.querySelector(`[data-app="${appName}"]`);
        } else {
            const appState = this.runningApps.get(appName);
            if (appState) {
                dockItem = appState.dockItem;
            }
        }
        
        if (dockItem) {
            dockItem.classList.add('dock-item-active');
        }
    },

    createDynamicDockItem(appName) {
        const app = window.appConfig ? window.appConfig[appName] : null;
        if (!app) {
            console.error('Unknown app:', appName);
            return null;
        }

        const dockItem = document.createElement('div');
        dockItem.className = 'dock-item dock-item-dynamic';
        dockItem.dataset.app = appName;
        dockItem.dataset.dynamic = 'true';

        const iconColor = this.getIconColor(appName);
        const iconClass = this.getIconClass(appName);

        dockItem.innerHTML = `
            <div class="dock-icon">
                <img src="./webp/${appName}.webp" alt="${app.title}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                <i class="${iconClass}" style="display: none; font-size: 28px; color: ${iconColor};"></i>
            </div>
            <div class="dock-label">${app.title}</div>
            <div class="dock-indicator"></div>
        `;

        dockItem.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handleDynamicDockClick(appName);
        });
        
        dockItem.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.handleDynamicDockContextMenu(appName, e);
        });

        // 插入到占位符之前
        if (this.placeholder && this.placeholder.parentNode === this.dynamicPanel) {
            this.dynamicPanel.insertBefore(dockItem, this.placeholder);
        } else {
            this.dynamicPanel.appendChild(dockItem);
        }

        return dockItem;
    },

    handleFixedDockClick(appName) {
        if (appName === 'trash') {
            alert('🗑️ 废纸篓（演示）\n当前没有要删除的项目');
            return;
        }

        const existingWindows = window.windows ? window.windows.filter(w => w.app === appName) : [];
        const visibleWindows = existingWindows.filter(w => !w.minimized);
        const minimizedWindows = existingWindows.filter(w => w.minimized);

        if (existingWindows.length === 0) {
            // 没有窗口，打开新窗口
            if (window.openApp) window.openApp(appName);
        } else if (visibleWindows.length > 0) {
            // 有可见窗口，最小化所有
            this.minimizeAllWindows(appName);
        } else if (minimizedWindows.length > 0) {
            // 有最小化窗口，恢复它们
            this.restoreAllWindows(appName);
        }
        
        // 弹跳动画
        const dockItem = this.fixedPanel.querySelector(`[data-app="${appName}"]`);
        if (dockItem) this.animateBounce(dockItem);
    },

    handleDynamicDockClick(appName) {
        const appState = this.runningApps.get(appName);
        if (!appState) return;

        if (appState.state === 'minimized') {
            this.restoreAllWindows(appName);
            appState.state = 'normal';
        } else {
            const visibleWindows = this.getVisibleWindows(appName);
            if (visibleWindows.length > 0) {
                this.minimizeAllWindows(appName);
                appState.state = 'minimized';
            } else {
                this.restoreAllWindows(appName);
                appState.state = 'normal';
            }
        }
        
        this.updateDockItemState(appState);
        this.animateBounce(appState.dockItem);
    },

    handleFixedDockContextMenu(appName, event) {
        if (appName === 'trash') return;
        
        const menuItems = [
            { label: '打开', action: () => this.handleFixedDockClick(appName) },
            { separator: true },
            { label: '从 Dock 中移除', action: () => alert('固定应用无法从 Dock 移除'), disabled: true }
        ];
        
        this.showContextMenu(event.clientX, event.clientY, menuItems);
    },

    handleDynamicDockContextMenu(appName, event) {
        const appState = this.runningApps.get(appName);
        if (!appState) return;
        
        const menuItems = [];
        
        if (appState.state === 'minimized') {
            menuItems.push({ label: '显示所有窗口', action: () => this.restoreAllWindows(appName) });
        } else {
            menuItems.push({ label: '隐藏', action: () => this.minimizeAllWindows(appName) });
        }
        
        menuItems.push(
            { separator: true },
            { label: '退出', action: () => this.quitApp(appName), danger: true }
        );
        
        this.showContextMenu(event.clientX, event.clientY, menuItems);
    },

    getVisibleWindows(appName) {
        return window.windows ? window.windows.filter(w => 
            w.app === appName && !w.minimized
        ) : [];
    },

    checkAllWindowsMinimized(appName) {
        const appWindows = window.windows ? window.windows.filter(w => w.app === appName) : [];
        return appWindows.length > 0 && appWindows.every(w => w.minimized);
    },

    minimizeAllWindows(appName) {
        const appWindows = window.windows ? window.windows.filter(w => w.app === appName && !w.minimized) : [];
        appWindows.forEach(win => {
            if (window.minimizeWindow) window.minimizeWindow(win);
        });
    },

    restoreAllWindows(appName) {
        const appWindows = window.windows ? window.windows.filter(w => w.app === appName && w.minimized) : [];
        appWindows.forEach(win => {
            if (window.restoreWindow) window.restoreWindow(win);
        });
    },

    quitApp(appName) {
        const appWindows = window.windows ? window.windows.filter(w => w.app === appName) : [];
        appWindows.forEach(win => {
            if (window.closeWindow) window.closeWindow(win);
        });
    },

    updateDockItemState(appState) {
        const indicator = appState.dockItem.querySelector('.dock-indicator');
        if (!indicator) return;

        if (appState.windows.length > 0) {
            indicator.classList.add('active');
        } else {
            indicator.classList.remove('active');
        }

        appState.dockItem.classList.toggle('dock-item-minimized', appState.state === 'minimized');
    },

    updatePlaceholder() {
        if (!this.placeholder) return;
        
        const hasRunningApps = this.runningApps.size > 0;
        if (hasRunningApps) {
            this.placeholder.classList.add('hidden');
        } else {
            this.placeholder.classList.remove('hidden');
        }
    },

    animateItemRemove(dockItem, callback) {
        dockItem.classList.add('removing');
        setTimeout(() => {
            if (callback) callback();
        }, 300);
    },

    animateBounce(dockItem) {
        dockItem.classList.remove('anim-dock-bounce');
        void dockItem.offsetWidth; // 强制重绘
        dockItem.classList.add('anim-dock-bounce');
        setTimeout(() => dockItem.classList.remove('anim-dock-bounce'), this.config.bounceDuration);
    },

    getIconColor(appName) {
        const colors = {
            finder: '#007aff', safari: '#007aff', calendar: '#ff3b30',
            photos: '#30d158', settings: '#8e8e93', about: '#007aff',
            mornstartpage: '#30d158', yd: '#30d158', trash: '#8e8e93'
        };
        return colors[appName] || '#007aff';
    },

    getIconClass(appName) {
        const icons = {
            finder: 'fas fa-folder', safari: 'fas fa-globe', calendar: 'fas fa-calendar-alt',
            photos: 'fas fa-images', settings: 'fas fa-cog', about: 'fas fa-info-circle',
            mornstartpage: 'fas fa-star-of-life', yd: 'fas fa-language', trash: 'fas fa-trash-alt'
        };
        return icons[appName] || 'fas fa-circle';
    },

    showContextMenu(x, y, items) {
        const existing = document.querySelector('.dock-context-menu');
        if (existing) existing.remove();

        const menu = document.createElement('div');
        menu.className = 'dock-context-menu';
        menu.style.cssText = `
            position: fixed; 
            background: rgba(255,255,255,0.9); 
            backdrop-filter: blur(20px);
            border-radius: 8px; 
            box-shadow: 0 8px 32px rgba(0,0,0,0.15); 
            padding: 6px 0;
            z-index: 10000; 
            min-width: 160px; 
            left: ${x}px; 
            top: ${y}px;
        `;

        items.forEach(item => {
            if (item.separator) {
                const sep = document.createElement('div');
                sep.style.cssText = 'height: 1px; background: rgba(0,0,0,0.1); margin: 6px 0;';
                menu.appendChild(sep);
            } else {
                const menuItem = document.createElement('div');
                menuItem.className = 'dock-context-item';
                menuItem.textContent = item.label;
                menuItem.style.cssText = `
                    padding: 8px 16px; 
                    cursor: ${item.disabled ? 'default' : 'pointer'}; 
                    font-size: 13px;
                    color: ${item.danger ? '#ff3b30' : item.disabled ? '#999' : '#1c1c1e'}; 
                    transition: background 0.15s;
                    opacity: ${item.disabled ? '0.6' : '1'};
                `;
                
                if (!item.disabled) {
                    menuItem.addEventListener('mouseenter', () => menuItem.style.background = 'rgba(0,122,255,0.1)');
                    menuItem.addEventListener('mouseleave', () => menuItem.style.background = 'transparent');
                    menuItem.addEventListener('click', () => { item.action(); menu.remove(); });
                }
                
                menu.appendChild(menuItem);
            }
        });

        document.body.appendChild(menu);
        
        setTimeout(() => {
            const closeMenu = (e) => {
                if (!menu.contains(e.target)) {
                    menu.remove();
                    document.removeEventListener('click', closeMenu);
                }
            };
            document.addEventListener('click', closeMenu);
        }, 100);
    }
};

// 初始化
window.DockManager = DockManager;
document.addEventListener('DOMContentLoaded', () => DockManager.init());
