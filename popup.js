// DOM 元素
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const reuploadBtn = document.getElementById('reuploadBtn');
const uploadSection = document.getElementById('uploadSection');
const reuploadSection = document.getElementById('reuploadSection');
const tagsSection = document.getElementById('tagsSection');
const tagsContainer = document.getElementById('tagsContainer');
const fileStatus = document.getElementById('fileStatus');
const message = document.getElementById('message');
const pinWindowBtn = document.getElementById('pinWindowBtn');
const floatWindowBtn = document.getElementById('floatWindowBtn');
const addSectionBtn = document.getElementById('addSectionBtn');
const exportMarkdownBtn = document.getElementById('exportMarkdownBtn');
const quickFillBtn = document.getElementById('quickFillBtn');

// 简历编辑对话框元素
const resumeEditDialog = document.getElementById('resumeEditDialog');
const resumeEditDialogTitle = document.getElementById('resumeEditDialogTitle');
const resumeLabelInput = document.getElementById('resumeLabelInput');
const resumeValueInput = document.getElementById('resumeValueInput');
const resumeEditDialogCancel = document.getElementById('resumeEditDialogCancel');
const resumeEditDialogConfirm = document.getElementById('resumeEditDialogConfirm');

// 添加模块对话框元素
const addSectionDialog = document.getElementById('addSectionDialog');
const sectionNameInput = document.getElementById('sectionNameInput');
const groupTitleInput = document.getElementById('groupTitleInput');
const addSectionDialogCancel = document.getElementById('addSectionDialogCancel');
const addSectionDialogConfirm = document.getElementById('addSectionDialogConfirm');

const tabBtns = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

const addApplicationBtn = document.getElementById('addApplicationBtn');
const applicationsContainer = document.getElementById('applicationsContainer');
const appTabBtns = document.querySelectorAll('.app-tab-btn');
const applicationDialog = document.getElementById('applicationDialog');
const applicationDialogTitle = document.getElementById('applicationDialogTitle');
const appTitleInput = document.getElementById('appTitleInput');
const appDateInput = document.getElementById('appDateInput');
const appLinkInput = document.getElementById('appLinkInput');
const appNotesInput = document.getElementById('appNotesInput');
const appStatusSelect = document.getElementById('appStatusSelect');
const appDialogCancel = document.getElementById('appDialogCancel');
const appDialogConfirm = document.getElementById('appDialogConfirm');

// 状态
let resumeSections = [];
let applications = { pending: [], submitted: [] };
let currentApplicationStatus = 'pending';
let editingApplicationId = null;
let isFixedWindow = false;
let isFloatWindow = false;
let selectedText = ''; // 当前选中的文本

// 编辑状态
let editingResumeEntry = null; // { sectionIndex, groupIndex, entryIndex } 或 { sectionIndex, groupIndex: -1 } 表示添加新条目
let editingSection = null; // { sectionIndex } 表示编辑模块

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  // 检查是否是固定窗口或悬浮窗
  const urlParams = new URLSearchParams(window.location.search);
  isFixedWindow = urlParams.get('fixed') === 'true';
  isFloatWindow = urlParams.get('float') === 'true';
  
  // 如果是固定窗口或悬浮窗，添加标识
  if (isFixedWindow || isFloatWindow) {
    document.documentElement.setAttribute('data-fixed', 'true');
    document.body.setAttribute('data-fixed', 'true');
    // 设置固定窗口的标题
    document.title = isFloatWindow ? '简历填写助手 - 悬浮窗' : '简历填写助手 - 固定窗口';
  }
  
  initResize();
  initTabs();
  initApplications();
  initPinWindow();
  initFloatWindow();
  initResumeEdit();
  initQuickFill();
  loadStoredData();

  uploadBtn.addEventListener('click', () => fileInput.click());
  reuploadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', handleFileUpload);
});

// 窗口大小调整
function initResize() {
  const resizeHandle = document.querySelector('.resize-handle');
  const body = document.body;
  let isResizing = false;
  let startX = 0;
  let startY = 0;
  let startWidth = 0;
  let startHeight = 0;

  resizeHandle.addEventListener('mousedown', (e) => {
    isResizing = true;
    startX = e.clientX;
    startY = e.clientY;
    const styles = window.getComputedStyle(body);
    startWidth = parseInt(styles.width, 10);
    startHeight = parseInt(styles.height, 10);
    e.preventDefault();
  });

  document.addEventListener('mousemove', (e) => {
    if (!isResizing) return;

    const newWidth = startWidth + (e.clientX - startX);
    const newHeight = startHeight + (e.clientY - startY);

    if (newWidth >= 380 && newWidth <= 820) {
      body.style.width = `${newWidth}px`;
    }
    if (newHeight >= 420 && newHeight <= 820) {
      body.style.height = `${newHeight}px`;
    }
  });

  document.addEventListener('mouseup', () => {
    if (!isResizing) return;
    isResizing = false;

    chrome.storage.local.set({
      windowSize: {
        width: parseInt(body.style.width, 10) || 460,
        height: parseInt(body.style.height, 10) || 520
      }
    });
  });

  chrome.storage.local.get(['windowSize'], (result) => {
    if (result.windowSize) {
      const { width, height } = result.windowSize;
      if (width && height) {
        body.style.width = `${width}px`;
        body.style.height = `${height}px`;
      }
    }
  });
}

