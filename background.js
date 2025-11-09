// Background service worker for managing windows

let fixedWindowId = null;
let floatWindowId = null;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'openFixedWindow') {
    openFixedWindow().then(windowId => {
      fixedWindowId = windowId;
      sendResponse({ success: true, windowId });
    }).catch(error => {
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'openFloatWindow') {
    // 必须返回 true 来保持消息通道打开，以便异步操作完成后发送响应
    openFloatWindow().then(windowId => {
      floatWindowId = windowId;
      try {
        sendResponse({ success: true, windowId });
      } catch (e) {
        console.error('发送响应失败:', e);
      }
    }).catch(error => {
      try {
        sendResponse({ success: false, error: error.message });
      } catch (e) {
        console.error('发送错误响应失败:', e);
      }
    });
    return true; // 保持消息通道打开
  }
  
  if (request.action === 'closeFloatWindow') {
    if (floatWindowId) {
      chrome.windows.remove(floatWindowId, () => {
        floatWindowId = null;
        try {
          sendResponse({ success: true });
        } catch (e) {
          console.error('发送响应失败:', e);
        }
      });
    } else {
      try {
        sendResponse({ success: false, error: '悬浮窗未打开' });
      } catch (e) {
        console.error('发送错误响应失败:', e);
      }
    }
    return true; // 保持消息通道打开
  }
  
  if (request.action === 'closeFixedWindow') {
    if (fixedWindowId) {
      chrome.tabs.remove(fixedWindowId, () => {
        fixedWindowId = null;
        sendResponse({ success: true });
      });
    } else {
      sendResponse({ success: false, error: '窗口未打开' });
    }
    return true;
  }
  
  if (request.action === 'checkFixedWindow') {
    if (fixedWindowId) {
      chrome.tabs.get(fixedWindowId, (tab) => {
        if (chrome.runtime.lastError || !tab) {
          fixedWindowId = null;
          sendResponse({ isOpen: false });
        } else {
          sendResponse({ isOpen: true, tabId: fixedWindowId });
        }
      });
    } else {
      sendResponse({ isOpen: false });
    }
    return true;
  }
});

// Open fixed window
async function openFixedWindow() {
  return new Promise((resolve, reject) => {
    // 检查是否已经存在固定窗口（标签页）
    if (fixedWindowId) {
      chrome.tabs.get(fixedWindowId, (tab) => {
        if (!chrome.runtime.lastError && tab) {
          // 标签页已存在，聚焦它
          chrome.tabs.update(fixedWindowId, { active: true }, () => {
            chrome.windows.update(tab.windowId, { focused: true }, () => {
              resolve(fixedWindowId);
            });
          });
        } else {
          // 标签页不存在，创建新标签页
          fixedWindowId = null;
          createNewFixedWindow().then(resolve).catch(reject);
        }
      });
    } else {
      createNewFixedWindow().then(resolve).catch(reject);
    }
  });
}

// Create a new fixed window - 使用新标签页方式，避免popup失去焦点关闭
async function createNewFixedWindow() {
  return new Promise((resolve, reject) => {
    // 使用chrome.tabs.create在新标签页中打开，这样不会因为失去焦点而关闭
    chrome.tabs.create({
      url: chrome.runtime.getURL('popup.html?fixed=true'),
      active: false // 不激活，保持popup打开（如果是从popup调用的）
    }, (tab) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
      } else {
        // 保存标签页ID而不是窗口ID
        fixedWindowId = tab.id;
        resolve(tab.id);
      }
    });
  });
}

// Check if fixed window (tab) exists on startup
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId === fixedWindowId) {
    fixedWindowId = null;
  }
});

// Check if float window exists on startup
chrome.windows.onRemoved.addListener((windowId) => {
  if (windowId === floatWindowId) {
    floatWindowId = null;
  }
});

// Open float window - 创建小的悬浮窗口
async function openFloatWindow() {
  return new Promise((resolve, reject) => {
    // 检查是否已经存在悬浮窗
    if (floatWindowId) {
      chrome.windows.get(floatWindowId, (window) => {
        if (!chrome.runtime.lastError) {
          // 窗口已存在，聚焦它
          chrome.windows.update(floatWindowId, { focused: true }, () => {
            resolve(floatWindowId);
          });
        } else {
          // 窗口不存在，创建新窗口
          floatWindowId = null;
          createNewFloatWindow().then(resolve).catch(reject);
        }
      });
    } else {
      createNewFloatWindow().then(resolve).catch(reject);
    }
  });
}

// Create a new float window - 创建小的悬浮窗口
async function createNewFloatWindow() {
  return new Promise((resolve, reject) => {
    // 获取当前窗口的位置和大小
    chrome.windows.getCurrent((currentWindow) => {
      if (chrome.runtime.lastError) {
        // 如果获取当前窗口失败，使用默认位置
        createFloatWindowWithPosition(null, null, resolve, reject);
        return;
      }
      
      const width = 400;
      const height = 500;
      const left = currentWindow.left + Math.floor((currentWindow.width - width) / 2);
      const top = currentWindow.top + 50;
      
      createFloatWindowWithPosition(left, top, resolve, reject);
    });
  });
}

// 创建悬浮窗的辅助函数
function createFloatWindowWithPosition(left, top, resolve, reject) {
  const width = 400;
  const height = 500;
  
  const windowOptions = {
    url: chrome.runtime.getURL('popup.html?fixed=true&float=true'),
    type: 'popup',
    width: width,
    height: height,
    focused: true
  };
  
  // 只有在有位置信息时才设置left和top
  if (left !== null && top !== null) {
    windowOptions.left = left;
    windowOptions.top = top;
  }
  
  chrome.windows.create(windowOptions, (window) => {
    if (chrome.runtime.lastError) {
      console.error('创建悬浮窗失败:', chrome.runtime.lastError);
      reject(new Error(chrome.runtime.lastError.message));
    } else {
      floatWindowId = window.id;
      resolve(window.id);
    }
  });
}

