// Content script for form filling

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fillForm') {
    const result = fillFormField(request.text, request.fieldType);
    sendResponse({ success: result.success, message: result.message });
    return true; // Keep the message channel open for async response
  }
  
  if (request.action === 'detectFields') {
    const fields = detectFormFields();
    sendResponse({ fields });
    return true;
  }
  
  if (request.action === 'fillSpecificField') {
    const result = fillSpecificField(request.selector, request.text);
    sendResponse({ success: result.success, message: result.message });
    return true;
  }
});

// Check if an element is editable
function isEditable(element) {
  if (!element) return false;
  
  // Check if it's a form input
  if (element.tagName === 'INPUT') {
    const type = element.type.toLowerCase();
    const editableTypes = ['text', 'email', 'tel', 'number', 'password', 'url', 'search', ''];
    return editableTypes.includes(type) && !element.disabled && !element.readOnly;
  }
  
  // Check if it's a textarea
  if (element.tagName === 'TEXTAREA') {
    return !element.disabled && !element.readOnly;
  }
  
  // Check if it's contenteditable
  const contentEditable = element.contentEditable;
  if (contentEditable === 'true' || contentEditable === '' || element.isContentEditable) {
    return true;
  }
  
  return false;
}

// Check if an element is visible
function isVisible(element) {
  if (!element) return false;
  
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') {
    return false;
  }
  
  if (element.offsetWidth === 0 && element.offsetHeight === 0) {
    return false;
  }
  
  return true;
}

// Fill form field with text - improved to support any editable element
function fillFormField(text, fieldType = 'auto') {
  try {
    // Priority 1: Fill the currently focused element (if editable)
    const activeElement = document.activeElement;
    
    if (activeElement && isEditable(activeElement) && isVisible(activeElement)) {
      fillElement(activeElement, text);
      triggerInputEvents(activeElement);
      return { success: true, message: '已填写到当前焦点字段' };
    }
    
    // Priority 2: Find all editable elements on the page
    const allEditableElements = [];
    
    // Find all input elements
    const inputs = document.querySelectorAll('input, textarea');
    inputs.forEach(input => {
      if (isEditable(input) && isVisible(input)) {
        allEditableElements.push(input);
      }
    });
    
    // Find all contenteditable elements
    const contentEditables = document.querySelectorAll('[contenteditable="true"], [contenteditable=""], [contenteditable]');
    contentEditables.forEach(el => {
      if (isEditable(el) && isVisible(el)) {
        allEditableElements.push(el);
      }
    });
    
    // Priority 2a: Try to find an empty editable element
    for (const element of allEditableElements) {
      const value = element.value || element.textContent || '';
      if (value.trim() === '') {
        element.focus();
        fillElement(element, text);
        triggerInputEvents(element);
        return { success: true, message: '已填写到空字段' };
      }
    }
    
    // Priority 2b: If no empty field, find the first visible editable element
    for (const element of allEditableElements) {
      element.focus();
      fillElement(element, text);
      triggerInputEvents(element);
      return { success: true, message: '已填写到可编辑字段' };
    }
    
    // Priority 3: Try to find elements by field type (if specified)
    if (fieldType !== 'auto') {
      for (const element of allEditableElements) {
        if (matchesFieldType(element, fieldType)) {
          element.focus();
          fillElement(element, text);
          triggerInputEvents(element);
          return { success: true, message: '已填写到指定类型字段' };
        }
      }
    }
    
    // If nothing found, return error
    return { success: false, message: '未找到可编辑的元素，请先点击要填写的位置' };
    
  } catch (error) {
    console.error('填写失败:', error);
    return { success: false, message: '填写失败: ' + error.message };
  }
}

// Trigger input events on an element
function triggerInputEvents(element) {
  // Create and dispatch input event
  const inputEvent = new Event('input', { bubbles: true, cancelable: true });
  element.dispatchEvent(inputEvent);
  
  // Create and dispatch change event
  const changeEvent = new Event('change', { bubbles: true, cancelable: true });
  element.dispatchEvent(changeEvent);
  
  // Also trigger React and other framework events
  const nativeInputValueSetter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value')?.set;
  const nativeTextAreaValueSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value')?.set;
  
  if (element.tagName === 'INPUT' && nativeInputValueSetter) {
    nativeInputValueSetter.call(element, element.value);
    const reactEvent = new Event('input', { bubbles: true });
    element.dispatchEvent(reactEvent);
  } else if (element.tagName === 'TEXTAREA' && nativeTextAreaValueSetter) {
    nativeTextAreaValueSetter.call(element, element.value);
    const reactEvent = new Event('input', { bubbles: true });
    element.dispatchEvent(reactEvent);
  }
}