// 标签页
function initTabs() {
  tabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      const tabName = btn.dataset.tab;
      tabBtns.forEach((b) => b.classList.remove('active'));
      tabContents.forEach((content) => content.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(`${tabName}Tab`).classList.add('active');
    });
  });
}

// 投递记录初始化
function initApplications() {
  addApplicationBtn.addEventListener('click', () => {
    openApplicationDialog('add');
  });

  appDialogCancel.addEventListener('click', () => {
    closeApplicationDialog();
  });

  appDialogConfirm.addEventListener('click', () => {
    saveApplication();
  });

  appTabBtns.forEach((btn) => {
    btn.addEventListener('click', () => {
      switchApplicationTab(btn.dataset.status);
    });
  });

  applicationDialog.addEventListener('click', (e) => {
    if (e.target === applicationDialog) {
      closeApplicationDialog();
    }
  });
}

// 数据加载
function loadStoredData() {
  chrome.storage.local.get(['resumeSections', 'resumeData', 'fileName', 'applications', 'windowSize'], (result) => {
    resumeSections = Array.isArray(result.resumeSections) ? result.resumeSections : [];

    if (!resumeSections.length && result.resumeData && typeof result.resumeData === 'object') {
      resumeSections = convertFlatDataToSections(result.resumeData);
      chrome.storage.local.set({ resumeSections });
    }

    if (resumeSections.length) {
      displaySections(resumeSections);
      uploadSection.style.display = 'none';
      reuploadSection.style.display = 'block';
      tagsSection.style.display = 'block';
      fileStatus.textContent = result.fileName ? `已加载: ${result.fileName}` : '已加载: 历史数据';
    } else {
      tagsContainer.innerHTML = '<p class="empty-hint">暂无内容，请先上传 Markdown 文件</p>';
      uploadSection.style.display = 'block';
      reuploadSection.style.display = 'none';
      tagsSection.style.display = 'none';
      fileStatus.textContent = '';
    }

    if (result.applications) {
      applications = {
        pending: result.applications.pending || [],
        submitted: result.applications.submitted || []
      };
    }

    switchApplicationTab(currentApplicationStatus);

    if (result.windowSize) {
      const { width, height } = result.windowSize;
      if (width && height) {
        document.body.style.width = `${width}px`;
        document.body.style.height = `${height}px`;
      }
    }
  });
}

// 文件上传
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.name.endsWith('.md') && !file.name.endsWith('.markdown')) {
    showMessage('请上传Markdown文件（.md或.markdown）', true);
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target.result;
    const parsedSections = parseMarkdown(content);

    if (!parsedSections.length) {
      showMessage('未找到有效内容，请检查Markdown格式', true);
      return;
    }

    resumeSections = parsedSections;

    chrome.storage.local.set({
      resumeSections: parsedSections,
      fileName: file.name
    }, () => {
      displaySections(parsedSections);
      uploadSection.style.display = 'none';
      reuploadSection.style.display = 'block';
      tagsSection.style.display = 'block';
      fileStatus.textContent = `已加载: ${file.name}`;
      showMessage('文件上传成功！');
    });
  };

  reader.readAsText(file, 'UTF-8');
}

// Markdown 解析（返回分块结构）
function parseMarkdown(content) {
  const sections = [];
  const sectionMap = new Map();

  let currentSectionName = null;
  let currentGroupTitle = null;
  let buffer = [];

  const lines = content.split('\n');

  const finalize = () => {
    if (!currentSectionName) {
      buffer = [];
      return;
    }

    const rawText = buffer.join('\n').trim();
    buffer = [];
    if (!rawText) return;

    const entries = parseContentLines(rawText);
    addGroupToSections(sections, sectionMap, currentSectionName, currentGroupTitle, entries);
  };

  lines.forEach((rawLine) => {
    const trimmed = rawLine.trim();
    const tagMatch = trimmed.match(/^\[(.+)\]$/);

    if (tagMatch) {
      finalize();
      const { sectionName, groupTitle } = splitTagName(tagMatch[1].trim());
      currentSectionName = sectionName;
      currentGroupTitle = groupTitle;
    } else {
      buffer.push(rawLine);
    }
  });

  finalize();

  return sections;
}

// 拆分标签名 -> 模块 / 子项
function splitTagName(tag) {
  const colonIndex = tag.indexOf(':');
  const dashIndex = tag.indexOf('-');

  let index = -1;
  if (colonIndex !== -1 && (dashIndex === -1 || colonIndex < dashIndex)) {
    index = colonIndex;
  } else if (dashIndex !== -1) {
    index = dashIndex;
  }

  if (index === -1) {
    return {
      sectionName: tag || '未分类',
      groupTitle: null
    };
  }

  return {
    sectionName: tag.slice(0, index).trim() || '未分类',
    groupTitle: tag.slice(index + 1).trim() || null
  };
}

