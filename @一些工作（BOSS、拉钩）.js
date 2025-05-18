// ==UserScript==
// @name         @一些工作（BOSS、拉钩）
// @namespace    http://tampermonkey.net/
// @version      2025.05.18
// @description  自动投递BOSS直聘和拉勾网职位，保存常用信息
// @author       Y77H
// @match        https://www.zhipin.com/*
// @match        https://www.lagou.com/*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_openInTab
// ==/UserScript==

(function () {
  'use strict';

  // 网站类型枚举
  const SITE_TYPE = {
    BOSS: 'BOSS',
    LAGOU: '拉钩'
  };

  // 获取当前网站类型
  const getCurrentSite = () => {
    const url = window.location.href;
    if (url.includes('zhipin.com')) return SITE_TYPE.BOSS;
    if (url.includes('lagou.com')) return SITE_TYPE.LAGOU;
    // 如果既不是BOSS直聘也不是拉勾网，默认为BOSS直聘
    return SITE_TYPE.BOSS;
  };

  // 检查当前页面是否是职位列表页面
  const isJobsListingPage = () => {
    const url = window.location.href;
    // BOSS直聘的职位列表URL
    if (url.includes('zhipin.com/web/geek/jobs')) return true;
    // 拉勾网的职位列表URL
    if (url.includes('lagou.com/wn/jobs')) return true;
    return false;
  };

  // 基础配置
  const baseConfig = {
    // 面板位置（每个网站单独保存）
    panelPosition: {
      [SITE_TYPE.BOSS]: {
        full: null,  // 职位列表页面的完整面板位置
        simple: null // 其他页面的简化面板位置
      },
      [SITE_TYPE.LAGOU]: {
        full: null,
        simple: null
      }
    },
    // 包含关键词（共享）
    keywords: GM_getValue('keywords', 'java mes'),
    // 排除关键词（共享）
    excludeKeywords: GM_getValue('excludeKeywords', '测试 前端 golang 支持 实施 运维 销售'),
    // 当前网站类型
    currentSite: getCurrentSite(),
    // 面板默认宽度
    panelWidth: 250
  };

  // BOSS直聘配置
  const boss_Config = {
    clickInterval: 1500,
    scrollCheckInterval: 800,
    scrollStep: 10000
  };

  // 拉勾网配置
  const laGou_Config = {
    searchInterval: 1000,
    confirmDelay: 800,
    knowDelay: 800,
    clickDelay: 1000
  };

  // 通用工具函数
  const utils = {
    // 等待指定时间
    sleep: (ms) => new Promise(resolve => setTimeout(resolve, ms)),

    // 滚动到元素位置
    scrollToElement: (element, offset = 300) => {
      if (!element) return;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.scrollY - offset;
      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    },

    // 获取职位信息
    getJobInfo: (jobElement) => {
      const info = {
        title: '未知职位',
        company: '未知公司',
        location: '未知地区'
      };

      if (baseConfig.currentSite === SITE_TYPE.BOSS) {
        info.title = jobElement.querySelector('.job-name')?.textContent?.trim() || info.title;
        info.company = jobElement.querySelector('.boss-info')?.textContent?.trim() || info.company;
        info.location = jobElement.querySelector('.company-location')?.textContent?.trim() || info.location;
      } else {
        info.title = jobElement.querySelector('#openWinPostion')?.textContent?.trim() || info.title;
        info.company = jobElement.querySelector('.company-name__2-SjF')?.textContent?.trim() || info.company;
      }

      return info;
    },

    // 更新按钮状态
    updateButtonState: (controlBtn, isRunning, count = '', isStopping = false) => {
      if (isRunning) {
        if (isStopping) {
          controlBtn.textContent = '停止中...';
          controlBtn.style.background = 'rgba(244, 164, 96, 0.8)'; // 使用砂褐色表示停止中
          controlBtn.style.boxShadow = '0 2px 8px rgba(244, 164, 96, 0.2)';
        } else {
          controlBtn.textContent = count ? `处理进度：${count}` : '处理中...';
          controlBtn.style.background = 'rgba(231, 76, 60, 0.8)';
          controlBtn.style.boxShadow = '0 2px 8px rgba(231, 76, 60, 0.2)';
        }

        // 运行时禁用悬停效果
        controlBtn.onmouseover = null;
        controlBtn.onmouseout = null;
      } else {
        controlBtn.textContent = '开始处理';
        controlBtn.style.background = 'rgba(67, 97, 238, 0.6)';
        controlBtn.style.boxShadow = '0 2px 8px rgba(67, 97, 238, 0.2)';

        // 恢复悬停效果
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
      }
    },

    // 通用消息提示函数
    createNotification: (message, type = 'info') => {
      // 颜色配置
      const colors = {
        info: { text: '#3498db', bg: 'rgba(52, 152, 219, 0.1)', icon: 'bi-info-circle-fill', bgSolid: 'rgba(52, 152, 219, .95)', border: 'rgb(41, 128, 185)' },
        success: { text: '#27ae60', bg: 'rgba(39, 174, 96, 0.1)', icon: 'bi-check-circle-fill', bgSolid: 'rgba(46, 204, 113, .95)', border: 'rgb(39, 174, 96)' },
        error: { text: '#e74c3c', bg: 'rgba(231, 76, 60, 0.1)', icon: 'bi-x-circle-fill', bgSolid: 'rgba(231, 76, 60, .95)', border: 'rgb(192, 57, 43)' },
        warning: { text: '#f39c12', bg: 'rgba(243, 156, 18, 0.1)', icon: 'bi-exclamation-circle-fill', bgSolid: 'rgba(243, 156, 18, .95)', border: 'rgb(230, 126, 34)' },
        primary: { text: '#4361ee', bg: 'rgba(67, 97, 238, 0.1)', icon: 'bi-clipboard-check-fill', bgSolid: 'rgba(67, 97, 238, .95)', border: 'rgb(48, 81, 211)' }
      };

      return { message, colors: colors[type], type };
    },

    // 防抖函数 - 避免过多更新
    debounce: (func, wait = 300) => {
      let timeout;
      return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
      };
    }
  };

  // 通用的职位处理类
  class JobProcessor {
    constructor(config) {
      this.config = config;
      this.isRunning = false;
      this.isProcessing = false;
      this.processedJobs = [];
      this.currentPage = 1;
      this.totalPages = 1;
      this.currentJobIndex = 0;
      this.isStopping = false; // 添加停止中状态标志
    }

    async start(controlBtn) {
      this.isRunning = true;
      this.isStopping = false;
      this.processedJobs = [];
      this.currentPage = 1;
      this.currentJobIndex = 0;
      utils.updateButtonState(controlBtn, true);
      await this.processJobs(controlBtn);
    }

    // 请求停止，但不立即停止
    requestStop(controlBtn) {
      if (this.isProcessing) {
        // 如果正在处理职位，设置停止中状态
        this.isStopping = true;
        utils.updateButtonState(controlBtn, true, '', true);
        updateStatus('正在完成当前职位处理后停止...', 'warning');
      } else {
        // 如果没有正在处理的职位，直接停止
        this.stop(controlBtn);
      }
    }

    // 实际停止处理
    stop(controlBtn) {
      this.isRunning = false;
      this.isProcessing = false;
      this.isStopping = false;
      utils.updateButtonState(controlBtn, false);
      updateStatus('已停止处理', 'warning');
    }

    // 添加一个带原因的停止方法
    stopWithReason(message, type = 'warning') {
      this.isRunning = false;
      this.isProcessing = false;
      this.isStopping = false;
      const controlBtn = document.querySelector('.control-btn');
      if (controlBtn) {
        utils.updateButtonState(controlBtn, false);
      }
      updateStatus(message, type);
    }

    async findFilteredJobs() {
      return [];
    }

    async processJob(jobElement) {
      return false;
    }

    async processJobs(controlBtn) {
      if (!this.isRunning || (this.isProcessing && !this.isStopping)) return;
      this.isProcessing = true;

      try {
        // 如果设置了停止标志，且当前没有正在处理的职位
        if (this.isStopping) {
          this.stop(controlBtn);
          return;
        }

        const jobList = await this.findFilteredJobs();

        if (!jobList || jobList.length === 0) {
          updateStatus('无符合条件的职位', 'warning');
          this.stop(controlBtn);
          return;
        }

        if (this.currentJobIndex >= jobList.length) {
          // BOSS直聘特殊处理：当前已经在findFilteredJobs中尝试获取更多职位
          if (baseConfig.currentSite === SITE_TYPE.BOSS) {
            // 如果仍然没有新职位，则结束处理
            updateStatus('所有职位处理完毕', 'success');
            this.stop(controlBtn);
            return;
          }
          // 拉勾网的翻页处理
          else if (this.hasNextPage && await this.goToNextPage()) {
            this.isProcessing = false;
            setTimeout(() => this.processJobs(controlBtn), this.config.searchInterval || 1000);
            return;
          } else {
            updateStatus('处理完成', 'success');
            this.stop(controlBtn);
            return;
          }
        }

        const currentJob = jobList[this.currentJobIndex];
        utils.updateButtonState(controlBtn, true, `${this.currentJobIndex + 1}/${jobList.length}`, this.isStopping);

        const success = await this.processJob(currentJob);
        if (success) {
          const jobInfo = utils.getJobInfo(currentJob);
          this.processedJobs.push({
            ...jobInfo,
            time: new Date().toLocaleTimeString()
          });
        }

        this.currentJobIndex++;
        this.isProcessing = false;

        // 如果设置了停止标志，当前职位处理完后停止
        if (this.isStopping) {
          this.stop(controlBtn);
          return;
        }

        const delay = this.config.searchInterval || this.config.clickInterval || 1000;
        setTimeout(() => this.processJobs(controlBtn), delay);

      } catch (error) {
        console.error('处理出错:', error);
        this.isProcessing = false;
        updateStatus('处理出错', 'error');
        this.stop(controlBtn);
      }
    }
  }

  // BOSS直聘处理器
  class BossProcessor extends JobProcessor {
    constructor() {
      super(boss_Config);
      this.hasNextPage = false;
      this.retryCount = 0; // 重试计数
    }

    // 滚动到底部
    async scrollToBottom() {
      return new Promise((resolve) => {
        let lastHeight = document.documentElement.scrollHeight;
        let noChangeCount = 0;

        updateStatus('加载更多职位中...', 'info');
        const scrollInterval = setInterval(() => {
          if (!this.isRunning) {
            clearInterval(scrollInterval);
            resolve();
            return;
          }

          window.scrollBy(0, this.config.scrollStep);

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
        }, this.config.scrollCheckInterval);
      });
    }

    // 查找职位列表
    async findFilteredJobs() {
      // 获取当前可见的职位
      let jobList = Array.from(document.querySelectorAll('li.job-card-box')).filter(checkJobKeywords);

      // 如果当前索引到达列表末尾，尝试滚动获取更多
      if (this.currentJobIndex >= jobList.length && this.retryCount < 3 && this.isRunning) {
        this.retryCount++;
        updateStatus(`尝试加载更多职位 (${this.retryCount}/3)...`, 'info');
        await this.scrollToBottom();
        if (!this.isRunning) return [];

        // 重新获取职位列表
        jobList = Array.from(document.querySelectorAll('li.job-card-box')).filter(checkJobKeywords);

        // 如果没有新的职位，返回空列表以结束处理
        if (this.currentJobIndex >= jobList.length) {
          updateStatus('没有更多职位可处理', 'info');
          return [];
        } else {
          updateStatus(`发现${jobList.length - this.currentJobIndex}个新职位`, 'success');
        }
      }

      return jobList;
    }

    // 查找沟通按钮
    findChatButton() {
      let btn = document.querySelector('.op-btn.op-btn-chat');
      if (btn != null && btn.textContent == '立即沟通') {
        return btn;
      }
      return null;
    }

    // 查找留在当前页按钮
    findStayButton() {
      return document.querySelector('.default-btn.cancel-btn');
    }

    // 检查沟通限制
    checkChatLimit() {
      const limitText = document.querySelector('.chat-block-container');
      return limitText && limitText.textContent.includes('今日沟通人数已达上限，请明天再试');
    }

    // 处理单个职位
    async processJob(jobElement) {
      if (!jobElement) return false;

      const jobInfo = utils.getJobInfo(jobElement);
      const companyInfo = `${jobInfo.title} | ${jobInfo.company}`;

      utils.scrollToElement(jobElement);
      await utils.sleep(1000);

      jobElement.click();
      await utils.sleep(this.config.clickInterval);

      const chatBtn = this.findChatButton();
      if (chatBtn) {
        chatBtn.click();
        await utils.sleep(this.config.clickInterval);

        if (this.checkChatLimit()) {
          updateStatus(`${companyInfo} | 达到沟通上限`, 'warning');
          setTimeout(() => this.stopWithReason('已达到沟通上限，处理已停止', 'warning'), 0);
          return false;
        }

        const stayBtn = this.findStayButton();
        if (stayBtn) {
          stayBtn.click();
        }
        updateStatus(`${companyInfo} | 沟通成功`, 'success');
        return true;
      } else {
        updateStatus(`${companyInfo} | 不可沟通`, 'error');
        return false;
      }
    }

    // 在流程结束时重置状态
    stop(controlBtn) {
      this.retryCount = 0; // 重置重试计数
      super.stop(controlBtn);
    }

    // 扩展stopWithReason方法重置状态
    stopWithReason(message, type = 'warning') {
      this.retryCount = 0;
      super.stopWithReason(message, type);
    }
  }

  // 拉勾网处理器
  class LaGouProcessor extends JobProcessor {
    constructor() {
      super(laGou_Config);
    }

    // 获取页面信息
    updatePageInfo() {
      const paginationItems = document.querySelectorAll('.lg-pagination-item');
      if (paginationItems.length > 0) {
        const lastPageItem = Array.from(paginationItems)
          .filter(item => !isNaN(parseInt(item.textContent.trim())))
          .pop();

        if (lastPageItem) {
          this.totalPages = parseInt(lastPageItem.textContent.trim());
        }

        const activePage = document.querySelector('.lg-pagination-item-active');
        if (activePage) {
          this.currentPage = parseInt(activePage.textContent.trim());
        }
      }

      this.hasNextPage = this.currentPage < this.totalPages;
    }

    // 等待页面加载完成
    waitForPageLoad() {
      return new Promise((resolve) => {
        const checkPage = () => {
          const jobList = document.querySelectorAll('.item__10RTO');
          if (jobList.length > 0) {
            setTimeout(resolve, 500);
          } else {
            setTimeout(checkPage, 100);
          }
        };
        setTimeout(checkPage, this.config.pageLoadDelay || 500);
      });
    }

    // 查找职位列表
    async findFilteredJobs() {
      this.updatePageInfo();
      return Array.from(document.querySelectorAll('.item__10RTO')).filter(checkJobKeywords);
    }

    // 处理下一页
    async goToNextPage() {
      if (this.currentPage < this.totalPages) {
        const nextPageBtn = document.querySelector('.lg-pagination-next');
        if (nextPageBtn && !nextPageBtn.classList.contains('lg-pagination-disabled')) {
          this.currentPage++;
          this.currentJobIndex = 0;
          nextPageBtn.click();
          await this.waitForPageLoad();
          return true;
        }
      }
      return false;
    }

    // 处理单个职位
    async processJob(jobElement) {
      if (!jobElement) return false;

      const jobInfo = utils.getJobInfo(jobElement);
      const companyInfo = `${jobInfo.title} | ${jobInfo.company}`;

      utils.scrollToElement(jobElement);
      await utils.sleep(500);

      // 模拟鼠标悬浮
      const jobTitleElement = jobElement.querySelector('.p-top__1F7CL');
      if (jobTitleElement) {
        try {
          // 创建并分发 mouseover 事件
          const mouseEvent = new Event('mouseover', {
            bubbles: true,
            cancelable: true
          });
          jobTitleElement.dispatchEvent(mouseEvent);
        } catch (e) {
          console.warn('模拟鼠标事件失败', e);
        }
      }

      await utils.sleep(this.config.clickDelay);

      // 查找并点击投递按钮
      const applyBtn = document.querySelector(".rc-trigger-popup.index-module_job_details__2LK3w:not(.rc-trigger-popup-hidden) button");
      if (applyBtn && applyBtn.textContent === "投简历") {
        applyBtn.click();
        await utils.sleep(this.config.confirmDelay);

        // 查找并点击确认按钮
        const confirmBtn = document.querySelector(".lg-design-modal-root .lg-design-modal-mask")?.nextSibling?.querySelector(".lg-design-btn.lg-design-btn-primary");
        if (confirmBtn && confirmBtn.textContent === "确认投递") {
          confirmBtn.click();
          await utils.sleep(this.config.knowDelay);

          // 查找并点击我知道了按钮
          const knowBtn = document.querySelector(".lg-design-modal-root .lg-design-modal-mask")?.nextSibling?.querySelector(".lg-design-btn.lg-design-btn-primary");
          if (knowBtn && knowBtn.textContent === "我知道了") {
            knowBtn.click();
            this.config.appliedCount++;
            updateStatus(`${companyInfo} | 投递成功`, 'success');
            return true;
          }
        }
      } else if (applyBtn) {
        applyBtn.click();
        updateStatus(`${companyInfo} | 不可投递`, 'error');
        return false;
      }
    }

    async start(controlBtn) {
      super.start(controlBtn);
      this.config.appliedCount = 0;
    }
  }

  // 加载已保存的位置
  function loadSavedPosition() {
    const defaultPos = { top: '200px', left: `${window.innerWidth - 300}px` };
    const isJobsPage = isJobsListingPage();
    const positionType = isJobsPage ? 'full' : 'simple';
    const storageKey = baseConfig.currentSite === SITE_TYPE.BOSS ?
      (isJobsPage ? 'bossPosition' : 'bossSimplePosition') :
      (isJobsPage ? 'lagouPosition' : 'lagouSimplePosition');

    try {
      // 加载对应类型的位置
      const savedPosition = GM_getValue(storageKey, defaultPos);

      if (baseConfig.currentSite === SITE_TYPE.BOSS) {
        baseConfig.panelPosition[SITE_TYPE.BOSS][positionType] = savedPosition;
      } else {
        baseConfig.panelPosition[SITE_TYPE.LAGOU][positionType] = savedPosition;
      }

      const position = baseConfig.panelPosition[baseConfig.currentSite][positionType];

      // 验证保存的位置是否有效
      if (!position || !position.top || !position.left ||
        !(position.top.includes('px') || position.top.includes('%')) ||
        !(position.left.includes('px') || position.left.includes('%'))) {
        console.warn('保存的位置无效，使用默认值', position);
        baseConfig.panelPosition[baseConfig.currentSite][positionType] = defaultPos;
      }
    } catch (e) {
      console.error('加载位置出错', e);
      baseConfig.panelPosition[baseConfig.currentSite][positionType] = defaultPos;
    }

    console.log('加载位置:', baseConfig.panelPosition[baseConfig.currentSite][positionType]);
  }

  // 保存面板位置
  function savePanelPosition(panel) {
    try {
      const rect = panel.getBoundingClientRect();
      const isJobsPage = isJobsListingPage();
      const positionType = isJobsPage ? 'full' : 'simple';

      // 直接使用像素值保存位置，而不是百分比
      const position = {
        top: `${rect.top}px`,
        left: `${rect.left}px`
      };

      // 保存位置
      baseConfig.panelPosition[baseConfig.currentSite][positionType] = position;

      // 使用对应的存储键名
      const storageKey = baseConfig.currentSite === SITE_TYPE.BOSS ?
        (isJobsPage ? 'bossPosition' : 'bossSimplePosition') :
        (isJobsPage ? 'lagouPosition' : 'lagouSimplePosition');

      GM_setValue(storageKey, position);

      console.log(`保存${isJobsPage ? '完整' : '简化'}面板位置:`, position);
    } catch (e) {
      console.error('保存位置出错', e);
    }
  }

  // 弹出记录窗口
  function showJobsRecordModal() {
    // 关闭已经打开的模态窗口
    const existingModal = document.getElementById('jobs-record-modal');
    if (existingModal) {
      document.body.removeChild(existingModal);
    }

    // 创建模态容器
    const modal = document.createElement('div');
    modal.id = 'jobs-record-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      z-index: 9999999;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'PingFang SC', 'Microsoft YaHei', 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
    `;

    // 添加样式到文档头
    const styleElement = document.createElement('style');
    styleElement.textContent = `
      :root {
        --border-color: #dee2e6;
        --primary-color: #4361ee;
        --success-color: #2ecc71;
        --info-color: #3498db;
        --danger-color: #e74c3c;
        --warning-color: #f39c12;
        --light-bg: #f8f9fa;
        --plan-color: #4caf50;
        --text-color: #2c3e50;
        --text-secondary: #6c757d;
        --shadow-sm: 0 2px 4px rgba(0, 0, 0, .05);
        --shadow-md: 0 4px 6px rgba(0, 0, 0, .1);
        --shadow-lg: 0 10px 15px rgba(0, 0, 0, .1);
      }

      #jobs-record-modal .main-container {
        overflow: hidden;
        display: flex;
        flex-direction: column;
        width: 98%;
        max-width: 2000px;
        height: 98vh;
        max-height: 98vh;
        margin: 0;
        padding: 0;
        background-color: #f5f7fa;
        border-radius: 10px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      }

      #jobs-record-modal .container {
        overflow-y: hidden;
        display: flex;
        flex: 1;
        flex-direction: column;
        height: 100%;
        max-height: 100%;
        padding: 20px 20px 15px 20px;
        background: #fff;
        border-radius: 10px;
        box-sizing: border-box;
        width: 100%;
      }

      #jobs-record-modal .content-wrapper {
        overflow: hidden;
        display: flex;
        flex: 1;
        height: calc(100% - 20px);
        gap: 20px;
        width: 100%;
      }

      #jobs-record-modal .left-panel {
        overflow: hidden;
        display: flex;
        flex: 1;
        flex-direction: column;
        width: 100%;
      }

      #jobs-record-modal .right-panel {
        overflow: hidden;
        display: flex;
        flex-direction: column;
        width: 380px;
        min-width: 380px;
        padding-right: 0;
      }

      #jobs-record-modal .section {
        margin-bottom: 20px;
        padding: 0;
        border-bottom: none;
      }

      #jobs-record-modal .section:last-child {
        overflow: hidden;
        display: flex;
        flex: 1;
        flex-direction: column;
        margin-bottom: 0;
        padding-bottom: 0;
      }

      #jobs-record-modal .plan-section {
        margin-bottom: 20px;
      }

      #jobs-record-modal .common-info-container {
        margin-bottom: 0;
        padding: 0;
      }

      #jobs-record-modal .company-section {
        overflow: hidden;
        display: flex;
        flex: 1;
        flex-direction: column;
        padding-bottom: 0;
      }

      #jobs-record-modal .table-responsive {
        overflow: hidden;
        overflow-x: hidden;
        display: flex;
        flex: 1;
        flex-direction: column;
        height: 1px;
        margin: 0 0 10px 0;
        padding: 0;
        border: 1px solid var(--border-color);
        border-radius: 8px;
        box-sizing: border-box;
      }

      #jobs-record-modal .summary-content-wrapper {
        overflow: hidden;
        display: flex;
        flex: 1;
        flex-direction: column;
        padding: 5px;
        border: none;
        background: #fff;
        border-radius: 0;
        box-shadow: none;
      }

      #jobs-record-modal .summary-title {
        display: flex;
        align-items: center;
        flex-shrink: 0;
        position: relative;
        margin: 0 0 15px 0;
        padding-left: 15px;
        border-bottom: none;
        background-color: transparent;
        color: var(--text-color);
        font-size: 20px;
        font-weight: 600;
        border-radius: 0;
      }

      #jobs-record-modal .summary-title:before {
        content: '';
        position: absolute;
        top: 50%;
        left: 0;
        width: 4px;
        height: 20px;
        margin-right: 0;
        background-color: var(--primary-color);
        transform: translateY(-50%);
        border-radius: 2px;
      }

      #jobs-record-modal .summary-textarea {
        overflow-y: auto;
        flex: 1;
        width: 100%;
        height: 100%;
        min-height: 60px;
        margin: 0;
        padding: 15px;
        border: 1px solid #ddd;
        background-color: #f5f7fd;
        color: var(--text-color);
        font-family: inherit;
        font-size: 14px;
        line-height: 1.5;
        white-space: pre-wrap;
        word-wrap: break-word;
        outline: none;
        resize: none;
        transition: all .3s ease;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, .05);
        box-sizing: border-box;
      }

      #jobs-record-modal .common-info-textarea {
        overflow-y: hidden;
        width: 100%;
        height: auto;
        min-height: 60px;
        padding: 15px;
        border: 1px solid #ddd;
        background-color: #f9fff9;
        font-family: inherit;
        font-size: 14px;
        line-height: 1.6;
        outline: none;
        resize: none;
        transition: all .3s ease;
        border-radius: 8px;
        box-shadow: 0 1px 3px rgba(0, 0, 0, .05);
        box-sizing: border-box;
      }

      #jobs-record-modal h2 {
        display: flex;
        align-items: center;
        position: relative;
        margin-top: 0;
        margin-bottom: 20px;
        padding-left: 15px;
        color: var(--text-color);
        font-size: 20px;
        font-weight: 600;
      }

      #jobs-record-modal h2:before {
        content: '';
        position: absolute;
        top: 50%;
        left: 0;
        width: 4px;
        height: 20px;
        background-color: var(--info-color);
        transform: translateY(-50%);
        border-radius: 2px;
      }

      #jobs-record-modal .section.plan-section h2:before {
        background-color: var(--plan-color);
      }

      #jobs-record-modal .section.company-section h2:before {
        background-color: var(--info-color);
      }

      #jobs-record-modal .table-header {
        position: sticky;
        z-index: 10;
        top: 0;
        width: 100%;
        background-color: var(--primary-color);
      }

      #jobs-record-modal .table-body {
        overflow-x: hidden;
        overflow-y: auto;
        flex: 1;
        width: 100%;
      }

      #jobs-record-modal table {
        width: 100%;
        margin: 0;
        padding: 0;
        border: none;
        font-size: 14px;
        border-collapse: separate;
        border-spacing: 0;
        table-layout: fixed;
        border-radius: 0;
        box-shadow: none;
      }

      #jobs-record-modal th {
        position: sticky;
        z-index: 10;
        top: 0;
        padding: 12px 8px;
        background-color: var(--primary-color);
        color: white;
        font-size: 14px;
        font-weight: 500;
        text-align: center;
        letter-spacing: .5px;
      }

      /* 表格样式 */
      #jobs-record-modal tr:hover {
        background-color: rgba(67, 97, 238, .04);
      }

      #jobs-record-modal tr:nth-child(odd) {
        background-color: #fff;
      }

      #jobs-record-modal tr:nth-child(even) {
        background-color: rgba(240, 242, 245, .6);
      }

      #jobs-record-modal tr:last-child td {
        border-bottom: none;
      }

      #jobs-record-modal input[type='text'],
      #jobs-record-modal select {
        width: 100%;
        margin: 2px 0;
        padding: 6px 8px;
        border: 1px solid #ddd;
        font-size: 14px;
        transition: all .3s ease;
        border-radius: 4px;
        box-sizing: border-box;
      }

      #jobs-record-modal input[type='text']:focus,
      #jobs-record-modal select:focus {
        border-color: var(--primary-color);
        outline: none;
        box-shadow: 0 0 0 2px rgba(67, 97, 238, .1);
      }

      #jobs-record-modal input[type='checkbox'] {
        display: block;
        position: relative;
        top: 2px;
        width: 20px;
        height: 20px;
        margin: 0 auto;
        cursor: pointer;
        accent-color: var(--primary-color);
      }

      #jobs-record-modal td {
        padding: 8px;
      }

      #jobs-record-modal td > * {
        margin: 2px 0;
      }

      /* 表格按钮样式 */
      #jobs-record-modal .table-btn {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 24px !important;
        height: 24px !important;
        margin: 0 1px !important;
        padding: 0 !important;
        border: none !important;
        background: none !important;
        font-size: 18px !important;
        cursor: pointer !important;
        transition: all .2s ease !important;
        border-radius: 50% !important;
      }

      #jobs-record-modal .table-btn:hover {
        background-color: rgba(0, 0, 0, .05) !important;
        transform: scale(1.1) !important;
      }

      #jobs-record-modal .table-btn.delete {
        color: var(--danger-color) !important;
      }

      #jobs-record-modal .table-btn.confirm {
        color: var(--success-color) !important;
      }

      #jobs-record-modal .move-btn {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 24px !important;
        height: 24px !important;
        margin: 0 1px !important;
        padding: 0 !important;
        border: none !important;
        background: none !important;
        font-size: 18px !important;
        cursor: pointer !important;
        transition: all .2s ease !important;
        border-radius: 50% !important;
      }

      #jobs-record-modal .move-btn:hover {
        background-color: rgba(0, 0, 0, .05) !important;
        transform: scale(1.1) !important;
      }

      #jobs-record-modal .move-btn.up {
        color: var(--success-color) !important;
      }

      #jobs-record-modal .move-btn.down {
        color: var(--warning-color) !important;
      }

      #jobs-record-modal .move-btn.disabled {
        color: #ccc !important;
        cursor: not-allowed !important;
      }

      #jobs-record-modal .move-btn.disabled:hover {
        background: none !important;
        transform: none !important;
      }

      /* 记录按钮样式 */
      #jobs-record-modal .remark-btn {
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        position: relative !important;
        width: 28px !important;
        height: 28px !important;
        margin: 0 auto !important;
        padding: 0 !important;
        border: 1px solid var(--border-color) !important;
        background-color: #fff !important;
        color: var(--primary-color) !important;
        font-size: 14px !important;
        text-align: center !important;
        cursor: pointer !important;
        transition: all .3s ease !important;
        border-radius: 4px !important;
        box-shadow: var(--shadow-sm) !important;
      }

      #jobs-record-modal .remark-btn.has-content {
        border-color: var(--primary-color) !important;
        background-color: var(--primary-color) !important;
        color: white !important;
      }

      #jobs-record-modal .remark-btn:hover {
        transform: translateY(-1px) !important;
        box-shadow: 0 3px 8px rgba(0, 0, 0, 0.1) !important;
      }

      /* 其他按钮样式 */
      #jobs-record-modal .add-btn {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 100% !important;
        height: 36px !important;
        margin-top: 5px !important;
        margin-bottom: 0 !important;
        border: none !important;
        background-color: var(--primary-color) !important;
        color: white !important;
        font-size: 15px !important;
        font-weight: bold !important;
        cursor: pointer !important;
        transition: all .3s ease !important;
        border-radius: 8px !important;
        box-shadow: 0 4px 10px rgba(67, 97, 238, .3) !important;
      }

      #jobs-record-modal .add-btn:hover {
        background-color: rgba(67, 97, 238, .9) !important;
        transform: translateY(-2px) !important;
        box-shadow: 0 6px 12px rgba(67, 97, 238, .4) !important;
      }

      /* 浮动按钮样式 */
      #jobs-record-modal .floating-buttons {
        display: flex !important;
        flex-direction: column !important;
        position: fixed !important;
        z-index: 10000 !important;
        right: 25px !important;
        bottom: 25px !important;
        gap: 12px !important;
      }

      #jobs-record-modal .floating-btn {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 50px !important;
        height: 50px !important;
        border: none !important;
        color: white !important;
        font-size: 20px !important;
        cursor: pointer !important;
        transition: all .3s cubic-bezier(.4, 0, .2, 1) !important;
        border-radius: 50% !important;
        box-shadow: 0 4px 12px rgba(0, 0, 0, .15) !important;
        backdrop-filter: blur(8px) !important;
        -webkit-backdrop-filter: blur(8px) !important;
      }

      #jobs-record-modal .floating-btn:hover {
        transform: translateY(-3px) !important;
        box-shadow: 0 6px 16px rgba(0, 0, 0, .2) !important;
      }

      #jobs-record-modal .floating-btn.save {
        background-color: var(--success-color) !important;
      }

      #jobs-record-modal .floating-btn.restore {
        background-color: var(--primary-color) !important;
      }

      #jobs-record-modal .floating-btn.export {
        background-color: var(--info-color) !important;
      }

      #jobs-record-modal .floating-btn.close {
        background-color: var(--danger-color) !important;
      }

      /* 表格列宽度 */
      #jobs-record-modal table#companyTable th:nth-child(1),
      #jobs-record-modal table#companyTable td:nth-child(1),
      #jobs-record-modal table#companyTableHeader th:nth-child(1) {
        width: 80px;
      }

      #jobs-record-modal table#companyTable th:nth-child(2),
      #jobs-record-modal table#companyTable td:nth-child(2),
      #jobs-record-modal table#companyTableHeader th:nth-child(2) {
        width: 18%;
      }

      #jobs-record-modal table#companyTable th:nth-child(3),
      #jobs-record-modal table#companyTable td:nth-child(3),
      #jobs-record-modal table#companyTableHeader th:nth-child(3) {
        width: 40%;
        text-align: center;
      }

      #jobs-record-modal table#companyTable th:nth-child(4),
      #jobs-record-modal table#companyTable td:nth-child(4),
      #jobs-record-modal table#companyTableHeader th:nth-child(4) {
        width: 10%;
        text-align: center;
      }

      #jobs-record-modal table#companyTable th:nth-child(5),
      #jobs-record-modal table#companyTable td:nth-child(5),
      #jobs-record-modal table#companyTableHeader th:nth-child(5) {
        width: 10%;
        text-align: center;
      }

      #jobs-record-modal table#companyTable th:nth-child(6),
      #jobs-record-modal table#companyTable td:nth-child(6),
      #jobs-record-modal table#companyTableHeader th:nth-child(6) {
        width: 60px;
        text-align: center;
      }

      #jobs-record-modal table#companyTable th:nth-child(7),
      #jobs-record-modal table#companyTable td:nth-child(7),
      #jobs-record-modal table#companyTableHeader th:nth-child(7) {
        width: 60px;
        vertical-align: middle;
        text-align: center;
      }

      #jobs-record-modal .action-cell {
        text-align: center;
      }

      #jobs-record-modal td.action-cell {
        vertical-align: middle;
        text-align: center;
      }

      /* 备注模态框 */
      #jobs-record-modal .remark-modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background-color: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        align-items: center;
        justify-content: center;
      }

      #jobs-record-modal .remark-modal-content {
        position: relative;
        width: 500px;
        max-width: 90%;
        background-color: white;
        border-radius: 10px;
        padding: 25px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.2);
      }

      #jobs-record-modal .remark-modal-content h3 {
        margin-top: 0;
        margin-bottom: 15px;
        color: var(--primary-color);
        font-size: 20px;
        font-weight: 600;
      }

      #jobs-record-modal #remarkTextarea {
        width: 100%;
        height: 200px;
        padding: 12px;
        border: 1px solid #ddd;
        border-radius: 6px;
        font-family: inherit;
        font-size: 14px;
        line-height: 1.5;
        resize: none;
        margin-bottom: 15px;
      }

      #jobs-record-modal #remarkTextarea:focus {
        border-color: var(--primary-color);
        outline: none;
        box-shadow: 0 0 0 3px rgba(67, 97, 238, .1);
      }

      #jobs-record-modal .remark-modal-buttons {
        display: flex;
        justify-content: flex-end;
        gap: 10px;
      }

      #jobs-record-modal .cancel-btn,
      #jobs-record-modal .save-btn {
        padding: 8px 16px;
        border: none;
        border-radius: 5px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
      }

      #jobs-record-modal .cancel-btn {
        background-color: #f8f9fa;
        color: #666;
        border: 1px solid #ddd;
      }

      #jobs-record-modal .cancel-btn:hover {
        background-color: #e9ecef;
      }

      #jobs-record-modal .save-btn {
        background-color: var(--primary-color);
        color: white;
      }

      #jobs-record-modal .save-btn:hover {
        background-color: rgba(67, 97, 238, .9);
      }

      #jobs-record-modal .close-btn {
        position: absolute;
        top: 10px;
        right: 10px;
        width: 30px;
        height: 30px;
        background: none;
        border: none;
        font-size: 24px;
        line-height: 1;
        color: #999;
        cursor: pointer;
        transition: color 0.2s ease;
      }

      #jobs-record-modal .close-btn:hover {
        color: #333;
      }

      /* 动画 */
      @keyframes highlight {
        0% { background-color: rgba(231, 76, 60, .1); }
        50% { background-color: rgba(231, 76, 60, .2); }
        100% { background-color: rgba(231, 76, 60, .1); }
      }

      #jobs-record-modal .delete-confirm {
        animation: highlight 1s ease-in-out infinite;
      }

      /* 确保Bootstrap图标正确加载 */
      #jobs-record-modal .bi {
        display: inline-block !important;
        line-height: 1 !important;
        vertical-align: -.125em !important;
        fill: currentColor !important;
      }
    `;
    document.head.appendChild(styleElement);

    // Styles have been consolidated into styleElement above

    // 创建模态内容结构
    const modalContent = document.createElement('div');
    modalContent.className = 'main-container';
    modalContent.innerHTML = `
      <div class="container">
        <div id="notificationsContainer" class="notifications-container" style="position: absolute; top: 70px; right: 25px; z-index: 10000; display: flex; flex-direction: column; gap: 10px; max-width: 330px;"></div>

        <div class="content-wrapper">
          <div class="left-panel">
            <div class="section plan-section">
              <h2>常用信息</h2>
              <div class="common-info-container">
                <textarea id="commonInfo" class="common-info-textarea" placeholder="在这里输入常用信息..."></textarea>
              </div>
            </div>

            <div class="section company-section">
              <h2>公司信息</h2>
              <div class="table-responsive">
                <div class="table-header">
                  <table id="companyTableHeader">
                    <thead>
                      <tr>
                        <th>操作</th>
                        <th>名称</th>
                        <th>信息</th>
                        <th>职位</th>
                        <th>薪资</th>
                        <th>记录</th>
                        <th>外包</th>
                      </tr>
                    </thead>
                  </table>
                </div>
                <div class="table-body">
                  <table id="companyTable">
                    <tbody>
                    </tbody>
                  </table>
                </div>
              </div>
              <button class="add-btn" id="addCompanyBtn"><i class="bi bi-plus-lg"></i></button>
            </div>
          </div>

          <div class="right-panel">
            <div class="summary-content-wrapper">
              <h2 class="summary-title">记录汇总</h2>
              <textarea id="summaryTextarea" class="summary-textarea" readonly placeholder="暂无记录"></textarea>
            </div>
          </div>
        </div>

        <div class="floating-buttons">
          <button class="floating-btn save" id="saveDataBtn" title="保存信息">
            <i class="bi bi-save"></i>
          </button>
          <button class="floating-btn restore" id="restoreDataBtn" title="恢复信息">
            <i class="bi bi-arrow-clockwise"></i>
          </button>
          <button class="floating-btn export" id="exportDataBtn" title="导出为Markdown">
            <i class="bi bi-clipboard"></i>
          </button>
          <button class="floating-btn close" id="closeJobsModal" title="关闭窗口" style="background-color: #e74c3c;">
            <i class="bi bi-x"></i>
          </button>
        </div>
      </div>
    `;

    // 创建备注模态窗口
    const remarkModal = document.createElement('div');
    remarkModal.id = 'remarkModal';
    remarkModal.className = 'remark-modal';
    remarkModal.innerHTML = `
      <div class="remark-modal-content">
        <button class="close-btn" id="closeRemarkModalBtn">&times;</button>
        <h3>记录</h3>
        <textarea id="remarkTextarea" placeholder="请记录..."></textarea>
        <div class="remark-modal-buttons">
          <button class="cancel-btn" id="cancelRemarkBtn">取消</button>
          <button class="save-btn" id="saveRemarkBtn">保存</button>
        </div>
      </div>
    `;

    // 添加内容到模态窗口
    modal.appendChild(modalContent);
    modal.appendChild(remarkModal);
    document.body.appendChild(modal);

    // 加载Bootstrap图标
    if (!document.querySelector('link[href*="bootstrap-icons"]')) {
      const iconLink = document.createElement('link');
      iconLink.rel = 'stylesheet';
      iconLink.href = 'https://cdn.jsdelivr.net/npm/bootstrap-icons@1.10.5/font/bootstrap-icons.css';
      document.head.appendChild(iconLink);

      // 添加备用图标加载方案
      setTimeout(() => {
        if (!document.querySelector('.bi')) {
          console.log('尝试使用备用方式加载图标');
          const fallbackStyle = document.createElement('style');
          fallbackStyle.textContent = `
            .bi-plus-lg:before { content: "+"; font-weight: bold; font-size: 18px; }
            .bi-trash:before { content: "🗑️"; }
            .bi-check-lg:before { content: "✓"; font-weight: bold; }
            .bi-arrow-up:before { content: "↑"; }
            .bi-arrow-down:before { content: "↓"; }
            .bi-pencil-square:before { content: "✎"; }
            .bi-save:before { content: "💾"; }
            .bi-arrow-clockwise:before { content: "↻"; }
            .bi-clipboard:before { content: "📋"; }
            .bi-info-circle-fill:before { content: "ℹ"; }
            .bi-check-circle-fill:before { content: "✓"; }
            .bi-exclamation-circle-fill:before { content: "⚠"; }
            .bi-x-circle-fill:before { content: "✕"; }
            .bi-clipboard-check-fill:before { content: "✓"; }
            .bi-x:before { content: "×"; }
          `;
          document.head.appendChild(fallbackStyle);
        }
      }, 1000);
    }

    // 初始化变量
    let companyData = JSON.parse(GM_getValue("jobsRecordCompanyData", "[]"));
    let commonInfoData = GM_getValue("jobsRecordCommonInfoData", "");
    let currentRemarkIndex = -1;
    let notificationCounter = 0;

    // 通知功能
    function showNotification(message, type = "info") {
      const notificationsContainer = document.getElementById("notificationsContainer");
      if (!notificationsContainer) return;

      const notificationId = `notification-${notificationCounter++}`;
      const notification = document.createElement("div");
      notification.id = notificationId;
      notification.className = `notification ${type}`;

      // 为通知添加基本样式
      notification.style.cssText = `
        display: flex;
        align-items: center;
        width: 100%;
        min-width: 260px;
        max-width: 320px;
        padding: 12px 15px;
        margin-bottom: 8px;
        font-size: 14px;
        font-weight: 500;
        opacity: 0;
        transition: all .3s cubic-bezier(.4, 0, .2, 1);
        transform: translateX(30px);
        animation: slide-in .3s forwards, slide-out .3s forwards 2.8s;
        border-radius: 8px;
        box-shadow: 0 6px 16px rgba(0, 0, 0, .2);
        gap: 10px;
        backdrop-filter: blur(6px);
        -webkit-backdrop-filter: blur(6px);
      `;

      // 添加动画样式
      if (!document.getElementById('notification-animations')) {
        const animStyle = document.createElement('style');
        animStyle.id = 'notification-animations';
        animStyle.textContent = `
          @keyframes slide-in {
            0% { opacity: 0; transform: translateX(30px); }
            100% { opacity: 1; transform: translateX(0); }
          }
          @keyframes slide-out {
            0% { opacity: 1; transform: translateX(0); }
            100% { opacity: 0; transform: translateX(30px); }
          }
        `;
        document.head.appendChild(animStyle);
      }

      // 使用通用通知函数获取样式
      const notificationData = utils.createNotification(message, type);
      const colors = notificationData.colors;

      const icon = colors.icon;
      const bgColor = colors.bgSolid;
      const borderColor = colors.border;

      notification.style.backgroundColor = bgColor;
      notification.style.borderLeft = `3px solid ${borderColor}`;
      notification.style.color = 'white';

      notification.innerHTML = `
        <i class="bi ${icon}" style="flex-shrink: 0; font-size: 18px;"></i>
        <span style="flex-grow: 1; line-height: 1.4;">${message}</span>
        <button onclick="document.getElementById('${notificationId}').remove()" style="
          display: flex;
          align-items: center;
          justify-content: center;
          width: 22px;
          height: 22px;
          padding: 0;
          border: none;
          background: rgba(255, 255, 255, 0.15);
          color: white;
          font-size: 14px;
          opacity: .8;
          cursor: pointer;
          transition: all .2s ease;
          border-radius: 50%;
        ">
          <i class="bi bi-x"></i>
        </button>
      `;

      notificationsContainer.appendChild(notification);

      setTimeout(() => {
        if (document.getElementById(notificationId)) {
          notification.remove();
        }
      }, 3000);
    }

    // 渲染公司表格
    function renderCompanyTable() {
      const tableBody = document.querySelector("#jobs-record-modal #companyTable tbody");
      if (!tableBody) return;

      tableBody.innerHTML = ''; // 清空现有行

      if (companyData.length === 0) {
        const emptyRow = document.createElement("tr");
        const emptyCell = document.createElement("td");
        emptyCell.colSpan = 7;
        emptyCell.textContent = "暂无公司信息，点击下方按钮添加";
        emptyCell.style.textAlign = "center";
        emptyCell.style.padding = "20px";
        emptyCell.style.color = "#888";
        emptyRow.appendChild(emptyCell);
        tableBody.appendChild(emptyRow);
        return;
      }

      // Table styles already included in styleElement

      companyData.forEach((company, index) => {
        const row = document.createElement("tr");

        // 操作按钮单元格
        const actionCell = document.createElement("td");
        actionCell.className = "action-cell";

        // 创建移动按钮容器
        const moveButtonsContainer = document.createElement("div");
        moveButtonsContainer.style.display = "flex";
        moveButtonsContainer.style.justifyContent = "center";
        moveButtonsContainer.style.gap = "4px";

        // 创建上移按钮
        const moveUpBtn = document.createElement("button");
        moveUpBtn.innerHTML = '<i class="bi bi-arrow-up"></i>';
        moveUpBtn.className = `move-btn up ${index === 0 ? 'disabled' : ''}`;
        moveUpBtn.title = "上移";
        moveUpBtn.onclick = () => {
          if (index > 0) {
            moveRow(index, -1);
          }
        };

        // 创建下移按钮
        const moveDownBtn = document.createElement("button");
        moveDownBtn.innerHTML = '<i class="bi bi-arrow-down"></i>';
        moveDownBtn.className = `move-btn down ${index === companyData.length - 1 ? 'disabled' : ''}`;
        moveDownBtn.title = "下移";
        moveDownBtn.onclick = () => {
          if (index < companyData.length - 1) {
            moveRow(index, 1);
          }
        };

        // 创建删除按钮
        const deleteBtn = document.createElement("button");
        deleteBtn.innerHTML = '<i class="bi bi-trash"></i>';
        deleteBtn.className = "table-btn delete";
        deleteBtn.title = "删除";

        // 创建删除按钮的点击处理函数
        function handleDeleteClick() {
          this.innerHTML = '<i class="bi bi-check-lg"></i>';
          this.className = "table-btn confirm";
          this.title = "确认删除";
          row.classList.add('delete-confirm');

          setTimeout(() => {
            if (row.classList.contains('delete-confirm')) {
              this.innerHTML = '<i class="bi bi-trash"></i>';
              this.className = "table-btn delete";
              this.title = "删除";
              row.classList.remove('delete-confirm');
              this.onclick = handleDeleteClick;
            }
          }, 3000);

          this.onclick = function () {
            if (this.className === "table-btn confirm") {
              row.classList.remove('delete-confirm');
              deleteCompany(index);
            }
          };
        }

        deleteBtn.onclick = handleDeleteClick;

        moveButtonsContainer.appendChild(moveUpBtn);
        moveButtonsContainer.appendChild(moveDownBtn);
        moveButtonsContainer.appendChild(deleteBtn);
        actionCell.appendChild(moveButtonsContainer);
        row.appendChild(actionCell);

        // 名称
        const nameCell = document.createElement("td");
        const nameInput = document.createElement("input");
        nameInput.type = "text";
        nameInput.value = company.name || "";
        nameInput.placeholder = "公司名称";
        nameInput.oninput = () => updateCompanyData(index, "name", nameInput.value);
        nameCell.appendChild(nameInput);
        row.appendChild(nameCell);

        // 信息
        const infoCell = document.createElement("td");
        infoCell.style.textAlign = "center";
        const infoInput = document.createElement("input");
        infoInput.type = "text";
        infoInput.value = company.size || "";
        infoInput.placeholder = "公司信息";
        infoInput.oninput = () => updateCompanyData(index, "size", infoInput.value);
        infoCell.appendChild(infoInput);
        row.appendChild(infoCell);

        // 职位
        const positionCell = document.createElement("td");
        positionCell.style.textAlign = "center";
        const positionInput = document.createElement("input");
        positionInput.type = "text";
        positionInput.value = company.position || "Java开发";
        positionInput.placeholder = "职位名称";
        positionInput.oninput = () => updateCompanyData(index, "position", positionInput.value);
        positionCell.appendChild(positionInput);
        row.appendChild(positionCell);

        // 薪资
        const salaryCell = document.createElement("td");
        salaryCell.style.textAlign = "center";
        const salaryInput = document.createElement("input");
        salaryInput.type = "text";
        salaryInput.value = company.salary || "";
        salaryInput.placeholder = "薪资范围";
        salaryInput.oninput = () => updateCompanyData(index, "salary", salaryInput.value);
        salaryCell.appendChild(salaryInput);
        row.appendChild(salaryCell);

        // 记录
        const remarkCell = document.createElement("td");
        remarkCell.style.textAlign = "center";
        const remarkTooltip = document.createElement("div");
        remarkTooltip.className = "remark-tooltip";

        const remarkBtn = document.createElement("button");
        remarkBtn.className = "remark-btn";
        remarkBtn.innerHTML = '<i class="bi bi-pencil-square"></i>';
        remarkBtn.style.cssText = `
        display: inline-flex;
        align-items: center;
        justify-content: center;
        position: relative;
        width: 28px;
        height: 28px;
        margin: 0 auto;
        padding: 0;
        border: 1px solid var(--border-color);
        background-color: #fff;
        color: var(--primary-color);
        font-size: 14px;
        text-align: center;
        cursor: pointer;
        transition: all .3s ease;
        border-radius: 4px;
        box-shadow: var(--shadow-sm);
      `;

        if (company.remark) {
          remarkBtn.classList.add("has-content");
          remarkBtn.style.borderColor = 'var(--primary-color)';
          remarkBtn.style.backgroundColor = 'var(--primary-color)';
          remarkBtn.style.color = 'white';
        }

        remarkBtn.onclick = () => {
          openRemarkModal(index);
        };

        remarkTooltip.appendChild(remarkBtn);
        remarkCell.appendChild(remarkTooltip);
        row.appendChild(remarkCell);

        // 外包
        const outsourcingCell = document.createElement("td");
        outsourcingCell.className = "action-cell";
        outsourcingCell.style.position = "relative";

        const outsourcingCheckbox = document.createElement("input");
        outsourcingCheckbox.type = "checkbox";
        outsourcingCheckbox.checked = company.isOutsourcing === undefined ? true : company.isOutsourcing;
        outsourcingCheckbox.onchange = () => updateCompanyData(index, "isOutsourcing", outsourcingCheckbox.checked);
        outsourcingCheckbox.style.position = "absolute";
        outsourcingCheckbox.style.top = "50%";
        outsourcingCheckbox.style.left = "50%";
        outsourcingCheckbox.style.transform = "translate(-50%, -50%)";
        outsourcingCheckbox.style.margin = "0";

        outsourcingCell.appendChild(outsourcingCheckbox);
        row.appendChild(outsourcingCell);

        tableBody.appendChild(row);
      });
    }

    // Render common info
    function renderCommonInfo() {
      const textarea = document.querySelector("#jobs-record-modal #commonInfo");
      if (!textarea) return;

      textarea.value = commonInfoData;

      function adjustHeight() {
        textarea.style.height = 'auto';
        textarea.style.height = textarea.scrollHeight + 'px';
      }

      adjustHeight();

      textarea.oninput = () => {
        commonInfoData = textarea.value;
        adjustHeight();
      };
    }

    // Update summary
    function updateSummary() {
      const summaryTextarea = document.querySelector("#jobs-record-modal #summaryTextarea");
      if (!summaryTextarea) return;

      let summaryText = "";

      companyData.forEach(company => {
        if (company.remark) {
          summaryText += `【${company.name || "未命名公司"}】\n${company.remark}\n\n`;
        }
      });

      if (!summaryText) {
        summaryText = "暂无记录";
      }

      summaryTextarea.value = summaryText.trim();
    }

    // Move row
    function moveRow(index, direction) {
      const newIndex = index + direction;
      if (newIndex < 0 || newIndex >= companyData.length) return;

      const temp = companyData[index];
      companyData[index] = companyData[newIndex];
      companyData[newIndex] = temp;

      renderCompanyTable();
      showNotification("已移动行", "info");
    }

    // Update company data
    function updateCompanyData(index, key, value) {
      companyData[index][key] = value;
    }

    // Delete company
    function deleteCompany(index) {
      companyData.splice(index, 1);
      renderCompanyTable();
      updateSummary();
      showNotification("公司信息已删除", "error");
    }

    // Add company
    function addCompany() {
      companyData.push({
        name: "",
        size: "",
        position: "Java开发",
        salary: "",
        isOutsourcing: true
      });
      renderCompanyTable();
      setTimeout(() => {
        const inputs = document.querySelectorAll("#jobs-record-modal #companyTable tbody tr:last-child td:nth-child(2) input");
        if (inputs.length > 0) {
          inputs[0].focus();
        }
      }, 100);
    }

    // Save data
    function saveData() {
      GM_setValue("jobsRecordCompanyData", JSON.stringify(companyData));
      GM_setValue("jobsRecordCommonInfoData", commonInfoData);
      showNotification("数据已保存", "success");
    }

    // Restore data
    function restoreData() {
      const savedCompanyData = GM_getValue("jobsRecordCompanyData");
      const savedCommonInfoData = GM_getValue("jobsRecordCommonInfoData");

      let hasRestoredData = false;

      if (savedCompanyData) {
        try {
          companyData = JSON.parse(savedCompanyData);
          renderCompanyTable();
          updateSummary();
          hasRestoredData = true;
        } catch (e) {
          console.error("恢复公司数据失败", e);
          showNotification("恢复公司数据失败", "error");
        }
      }

      if (savedCommonInfoData) {
        try {
          commonInfoData = savedCommonInfoData;
          renderCommonInfo();
          hasRestoredData = true;
        } catch (e) {
          console.error("恢复常用信息数据失败", e);
          showNotification("恢复常用信息数据失败", "error");
        }
      }

      if (hasRestoredData) {
        showNotification("数据已恢复", "info");
      } else {
        showNotification("没有可恢复的数据", "warning");
      }
    }

    // Export data as markdown
    function exportData() {
      let markdown = "# 常用信息\n\n";
      markdown += commonInfoData + "\n\n";

      markdown += "# 公司列表\n\n";
      if (companyData.length > 0) {
        markdown += "| 公司名称 | 信息 | 职位 | 薪资 | 外包 |\n";
        markdown += "| -------- | ---- | ---- | ---- | -------- |\n";

        companyData.forEach(company => {
          const name = company.name || "未填写";
          const info = company.size || "未填写";
          const position = company.position || "未填写";
          const salary = company.salary || "未填写";
          const isOutsourcing = company.isOutsourcing ? "是" : "否";

          markdown += `| ${name} | ${info} | ${position} | ${salary} | ${isOutsourcing} |\n`;
        });
      } else {
        markdown += "暂无公司信息\n";
      }

      markdown += "\n\n# 记录汇总\n\n";
      markdown += document.querySelector("#jobs-record-modal #summaryTextarea").value;

      copyToClipboard(markdown);
      showNotification("已复制到剪贴板", "primary");
    }

    // Copy to clipboard
    function copyToClipboard(text) {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      textarea.style.position = 'fixed';
      textarea.style.opacity = 0;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
    }

    // Open remark modal
    function openRemarkModal(index) {
      currentRemarkIndex = index;
      const modal = document.querySelector("#jobs-record-modal #remarkModal");
      const textarea = document.querySelector("#jobs-record-modal #remarkTextarea");
      if (!modal || !textarea) return;

      textarea.value = companyData[index].remark || "";
      modal.style.display = "flex";
      textarea.focus();
    }

    // Close remark modal
    function closeRemarkModal() {
      const modal = document.querySelector("#jobs-record-modal #remarkModal");
      if (!modal) return;

      modal.style.display = "none";
      currentRemarkIndex = -1;
    }

    // Save remark
    function saveRemarkInfo() {
      if (currentRemarkIndex === -1) return;

      const textarea = document.querySelector("#jobs-record-modal #remarkTextarea");
      if (!textarea) return;

      const value = textarea.value.trim();

      companyData[currentRemarkIndex].remark = value;

      const rows = document.querySelectorAll("#jobs-record-modal #companyTable tbody tr");
      if (rows[currentRemarkIndex]) {
        const btn = rows[currentRemarkIndex].querySelector(".remark-btn");
        if (btn) {
          if (value) {
            btn.classList.add("has-content");
            btn.style.borderColor = 'var(--primary-color)';
            btn.style.backgroundColor = 'var(--primary-color)';
            btn.style.color = 'white';
          } else {
            btn.classList.remove("has-content");
            btn.style.borderColor = 'var(--border-color)';
            btn.style.backgroundColor = '#fff';
            btn.style.color = 'var(--primary-color)';
          }
        }
      }

      updateSummary();
      closeRemarkModal();
      showNotification("记录已保存", "success");
    }

    // Close modal
    function closeModal() {
      const modal = document.getElementById('jobs-record-modal');
      if (modal) {
        document.body.removeChild(modal);
      }
    }

    // Event listeners
    function setupEventListeners() {
      // Close modal button
      const closeBtn = document.querySelector("#jobs-record-modal #closeJobsModal");
      if (closeBtn) {
        closeBtn.addEventListener('click', closeModal);
      }

      // Add company button
      const addBtn = document.querySelector("#jobs-record-modal #addCompanyBtn");
      if (addBtn) {
        addBtn.addEventListener('click', addCompany);
      }

      // Save data button
      const saveBtn = document.querySelector("#jobs-record-modal #saveDataBtn");
      if (saveBtn) {
        saveBtn.addEventListener('click', saveData);
      }

      // Restore data button
      const restoreBtn = document.querySelector("#jobs-record-modal #restoreDataBtn");
      if (restoreBtn) {
        restoreBtn.addEventListener('click', restoreData);
      }

      // Export data button
      const exportBtn = document.querySelector("#jobs-record-modal #exportDataBtn");
      if (exportBtn) {
        exportBtn.addEventListener('click', exportData);
      }

      // Remark modal close buttons
      const closeRemarkBtn = document.querySelector("#jobs-record-modal #closeRemarkModalBtn");
      const cancelRemarkBtn = document.querySelector("#jobs-record-modal #cancelRemarkBtn");
      if (closeRemarkBtn) {
        closeRemarkBtn.addEventListener('click', closeRemarkModal);
      }
      if (cancelRemarkBtn) {
        cancelRemarkBtn.addEventListener('click', closeRemarkModal);
      }

      // Save remark button
      const saveRemarkBtn = document.querySelector("#jobs-record-modal #saveRemarkBtn");
      if (saveRemarkBtn) {
        saveRemarkBtn.addEventListener('click', saveRemarkInfo);
      }

      // Handle click outside of remark modal
      document.addEventListener('click', (event) => {
        const remarkModal = document.querySelector("#jobs-record-modal #remarkModal");
        if (remarkModal && event.target === remarkModal) {
          closeRemarkModal();
        }
      });

      // Handle Escape key
      document.addEventListener('keydown', (event) => {
        if (event.key === 'Escape') {
          const remarkModal = document.querySelector("#jobs-record-modal #remarkModal");
          if (remarkModal && remarkModal.style.display === 'flex') {
            closeRemarkModal();
          } else {
            closeModal();
          }
        }
      });

      // Handle Ctrl+S to save data
      document.addEventListener('keydown', (event) => {
        if ((event.ctrlKey || event.metaKey) && event.key === 's' && document.getElementById('jobs-record-modal')) {
          event.preventDefault();
          saveData();
        }
      });
    }

    // Initialize
    renderCompanyTable();
    renderCommonInfo();
    updateSummary();
    setupEventListeners();

    // Animation styles already included in styleElement

    // 添加备注模态窗口样式
    // All modal styles are now consolidated in styleElement
  }

  // 创建可拖动面板
  function createDraggablePanel() {
    const existingPanel = document.getElementById('auto-apply-panel');
    if (existingPanel) {
      return {
        panel: existingPanel,
        controlBtn: existingPanel.querySelector('.control-btn'),
        statusDiv: existingPanel.querySelector('.status-display')
      };
    }

    // 确保位置已加载
    loadSavedPosition();

    const panel = document.createElement('div');
    panel.id = 'auto-apply-panel';

    // 检查是否在职位列表页面
    const isJobsPage = isJobsListingPage();
    const positionType = isJobsPage ? 'full' : 'simple';

    // 从存储中获取位置 - 根据面板类型
    const position = baseConfig.panelPosition[baseConfig.currentSite][positionType];

    // 确保位置值有效，如果无效则使用默认值
    const validatePosition = (pos) => {
      const defaultPos = { top: '200px', left: `${window.innerWidth - 300}px` };
      if (!pos) return defaultPos;

      // 检查是否包含有效单位
      const hasValidUnits = (pos.top && (pos.top.includes('px') || pos.top.includes('%'))) &&
        (pos.left && (pos.left.includes('px') || pos.left.includes('%')));

      // 如果有right属性但没有left属性，转换为left
      if (pos.right && !pos.left) {
        try {
          // 提取数值和单位
          const match = pos.right.match(/^([\d.]+)(.*)$/);
          if (match) {
            const value = parseFloat(match[1]);
            const unit = match[2]; // 'px' 或 '%'
            if (unit === '%') {
              // 百分比转换
              pos.left = `${100 - value - 10}%`; // 10%是面板占比的粗略估计
            } else if (unit === 'px') {
              // 像素转换
              pos.left = `${window.innerWidth - value - 250}px`; // 250px是面板宽度
            }
            delete pos.right;
          }
        } catch (e) {
          console.error('转换位置出错', e);
        }
      }

      return hasValidUnits ? pos : defaultPos;
    };

    const validPosition = validatePosition(position);

    // 创建面板样式 - 在非职位页面时宽度更小
    const panelStyle = `
    position: fixed;
    top: ${validPosition.top};
    left: ${validPosition.left};
    background: rgba(255, 255, 255, 0.2);
    padding: 8px;
    border-radius: 8px;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    z-index: 999999;
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: ${isJobsPage ? '250px' : '100px'};
    max-height: 80vh;
    overflow-y: auto;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    backdrop-filter: blur(8px);
    border: 1px solid rgba(255, 255, 255, 0.1);
    transition: all 0.3s ease;
    cursor: default;
  `;
    panel.style.cssText = panelStyle;

    // 创建按钮容器
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
    display: flex;
    gap: 8px;
    width: 100%;
    ${!isJobsPage ? 'justify-content: center;' : ''}
  `;

    // 创建记录按钮
    const recordBtn = document.createElement('button');
    recordBtn.className = 'record-btn';
    recordBtn.textContent = '记录';
    recordBtn.style.cssText = `
    padding: 8px 12px;
    background: rgba(39, 174, 96, 0.6);
    color: rgba(255, 255, 255, 0.9);
    border: none;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.3s ease;
    font-size: 13px;
    font-weight: 500;
    box-shadow: 0 2px 8px rgba(39, 174, 96, 0.2);
    flex: ${isJobsPage ? '1' : 'auto'};
    position: relative;
    z-index: 1000000;
  `;

    // 为记录按钮添加悬停效果
    recordBtn.onmouseover = () => {
      recordBtn.style.transform = 'translateY(-1px)';
      recordBtn.style.background = 'rgba(39, 174, 96, 0.8)';
      recordBtn.style.boxShadow = '0 4px 12px rgba(39, 174, 96, 0.3)';
    };

    recordBtn.onmouseout = () => {
      recordBtn.style.transform = 'translateY(0)';
      recordBtn.style.background = 'rgba(39, 174, 96, 0.6)';
      recordBtn.style.boxShadow = '0 2px 8px rgba(39, 174, 96, 0.2)';
    };

    // 点击记录按钮时显示记录弹窗
    recordBtn.onclick = () => {
      showJobsRecordModal();
    };

    // 如果是职位页面，需要显示控制按钮
    let controlBtn;
    if (isJobsPage) {
      // 创建控制按钮
      controlBtn = document.createElement('button');
      controlBtn.className = 'control-btn';
      controlBtn.textContent = '开始处理';
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
      flex: 3;
      position: relative;
      z-index: 1000000;
    `;

      // 初始化按钮状态（未运行）
      utils.updateButtonState(controlBtn, false);

      // 添加到按钮容器
      buttonContainer.appendChild(controlBtn);
    }

    // 添加记录按钮到按钮容器
    buttonContainer.appendChild(recordBtn);

    // 创建状态显示区域（仅在职位页面显示）
    let statusDiv;
    if (isJobsPage) {
      statusDiv = document.createElement('div');
      statusDiv.className = 'status-display';
      statusDiv.style.cssText = `
      margin-top: 5px;
      padding: 8px;
      background: rgba(245, 245, 245, 0.5);
      border-radius: 4px;
      font-size: 12px;
      color: #666;
      transition: all 0.3s ease;
      cursor: move;
      min-height: 20px;
      max-height: 200px;
      overflow-y: auto;
      position: relative;
      user-select: none;
      backdrop-filter: blur(4px);
      border: 1px solid rgba(255, 255, 255, 0.1);
    `;

      // 添加默认提示文本
      const defaultMessage = document.createElement('div');
      defaultMessage.className = 'default-message';
      defaultMessage.style.cssText = `
      left: 50%;
      transform: translate(-50%, 0);
      padding-left: 8px;
      background: rgba(52, 152, 219, 0.1);
      border-radius: 4px;
      font-size: 12px;
      color: #3498db;
      position: relative;
      user-select: none;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-left: 2px solid #3498db;
      `;
      defaultMessage.textContent = `当前页面为 ${baseConfig.currentSite}，点击开始`;
      statusDiv.appendChild(defaultMessage);
    }

    // 为面板添加拖动功能
    setupDragging(panel, isJobsPage ? statusDiv : panel);

    // 组装面板
    document.body.appendChild(panel);

    // 仅在职位页面显示配置
    if (isJobsPage) {
      updateConfigDisplay(panel);
    }

    panel.appendChild(buttonContainer);

    if (isJobsPage) {
      panel.appendChild(statusDiv);
    }

    return { panel, controlBtn, recordBtn, statusDiv };
  }

  // 设置拖动功能
  function setupDragging(panel, dragHandle) {
    if (!dragHandle) return;

    let isDragging = false;
    let startX, startY, startTop, startLeft;

    function dragStart(e) {
      // 检查是状态栏拖动还是整个面板拖动
      const isStatusBar = dragHandle.classList.contains('status-display');

      if ((!isStatusBar && e.target === dragHandle) ||
        (isStatusBar && e.target.closest('.status-display'))) {
        isDragging = true;
        const rect = panel.getBoundingClientRect();
        startX = e.clientX;
        startY = e.clientY;
        startTop = rect.top;
        startLeft = rect.left;
        e.preventDefault();

        document.body.style.cursor = 'move';
        document.addEventListener('mousemove', drag);
        document.addEventListener('mouseup', dragEnd);
      }
    }

    function drag(e) {
      if (!isDragging) return;

      requestAnimationFrame(() => {
        const deltaX = e.clientX - startX;
        const deltaY = e.clientY - startY;

        const newTop = startTop + deltaY;
        const newLeft = startLeft + deltaX;

        const rect = panel.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        const finalTop = Math.max(0, Math.min(viewportHeight - rect.height, newTop));
        const finalLeft = Math.max(0, Math.min(viewportWidth - rect.width, newLeft));

        panel.style.top = `${finalTop}px`;
        panel.style.left = `${finalLeft}px`;
      });
    }

    function dragEnd() {
      if (!isDragging) return;

      isDragging = false;
      document.body.style.cursor = '';
      document.removeEventListener('mousemove', drag);
      document.removeEventListener('mouseup', dragEnd);

      // 使用统一的保存函数
      savePanelPosition(panel);
    }

    dragHandle.addEventListener('mousedown', dragStart);
  }

  // 更新配置显示
  function updateConfigDisplay(panel, isHovered = false) {
    const textOpacity = isHovered ? '1' : '0.8';
    const bgOpacity = isHovered ? '0.2' : '0.05';

    const oldConfig = panel.querySelector('.config-display');
    if (oldConfig) {
      oldConfig.remove();
    }

    const configHtml = `
    <div class="config-display" style="cursor: default;">
      <div style="margin: 4px 0; padding: 6px; background: rgba(67, 97, 238, ${bgOpacity}); border-radius: 4px; font-size: 13px; color: rgba(68, 68, 68, ${textOpacity});">
        包含：<span style="color: rgba(67, 97, 238, ${textOpacity}); font-weight: 500;">${baseConfig.keywords || '无'}</span>
      </div>
      <div style="margin: 4px 0; padding: 6px; background: rgba(231, 76, 60, ${bgOpacity}); border-radius: 4px; font-size: 13px; color: rgba(68, 68, 68, ${textOpacity});">
        排除：<span style="color: rgba(231, 76, 60, ${textOpacity}); font-weight: 500;">${baseConfig.excludeKeywords || '无'}</span>
      </div>
    </div>
  `;

    // 直接添加到面板开头
    panel.insertAdjacentHTML('afterbegin', configHtml);
  }

  // 更新状态显示
  function updateStatus(message, type = 'info') {
    const statusDiv = document.querySelector('.status-display');
    if (!statusDiv) return;

    // 移除默认提示
    const defaultMessage = statusDiv.querySelector('.default-message');
    if (defaultMessage) {
      defaultMessage.remove();
    }

    // 使用通用通知函数获取样式
    const notification = utils.createNotification(message, type);
    const colors = notification.colors;

    const newMessage = document.createElement('div');
    newMessage.style.cssText = `
    margin-bottom: 4px;
    color: ${colors.text};
    padding: 6px;
    border-radius: 4px;
    background: ${colors.bg};
    word-break: break-word;
    overflow-wrap: break-word;
    border-left: 2px solid ${colors.text};
  `;

    newMessage.textContent = message;

    statusDiv.insertBefore(newMessage, statusDiv.firstChild);

    // 最多显示5条消息
    while (statusDiv.children.length > 5) {
      statusDiv.removeChild(statusDiv.lastChild);
    }

    // 如果是错误消息，添加抖动效果
    if (type === 'error') {
      statusDiv.style.animation = 'shake 0.5s';
      setTimeout(() => {
        statusDiv.style.animation = '';
      }, 500);
    }
  }

  // 添加抖动动画的样式
  const styleSheet = document.createElement('style');
  styleSheet.textContent = `
  @keyframes shake {
    0%, 100% { transform: translateX(0); }
    25% { transform: translateX(-5px); }
    75% { transform: translateX(5px); }
  }
`;
  document.head.appendChild(styleSheet);

  // 检查职位关键词
  function checkJobKeywords(jobElement) {
    if (!jobElement) return false;

    const jobText = jobElement.textContent.toLowerCase();
    const keywords = baseConfig.keywords.toLowerCase().split(' ').filter(k => k);
    const excludeKeywords = baseConfig.excludeKeywords.toLowerCase().split(' ').filter(k => k);

    if (keywords.length > 0) {
      const hasKeyword = keywords.some(keyword => jobText.includes(keyword));
      if (!hasKeyword) return false;
    }

    if (excludeKeywords.length > 0) {
      if (excludeKeywords.some(keyword => jobText.includes(keyword))) {
        return false;
      }
    }

    return true;
  }

  // 初始化
  function init() {
    const { controlBtn, recordBtn } = createDraggablePanel();

    // 只有在职位列表页面才设置处理器和控制按钮逻辑
    if (isJobsListingPage()) {
      const processor = baseConfig.currentSite === SITE_TYPE.BOSS ?
        new BossProcessor() :
        new LaGouProcessor();

      controlBtn.onclick = () => {
        if (processor.isRunning) {
          processor.requestStop(controlBtn);
        } else {
          processor.start(controlBtn);
        }
      };
    }
  }

  // 启动脚本
  init();
})();
