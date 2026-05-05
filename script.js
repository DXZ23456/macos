// ========== script.js ==========
let windows = [];
window.windows = windows;
let nextWindowId = 1;
let highestZ = 1000;
let activeWindow = null;

let dragState = {
    active: false,
    target: null,
    startX: 0,
    startY: 0,
    startLeft: 0,
    startTop: 0
};

let resizeState = {
    active: false,
    target: null,
    direction: '',
    startX: 0,
    startY: 0,
    startWidth: 0,
    startHeight: 0,
    startLeft: 0,
    startTop: 0
};

let overlay = null;
let animationManager = null;

// 全局单例监听器标志
let globalListenersBound = false;
let resizeFrame = null;          

function getEventCoords(e) {
    if (e.touches && e.touches.length) {
        return { clientX: e.touches[0].clientX, clientY: e.touches[0].clientY };
    }
    return { clientX: e.clientX, clientY: e.clientY };
}

// 应用配置
const appConfig = {
    finder: { title: "访达", src: "apps/finder.html", defaultW: 650, defaultH: 450 },
    safari: { title: "Safari", src: "apps/safari.html", defaultW: 700, defaultH: 480 },
    calendar: { title: "日历", src: "apps/calendar.html", defaultW: 600, defaultH: 450 },
    photos: { title: "照片", src: "apps/photos.html", defaultW: 700, defaultH: 500 },
    settings: { title: "设置", src: "apps/settings.html", defaultW: 600, defaultH: 450 },
    weather:  { title: "天气", src: "apps/weather.html", defaultW: 700, defaultH: 480 },
    yd: { title: "有道", src: "https://youdao.com/", defaultW: 650, defaultH: 450 },
    about: { title: "关于本机", src: "apps/about.html", defaultW: 500, defaultH: 400 },
    quest: { title: "待办", src: "apps/quest.html", defaultW: 500, defaultH: 400 },
    xn: { title: "小宁AI", src: "apps/xn.html", defaultW: 500, defaultH: 400 },
    text: { title: "测试", src: "apps/text.html", defaultW: 500, defaultH: 400 }
};

// 获取菜单栏实际高度
function getMenuBarHeight() {
    const menuBar = document.querySelector('.menu-bar');
    return menuBar ? menuBar.offsetHeight : 28;
}

// 获取 Dock 区域实际高度
function getDockHeight() {
    const dockWrapper = document.querySelector('.dock-wrapper');
    if (!dockWrapper) return 78;
    const rect = dockWrapper.getBoundingClientRect();
    return rect.height;
}

// 拖拽边界限制
function applyDragBoundaries(winDiv, newLeft, newTop) {
    const winWidth = winDiv.offsetWidth;
    const winHeight = winDiv.offsetHeight;
    const menuH = getMenuBarHeight();
    const dockH = getDockHeight();
    const maxTop = window.innerHeight - winHeight - dockH;
    newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - winWidth));
    newTop = Math.max(menuH, Math.min(newTop, maxTop));
    return { newLeft, newTop };
}

function applyResizeBoundaries(winDiv, newLeft, newTop, newWidth, newHeight) {
    const menuH = getMenuBarHeight();
    const dockH = getDockHeight();
    const minWidth = parseFloat(getComputedStyle(winDiv).minWidth) || 450;
    const minHeight = parseFloat(getComputedStyle(winDiv).minHeight) || 350;

    let width = Math.max(minWidth, newWidth);
    let height = Math.max(minHeight, newHeight);
    let left = newLeft;
    let top = newTop;

    // 右边界
    if (left + width > window.innerWidth) {
        width = window.innerWidth - left;
    }
    // 下边界（Dock 上方）
    if (top + height > window.innerHeight - dockH) {
        height = window.innerHeight - dockH - top;
    }
    // 左边界
    if (left < 0) {
        width += left;
        left = 0;
    }
    // 上边界（菜单栏下方）
    if (top < menuH) {
        height += top - menuH;
        top = menuH;
    }
    // 确保不小于最小值
    if (width < minWidth) width = minWidth;
    if (height < minHeight) height = minHeight;

    return { left, top, width, height };
}