// 将内容行解析为条目
function parseContentLines(text) {
  const lines = text.split('\n');
  const entries = [];
  let currentEntry = null;

  lines.forEach((rawLine) => {
    let line = rawLine.trim();
    if (!line) return;

    // 移除常见的列表前缀
    if (/^[-*•]\s+/.test(line)) {
      line = line.replace(/^[-*•]\s+/, '').trim();
    } else if (/^\d+\.\s+/.test(line)) {
      line = line.replace(/^\d+\.\s+/, '').trim();
    }

    const kvMatch = line.match(/^([^：:]+)[：:]\s*(.*)$/);
    if (kvMatch) {
      const key = kvMatch[1].trim();
      const valuePart = kvMatch[2].trim();

      const entry = {
        label: key || null,
        value: valuePart || ''
      };

      entries.push(entry);
      currentEntry = entry;
    } else if (currentEntry && typeof currentEntry.value === 'string') {
      currentEntry.value = currentEntry.value
        ? `${currentEntry.value}\n${line}`
        : line;
    } else {
      const entry = {
        label: null,
        value: line
      };
      entries.push(entry);
      currentEntry = entry;
    }
  });

  const cleaned = entries
    .map((entry) => ({
      label: entry.label ? entry.label.trim() : null,
      value: entry.value ? entry.value.trim() : ''
    }))
    .filter((entry) => entry.label || entry.value);

  if (cleaned.length === 0) {
    const fallback = text.trim();
    return fallback ? [{ label: null, value: fallback }] : [];
  }

  return cleaned;
}

// 将组添加到分块结构
function addGroupToSections(sections, sectionMap, sectionName, groupTitle, entries) {
  if (!entries || !entries.length) return;
  const normalizedSection = sectionName || '未分类';

  if (!sectionMap.has(normalizedSection)) {
    sectionMap.set(normalizedSection, { name: normalizedSection, groups: [] });
    sections.push(sectionMap.get(normalizedSection));
  }

  sectionMap.get(normalizedSection).groups.push({
    title: groupTitle || null,
    entries
  });
}

// 兼容旧版平铺数据
function convertFlatDataToSections(rawData) {
  const sections = [];
  const sectionMap = new Map();

  Object.entries(rawData).forEach(([tag, value]) => {
    if (typeof value !== 'string') return;
    const { sectionName, groupTitle } = splitTagName(tag);
    const entries = parseContentLines(value);
    addGroupToSections(sections, sectionMap, sectionName, groupTitle, entries);
  });

  return sections;
}

// 渲染分块内容
function displaySections(sections) {
  tagsContainer.innerHTML = '';

  if (!sections.length) {
    tagsContainer.innerHTML = '<p class="empty-hint">暂无内容</p>';
    return;
  }

  sections.forEach((section, sectionIndex) => {
    const sectionCard = document.createElement('div');
    sectionCard.className = 'section-card';

    const header = document.createElement('div');
    header.className = 'section-header';

    const titleContainer = document.createElement('div');
    titleContainer.className = 'section-title-container';
    
    const title = document.createElement('h3');
    title.textContent = section.name;
    titleContainer.appendChild(title);
    
    // 添加模块操作按钮
    const sectionActions = document.createElement('div');
    sectionActions.className = 'section-actions';
    
    const addEntryBtn = document.createElement('button');
    addEntryBtn.className = 'action-btn add-btn-small';
    addEntryBtn.textContent = '+';
    addEntryBtn.title = '添加条目';
    addEntryBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      openResumeEditDialog('add', sectionIndex, -1);
    });
    
    const deleteSectionBtn = document.createElement('button');
    deleteSectionBtn.className = 'action-btn delete-btn-small';
    deleteSectionBtn.textContent = '❌';
    deleteSectionBtn.title = '删除模块';
    deleteSectionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (confirm(`确定要删除模块"${section.name}"吗？`)) {
        deleteSection(sectionIndex);
      }
    });
    
    sectionActions.appendChild(addEntryBtn);
    sectionActions.appendChild(deleteSectionBtn);
    titleContainer.appendChild(sectionActions);
    header.appendChild(titleContainer);
    sectionCard.appendChild(header);

    section.groups.forEach((group, groupIndex) => {
      const groupEl = document.createElement('div');
      groupEl.className = 'section-group';

      if (group.title) {
        const groupTitleContainer = document.createElement('div');
        groupTitleContainer.className = 'group-title-container';
        
        const groupTitle = document.createElement('div');
        groupTitle.className = 'group-title';
        groupTitle.textContent = group.title;
        groupTitleContainer.appendChild(groupTitle);
        
        // 添加子项操作按钮
        const groupAddBtn = document.createElement('button');
        groupAddBtn.className = 'action-btn add-btn-small';
        groupAddBtn.textContent = '+';
        groupAddBtn.title = '添加条目';
        groupAddBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openResumeEditDialog('add', sectionIndex, groupIndex);
        });
        groupTitleContainer.appendChild(groupAddBtn);
        
        groupEl.appendChild(groupTitleContainer);
      }

      (group.entries || []).forEach((entry, idx) => {
        if (!entry || (!entry.label && !entry.value)) return;

        const itemEl = document.createElement('div');
        itemEl.className = 'section-item';

        const itemContainer = document.createElement('div');
        itemContainer.className = 'item-container';

        const btn = document.createElement('button');
        btn.className = 'copy-btn full';
        const btnText = entry.label || (group.title || section.name) + (entry.value ? '' : '');
        btn.textContent = btnText;
        
        const textToCopy = entry.value || entry.label || '';
        const copyLabel = entry.label || group.title || section.name;
        
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!textToCopy) return;
          copyToClipboard(textToCopy, copyLabel);
        });

        // 添加填写表单按钮
        const fillBtn = document.createElement('button');
        fillBtn.className = 'fill-btn';
        fillBtn.textContent = '填写';
        fillBtn.title = '填写到当前页面表单';
        fillBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (!textToCopy) return;
          fillFormToActiveTab(textToCopy, copyLabel);
        });
        
        // 添加编辑和删除按钮
        const editBtn = document.createElement('button');
        editBtn.className = 'action-btn edit-btn';
        editBtn.textContent = '✏️';
        editBtn.title = '编辑';
        editBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          openResumeEditDialog('edit', sectionIndex, groupIndex, idx);
        });
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'action-btn delete-btn';
        deleteBtn.textContent = '❌';
        deleteBtn.title = '删除';
        deleteBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`确定要删除"${copyLabel}"吗？`)) {
            deleteResumeEntry(sectionIndex, groupIndex, idx);
          }
        });
        
        itemContainer.appendChild(btn);
        itemContainer.appendChild(fillBtn);
        itemContainer.appendChild(editBtn);
        itemContainer.appendChild(deleteBtn);

        itemEl.appendChild(itemContainer);
        groupEl.appendChild(itemEl);
      });

      if (!group.entries || !group.entries.length) {
        const emptyEl = document.createElement('div');
        emptyEl.className = 'section-item empty';
        emptyEl.textContent = '暂无内容';
        groupEl.appendChild(emptyEl);
      }

      sectionCard.appendChild(groupEl);
    });

    tagsContainer.appendChild(sectionCard);
  });
}

