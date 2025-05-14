// ==UserScript==
// @name         BOSS直聘自动沟通
// @namespace    http://tampermonkey.net/
// @version      2025-05-14
// @description  自动点击BOSS直聘职位列表和沟通按钮
// @author       Y77H
// @match        https://www.zhipin.com/web/geek/jobs*
// @grant        none
// ==/UserScript==

(function () {
  'use strict';

  const config = {
    clickInterval: 1500,
    autoStart: false,
    scrollCheckInterval: 800,
    scrollStep: 10000,
    keywords: '测试开发 mes java',
    excludeKeywords: '测试 前端 golang 支持 实施 运维 销售 教师 salesforce python c'
  };

  function createControlPanel() {
    const existingPanel = document.getElementById('boss-auto-chat-panel');
    if (existingPanel) {
      return {
        panel: existingPanel,
        controlBtn: existingPanel.querySelector('.control-btn')
      };
    }

    const panel = document.createElement('div');
    panel.id = 'boss-auto-chat-panel';
    panel.style.cssText = `
      position: fixed;
      top: 190px;
      right: 11px;
      background: rgba(255, 255, 255, 0.2);
      padding: 8px;
      border-radius: 8px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
      z-index: 999999;
      display: flex;
      flex-direction: column;
      gap: 6px;
      width: 250px;
      max-height: 80vh;
      overflow-y: auto;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
      backdrop-filter: blur(8px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      transition: all 0.3s ease;
    `;

    panel.onmouseover = () => {
      panel.style.background = 'rgba(255, 255, 255, 0.95)';
      panel.style.boxShadow = '0 4px 20px rgba(0,0,0,0.12)';
      controlBtn.style.color = 'rgba(255, 255, 255, 1)';
      updateConfigDisplay(panel, true);
    };

    panel.onmouseout = () => {
      panel.style.background = 'rgba(255, 255, 255, 0.2)';
      panel.style.boxShadow = '0 4px 20px rgba(0,0,0,0.08)';
      controlBtn.style.color = 'rgba(255, 255, 255, 0.9)';
      updateConfigDisplay(panel, false);
    };

    const controlBtn = document.createElement('button');
    controlBtn.className = 'control-btn';
    controlBtn.textContent = '开始';
    controlBtn.style.cssText = `
      padding: 8px 16px;
      background: rgba(67, 97, 238, 0.6);
      color: rgba(255, 255, 255, 0.9);
      border: none;
      border-radius: 6px;
      cursor: pointer;
      transition: all 0.3s ease;
      font-size: 13px;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(67, 97, 238, 0.2);
      width: 100%;
    `;

    controlBtn.onmouseover = () => {
      controlBtn.style.transform = 'translateY(-1px)';
      controlBtn.style.background = 'rgba(67, 97, 238, 0.8)';
      controlBtn.style.boxShadow = '0 4px 12px rgba(67, 97, 238, 0.3)';
    };

    controlBtn.onmouseout = () => {
      controlBtn.style.transform = 'translateY(0)';
      controlBtn.style.background = 'rgba(67, 97, 238, 0.6)';
      controlBtn.style.boxShadow = '0 2px 8px rgba(67, 97, 238, 0.2)';
    };

    panel.appendChild(controlBtn);
    document.body.appendChild(panel);
    updateConfigDisplay(panel);

    return { panel, controlBtn };
  }

  function updateConfigDisplay(panel, isHovered = false) {
    const textOpacity = isHovered ? '1' : '0.8';
    const bgOpacity = isHovered ? '0.2' : '0.05';

    const oldConfig = panel.querySelector('.config-display');
    if (oldConfig) {
      oldConfig.remove();
    }

    const configHtml = `
      <div class="config-display">
        <div style="margin: 4px 0; padding: 6px; background: rgba(67, 97, 238, ${bgOpacity}); border-radius: 4px; font-size: 13px; color: rgba(68, 68, 68, ${textOpacity});">
          包含：<span style="color: rgba(67, 97, 238, ${textOpacity}); font-weight: 500;">${config.keywords || '无'}</span>
        </div>
        <div style="margin: 4px 0; padding: 6px; background: rgba(231, 76, 60, ${bgOpacity}); border-radius: 4px; font-size: 13px; color: rgba(68, 68, 68, ${textOpacity});">
          排除：<span style="color: rgba(231, 76, 60, ${textOpacity}); font-weight: 500;">${config.excludeKeywords || '无'}</span>
        </div>
      </div>
    `;

    const controlBtn = panel.querySelector('.control-btn');
    if (controlBtn) {
      controlBtn.insertAdjacentHTML('beforebegin', configHtml);
    }
  }

  function scrollToBottom() {
    return new Promise((resolve) => {
      let lastHeight = document.documentElement.scrollHeight;
      let noChangeCount = 0;

      const scrollInterval = setInterval(() => {
        const controlBtn = document.querySelector('.control-btn');
        if (controlBtn && !controlBtn.classList.contains('running')) {
          clearInterval(scrollInterval);
          resolve();
          return;
        }

        window.scrollBy(0, config.scrollStep);

        setTimeout(() => {
          const newHeight = document.documentElement.scrollHeight;
          if (newHeight === lastHeight) {
            noChangeCount++;
            if (noChangeCount >= 3) {
              clearInterval(scrollInterval);
              resolve();
            }
          } else {
            noChangeCount = 0;
            lastHeight = newHeight;
          }
        }, 500);
      }, config.scrollCheckInterval);
    });
  }

  function findJobList() {
    return Array.from(document.querySelectorAll('li.job-card-box'));
  }

  function findChatButton() {
    let btn = document.querySelector('.op-btn.op-btn-chat');
    if (btn != null && btn.textContent == '立即沟通') {
      return btn;
    }
    return null;
  }

  function findStayButton() {
    return document.querySelector('.default-btn.cancel-btn');
  }

  function checkChatLimit() {
    const limitText = document.querySelector('.chat-block-container');
    return limitText && limitText.textContent.includes('今日沟通人数已达上限，请明天再试');
  }

  function scrollToElement(element) {
    if (!element) return;
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.scrollY - 300;
    window.scrollTo({
      top: offsetPosition,
      behavior: 'smooth'
    });
  }

  function clickJobAndChat(jobElement) {
    if (!jobElement) return;

    const jobTitle = jobElement.querySelector('.job-name')?.textContent?.trim() || '未知职位';
    const companyName = jobElement.querySelector('.boss-info')?.textContent?.trim() || '未知公司';
    const location = jobElement.querySelector('.company-location')?.textContent?.trim() || '未知地区';
    const companyInfo = ` ${jobTitle} | ${companyName} | ${location}`;

    scrollToElement(jobElement);
    setTimeout(() => {
      jobElement.click();
      setTimeout(() => {
        const chatBtn = findChatButton();
        if (chatBtn) {
          chatBtn.click();
          setTimeout(() => {
            if (checkChatLimit()) {
              console.log(`[${new Date().toLocaleTimeString()}]` + companyInfo + ' | ' + `达到沟通上限`);
              throw new Error('CHAT_LIMIT_REACHED');
            }

            const stayBtn = findStayButton();
            if (stayBtn) {
              stayBtn.click();
            }
          }, config.clickInterval);
        } else {
          console.log(`[${new Date().toLocaleTimeString()}]` + companyInfo + ' | ' + `未找到沟通按钮`);
        }
      }, config.clickInterval);
    }, 1000);
  }

  function checkJobKeywords(jobElement) {
    if (!jobElement) return false;

    const jobText = jobElement.textContent.toLowerCase();
    const keywords = config.keywords.toLowerCase().split(' ').filter(k => k);
    const excludeKeywords = config.excludeKeywords.toLowerCase().split(' ').filter(k => k);

    if (keywords.length > 0) {
      const hasKeyword = keywords.some(keyword => jobText.includes(keyword));
      if (hasKeyword) return true;
    }

    if (excludeKeywords.length > 0) {
      if (excludeKeywords.some(keyword => jobText.includes(keyword))) {
        return false;
      }
    }

    return keywords.length === 0;
  }

  function startAutoChat(controlBtn) {
    window.totalJobs = 0;
    window.processedJobs = [];

    controlBtn.textContent = '正在加载所有职位...';
    scrollToBottom().then(() => {
      if (!controlBtn.classList.contains('running')) {
        controlBtn.textContent = '开始';
        return;
      }

      const jobList = findJobList().filter(checkJobKeywords);
      if (jobList.length === 0) {
        controlBtn.textContent = '未找到符合条件的职位';
        controlBtn.classList.remove('running');
        controlBtn.style.background = 'rgba(67, 97, 238, 0.6)';
        controlBtn.style.boxShadow = '0 2px 8px rgba(67, 97, 238, 0.2)';

        console.group('BOSS直聘自动沟通处理结果');
        console.log('未找到符合条件的职位');
        console.groupEnd();
        return;
      }

      let currentIndex = 0;
      const totalJobs = jobList.length;
      const processedJobs = [];

      window.totalJobs = totalJobs;
      window.processedJobs = processedJobs;

      function processNextJob() {
        if (!controlBtn.classList.contains('running')) {
          controlBtn.textContent = '开始';
          return;
        }

        if (currentIndex >= totalJobs) {
          const successCount = processedJobs.length;
          controlBtn.textContent = `处理完成 (${successCount}/${totalJobs})`;
          controlBtn.classList.remove('running');
          controlBtn.style.background = 'rgba(67, 97, 238, 0.6)';
          controlBtn.style.boxShadow = '0 2px 8px rgba(67, 97, 238, 0.2)';

          console.group('BOSS直聘自动沟通处理结果');
          console.log(`总职位数：${totalJobs}`);
          console.log(`成功处理：${successCount}`);
          console.log(`跳过处理：${totalJobs - successCount}`);
          console.log('处理详情：');
          processedJobs.forEach(job => {
            console.log(`[${job.time}] ${job.index}. ${job.title} | ${job.company} | ${job.location}`);
          });
          console.groupEnd();
          return;
        }

        const currentJob = jobList[currentIndex];
        const jobTitle = currentJob.querySelector('.job-name')?.textContent?.trim() || '未知职位';
        const companyName = currentJob.querySelector('.boss-info')?.textContent?.trim() || '未知公司';
        const location = currentJob.querySelector('.company-location')?.textContent?.trim() || '未知地区';

        controlBtn.textContent = `正在处理: ${currentIndex + 1}/${totalJobs}`;

        try {
          clickJobAndChat(currentJob);
          processedJobs.push({
            index: currentIndex + 1,
            title: jobTitle,
            company: companyName,
            location: location,
            time: new Date().toLocaleTimeString()
          });
          currentIndex++;
          setTimeout(processNextJob, config.clickInterval * 2);
        } catch (error) {
          if (error.message === 'CHAT_LIMIT_REACHED') {
            controlBtn.textContent = '今日沟通人数已达上限，请明天再试';
            return;
          }
          console.error('自动处理出错:', error);
          controlBtn.textContent = '处理出错，请重试';
          controlBtn.classList.remove('running');
          controlBtn.style.background = 'rgba(67, 97, 238, 0.6)';
          controlBtn.style.boxShadow = '0 2px 8px rgba(67, 97, 238, 0.2)';
        }
      }

      processNextJob();
    });
  }

  function setupControlButton(controlBtn) {
    controlBtn.onclick = () => {
      if (controlBtn.classList.contains('running')) {
        controlBtn.classList.remove('running');
        controlBtn.textContent = '开始';
        controlBtn.style.background = 'rgba(67, 97, 238, 0.6)';
        controlBtn.style.boxShadow = '0 2px 8px rgba(67, 97, 238, 0.2)';

        controlBtn.onmouseover = () => {
          controlBtn.style.transform = 'translateY(-1px)';
          controlBtn.style.background = 'rgba(67, 97, 238, 0.8)';
          controlBtn.style.boxShadow = '0 4px 12px rgba(67, 97, 238, 0.3)';
        };
        controlBtn.onmouseout = () => {
          controlBtn.style.transform = 'translateY(0)';
          controlBtn.style.background = 'rgba(67, 97, 238, 0.6)';
          controlBtn.style.boxShadow = '0 2px 8px rgba(67, 97, 238, 0.2)';
        };

        if (window.totalJobs > 0 && window.processedJobs.length > 0) {
          const processedJobs = window.processedJobs;
          const totalJobs = window.totalJobs;
          const successCount = processedJobs.length;

          console.group('BOSS直聘自动沟通处理结果（已停止）');
          console.log(`总职位数：${totalJobs}`);
          console.log(`成功处理：${successCount}`);
          console.log(`跳过处理：${totalJobs - successCount}`);
          console.log('处理详情：');
          processedJobs.forEach(job => {
            console.log(`[${job.time}] ${job.index}. ${job.title} | ${job.company} | ${job.location}`);
          });
          console.groupEnd();
        }
      } else {
        controlBtn.classList.add('running');
        controlBtn.textContent = '正在处理...';
        controlBtn.style.background = 'rgba(231, 76, 60, 0.8)';
        controlBtn.style.boxShadow = '0 2px 8px rgba(231, 76, 60, 0.2)';

        controlBtn.onmouseover = () => {
          controlBtn.style.transform = 'translateY(-1px)';
          controlBtn.style.background = 'rgba(231, 76, 60, 0.9)';
          controlBtn.style.boxShadow = '0 4px 12px rgba(231, 76, 60, 0.3)';
        };
        controlBtn.onmouseout = () => {
          controlBtn.style.transform = 'translateY(0)';
          controlBtn.style.background = 'rgba(231, 76, 60, 0.8)';
          controlBtn.style.boxShadow = '0 2px 8px rgba(231, 76, 60, 0.2)';
        };

        startAutoChat(controlBtn);
      }
    };

    if (config.autoStart) {
      controlBtn.click();
    }
  }

  function init() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        const { controlBtn } = createControlPanel();
        setupControlButton(controlBtn);
      });
    } else {
      const { controlBtn } = createControlPanel();
      setupControlButton(controlBtn);
    }
  }

  init();
})();