// 通知 iframe 内容区域大小变化
function notifyResize(winObj) {
    const iframe = winObj.dom.querySelector('iframe');
    if (iframe && iframe.contentWindow) {
        const rect = winObj.dom.querySelector('.window-content').getBoundingClientRect();
        iframe.contentWindow.postMessage({
            type: 'resize',
            width: rect.width,
            height: rect.height
        }, '*');
    }
}

function notifyResizeThrottled(winObj) {
    if (resizeFrame) cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
        notifyResize(winObj);
        resizeFrame = null;
    });
}

// 同步深色模式到窗口
function syncDarkModeToWindow(winObj) {
    if (winObj.app === 'about') {
        const iframe = winObj.dom.querySelector('iframe');
        if (iframe && iframe.contentWindow) {
            const isDark = document.body.classList.contains('dark-mode');
            iframe.contentWindow.postMessage({ type: 'darkMode', enabled: isDark }, '*');
        }
    }
}

// ---------- 全局单例拖拽/调整大小移动处理 ----------
function onGlobalMove(clientX, clientY) {
    // 拖拽
    if (dragState.active && dragState.target) {
        const dx = clientX - dragState.startX;
        const dy = clientY - dragState.startY;
        let newLeft = dragState.startLeft + dx;
        let newTop = dragState.startTop + dy;
        const bounded = applyDragBoundaries(dragState.target, newLeft, newTop);
        dragState.target.style.left = bounded.newLeft + 'px';
        dragState.target.style.top = bounded.newTop + 'px';
    }

    // 调整大小
    if (resizeState.active && resizeState.target) {
        const dx = clientX - resizeState.startX;
        const dy = clientY - resizeState.startY;
        let newWidth = resizeState.startWidth;
        let newHeight = resizeState.startHeight;
        let newLeft = resizeState.startLeft;
        let newTop = resizeState.startTop;
        const dir = resizeState.direction;

        if (dir.includes('e')) newWidth = resizeState.startWidth + dx;
        if (dir.includes('w')) {
            newWidth = resizeState.startWidth - dx;
            newLeft = resizeState.startLeft + (resizeState.startWidth - newWidth);
        }
        if (dir.includes('s')) newHeight = resizeState.startHeight + dy;
        if (dir.includes('n')) {
            newHeight = resizeState.startHeight - dy;
            newTop = resizeState.startTop + (resizeState.startHeight - newHeight);
        }

        const bounded = applyResizeBoundaries(resizeState.target, newLeft, newTop, newWidth, newHeight);
        resizeState.target.style.left = bounded.left + 'px';
        resizeState.target.style.top = bounded.top + 'px';
        resizeState.target.style.width = bounded.width + 'px';
        resizeState.target.style.height = bounded.height + 'px';

        if (resizeState.target.__winObj) {
            notifyResizeThrottled(resizeState.target.__winObj);
        }
    }
}

function onGlobalUp() {
    // 拖拽结束
    if (dragState.active) {
        dragState.active = false;
        if (dragState.target && animationManager) {
            animationManager.animateDragEnd(dragState.target);
        } else if (dragState.target) {
            dragState.target.classList.remove('window-dragging');
        }
        dragState.target = null;
    }

    // 调整大小结束
    if (resizeState.active) {
        const win = resizeState.target;
        resizeState.active = false;
        if (win && animationManager) {
            animationManager.animateResizeEnd(win);
        } else if (win) {
            win.classList.remove('window-resizing');
        }
        if (win && win.__winObj) notifyResize(win.__winObj);
        resizeState.target = null;
    }
}