// 初始化固定窗口功能
function initPinWindow() {
  if (pinWindowBtn) {
    pinWindowBtn.addEventListener('click', () => {
      if (isFixedWindow && !isFloatWindow) {
        // 如果是固定窗口（标签页），则关闭标签页
        chrome.runtime.sendMessage({ action: 'closeFixedWindow' }, (response) => {
          if (response && response.success) {
            // 关闭当前标签页
            if (chrome.tabs && chrome.tabs.getCurrent) {
              chrome.tabs.getCurrent((tab) => {
                if (tab && tab.id) {
                  chrome.tabs.remove(tab.id);
                } else {
                  window.close();
                }
              });
            } else {
              window.close();
            }
          }
        });
      } else {
        // 打开固定窗口（在新标签页中）
        chrome.runtime.sendMessage({ action: 'openFixedWindow' }, (response) => {
          if (response && response.success) {
            showMessage('已在新标签页中打开固定窗口');
            setTimeout(() => {
              window.close();
            }, 500);
          } else {
            showMessage('打开固定窗口失败', true);
          }
        });
      }
    });
    
    // 更新按钮文本
    if (isFixedWindow && !isFloatWindow) {
      pinWindowBtn.textContent = '✕';
      pinWindowBtn.title = '关闭标签页';
    }
  }
}

// 初始化悬浮窗功能
function initFloatWindow() {
  if (floatWindowBtn) {
    floatWindowBtn.addEventListener('click', () => {
      if (isFloatWindow) {
        // 如果是悬浮窗，则关闭
        chrome.runtime.sendMessage({ action: 'closeFloatWindow' }, (response) => {
          if (response && response.success) {
            window.close();
          } else {
            showMessage('关闭悬浮窗失败', true);
          }
        });
      } else {
        // 打开悬浮窗
        chrome.runtime.sendMessage({ action: 'openFloatWindow' }, (response) => {
          // 检查是否有运行时错误
          if (chrome.runtime.lastError) {
            console.error('打开悬浮窗错误:', chrome.runtime.lastError);
            showMessage('打开悬浮窗失败: ' + chrome.runtime.lastError.message, true);
            return;
          }
          
          // 检查响应
          if (response) {
            if (response.success) {
              showMessage('已打开悬浮窗');
              if (!isFixedWindow) {
                setTimeout(() => {
                  window.close();
                }, 500);
              }
            } else {
              showMessage('打开悬浮窗失败: ' + (response.error || '未知错误'), true);
            }
          } else {
            // 如果没有响应，可能是service worker已关闭
            showMessage('打开悬浮窗失败: 服务未响应，请重试', true);
          }
        });
      }
    });
    
    // 更新按钮文本
    if (isFloatWindow) {
      floatWindowBtn.textContent = '✕';
      floatWindowBtn.title = '关闭悬浮窗';
    }
  }
}

