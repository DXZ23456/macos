/* ========== IslandAPI ========== */

(function() {
    'use strict';

    const IslandAPI = {
        _send(action, payload) {
            if (window.parent !== window) {
                window.parent.postMessage({ type: 'island', action, payload }, '*');
            }
        },

        /**
         * 临时通知
         * @param {Object} opts
         *   - cardSize: 'small' 或 'large'，默认 small
         *   - icon, iconColor, title, subtitle, duration
         */
        notify(opts = {}) {
            const finalOpts = { cardSize: 'small', ...opts };
            this._send('notify', finalOpts);
        },

        /**
         * 持续状态
         * @param {Object} opts
         *   - cardSize: 'small' 或 'large'，默认 small
         */
        status(opts = {}) {
            const finalOpts = { cardSize: 'small', ...opts };
            this._send('status', finalOpts);
        },

        /**
         * 进度条
         * @param {Object} opts
         *   - cardSize: 'small' 或 'large'，默认 large
         */
        progress(opts = {}) {
            const finalOpts = { cardSize: 'large', ...opts };
            this._send('progress', finalOpts);
        },

        setProgress(value, text) {
            this._send('setProgress', { value, text });
        },

        idle() {
            this._send('idle');
        },

        send(action, payload) {
            this._send(action, payload);
        }
    };

    window.IslandAPI = IslandAPI;
    window.island = IslandAPI;   // 简写别名
})();