// 绑定全局单例监听器
function bindGlobalDragResizeListeners() {
    if (globalListenersBound) return;
    window.addEventListener('mousemove', (e) => onGlobalMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', onGlobalUp);
    window.addEventListener('touchmove', (e) => {
        if (dragState.active || resizeState.active) {
            e.preventDefault();
            const coords = getEventCoords(e);
            onGlobalMove(coords.clientX, coords.clientY);
        }
    }, { passive: false });
    window.addEventListener('touchend', onGlobalUp);
    window.addEventListener('touchcancel', onGlobalUp);
    globalListenersBound = true;
}

// ---------- 窗口管理核心函数 ----------
function updateBadge(app) {
    const hasWin = windows.some(w => w.app === app && !w.minimized);
    const badge = document.querySelector(`.dock-item[data-app="${app}"] .badge`);
    if (badge) {
        badge.classList.toggle('active', hasWin);
        if (hasWin) {
            badge.classList.add('anim-badge-appear');
            setTimeout(() => badge.classList.remove('anim-badge-appear'), 800);
        }
    }
}

function focusWindow(winObj) {
    highestZ++;
    winObj.dom.style.zIndex = highestZ;
    winObj.zIndex = highestZ;
    activeWindow = winObj;

    window.dispatchEvent(new CustomEvent('windowFocused', {
        detail: { appName: winObj.app, windowId: winObj.id }
    }));

    syncDarkModeToWindow(winObj);

    if (animationManager) {
        const state = animationManager.getWindowState(winObj.dom);
        if (state === 'open' || state === 'unknown') {
            animationManager.animateWindowFocus(winObj.dom).catch(() => {});
        }
    }
}

// 关闭窗口
async function closeWindow(winObj) {
    const dom = winObj.dom;
    if (dom.classList.contains('window-closing')) return;
    dom.classList.add('window-closing');

    if (animationManager) {
        await animationManager.animateWindowClose(dom);
    } else {
        dom.style.transition = 'all 0.8s cubic-bezier(0.4, 0.0, 1.0, 1.0)';
        dom.style.opacity = '0';
        dom.style.transform = 'scale(0.85)';
        await new Promise(r => setTimeout(r, 800));
    }

    dom.remove();
    windows = windows.filter(w => w.id !== winObj.id);
    updateBadge(winObj.app);

    window.dispatchEvent(new CustomEvent('appClosed', {
        detail: { appName: winObj.app, windowId: winObj.id }
    }));

    if (activeWindow === winObj) {
        activeWindow = windows.length > 0 ? windows[windows.length - 1] : null;
        if (activeWindow) focusWindow(activeWindow);
    }
}

// 最小化窗口
async function minimizeWindow(winObj) {
    window.dispatchEvent(new CustomEvent('windowMinimized', {
        detail: { appName: winObj.app, windowId: winObj.id }
    }));

    if (winObj.minimized || winObj.isMinimizing) return;
    winObj.isMinimizing = true;

    const win = winObj.dom;
    const rect = win.getBoundingClientRect();
    winObj.originalRect = { left: rect.left, top: rect.top, width: rect.width, height: rect.height };

    const dockItem = document.querySelector(`.dock-item[data-app="${winObj.app}"]`);
    if (!dockItem) {
        win.style.display = 'none';
        winObj.minimized = true;
        winObj.isMinimizing = false;
        updateBadge(winObj.app);
        return;
    }
    const dockRect = dockItem.getBoundingClientRect();

    if (animationManager) {
        await animationManager.animateWindowMinimize(win, dockRect, rect);
    } else {
        // 降级动画
        const translateX = (dockRect.left + dockRect.width / 2) - (rect.left + rect.width / 2);
        const translateY = (dockRect.top + dockRect.height / 2) - (rect.top + rect.height / 2);
        win.style.transition = 'all 1.2s cubic-bezier(0.4, 0.0, 1.0, 1.0)';
        win.style.transform = `translate(${translateX}px, ${translateY}px) scale(0.1)`;
        win.style.opacity = '0';
        await new Promise(r => setTimeout(r, 1200));
        win.style.display = 'none';
        win.style.transform = '';
        win.style.opacity = '';
        win.style.transition = '';
    }

    winObj.minimized = true;
    winObj.isMinimizing = false;
    updateBadge(winObj.app);

    if (activeWindow === winObj) {
        const nextWindow = windows.find(w => !w.minimized && w.id !== winObj.id);
        if (nextWindow) focusWindow(nextWindow);
    }
}

// 恢复窗口
async function restoreWindow(winObj) {
    window.dispatchEvent(new CustomEvent('windowRestored', {
        detail: { appName: winObj.app, windowId: winObj.id }
    }));

    if (!winObj.minimized || winObj.isRestoring) return;
    winObj.isRestoring = true;

    const win = winObj.dom;
    const orig = winObj.originalRect;
    const dockItem = document.querySelector(`.dock-item[data-app="${winObj.app}"]`);
    if (!orig || !dockItem) {
        win.style.display = 'flex';
        winObj.minimized = false;
        winObj.isRestoring = false;
        updateBadge(winObj.app);
        focusWindow(winObj);
        return;
    }
    const dockRect = dockItem.getBoundingClientRect();

    if (animationManager) {
        await animationManager.animateWindowRestore(win, dockRect, orig);
    } else {
        win.style.left = `${orig.left}px`;
        win.style.top = `${orig.top}px`;
        win.style.width = `${orig.width}px`;
        win.style.height = `${orig.height}px`;
        win.style.display = 'flex';
        win.style.transition = 'all 1.2s cubic-bezier(0.0, 0.0, 0.2, 1)';
        win.style.opacity = '0';
        win.style.transform = 'scale(0.1)';
        await new Promise(r => setTimeout(r, 50));
        win.style.opacity = '1';
        win.style.transform = 'scale(1)';
        await new Promise(r => setTimeout(r, 1200));
        win.style.transform = '';
        win.style.opacity = '';
        win.style.transition = '';
    }

    winObj.minimized = false;
    winObj.isRestoring = false;
    updateBadge(winObj.app);
    notifyResize(winObj);
    focusWindow(winObj);
}

// 全屏切换
async function toggleFullscreen(winObj) {
    const win = winObj.dom;
    const menuH = getMenuBarHeight();
    const dockH = getDockHeight();

    if (winObj.isFullscreenTransitioning) return;
    winObj.isFullscreenTransitioning = true;

    if (!winObj.isFullscreen) {
        winObj.originalRect = {
            left: parseInt(win.style.left) || 0,
            top: parseInt(win.style.top) || 0,
            width: win.offsetWidth,
            height: win.offsetHeight
        };
        const targetRect = {
            left: 0,
            top: menuH,
            width: window.innerWidth,
            height: window.innerHeight - menuH - dockH
        };
        if (animationManager) {
            await animationManager.animateWindowFullscreen(win, true, targetRect);
        } else {
            win.style.transition = 'all 1.0s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            win.style.left = '0px';
            win.style.top = `${menuH}px`;
            win.style.width = '100%';
            win.style.height = `calc(100% - ${menuH + dockH}px)`;
            await new Promise(r => setTimeout(r, 1000));
        }
        winObj.isFullscreen = true;
    } else {
        const o = winObj.originalRect;
        if (animationManager) {
            await animationManager.animateWindowFullscreen(win, false, o);
        } else {
            win.style.transition = 'all 1.0s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            win.style.left = `${o.left}px`;
            win.style.top = `${o.top}px`;
            win.style.width = `${o.width}px`;
            win.style.height = `${o.height}px`;
            await new Promise(r => setTimeout(r, 1000));
        }
        winObj.isFullscreen = false;
    }

    win.style.transition = '';
    winObj.isFullscreenTransitioning = false;
    notifyResize(winObj);
}

// 创建窗口
async function createWindow(appName, left, top, width, height) {
    const app = appConfig[appName];
    if (!app) return null;

    const winId = nextWindowId++;
    const winDiv = document.createElement('div');
    winDiv.className = 'window gpu-accelerated';
    winDiv.id = `window-${winId}`;
    winDiv.dataset.app = appName;
    winDiv.style.left = `${left}px`;
    winDiv.style.top = `${top}px`;
    winDiv.style.width = `${width}px`;
    winDiv.style.height = `${height}px`;
    winDiv.style.zIndex = ++highestZ;

    winDiv.innerHTML = `
        <div class="window-header">
            <div class="window-controls">
                <button class="window-close" title="关闭"></button>
                <button class="window-minimize" title="最小化"></button>
                <button class="window-maximize" title="全屏"></button>
            </div>
            <div class="window-title">${app.title}</div>
        </div>
        <div class="window-content">
            <iframe src="${app.src}" sandbox="allow-same-origin allow-scripts allow-popups allow-forms allow-modals allow-top-navigation"></iframe>
        </div>
        <div class="resize-handle resize-nw" data-dir="nw"></div>
        <div class="resize-handle resize-ne" data-dir="ne"></div>
        <div class="resize-handle resize-sw" data-dir="sw"></div>
        <div class="resize-handle resize-se" data-dir="se"></div>
        <div class="resize-handle resize-n" data-dir="n"></div>
        <div class="resize-handle resize-s" data-dir="s"></div>
        <div class="resize-handle resize-w" data-dir="w"></div>
        <div class="resize-handle resize-e" data-dir="e"></div>
    `;

    document.body.appendChild(winDiv);

    const winObj = {
        id: winId,
        app: appName,
        dom: winDiv,
        minimized: false,
        zIndex: highestZ,
        isFullscreen: false,
        originalRect: null,
        isMinimizing: false,
        isRestoring: false,
        isFullscreenTransitioning: false
    };
    winDiv.__winObj = winObj; 

    // 按钮事件
    winDiv.querySelector('.window-close').addEventListener('click', (e) => {
        e.stopPropagation();
        closeWindow(winObj);
    });
    winDiv.querySelector('.window-minimize').addEventListener('click', (e) => {
        e.stopPropagation();
        minimizeWindow(winObj);
    });
    winDiv.querySelector('.window-maximize').addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFullscreen(winObj);
    });

    const header = winDiv.querySelector('.window-header');

    // 拖拽开始
    const startDrag = async (clientX, clientY) => {
        if (winObj.isFullscreen) await toggleFullscreen(winObj);
        dragState.active = true;
        dragState.target = winDiv;
        dragState.startX = clientX;
        dragState.startY = clientY;
        dragState.startLeft = parseInt(winDiv.style.left) || 0;
        dragState.startTop = parseInt(winDiv.style.top) || 0;
        focusWindow(winObj);
        if (animationManager) await animationManager.animateDragStart(winDiv);
        else winDiv.classList.add('window-dragging');
    };

    // 调整大小开始
    const startResize = (clientX, clientY, dir) => {
        if (winObj.isFullscreen) toggleFullscreen(winObj);
        resizeState.active = true;
        resizeState.target = winDiv;
        resizeState.direction = dir;
        resizeState.startX = clientX;
        resizeState.startY = clientY;
        resizeState.startWidth = winDiv.offsetWidth;
        resizeState.startHeight = winDiv.offsetHeight;
        resizeState.startLeft = parseInt(winDiv.style.left) || 0;
        resizeState.startTop = parseInt(winDiv.style.top) || 0;
        focusWindow(winObj);
        if (animationManager) animationManager.animateResizeStart(winDiv);
        else winDiv.classList.add('window-resizing');
    };

    header.addEventListener('mousedown', (e) => {
        if (e.target.closest('.window-controls')) return;
        e.preventDefault();
        startDrag(e.clientX, e.clientY);
    });
    header.addEventListener('touchstart', (e) => {
        if (e.target.closest('.window-controls')) return;
        e.preventDefault();
        const coords = getEventCoords(e);
        startDrag(coords.clientX, coords.clientY);
    }, { passive: false });

    const handles = winDiv.querySelectorAll('.resize-handle');
    handles.forEach(handle => {
        const dir = handle.getAttribute('data-dir');
        if (!dir) return;
        handle.addEventListener('mousedown', (e) => {
            e.preventDefault();
            e.stopPropagation();
            startResize(e.clientX, e.clientY, dir);
        });
        handle.addEventListener('touchstart', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const coords = getEventCoords(e);
            startResize(coords.clientX, coords.clientY, dir);
        }, { passive: false });
    });

    winDiv.addEventListener('mousedown', () => focusWindow(winObj));
    winDiv.addEventListener('touchstart', () => focusWindow(winObj), { passive: true });

    const iframe = winDiv.querySelector('iframe');
    iframe.addEventListener('load', () => {
        notifyResize(winObj);
        syncDarkModeToWindow(winObj);
    });

    if (animationManager) {
        await animationManager.animateWindowOpen(winDiv);
    } else {
        winDiv.style.opacity = '0';
        winDiv.style.transform = 'scale(0.88) translateY(40px)';
        winDiv.style.filter = 'blur(12px)';
        requestAnimationFrame(() => {
            winDiv.style.transition = 'all 1.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
            winDiv.style.opacity = '1';
            winDiv.style.transform = 'scale(1) translateY(0)';
            winDiv.style.filter = 'blur(0)';
            setTimeout(() => {
                winDiv.style.transition = '';
                notifyResize(winObj);
            }, 1200);
        });
    }

    return winObj;
}