// 复制到剪贴板
function copyToClipboard(text, tagName) {
  selectedText = text;
  navigator.clipboard.writeText(text).then(() => {
    showMessage(`已复制 "${tagName}" 到剪切板`);
  }).catch((err) => {
    console.error('复制失败:', err);
    showMessage('复制失败，请重试', true);
  });
}

// 填写表单到当前活动标签页
function fillFormToActiveTab(text, tagName) {
  // 如果是固定窗口模式，查找所有窗口中的活动标签页
  // 如果是popup模式，查找当前窗口的活动标签页
  chrome.tabs.query({ active: true }, (tabs) => {
    if (tabs.length === 0) {
      navigator.clipboard.writeText(text).then(() => {
        showMessage(`已复制 "${tagName}" 到剪切板`);
      });
      return;
    }
    
    // 找到第一个非扩展页面的标签页
    let targetTab = null;
    for (const tab of tabs) {
      if (tab.url && 
          !tab.url.startsWith('chrome://') && 
          !tab.url.startsWith('chrome-extension://') &&
          !tab.url.startsWith('edge://') &&
          !tab.url.startsWith('about:')) {
        targetTab = tab;
        break;
      }
    }
    
    if (!targetTab) {
      // 如果没有找到合适的标签页，复制到剪贴板
      navigator.clipboard.writeText(text).then(() => {
        showMessage(`已复制 "${tagName}" 到剪切板（当前页面不支持填写）`);
      }).catch((err) => {
        console.error('复制失败:', err);
        showMessage('复制失败，请重试', true);
      });
      return;
    }
    
    // 发送消息到目标标签页
    chrome.tabs.sendMessage(targetTab.id, {
      action: 'fillForm',
      text: text,
      fieldType: 'auto'
    }, (response) => {
      if (chrome.runtime.lastError) {
        // 如果content script未加载，尝试重新注入
        console.warn('Content script未加载，尝试重新注入:', chrome.runtime.lastError);
        // 复制到剪贴板作为备选方案
        navigator.clipboard.writeText(text).then(() => {
          showMessage(`已复制 "${tagName}" 到剪切板（请刷新页面后使用填写功能）`);
        }).catch((err) => {
          console.error('复制失败:', err);
          showMessage('操作失败，请重试', true);
        });
      } else if (response && response.success) {
        showMessage(`已填写 "${tagName}" 到页面`);
      } else {
        // 填写失败，改为复制
        navigator.clipboard.writeText(text).then(() => {
          showMessage(response?.message || `已复制 "${tagName}" 到剪切板`);
        }).catch((err) => {
          console.error('复制失败:', err);
          showMessage('操作失败，请重试', true);
        });
      }
    });
  });
}

// 显示消息
function showMessage(msg, isError = false) {
  message.textContent = msg;
  message.className = 'message' + (isError ? ' error' : '') + ' show';
  setTimeout(() => {
    message.className = 'message' + (isError ? ' error' : '');
  }, 2000);
}

// 投递记录逻辑
function switchApplicationTab(status) {
  currentApplicationStatus = status;
  appTabBtns.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.status === status);
  });
  displayApplications();
}

function displayApplications() {
  applicationsContainer.innerHTML = '';
  const list = applications[currentApplicationStatus] || [];

  if (list.length === 0) {
    applicationsContainer.innerHTML = '<p style="color:#999;text-align:center;padding:20px;">暂无记录，点击 + 添加记录</p>';
    return;
  }

  list.forEach((app) => {
    const item = document.createElement('div');
    item.className = `application-item ${app.status}`;

    const header = document.createElement('div');
    header.className = 'application-header';

    const titleEl = document.createElement('div');
    titleEl.className = 'application-title';
    titleEl.textContent = app.title;

    const actions = document.createElement('div');
    actions.className = 'application-actions';

    const toggleBtn = document.createElement('button');
    toggleBtn.className = 'app-action-btn';
    toggleBtn.title = '切换状态';
    toggleBtn.textContent = app.status === 'pending' ? '✓' : '↩';
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleApplicationStatus(app.id);
    });

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'app-action-btn';
    deleteBtn.title = '删除';
    deleteBtn.textContent = '🗑️';
    deleteBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      deleteApplication(app.id);
    });

    actions.appendChild(toggleBtn);
    actions.appendChild(deleteBtn);

    header.appendChild(titleEl);
    header.appendChild(actions);
    item.appendChild(header);

    if (app.date) {
      const dateEl = document.createElement('div');
      dateEl.className = 'application-date';
      dateEl.textContent = `📅 ${app.date}`;
      item.appendChild(dateEl);
    }

    if (app.link) {
      const linkEl = document.createElement('a');
      linkEl.className = 'application-link';
      linkEl.href = app.link;
      linkEl.target = '_blank';
      linkEl.rel = 'noopener noreferrer';
      linkEl.textContent = `🔗 ${app.link}`;
      linkEl.addEventListener('click', (e) => e.stopPropagation());
      item.appendChild(linkEl);
    }

    if (app.notes) {
      const notesEl = document.createElement('div');
      notesEl.className = 'application-notes';
      notesEl.textContent = app.notes;
      item.appendChild(notesEl);
    }

    item.addEventListener('click', () => {
      openApplicationDialog('edit', app.id);
    });

    applicationsContainer.appendChild(item);
  });
}

