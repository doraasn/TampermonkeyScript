// ==UserScript==
// @name         @B站倍速记忆控制
// @namespace    http://tampermonkey.net/
// @version      2025-05-05
// @description  通过 shift + ⬆️/⬇️ 实现控制B站视频倍速
// @author       Y77H
// @match        https://www.bilibili.com/*
// @grant        GM_setValue
// @grant        GM_getValue
// ==/UserScript==

(function() {
    'use strict';
    const CONFIG={color:"#fff",fontSize:"16px",topMargin:"15px",fadeDuration:1500},indicator=document.createElement("div");indicator.id="bili-speed-indicator",indicator.style.cssText=`\nposition: absolute;\ntop: ${CONFIG.topMargin};\nleft: 50%;\ntransform: translateX(-50%);\nz-index: 2147483647;\ncolor: ${CONFIG.color};\nfont-size: ${CONFIG.fontSize};\nfont-weight: bold;\ntext-shadow: 0 1px 2px rgba(0,0,0,0.8);\npointer-events: none;\nopacity: 0;\ntransition: opacity 0.3s;\n`;let currentSpeed=GM_getValue("lastSpeed",1);function saveSpeed(e){currentSpeed=e,GM_setValue("lastSpeed",e)}function updateIndicator(e){indicator.textContent=`×${e.toFixed(2)}`,indicator.style.opacity="1",clearTimeout(indicator.timer),indicator.timer=setTimeout((()=>{indicator.style.opacity="0"}),CONFIG.fadeDuration)}function setSpeed(e){const t=document.querySelector("video");if(t){const n=Math.max(.25,Math.min(16,e));t.playbackRate=n,saveSpeed(n),updateIndicator(n)}}function initVideoObserver(){new MutationObserver(((e,t)=>{const n=document.querySelector("video");n&&n.readyState>0&&(Math.abs(n.playbackRate-currentSpeed)>.01&&(n.playbackRate=currentSpeed,updateIndicator(currentSpeed)),t.disconnect())})).observe(document.body,{childList:!0,subtree:!0})}function handleKeyDown(e){if(!e.shiftKey)return;const t=document.querySelector("video");t&&("ArrowUp"===e.key?(setSpeed(t.playbackRate+.25),e.preventDefault()):"ArrowDown"===e.key&&(setSpeed(t.playbackRate-.25),e.preventDefault()))}function init(){(document.querySelector(".bpx-player-container, .bilibili-player-video-wrap")||document.body).appendChild(indicator);const e=document.querySelector("video");e&&(e.playbackRate=currentSpeed,updateIndicator(currentSpeed)),document.addEventListener("keydown",handleKeyDown),initVideoObserver(),window.addEventListener("locationchange",initVideoObserver)}"complete"===document.readyState?setTimeout(init,300):window.addEventListener("load",(()=>setTimeout(init,300)));let lastUrl=location.href;new MutationObserver((()=>{location.href!==lastUrl&&(lastUrl=location.href,window.dispatchEvent(new Event("locationchange")))})).observe(document,{subtree:!0,childList:!0});
})();
