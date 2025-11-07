// DOM元素
const fileInput = document.getElementById('fileInput');
const uploadBtn = document.getElementById('uploadBtn');
const reuploadBtn = document.getElementById('reuploadBtn');
const uploadSection = document.getElementById('uploadSection');
const reuploadSection = document.getElementById('reuploadSection');
const tagsSection = document.getElementById('tagsSection');
const tagsContainer = document.getElementById('tagsContainer');
const fileStatus = document.getElementById('fileStatus');
const message = document.getElementById('message');

// 初始化
document.addEventListener('DOMContentLoaded', () => {
  loadStoredData();
  
  uploadBtn.addEventListener('click', () => {
    fileInput.click();
  });
  
  reuploadBtn.addEventListener('click', () => {
    fileInput.click();
  });
  
  fileInput.addEventListener('change', handleFileUpload);
});

// 加载存储的数据
function loadStoredData() {
  chrome.storage.local.get(['resumeData', 'fileName'], (result) => {
    if (result.resumeData && result.fileName) {
      // 已存在数据，显示标签和重新上传按钮
      displayTags(result.resumeData);
      uploadSection.style.display = 'none';
      reuploadSection.style.display = 'block';
      tagsSection.style.display = 'block';
      fileStatus.textContent = `已加载: ${result.fileName}`;
    } else {
      // 没有数据，显示上传区域
      uploadSection.style.display = 'block';
      reuploadSection.style.display = 'none';
      tagsSection.style.display = 'none';
    }
  });
}

// 处理文件上传
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
    
    // 保存到存储
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

// 解析Markdown文件
// 格式：[标签名]
// 内容
function parseMarkdown(content) {
  const data = {};
  const lines = content.split('\n');
  let currentTag = null;
  let currentContent = [];
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // 匹配标签格式：[标签名]
    const tagMatch = line.match(/^\[(.+)\]$/);
    if (tagMatch) {
      // 保存上一个标签的内容
      if (currentTag) {
        data[currentTag] = currentContent.join('\n').trim();
      }
      // 开始新标签
      currentTag = tagMatch[1];
      currentContent = [];
    } else if (currentTag && line) {
      // 收集标签内容
      currentContent.push(line);
    }
  }
  
  // 保存最后一个标签
  if (currentTag) {
    data[currentTag] = currentContent.join('\n').trim();
  }
  
  return data;
}

// 显示标签
function displayTags(data) {
  tagsContainer.innerHTML = '';
  
  const tags = Object.keys(data).sort();
  
  tags.forEach(tag => {
    const tagElement = document.createElement('div');
    tagElement.className = 'tag';
    tagElement.textContent = tag;
    tagElement.addEventListener('click', () => {
      copyToClipboard(data[tag], tag);
    });
    tagsContainer.appendChild(tagElement);
  });
  
  if (tags.length === 0) {
    tagsContainer.innerHTML = '<p style="color: #999; text-align: center;">暂无标签</p>';
  }
}

// 复制到剪切板
function copyToClipboard(text, tagName) {
  navigator.clipboard.writeText(text).then(() => {
    showMessage(`已复制 "${tagName}" 到剪切板`);
  }).catch(err => {
    console.error('复制失败:', err);
    showMessage('复制失败，请重试', true);
  });
}

// 显示提示消息
function showMessage(msg, isError = false) {
  message.textContent = msg;
  message.className = 'message' + (isError ? ' error' : '') + ' show';
  
  setTimeout(() => {
    message.className = 'message' + (isError ? ' error' : '');
  }, 2000);
}