function openApplicationDialog(mode, id = null) {
  if (mode === 'edit') {
    const found = findApplicationById(id);
    if (!found) {
      showMessage('记录不存在或已被删除', true);
      return;
    }
    const { application } = found;
    editingApplicationId = id;
    applicationDialogTitle.textContent = '编辑投递记录';
    appDialogConfirm.textContent = '保存';
    appTitleInput.value = application.title || '';
    appDateInput.value = application.date || '';
    appLinkInput.value = application.link || '';
    appNotesInput.value = application.notes || '';
    appStatusSelect.value = application.status || 'pending';
  } else {
    editingApplicationId = null;
    applicationDialogTitle.textContent = '添加投递记录';
    appDialogConfirm.textContent = '确定';
    appTitleInput.value = '';
    appDateInput.value = new Date().toISOString().split('T')[0];
    appLinkInput.value = '';
    appNotesInput.value = '';
    appStatusSelect.value = currentApplicationStatus;
  }

  applicationDialog.style.display = 'flex';
  setTimeout(() => appTitleInput.focus(), 0);
}

function closeApplicationDialog() {
  applicationDialog.style.display = 'none';
  editingApplicationId = null;
}

function saveApplication() {
  const title = appTitleInput.value.trim();
  const date = appDateInput.value;
  const link = appLinkInput.value.trim();
  const notes = appNotesInput.value.trim();
  const status = appStatusSelect.value;

  if (!title) {
    showMessage('请输入公司/职位名称', true);
    return;
  }

  const resolvedDate = date || new Date().toISOString().split('T')[0];

  if (editingApplicationId) {
    const found = findApplicationById(editingApplicationId);
    if (!found) {
      showMessage('记录不存在或已被删除', true);
      closeApplicationDialog();
      return;
    }

    const { status: oldStatus, index } = found;
    const updated = {
      ...applications[oldStatus][index],
      title,
      date: resolvedDate,
      link,
      notes,
      status
    };

    if (oldStatus === status) {
      applications[oldStatus][index] = updated;
    } else {
      applications[oldStatus].splice(index, 1);
      applications[status].push(updated);
    }

    showMessage('记录已更新！');
  } else {
    const application = {
      id: Date.now(),
      title,
      date: resolvedDate,
      link,
      notes,
      status
    };

    if (!applications[status]) {
      applications[status] = [];
    }

    applications[status].push(application);
    showMessage('记录添加成功！');
  }

  saveApplications();
  closeApplicationDialog();
  switchApplicationTab(status);
}

function toggleApplicationStatus(id) {
  const found = findApplicationById(id);
  if (!found) return;

  const { status, index, application } = found;
  const newStatus = status === 'pending' ? 'submitted' : 'pending';

  applications[status].splice(index, 1);
  applications[newStatus].push({ ...application, status: newStatus });

  saveApplications();
  displayApplications();
  showMessage(`已${newStatus === 'submitted' ? '标记为已投递' : '标记为待投递'}`);
}

function deleteApplication(id) {
  if (!confirm('确定要删除这条记录吗？')) return;

  applications.pending = applications.pending.filter((app) => app.id !== id);
  applications.submitted = applications.submitted.filter((app) => app.id !== id);

  saveApplications();
  displayApplications();
  showMessage('记录已删除');
}

function findApplicationById(id) {
  for (const status of ['pending', 'submitted']) {
    const list = applications[status] || [];
    const index = list.findIndex((app) => app.id === id);
    if (index !== -1) {
      return { status, index, application: list[index] };
    }
  }
  return null;
}

function saveApplications() {
  chrome.storage.local.set({ applications });
}

// 初始化简历编辑功能
function initResumeEdit() {
  // 添加模块按钮
  if (addSectionBtn) {
    addSectionBtn.addEventListener('click', () => {
      sectionNameInput.value = '';
      groupTitleInput.value = '';
      addSectionDialog.style.display = 'flex';
      setTimeout(() => sectionNameInput.focus(), 0);
    });
  }
  
  // 导出Markdown按钮
  if (exportMarkdownBtn) {
    exportMarkdownBtn.addEventListener('click', () => {
      exportToMarkdown();
    });
  }
  
  // 添加模块对话框
  if (addSectionDialogCancel) {
    addSectionDialogCancel.addEventListener('click', () => {
      addSectionDialog.style.display = 'none';
    });
  }
  
  if (addSectionDialogConfirm) {
    addSectionDialogConfirm.addEventListener('click', () => {
      const sectionName = sectionNameInput.value.trim();
      const groupTitle = groupTitleInput.value.trim();
      
      if (!sectionName) {
        showMessage('请输入模块名称', true);
        return;
      }
      
      // 添加新模块
      const newSection = {
        name: sectionName,
        groups: groupTitle ? [{
          title: groupTitle,
          entries: []
        }] : [{
          title: null,
          entries: []
        }]
      };
      
      resumeSections.push(newSection);
      saveResumeSections();
      displaySections(resumeSections);
      addSectionDialog.style.display = 'none';
      showMessage('模块添加成功');
    });
  }
  
  // 简历编辑对话框
  if (resumeEditDialogCancel) {
    resumeEditDialogCancel.addEventListener('click', () => {
      closeResumeEditDialog();
    });
  }
  
  if (resumeEditDialogConfirm) {
    resumeEditDialogConfirm.addEventListener('click', () => {
      saveResumeEntry();
    });
  }
  
  // 点击对话框外部关闭
  if (resumeEditDialog) {
    resumeEditDialog.addEventListener('click', (e) => {
      if (e.target === resumeEditDialog) {
        closeResumeEditDialog();
      }
    });
  }
  
  if (addSectionDialog) {
    addSectionDialog.addEventListener('click', (e) => {
      if (e.target === addSectionDialog) {
        addSectionDialog.style.display = 'none';
      }
    });
  }
}