// 打开应用
async function openApp(appName) {
    const existing = getWindowsByApp(appName);
    const visible = existing.find(w => !w.minimized);
    if (visible) {
        focusWindow(visible);
        const dockItem = document.querySelector(`.dock-item[data-app="${appName}"]`);
        if (dockItem && animationManager) {
            await animationManager.animateDockBounce(dockItem);
        } else if (dockItem) {
            dockItem.style.animation = 'dockBounce 0.6s cubic-bezier(0.175,0.885,0.32,1.275)';
            setTimeout(() => dockItem.style.animation = '', 600);
        }
        return;
    }
    const minimized = existing.find(w => w.minimized);
    if (minimized) {
        await restoreWindow(minimized);
        return;
    }
    const offset = windows.length * 28;
    const left = 80 + offset;
    const top = 60 + offset;
    const cfg = appConfig[appName];
    if (!cfg) return;
    const winObj = await createWindow(appName, left, top, cfg.defaultW, cfg.defaultH);
    if (winObj) {
        windows.push(winObj);
        updateBadge(appName);
        focusWindow(winObj);
        window.dispatchEvent(new CustomEvent('appOpened', {
            detail: { appName: appName, windowId: winObj.id }
        }));
    }
}

function getWindowsByApp(app) {
    return windows.filter(w => w.app === app);
}

