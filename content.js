// 全局变量存储扩展状态
let isExtensionValid = true;

// 创建翻译弹窗
const createTranslatePopup = () => {
  console.log('创建弹窗');
  removeExistingPopup();
  
  const popup = document.createElement('div');
  popup.className = 'translate-popup';
  
  const closeBtn = document.createElement('div');
  closeBtn.className = 'close-btn';
  closeBtn.innerHTML = '×';
  closeBtn.onclick = removeExistingPopup;
  popup.appendChild(closeBtn);
  
  document.body.appendChild(popup);
  return popup;
};

// 移除已存在的弹窗
const removeExistingPopup = () => {
  const existingPopup = document.querySelector('.translate-popup');
  if (existingPopup) {
    existingPopup.remove();
  }
};

// 调用翻译API
const translateWord = async (word, retryCount = 0) => {
  try {
    // 最多重试2次
    const maxRetries = 2;
    
    const response = await chrome.runtime.sendMessage({
      action: 'translate',
      word: word
    });

    if (!response || response.error) {
      throw new Error(response?.error || '翻译失败');
    }

    return response.translation;
  } catch (error) {
    console.error('翻译请求失败:', error);
    
    // 如果是扩展上下文失效错误且未超过重试次数，则等待后重试
    if (error.message.includes('Extension context invalidated') && retryCount < 2) {
      await new Promise(resolve => setTimeout(resolve, 500)); // 等待500ms
      return translateWord(word, retryCount + 1);
    }
    
    return '翻译失败';
  }
};

// 显示翻译结果
const showTranslation = async (selectedText, popup, isHover = false) => {
  try {
    // 先显示加载状态
    popup.innerHTML = `
      <div class="translation-content">
        <div class="word">${selectedText}</div>
        <div class="meaning loading">正在翻译...</div>
      </div>
    `;
    
    const translation = await translateWord(selectedText);
    
    // 检查popup是否仍然存在（用户可能已关闭）
    if (!document.contains(popup)) {
      return;
    }
    
    // 如果不是悬浮显示，则保存到生词本
    if (!isHover && translation !== '翻译失败') {
      await saveToVocabulary(selectedText, translation);
      await recordTodayWord(selectedText); // 记录今日新学单词
      await updateLearningStreak(); // 更新连续学习天数
      await highlightKnownWords();
    }
    
    // 检查单词是否已在生词本中
    const isInVocabulary = await isWordKnown(selectedText);
    const blurClass = isInVocabulary ? 'blur-translation' : '';
    
    popup.innerHTML = `
      <div class="translation-content">
        <div class="word">${selectedText}</div>
        <div class="meaning ${blurClass}">${translation}</div>
      </div>
      <div class="close-btn">×</div>
    `;

    // 重新绑定关闭按钮事件
    const closeBtn = popup.querySelector('.close-btn');
    if (closeBtn) {
      closeBtn.onclick = removeExistingPopup;
    }
  } catch (error) {
    console.error('翻译失败:', error);
    if (document.contains(popup)) {
      popup.innerHTML = `
        <div class="translation-content">
          <div class="word">${selectedText}</div>
          <div class="meaning error">翻译失败，请重试</div>
        </div>
        <div class="close-btn">×</div>
      `;
    }
  }
};

// 高亮已学习的单词
const highlightKnownWords = async () => {
  try {
    const vocabulary = await getVocabulary();
    
    const walker = document.createTreeWalker(
      document.body,
      NodeFilter.SHOW_TEXT,
      {
        acceptNode: function(node) {
          const parent = node.parentNode;
          if (!parent || 
              parent.tagName === 'SCRIPT' || 
              parent.tagName === 'STYLE' || 
              parent.closest('.translate-popup')) {
            return NodeFilter.FILTER_REJECT;
          }
          return NodeFilter.FILTER_ACCEPT;
        }
      }
    );

    const textNodes = [];
    while (walker.nextNode()) textNodes.push(walker.currentNode);
    
    textNodes.forEach(node => {
      if (!node.parentNode) return;
      
      let text = node.textContent;
      let hasReplacement = false;
      
      // 处理已认识的单词
      Object.entries(vocabulary.known).forEach(([word, translation]) => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        if (regex.test(text)) {
          text = text.replace(regex, `<span class="known-word" data-word="${word}" data-translation="${translation}">$&</span>`);
          hasReplacement = true;
        }
      });
      
      // 处理不认识的单词
      Object.entries(vocabulary.unknown).forEach(([word, translation]) => {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        if (regex.test(text)) {
          text = text.replace(regex, `<span class="known-word unknown-word" data-word="${word}" data-translation="${translation}">$&</span>`);
          hasReplacement = true;
        }
      });
      
      if (hasReplacement) {
        const span = document.createElement('span');
        span.innerHTML = text;
        node.parentNode.replaceChild(span, node);
      }
    });
  } catch (error) {
    console.error('高亮单词失败:', error);
  }
};

// 防抖函数
const debounce = (func, wait) => {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(this, args), wait);
  };
};

// 处理选中文本
const handleSelection = async () => {
  try {
    const selection = window.getSelection();
    const selectedText = selection.toString().trim();

    if (!selectedText || !/^[a-zA-Z]+$/.test(selectedText)) {
      return;
    }

    const popup = createTranslatePopup();
    
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    
    popup.style.left = `${rect.left + scrollLeft}px`;
    popup.style.top = `${rect.bottom + scrollTop + 10}px`;

    await showTranslation(selectedText, popup);
  } catch (error) {
    console.error('处理选中文本失败:', error);
  }
};

// 处理鼠标悬停
const handleHover = async (event) => {
  try {
    const knownWord = event.target.closest('.known-word');
    if (!knownWord) return;

    const word = knownWord.dataset.word;
    const rect = knownWord.getBoundingClientRect();
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

    const popup = createTranslatePopup();
    popup.classList.add('hover-popup');
    popup.style.left = `${rect.left + scrollLeft}px`;
    popup.style.top = `${rect.bottom + scrollTop + 5}px`;

    await showTranslation(word, popup, true);
  } catch (error) {
    console.error('处理悬停失败:', error);
  }
};

// 初始化事件监听
const initEventListeners = () => {
  // 选中文本事件
  document.addEventListener('mouseup', debounce(handleSelection, 300));

  // 鼠标悬停事件
  document.addEventListener('mouseover', debounce(handleHover, 200));

  // 点击事件关闭弹窗（点击弹窗外部或关闭按钮时关闭）
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.translate-popup')) {
      removeExistingPopup();
    }
  });

  // 移除鼠标移出事件监听器
  // document.addEventListener('mouseout', (e) => {...});
};

// 初始化扩展
const initializeExtension = async () => {
  try {
    console.log('初始化扩展');
    await highlightKnownWords();
    initEventListeners();
  } catch (error) {
    console.error('初始化扩展失败:', error);
  }
};

// 确保DOM加载完成后再初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
} 