// 打开简历编辑对话框
function openResumeEditDialog(mode, sectionIndex, groupIndex, entryIndex = null) {
  editingResumeEntry = { sectionIndex, groupIndex, entryIndex };
  
  if (mode === 'edit' && entryIndex !== null) {
    // 编辑模式
    const section = resumeSections[sectionIndex];
    const group = section.groups[groupIndex];
    const entry = group.entries[entryIndex];
    
    resumeEditDialogTitle.textContent = '编辑简历内容';
    resumeLabelInput.value = entry.label || '';
    resumeValueInput.value = entry.value || '';
  } else {
    // 添加模式
    resumeEditDialogTitle.textContent = '添加简历内容';
    resumeLabelInput.value = '';
    resumeValueInput.value = '';
  }
  
  resumeEditDialog.style.display = 'flex';
  setTimeout(() => resumeLabelInput.focus(), 0);
}

// 关闭简历编辑对话框
function closeResumeEditDialog() {
  resumeEditDialog.style.display = 'none';
  editingResumeEntry = null;
}

// 保存简历条目
function saveResumeEntry() {
  if (!editingResumeEntry) return;
  
  const { sectionIndex, groupIndex, entryIndex } = editingResumeEntry;
  const label = resumeLabelInput.value.trim();
  const value = resumeValueInput.value.trim();
  
  if (!label && !value) {
    showMessage('请输入标签或内容', true);
    return;
  }
  
  const section = resumeSections[sectionIndex];
  
  // 确定要操作的group
  let targetGroup;
  if (groupIndex === -1) {
    // 如果没有group，创建一个
    if (!section.groups || section.groups.length === 0) {
      section.groups = [{ title: null, entries: [] }];
    }
    targetGroup = section.groups[0];
  } else {
    targetGroup = section.groups[groupIndex];
  }
  
  if (!targetGroup.entries) {
    targetGroup.entries = [];
  }
  
  const newEntry = {
    label: label || null,
    value: value || ''
  };
  
  if (entryIndex !== null) {
    // 编辑模式
    targetGroup.entries[entryIndex] = newEntry;
    showMessage('内容已更新');
  } else {
    // 添加模式
    targetGroup.entries.push(newEntry);
    showMessage('内容已添加');
  }
  
  saveResumeSections();
  displaySections(resumeSections);
  closeResumeEditDialog();
}

// 删除简历条目
function deleteResumeEntry(sectionIndex, groupIndex, entryIndex) {
  const section = resumeSections[sectionIndex];
  const group = section.groups[groupIndex];
  group.entries.splice(entryIndex, 1);
  
  // 如果group没有条目了，可以选择删除group（可选）
  if (group.entries.length === 0 && !group.title) {
    section.groups.splice(groupIndex, 1);
  }
  
  saveResumeSections();
  displaySections(resumeSections);
  showMessage('内容已删除');
}

// 删除模块
function deleteSection(sectionIndex) {
  resumeSections.splice(sectionIndex, 1);
  saveResumeSections();
  displaySections(resumeSections);
  showMessage('模块已删除');
}

// 保存简历数据
function saveResumeSections() {
  chrome.storage.local.set({ resumeSections }, () => {
    // 同时更新markdown格式的数据（用于导出）
    const markdownContent = convertSectionsToMarkdown(resumeSections);
    chrome.storage.local.set({ resumeMarkdown: markdownContent });
  });
}

// 将sections转换为Markdown格式
function convertSectionsToMarkdown(sections) {
  let markdown = '';
  
  sections.forEach((section) => {
    section.groups.forEach((group) => {
      // 构建标签
      let tag = `[${section.name}`;
      if (group.title) {
        tag += `-${group.title}`;
      }
      tag += ']';
      markdown += tag + '\n';
      
      // 添加条目
      if (group.entries && group.entries.length > 0) {
        group.entries.forEach((entry) => {
          if (entry.label && entry.value) {
            markdown += `${entry.label}：${entry.value}\n`;
          } else if (entry.label) {
            markdown += `${entry.label}\n`;
          } else if (entry.value) {
            markdown += `${entry.value}\n`;
          }
        });
      }
      
      markdown += '\n';
    });
  });
  
  return markdown.trim();
}