// ---------- 开机动画 ----------
async function startBootAnimation() {
    const bootScreen = document.getElementById('boot-screen');
    if (!bootScreen) return;
    await new Promise(r => setTimeout(r, 10000));
    bootScreen.classList.add('hide-boot');
    setTimeout(() => bootScreen.style.display = 'none', 1500);
}

// ---------- 菜单栏交互 ----------
function initMenuBar() {
    const aboutMenuItem = document.querySelector('.menu-item .submenu ul li:first-child a');
    if (aboutMenuItem && aboutMenuItem.textContent.includes('关于本机')) {
        aboutMenuItem.addEventListener('click', (e) => {
            e.preventDefault();
            openApp('about');
        });
    }
    const prefsMenuItem = document.getElementById('menu-settings');
    if (prefsMenuItem) {
        prefsMenuItem.addEventListener('click', (e) => {
            e.preventDefault();
            openApp('settings');
        });
    }
    document.querySelectorAll('.menu-item').forEach(menu => {
        const title = menu.querySelector('.menu-title');
        if (title && title.textContent === '文件') {
            const submenuItems = menu.querySelectorAll('.submenu li a');
            submenuItems.forEach(sub => {
                if (sub.textContent.includes('新建访达窗口')) {
                    sub.addEventListener('click', (e) => { e.preventDefault(); openApp('finder'); });
                }
                if (sub.textContent.includes('新建文件夹')) {
                    sub.addEventListener('click', (e) => { e.preventDefault(); alert('新建文件夹（演示）'); });
                }
                if (sub.textContent.includes('关闭')) {
                    sub.addEventListener('click', (e) => {
                        e.preventDefault();
                        if (activeWindow) closeWindow(activeWindow);
                        else alert('没有活动窗口');
                    });
                }
            });
        }
        if (title && title.textContent === '窗口') {
            const submenuItems = menu.querySelectorAll('.submenu li a');
            submenuItems.forEach(sub => {
                if (sub.textContent.includes('最小化')) {
                    sub.addEventListener('click', (e) => {
                        e.preventDefault();
                        if (activeWindow && !activeWindow.minimized) minimizeWindow(activeWindow);
                    });
                }
                if (sub.textContent.includes('缩放')) {
                    sub.addEventListener('click', (e) => {
                        e.preventDefault();
                        if (activeWindow) toggleFullscreen(activeWindow);
                    });
                }
            });
        }
    });
    const helpSearch = document.querySelector('.menu-item:last-child .submenu li a');
    if (helpSearch && helpSearch.textContent.includes('macOS 帮助')) {
        helpSearch.addEventListener('click', (e) => {
            e.preventDefault();
            openApp('about');
            setTimeout(() => {
                const aboutWin = windows.find(w => w.app === 'about' && !w.minimized);
                if (aboutWin) {
                    const iframe = aboutWin.dom.querySelector('iframe');
                    if (iframe && iframe.contentWindow) {
                        iframe.contentWindow.postMessage({ type: 'switchTab', tab: 'software' }, '*');
                    }
                }
            }, 500);
        });
    }
}