// Fill a specific field by selector
function fillSpecificField(selector, text) {
  try {
    const element = document.querySelector(selector);
    if (element) {
      fillElement(element, text);
      // Trigger events
      triggerInputEvents(element);
      return { success: true, message: '已填写到指定字段' };
    } else {
      return { success: false, message: '未找到指定的表单字段' };
    }
  } catch (error) {
    console.error('填写表单失败:', error);
    return { success: false, message: '填写失败: ' + error.message };
  }
}

// Fill an element with text
function fillElement(element, text) {
  if (!element) return;
  
  // Focus the element first
  try {
    element.focus();
  } catch (e) {
    console.warn('无法聚焦元素:', e);
  }
  
  // Handle different element types
  if (element.isContentEditable || element.contentEditable === 'true' || element.contentEditable === '') {
    // For contenteditable elements (div, span, p, etc.)
    // Clear existing content
    element.textContent = '';
    element.innerHTML = '';
    
    // Set new content, preserving line breaks
    if (text.includes('\n')) {
      // Use innerHTML to preserve line breaks
      const lines = text.split('\n');
      lines.forEach((line, index) => {
        if (index > 0) {
          element.appendChild(document.createElement('br'));
        }
        element.appendChild(document.createTextNode(line));
      });
    } else {
      element.textContent = text;
    }
    
    // Trigger input event for contenteditable
    const inputEvent = new InputEvent('input', { bubbles: true, cancelable: true, inputType: 'insertText' });
    element.dispatchEvent(inputEvent);
  } else if (element.tagName === 'TEXTAREA') {
    // For textarea
    element.value = text;
  } else if (element.tagName === 'INPUT') {
    // For input fields
    element.value = text;
  } else {
    // Fallback: try value first, then textContent
    if ('value' in element && typeof element.value !== 'undefined') {
      element.value = text;
    } else {
      element.textContent = text;
    }
  }
  
  // Scroll element into view smoothly
  try {
    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'nearest' });
  } catch (e) {
    // Fallback for older browsers
    try {
      element.scrollIntoView(false);
    } catch (e2) {
      // Ignore if still fails
    }
  }
}

// Check if element matches field type
function matchesFieldType(element, fieldType) {
  const placeholder = (element.placeholder || '').toLowerCase();
  const name = (element.name || '').toLowerCase();
  const id = (element.id || '').toLowerCase();
  const label = getLabelText(element).toLowerCase();
  
  const searchText = `${placeholder} ${name} ${id} ${label}`;
  
  const patterns = {
    name: ['姓名', 'name', '姓名', '真实姓名'],
    phone: ['电话', '手机', 'phone', 'mobile', 'tel', '联系电话'],
    email: ['邮箱', '邮件', 'email', 'e-mail', 'mail'],
    address: ['地址', 'address', '住址'],
    company: ['公司', 'company', '单位', '工作单位'],
    position: ['职位', 'position', 'job', '岗位', '职务'],
    experience: ['经历', 'experience', '工作经历', '工作经验'],
    education: ['教育', 'education', '学历', '毕业院校', '学校'],
    skill: ['技能', 'skill', '专业技能', '能力'],
    introduction: ['介绍', '简介', 'introduction', '自我介绍', '个人简介', '描述', 'description']
  };
  
  if (patterns[fieldType]) {
    return patterns[fieldType].some(pattern => searchText.includes(pattern));
  }
  
  return false;
}

// Get label text for an element
function getLabelText(element) {
  if (element.labels && element.labels.length > 0) {
    return element.labels[0].textContent || '';
  }
  
  const id = element.id;
  if (id) {
    const label = document.querySelector(`label[for="${id}"]`);
    if (label) {
      return label.textContent || '';
    }
  }
  
  // Try to find nearby label
  const parent = element.parentElement;
  if (parent) {
    const label = parent.querySelector('label');
    if (label) {
      return label.textContent || '';
    }
  }
  
  return '';
}

// Detect all form fields on the page
function detectFormFields() {
  const fields = [];
  const inputs = document.querySelectorAll('input, textarea, [contenteditable="true"]');
  
  inputs.forEach((input, index) => {
    if (input.offsetParent === null || input.disabled || input.readOnly) {
      return;
    }
    
    const placeholder = input.placeholder || '';
    const name = input.name || '';
    const id = input.id || '';
    const label = getLabelText(input);
    const type = input.type || 'text';
    const value = input.value || input.textContent || '';
    
    // Generate a unique selector
    let selector = '';
    if (id) {
      selector = `#${id}`;
    } else if (name) {
      selector = `input[name="${name}"]`;
      if (type !== 'text') {
        selector = `input[type="${type}"][name="${name}"]`;
      }
    } else {
      selector = `input:nth-of-type(${index + 1})`;
    }
    
    fields.push({
      selector,
      placeholder,
      name,
      id,
      label: label || placeholder || name || id || `字段${index + 1}`,
      type,
      value: value.substring(0, 50) // Preview only
    });
  });
  
  return fields;
}

