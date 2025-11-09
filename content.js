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
  
  if (request.action === 'quickFill') {
    quickFillForm(request.resumeData).then(result => {
      sendResponse(result);
    }).catch(error => {
      sendResponse({ success: false, message: error.message });
    });
    return true; // Keep the message channel open for async response
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

// 识别字段类型（通过 name、id、placeholder、autocomplete 等属性）
function identifyFieldType(element) {
  const name = (element.name || '').toLowerCase();
  const id = (element.id || '').toLowerCase();
  const placeholder = (element.placeholder || '').toLowerCase();
  const autocomplete = (element.autocomplete || element.getAttribute('autocomplete') || '').toLowerCase();
  const label = getLabelText(element).toLowerCase();
  const type = (element.type || '').toLowerCase();
  
  // 组合所有文本用于匹配
  const searchText = `${name} ${id} ${placeholder} ${autocomplete} ${label}`;
  
  // 字段类型映射规则
  const fieldMappings = {
    // 姓名相关
    name: {
      keywords: ['name', '姓名', '真实姓名', 'fullname', 'full-name', 'user-name', 'username', '姓', '名'],
      autocomplete: ['name', 'given-name', 'family-name']
    },
    // 电话相关
    phone: {
      keywords: ['phone', 'tel', 'mobile', '电话', '手机', '联系电话', '手机号', '手机号码', 'telephone'],
      autocomplete: ['tel', 'tel-national', 'tel-country-code']
    },
    // 邮箱相关
    email: {
      keywords: ['email', 'e-mail', 'mail', '邮箱', '邮件', '电子邮箱', 'email-address'],
      autocomplete: ['email']
    },
    // 地址相关
    address: {
      keywords: ['address', '地址', '住址', '居住地址', '详细地址', 'street', 'street-address'],
      autocomplete: ['street-address', 'address-line1', 'address-line2']
    },
    // 公司相关
    company: {
      keywords: ['company', '公司', '单位', '工作单位', 'employer', 'organization', 'org'],
      autocomplete: ['organization']
    },
    // 职位相关
    position: {
      keywords: ['position', 'job', 'title', '职位', '岗位', '职务', 'job-title', 'jobtitle'],
      autocomplete: ['organization-title']
    },
    // 工作经历
    experience: {
      keywords: ['experience', '工作经历', '工作经验', 'work-experience', 'workexperience', '工作履历'],
      autocomplete: []
    },
    // 教育经历
    education: {
      keywords: ['education', '教育', '学历', '毕业院校', '学校', 'school', 'university', 'college'],
      autocomplete: []
    },
    // 技能
    skill: {
      keywords: ['skill', '技能', '专业技能', '能力', 'skills', 'abilities'],
      autocomplete: []
    },
    // 自我介绍
    introduction: {
      keywords: ['introduction', '介绍', '简介', '自我介绍', '个人简介', '描述', 'description', 'about', 'bio', 'biography'],
      autocomplete: []
    }
  };
  
  // 首先检查 autocomplete 属性（最准确）
  if (autocomplete) {
    for (const [fieldType, mapping] of Object.entries(fieldMappings)) {
      if (mapping.autocomplete.some(ac => autocomplete.includes(ac))) {
        return fieldType;
      }
    }
  }
  
  // 检查 type 属性
  if (type === 'email') return 'email';
  if (type === 'tel') return 'phone';
  
  // 检查关键词匹配
  for (const [fieldType, mapping] of Object.entries(fieldMappings)) {
    if (mapping.keywords.some(keyword => searchText.includes(keyword))) {
      return fieldType;
    }
  }
  
  return null; // 无法识别
}

// 一键闪填表单
async function quickFillForm(resumeData) {
  try {
    const filledFields = [];
    const failedFields = [];
    
    // 获取所有可编辑的表单元素
    const allInputs = document.querySelectorAll('input, textarea, [contenteditable="true"]');
    const processedElements = new Set(); // 避免重复处理
    
    for (const input of allInputs) {
      if (!isEditable(input) || !isVisible(input) || processedElements.has(input)) {
        continue;
      }
      
      // 识别字段类型
      const fieldType = identifyFieldType(input);
      if (!fieldType) {
        continue; // 无法识别的字段跳过
      }
      
      // 获取对应的简历数据
      let value = null;
      if (resumeData[fieldType]) {
        value = resumeData[fieldType];
      } else if (fieldType === 'name' && resumeData['姓名']) {
        value = resumeData['姓名'];
      } else if (fieldType === 'phone' && resumeData['电话']) {
        value = resumeData['电话'];
      } else if (fieldType === 'email' && resumeData['邮箱']) {
        value = resumeData['邮箱'];
      }
      
      if (value && typeof value === 'string' && value.trim()) {
        // 检查字段是否已有值（可选：跳过已有值的字段）
        const currentValue = input.value || input.textContent || '';
        if (currentValue.trim() && currentValue.trim() === value.trim()) {
          continue; // 值已相同，跳过
        }
        
        // 填充字段
        try {
          fillElement(input, value);
          triggerInputEvents(input);
          filledFields.push({ fieldType, value: value.substring(0, 30) });
          processedElements.add(input);
        } catch (error) {
          console.error(`填充字段 ${fieldType} 失败:`, error);
          failedFields.push({ fieldType, error: error.message });
        }
      }
    }
    
    if (filledFields.length === 0 && failedFields.length === 0) {
      return {
        success: false,
        message: '未找到可识别的表单字段，请检查页面是否包含表单',
        filledCount: 0
      };
    }
    
    return {
      success: true,
      message: `成功填写 ${filledFields.length} 个字段${failedFields.length > 0 ? `，${failedFields.length} 个字段失败` : ''}`,
      filledCount: filledFields.length,
      failedCount: failedFields.length,
      filledFields,
      failedFields
    };
    
  } catch (error) {
    console.error('一键闪填失败:', error);
    return {
      success: false,
      message: '一键闪填失败: ' + error.message,
      filledCount: 0
    };
  }
}