// 桌面图标 - 已移除入场动画调用
function initDesktopIcons() {
    document.querySelectorAll('.desktop-icon').forEach(icon => {
        icon.addEventListener('dblclick', () => {
            const app = icon.getAttribute('data-app');
            if (app) openApp(app);
        });
        let lastTap = 0;
        icon.addEventListener('touchstart', (e) => {
            const currentTime = Date.now();
            const tapLength = currentTime - lastTap;
            if (tapLength < 300 && tapLength > 0) {
                const app = icon.getAttribute('data-app');
                if (app) openApp(app);
                lastTap = 0;
            } else {
                lastTap = currentTime;
            }
        });
        icon.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            showContextMenu(e.clientX, e.clientY);
        });
    });
    // 入场动画已移除（原 animationManager.animateDesktopIconsStagger() 调用已删除）
}

async function showContextMenu(x, y) {
    const menu = document.getElementById('desktop-context-menu');
    if (!menu) return;
    const menuWidth = 200, menuHeight = 250;
    let finalX = x, finalY = y;
    if (x + menuWidth > window.innerWidth) finalX = window.innerWidth - menuWidth - 10;
    if (y + menuHeight > window.innerHeight) finalY = window.innerHeight - menuHeight - 10;
    menu.style.display = 'block';
    menu.style.left = `${finalX}px`;
    menu.style.top = `${finalY}px`;
    if (animationManager) await animationManager.animateContextMenu(menu);
    const closeMenu = () => {
        menu.style.display = 'none';
        document.removeEventListener('click', closeMenu);
    };
    setTimeout(() => document.addEventListener('click', closeMenu), 100);
}

