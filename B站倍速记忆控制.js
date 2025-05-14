// ==UserScript==
// @name         B站倍速记忆控制
// @namespace    http://tampermonkey.net/
// @version      2025-05-05
// @description  通过 shift + ⬆️/⬇️ 实现控制B站视频倍速
// @author       Y77H
// @match        https://www.bilibili.com/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=deepseek.com
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';

    // 配置项
    const CONFIG = {
        color: "#fff",
        fontSize: "16px",
        topMargin: "15px",
        fadeDuration: 1500
    };

    // 创建提示元素
    const indicator = document.createElement('div');
    indicator.id = 'bili-speed-indicator';
    indicator.style.cssText = `
  position: absolute;
  top: ${CONFIG.topMargin};
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483647;
  color: ${CONFIG.color};
  font-size: ${CONFIG.fontSize};
  font-weight: bold;
  text-shadow: 0 1px 2px rgba(0,0,0,0.8);
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.3s;
`;

    // 获取/存储倍速
    let currentSpeed = GM_getValue('lastSpeed', 1.0);

    function saveSpeed(rate) {
        currentSpeed = rate;
        GM_setValue('lastSpeed', rate);
    }

    // 更新提示显示
    function updateIndicator(speed) {
        indicator.textContent = `×${speed.toFixed(2)}`;
        indicator.style.opacity = '1';
        clearTimeout(indicator.timer);
        indicator.timer = setTimeout(() => {
            indicator.style.opacity = '0';
        }, CONFIG.fadeDuration);
    }

    // 设置倍速
    function setSpeed(rate) {
        const video = document.querySelector('video');
        if (video) {
            const newSpeed = Math.max(0.25, Math.min(16, rate));
            video.playbackRate = newSpeed;
            saveSpeed(newSpeed);
            updateIndicator(newSpeed);
        }
    }

    // 初始化视频监听
    function initVideoObserver() {
        new MutationObserver((mutations, observer) => {
            const video = document.querySelector('video');
            if (video && video.readyState > 0) {
                // 新视频加载时应用记忆的倍速
                if (Math.abs(video.playbackRate - currentSpeed) > 0.01) {
                    video.playbackRate = currentSpeed;
                    updateIndicator(currentSpeed);
                }
                observer.disconnect(); // 只执行一次
            }
        }).observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    // 快捷键监听
    function handleKeyDown(e) {
        if (!e.shiftKey) return;

        const video = document.querySelector('video');
        if (!video) return;

        if (e.key === 'ArrowUp') {
            setSpeed(video.playbackRate + 0.25);
            e.preventDefault();
        } else if (e.key === 'ArrowDown') {
            setSpeed(video.playbackRate - 0.25);
            e.preventDefault();
        }
    }

    // 主初始化
    function init() {
        // 挂载元素
        const container = document.querySelector('.bpx-player-container, .bilibili-player-video-wrap');
        (container || document.body).appendChild(indicator);

        // 设置初始倍速
        const video = document.querySelector('video');
        if (video) {
            video.playbackRate = currentSpeed;
            updateIndicator(currentSpeed);
        }

        // 监听事件
        document.addEventListener('keydown', handleKeyDown);
        initVideoObserver();

        // 监听页面切换
        window.addEventListener('locationchange', initVideoObserver);
    }

    // 延迟初始化
    if (document.readyState === 'complete') {
        setTimeout(init, 300);
    } else {
        window.addEventListener('load', () => setTimeout(init, 300));
    }

    // 监听URL变化(用于单页应用)
    let lastUrl = location.href;
    new MutationObserver(() => {
        if (location.href !== lastUrl) {
            lastUrl = location.href;
            window.dispatchEvent(new Event('locationchange'));
        }
    }).observe(document, { subtree: true, childList: true });
})();