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

    // 确保返回正确的数据结构
    return {
      translation: response.translation || '翻译失败',
      phonetic: response.phonetic || ''
    };
  } catch (error) {
    console.error('翻译请求失败:', error);
    
    if (error.message.includes('Extension context invalidated') && retryCount < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return translateWord(word, retryCount + 1);
    }
    
    return {
      translation: '翻译失败',
      phonetic: ''
    };
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
    
    // 获取最新设置
    const result = await chrome.storage.sync.get('settings');
    const settings = result.settings || {
      showPhonetic: true,
      autoSpeak: true,
      autoBlur: true
    };

    const response = await translateWord(selectedText);
    
    // 检查popup是否仍然存在
    if (!document.contains(popup)) {
      return;
    }

    // 构建翻译内容
    const translationHtml = `
      <div class="translation-content">
        <div class="word-header">
          <div class="word">${selectedText}</div>
          ${settings.showPhonetic && response.phonetic ? 
            `<div class="phonetic">/${response.phonetic}/</div>` : 
            ''}
          ${settings.autoSpeak ? 
            `<button class="speak-btn" title="朗读单词">🔊</button>` : 
            ''}
        </div>
        <div class="meaning ${settings.autoBlur && isHover ? 'blur' : ''}">${response.translation}</div>
      </div>
      <div class="close-btn">×</div>
    `;
    
    popup.innerHTML = translationHtml;

    // 绑定朗读按钮事件
    const speakBtn = popup.querySelector('.speak-btn');
    if (speakBtn) {
      speakBtn.onclick = () => {
        const utterance = new SpeechSynthesisUtterance(selectedText);
        utterance.lang = 'en-US';
        speechSynthesis.speak(utterance);
      };

      // 仅在设置开启且非悬停时自动朗读
      if (settings.autoSpeak && !isHover) {
        speakBtn.click();
      }
    }

    // 重新绑定关闭按钮事件
    const closeBtn = popup.querySelector('.close-btn');
    if (closeBtn) {
      closeBtn.onclick = removeExistingPopup;
    }

    // 如果不是悬停显示且翻译成功，则保存到生词本
    if (!isHover && response.translation !== '翻译失败') {
      const saved = await saveToVocabulary(selectedText, response.translation);
      if (!saved) {
        console.error('保存单词失败:', selectedText);
      } else {
        await recordTodayWord(selectedText);
        await updateLearningStreak();
        await highlightKnownWords();
      }
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

// 添加设置变更监听
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.settings) {
    console.log('设置已更新:', changes.settings.newValue);
    // 移除现有弹窗，确保新弹窗使用最新设置
    removeExistingPopup();
  }
});

// 确保DOM加载完成后再初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeExtension);
} else {
  initializeExtension();
} 