function updateTime() {
    const now = new Date();
    const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const timeElement = document.getElementById('current-time');
    if (timeElement) timeElement.textContent = timeStr;
}

// 消息监听
window.addEventListener('message', (e) => {
    const data = e.data;
    if (!data) return;
    if (data.type === 'closeWindow') {
        const win = windows.find(w => w.dom.querySelector('iframe') === e.source.frameElement);
        if (win) closeWindow(win);
    } else if (data.type === 'toggleDarkMode') {
        document.body.classList.toggle('dark-mode', data.enabled);
        if (window.updateCCDarkMode) window.updateCCDarkMode(data.enabled);
        windows.filter(w => w.app === 'settings').forEach(win => {
            const iframe = win.dom.querySelector('iframe');
            if (iframe && iframe.contentWindow && iframe.contentWindow !== e.source) {
                iframe.contentWindow.postMessage({ type: 'syncDarkMode', enabled: data.enabled }, '*');
            }
        });
        windows.filter(w => w.app === 'about').forEach(win => {
            const iframe = win.dom.querySelector('iframe');
            if (iframe && iframe.contentWindow) {
                iframe.contentWindow.postMessage({ type: 'darkMode', enabled: data.enabled }, '*');
            }
        });
    } else if (data.type === 'showDesktopIcons') {
        const iconsDiv = document.querySelector('.desktop-icons');
        if (iconsDiv) iconsDiv.style.display = data.visible ? 'grid' : 'none';
    }
});

