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
let resumeData = {};
let applications = { pending: [], submitted: [] };
let currentApplicationStatus = 'pending';
let editingApplicationId = null;

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  initResize();
  initTabs();
  initApplications();
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
      body.style.width = `${width}px`;
      body.style.height = `${height}px`;
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
  chrome.storage.local.get(['resumeData', 'fileName', 'applications', 'windowSize'], (result) => {
    if (result.resumeData && result.fileName) {
      resumeData = result.resumeData;
      displayTags(resumeData);
      uploadSection.style.display = 'none';
      reuploadSection.style.display = 'block';
      tagsSection.style.display = 'block';
      fileStatus.textContent = `已加载: ${result.fileName}`;
    } else {
      uploadSection.style.display = 'block';
      reuploadSection.style.display = 'none';
      tagsSection.style.display = 'none';
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
    const parsedData = parseMarkdown(content);

    if (Object.keys(parsedData).length === 0) {
      showMessage('未找到有效内容，请检查Markdown格式', true);
      return;
    }

    resumeData = parsedData;

    chrome.storage.local.set({
      resumeData: parsedData,
      fileName: file.name
    }, () => {
      displayTags(parsedData);
      uploadSection.style.display = 'none';
      reuploadSection.style.display = 'block';
      tagsSection.style.display = 'block';
      fileStatus.textContent = `已加载: ${file.name}`;
      showMessage('文件上传成功！');
    });
  };

  reader.readAsText(file, 'UTF-8');
}

// Markdown 解析
function parseMarkdown(content) {
  const data = {};
  const lines = content.split('\n');
  let currentTag = null;
  let currentContent = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const tagMatch = line.match(/^\[(.+)\]$/);

    if (tagMatch) {
      if (currentTag) {
        data[currentTag] = currentContent.join('\n').trim();
      }
      currentTag = tagMatch[1];
      currentContent = [];
    } else if (currentTag) {
      currentContent.push(line);
    }
  }

  if (currentTag) {
    data[currentTag] = currentContent.join('\n').trim();
  }

  return data;
}

// 显示标签
function displayTags(data) {
  tagsContainer.innerHTML = '';
  const tags = Object.keys(data).sort();

  tags.forEach((tag) => {
    const tagElement = document.createElement('div');
    tagElement.className = 'tag';
    tagElement.textContent = tag;
    tagElement.addEventListener('click', () => {
      copyToClipboard(data[tag], tag);
    });
    tagsContainer.appendChild(tagElement);
  });

  if (tags.length === 0) {
    tagsContainer.innerHTML = '<p style="color:#999;text-align:center;width:100%;">暂无标签</p>';
  }
}

// 复制
function copyToClipboard(text, tagName) {
  navigator.clipboard.writeText(text).then(() => {
    showMessage(`已复制 "${tagName}" 到剪切板`);
  }).catch((err) => {
    console.error('复制失败:', err);
    showMessage('复制失败，请重试', true);
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

