// ========== 控制中心 ==========
(function() {
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', buildControlCenter);
    } else {
        buildControlCenter();
    }

    function buildControlCenter() {
        const cc = document.getElementById('control-center');
        const trigger = document.getElementById('control-center-trigger');
        const closeBtn = document.getElementById('cc-close-btn');
        if (!cc) return;

        const oldGrid = cc.querySelector('.cc-grid');
        const oldFooter = cc.querySelector('.cc-footer');
        if (oldGrid) oldGrid.remove();
        if (oldFooter) oldFooter.remove();

        const grid = document.createElement('div');
        grid.className = 'cc-grid';

        const iconModules = [
            { id: 'wifi', label: '无线局域网', icon: 'fas fa-wifi', defaultState: 'on' },
            { id: 'bluetooth', label: '蓝牙', icon: 'fab fa-bluetooth-b', defaultState: 'on' },
            { id: 'focus', label: '专注模式', icon: 'fas fa-moon', defaultState: 'off' },
            { id: 'darkmode', label: '深色模式', icon: 'fas fa-adjust', defaultState: 'off' }
        ];

        iconModules.forEach(mod => {
            const moduleDiv = document.createElement('div');
            moduleDiv.className = 'icon-module';
            if (mod.defaultState === 'on') moduleDiv.classList.add('active');
            moduleDiv.setAttribute('data-id', mod.id);
            moduleDiv.setAttribute('data-state', mod.defaultState);

            const icon = document.createElement('i');
            icon.className = mod.icon;
            icon.style.color = '';

            const labelSpan = document.createElement('span');
            labelSpan.className = 'module-label';
            labelSpan.textContent = mod.label;

            moduleDiv.appendChild(icon);
            moduleDiv.appendChild(labelSpan);
            grid.appendChild(moduleDiv);
        });

        const brightnessModule = document.createElement('div');
        brightnessModule.className = 'cc-module cc-slider-module';
        brightnessModule.innerHTML = `
            <div class="module-label"><i class="fas fa-sun"></i> 显示器亮度</div>
            <div class="slider-container">
                <i class="fas fa-sun" style="font-size: 14px; opacity:0.7;"></i>
                <input type="range" min="0.3" max="1.0" step="0.01" value="0.9" class="cc-slider brightness-slider">
                <i class="fas fa-sun" style="font-size: 18px;"></i>
            </div>
        `;
        grid.appendChild(brightnessModule);

        const volumeModule = document.createElement('div');
        volumeModule.className = 'cc-module cc-slider-module';
        volumeModule.innerHTML = `
            <div class="module-label"><i class="fas fa-volume-up"></i> 音量</div>
            <div class="slider-container">
                <i class="fas fa-volume-down"></i>
                <input type="range" min="0" max="1" step="0.01" value="0.6" class="cc-slider volume-slider">
                <i class="fas fa-volume-up"></i>
            </div>
        `;
        grid.appendChild(volumeModule);

        const mirrorModule = document.createElement('div');
        mirrorModule.className = 'cc-module';
        mirrorModule.innerHTML = `
            <div class="module-label"><i class="fas fa-tv"></i> 屏幕镜像</div>
            <div class="cc-action" id="screen-mirror"><i class="fas fa-chevron-right"></i></div>
        `;
        grid.appendChild(mirrorModule);

        const audioModule = document.createElement('div');
        audioModule.className = 'cc-module';
        audioModule.innerHTML = `
            <div class="module-label"><i class="fas fa-headphones"></i> 声音输出</div>
            <div class="cc-detail" id="audio-output">MacBook Pro 扬声器</div>
        `;
        grid.appendChild(audioModule);

        cc.appendChild(grid);

        const footer = document.createElement('div');
        footer.className = 'cc-footer';
        footer.innerHTML = `
            <button class="cc-quick-btn" id="cc-lock"><i class="fas fa-lock"></i> 锁定屏幕</button>
            <button class="cc-quick-btn" id="cc-sleep"><i class="fas fa-bed"></i> 睡眠</button>
        `;
        cc.appendChild(footer);

        function setModuleState(module, state) {
            if (state === 'on') {
                module.classList.add('active');
            } else {
                module.classList.remove('active');
            }
            module.setAttribute('data-state', state);
        }

        const wifiModule = document.querySelector('.icon-module[data-id="wifi"]');
        if (wifiModule) {
            wifiModule.addEventListener('click', (e) => {
                e.stopPropagation();
                const newState = wifiModule.getAttribute('data-state') === 'on' ? 'off' : 'on';
                setModuleState(wifiModule, newState);
            });
        }

        const btModule = document.querySelector('.icon-module[data-id="bluetooth"]');
        if (btModule) {
            btModule.addEventListener('click', (e) => {
                e.stopPropagation();
                const newState = btModule.getAttribute('data-state') === 'on' ? 'off' : 'on';
                setModuleState(btModule, newState);
            });
        }

        const focusModule = document.querySelector('.icon-module[data-id="focus"]');
        if (focusModule) {
            focusModule.addEventListener('click', (e) => {
                e.stopPropagation();
                const newState = focusModule.getAttribute('data-state') === 'on' ? 'off' : 'on';
                setModuleState(focusModule, newState);
            });
        }

        const darkModule = document.querySelector('.icon-module[data-id="darkmode"]');
        if (darkModule) {
            const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            setModuleState(darkModule, prefersDark ? 'on' : 'off');
            if (prefersDark) document.body.classList.add('dark-mode');

            darkModule.addEventListener('click', (e) => {
                e.stopPropagation();
                const current = darkModule.getAttribute('data-state');
                const newState = current === 'on' ? 'off' : 'on';
                setModuleState(darkModule, newState);
                const enabled = newState === 'on';
                if (enabled) document.body.classList.add('dark-mode');
                else document.body.classList.remove('dark-mode');

                if (window.windows) {
                    window.windows.filter(w => w.app === 'settings').forEach(win => {
                        const iframe = win.dom.querySelector('iframe');
                        iframe?.contentWindow?.postMessage({ type: 'syncDarkMode', enabled }, '*');
                    });
                    window.windows.filter(w => w.app === 'about').forEach(win => {
                        const iframe = win.dom.querySelector('iframe');
                        iframe?.contentWindow?.postMessage({ type: 'darkMode', enabled }, '*');
                    });
                }
            });
        }

        const brightnessSlider = brightnessModule.querySelector('.brightness-slider');
        const desktop = document.querySelector('.desktop');
        if (brightnessSlider && desktop) {
            const setBrightness = (val) => {
                desktop.style.filter = `brightness(${val})`;
                if (cc) cc.style.filter = `brightness(${Math.max(0.65, val)})`;
            };
            brightnessSlider.addEventListener('input', (e) => setBrightness(e.target.value));
            setBrightness(brightnessSlider.value);
        }

        const volumeSlider = volumeModule.querySelector('.volume-slider');
        let audioCtx = null;
        let gainNode = null;
        function initAudio() {
            if (audioCtx) return;
            try {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                gainNode = audioCtx.createGain();
                gainNode.gain.value = volumeSlider ? parseFloat(volumeSlider.value) : 0.6;
                gainNode.connect(audioCtx.destination);
            } catch(e) { console.warn('Web Audio API not supported'); }
        }
        if (volumeSlider) {
            volumeSlider.addEventListener('input', (e) => {
                const vol = parseFloat(e.target.value);
                if (!audioCtx) initAudio();
                if (audioCtx && gainNode) {
                    if (audioCtx.state === 'suspended') audioCtx.resume();
                    gainNode.gain.value = vol;
                }
            });
            const initOnce = () => {
                initAudio();
                document.body.removeEventListener('click', initOnce);
                document.body.removeEventListener('touchstart', initOnce);
            };
            document.body.addEventListener('click', initOnce, { once: true });
            document.body.addEventListener('touchstart', initOnce, { once: true });
        }

        const screenMirror = document.getElementById('screen-mirror');
        if (screenMirror) {
            screenMirror.addEventListener('click', () => alert('屏幕镜像：未检测到设备'));
        }

        const lockBtn = document.getElementById('cc-lock');
        if (lockBtn) {
            lockBtn.addEventListener('click', () => { alert('🔒 屏幕已锁定'); closeCC(); });
        }
        const sleepBtn = document.getElementById('cc-sleep');
        if (sleepBtn) {
            sleepBtn.addEventListener('click', () => { alert('😴 睡眠模式'); closeCC(); });
        }

        function openCC() { cc.classList.add('active'); }
        function closeCC() { cc.classList.remove('active'); }

        if (trigger) {
            trigger.addEventListener('click', (e) => {
                e.stopPropagation();
                cc.classList.contains('active') ? closeCC() : openCC();
            });
        }
        if (closeBtn) {
            closeBtn.addEventListener('click', closeCC);
        }

        // 点击面板内部不关闭
        cc.addEventListener('click', (e) => e.stopPropagation());

        // 点击其他区域关闭
        document.addEventListener('click', () => {
            if (cc.classList.contains('active')) closeCC();
        });

        // ESC 键关闭
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && cc.classList.contains('active')) closeCC();
        });

        window.updateCCDarkMode = function(enabled) {
            if (darkModule) {
                const newState = enabled ? 'on' : 'off';
                if (darkModule.getAttribute('data-state') !== newState) {
                    setModuleState(darkModule, newState);
                }
            }
        };
        window.ControlCenter = { open: openCC, close: closeCC, isOpen: () => cc.classList.contains('active') };
    }
})();