// ---------- 初始化入口 ----------
document.addEventListener('DOMContentLoaded', async () => {
    let attempts = 0;
    while (!window.AnimationManager && attempts < 50) {
        await new Promise(r => setTimeout(r, 100));
        attempts++;
    }
    if (window.AnimationManager) {
        animationManager = window.AnimationManager;
        console.log(' d.js收到');
    } else {
        console.warn(' d.js丢了');
    }

    bindGlobalDragResizeListeners();

    await startBootAnimation();

    updateTime();
    setInterval(updateTime, 60000);

    initMenuBar();
    initDesktopIcons();

    document.getElementById('new-folder')?.addEventListener('click', (e) => { e.preventDefault(); alert('📁 新建文件夹（演示）'); });
    document.getElementById('new-document')?.addEventListener('click', (e) => { e.preventDefault(); alert('📄 新建文档（演示）'); });
    document.getElementById('paste')?.addEventListener('click', (e) => { e.preventDefault(); alert('📋 粘贴（演示）'); });
    document.getElementById('sort-by')?.addEventListener('click', (e) => { e.preventDefault(); alert('📊 排序方式（演示）'); });
    document.getElementById('show-view-options')?.addEventListener('click', (e) => { e.preventDefault(); alert('🔍 查看显示选项（演示）'); });
    document.getElementById('get-info')?.addEventListener('click', (e) => {
        e.preventDefault();
        alert('ℹ️ 显示简介\n\nmacOS 桌面\n项目数量: 7\n可用空间: 256 GB');
    });

    document.addEventListener('click', (e) => {
        const menu = document.getElementById('desktop-context-menu');
        if (menu && !menu.contains(e.target)) menu.style.display = 'none';
    });
    document.querySelector('.desktop')?.addEventListener('contextmenu', (e) => {
        if (e.target.classList.contains('desktop') || e.target.classList.contains('desktop-icons')) {
            e.preventDefault();
            showContextMenu(e.clientX, e.clientY);
        }
    });

    console.log('macOS 网页版v1.0.1');
});

// 导出全局 API
window.macOS = { openApp, windows, activeWindow, version: '3.1-fixed' };
window.openApp = openApp;
window.closeWindow = closeWindow;
window.minimizeWindow = minimizeWindow;
window.restoreWindow = restoreWindow;
window.appConfig = appConfig;

// 灵动岛
window.addEventListener('islandRestoreWindow', (e) => {
    const appName = e.detail?.appName;
    if (!appName) return;
    const win = windows.find(w => w.app === appName && w.minimized);
    if (win && typeof restoreWindow === 'function') restoreWindow(win);
});

window.DynamicIslandAPI = {
    notify: (opts) => window.dynamicIsland?.notify(opts),
    status: (opts) => window.dynamicIsland?.status(opts),
    progress: (opts) => window.dynamicIsland?.progress(opts),
    setProgress: (value, text) => window.dynamicIsland?.setProgress(value, text),
    idle: () => window.dynamicIsland?.idle(),
    show: (mode, duration) => window.dynamicIsland?.notify({ title: mode || '提示', duration: duration || 3000 }),
    hide: () => window.dynamicIsland?.idle()
};