// 导出为Markdown文件
function exportToMarkdown() {
  const markdownContent = convertSectionsToMarkdown(resumeSections);
  
  if (!markdownContent) {
    showMessage('没有内容可导出', true);
    return;
  }
  
  // 创建Blob并下载
  const blob = new Blob([markdownContent], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `resume-${new Date().toISOString().split('T')[0]}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  showMessage('Markdown文件已导出');
}

// 初始化一键闪填功能
function initQuickFill() {
  if (quickFillBtn) {
    quickFillBtn.addEventListener('click', () => {
      performQuickFill();
    });
  }
}

// 将简历数据转换为结构化格式
function convertResumeToStructuredData() {
  const structuredData = {};
  
  if (!resumeSections || resumeSections.length === 0) {
    return structuredData;
  }
  
  // 遍历所有模块和条目，提取关键信息
  resumeSections.forEach((section) => {
    section.groups.forEach((group) => {
      if (group.entries && group.entries.length > 0) {
        group.entries.forEach((entry) => {
          const label = (entry.label || '').toLowerCase().trim();
          const value = entry.value || '';
          
          if (!value) return;
          
          // 根据标签识别字段类型
          if (label.includes('姓名') || label.includes('name')) {
            structuredData.name = value;
            structuredData['姓名'] = value;
          } else if (label.includes('电话') || label.includes('手机') || label.includes('phone') || label.includes('tel') || label.includes('mobile')) {
            structuredData.phone = value;
            structuredData['电话'] = value;
          } else if (label.includes('邮箱') || label.includes('邮件') || label.includes('email') || label.includes('mail')) {
            structuredData.email = value;
            structuredData['邮箱'] = value;
          } else if (label.includes('地址') || label.includes('address')) {
            structuredData.address = value;
            structuredData['地址'] = value;
          } else if (label.includes('公司') || label.includes('company') || label.includes('单位')) {
            structuredData.company = value;
            structuredData['公司'] = value;
          } else if (label.includes('职位') || label.includes('position') || label.includes('job') || label.includes('岗位')) {
            structuredData.position = value;
            structuredData['职位'] = value;
          } else if (label.includes('工作经历') || label.includes('experience') || label.includes('工作经验')) {
            if (!structuredData.experience) {
              structuredData.experience = [];
            }
            structuredData.experience.push(value);
          } else if (label.includes('教育') || label.includes('education') || label.includes('学历') || label.includes('学校')) {
            if (!structuredData.education) {
              structuredData.education = [];
            }
            structuredData.education.push(value);
          } else if (label.includes('技能') || label.includes('skill')) {
            if (!structuredData.skill) {
              structuredData.skill = [];
            }
            structuredData.skill.push(value);
          } else if (label.includes('介绍') || label.includes('简介') || label.includes('introduction') || label.includes('描述')) {
            structuredData.introduction = value;
            structuredData['介绍'] = value;
          }
        });
      }
    });
  });
  
  // 处理数组字段，合并为字符串
  if (Array.isArray(structuredData.experience)) {
    structuredData.experience = structuredData.experience.join('\n\n');
  }
  if (Array.isArray(structuredData.education)) {
    structuredData.education = structuredData.education.join('\n\n');
  }
  if (Array.isArray(structuredData.skill)) {
    structuredData.skill = structuredData.skill.join('、');
  }
  
  return structuredData;
}

// 执行一键闪填
function performQuickFill() {
  // 检查是否有简历数据
  if (!resumeSections || resumeSections.length === 0) {
    showMessage('请先上传简历内容', true);
    return;
  }
  
  // 转换为结构化数据
  const resumeData = convertResumeToStructuredData();
  
  if (Object.keys(resumeData).length === 0) {
    showMessage('未找到可填充的简历数据', true);
    return;
  }
  
  // 查找当前活动标签页
  chrome.tabs.query({ active: true }, (tabs) => {
    if (tabs.length === 0) {
      showMessage('未找到活动标签页', true);
      return;
    }
    
    // 找到第一个非扩展页面的标签页
    let targetTab = null;
    for (const tab of tabs) {
      if (tab.url && 
          !tab.url.startsWith('chrome://') && 
          !tab.url.startsWith('chrome-extension://') &&
          !tab.url.startsWith('edge://') &&
          !tab.url.startsWith('about:')) {
        targetTab = tab;
        break;
      }
    }
    
    if (!targetTab) {
      showMessage('当前页面不支持填写表单', true);
      return;
    }
    
    // 显示加载提示
    showMessage('正在识别并填写表单...');
    
    // 发送一键闪填消息
    chrome.tabs.sendMessage(targetTab.id, {
      action: 'quickFill',
      resumeData: resumeData
    }, (response) => {
      if (chrome.runtime.lastError) {
        showMessage('一键闪填失败：请刷新页面后重试', true);
        console.error('一键闪填错误:', chrome.runtime.lastError);
      } else if (response && response.success) {
        showMessage(response.message || `成功填写 ${response.filledCount || 0} 个字段`);
      } else {
        showMessage(response?.message || '一键闪填失败，请检查表单字段', true);
      }
    });
  });
}

