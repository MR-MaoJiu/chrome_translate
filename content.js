// 全局变量存储扩展状态
let isExtensionValid = true;

// 添加默认设置
const defaultSettings = {
  apiType: 'youdao',
  customApiUrl: '',
  apiKey: '',
  autoSpeak: true,
  showPhonetic: true,
  showExample: true,
  autoBlur: true,
  pronunciationType: '0'
};

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

    // 确保返回完整的翻译数据
    return {
      translation: response.translation || '翻译失败',
      phonetic: response.phonetic || '',
      example: response.example || null  // 添加例句数据
    };
  } catch (error) {
    console.error('翻译请求失败:', error, word);
    
    if (error.message.includes('Extension context invalidated') && retryCount < maxRetries) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return translateWord(word, retryCount + 1);
    }
    
    return {
      translation: '翻译失败',
      phonetic: '',
      example: null
    };
  }
};

// 获取设置
async function getSettings() {
  try {
    const result = await chrome.storage.sync.get('settings');
    return { ...defaultSettings, ...result.settings };
  } catch (error) {
    console.error('获取设置失败:', error);
    return defaultSettings;
  }
}

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
    
    // 获取最新设置和翻译
    const settings = await getSettings();
    const response = await translateWord(selectedText);
    
    // 检查popup是否仍然存在
    if (!document.contains(popup)) {
      return;
    }

    // 创建翻译内容
    const translationContent = document.createElement('div');
    translationContent.className = 'translation-content';

    // 创建单词头部
    const wordHeader = document.createElement('div');
    wordHeader.className = 'word-header';
    
    // 添加单词
    const wordDiv = document.createElement('div');
    wordDiv.className = 'word';
    wordDiv.textContent = selectedText;
    wordHeader.appendChild(wordDiv);
    
    // 创建第二行容器
    const secondLineDiv = document.createElement('div');
    secondLineDiv.className = 'second-line';
    
    // 添加音标
    if (response.phonetic && settings.showPhonetic) {
      const phoneticDiv = document.createElement('div');
      phoneticDiv.className = 'phonetic show';
      phoneticDiv.textContent = `/${response.phonetic}/`;
      secondLineDiv.appendChild(phoneticDiv);
    }
    
    // 添加朗读按钮
    if (settings.autoSpeak) {
      const speakBtn = document.createElement('button');
      speakBtn.className = 'speak-btn show';
      speakBtn.title = '朗读单词';
      speakBtn.textContent = '🔊';
      speakBtn.onclick = () => playWordAudio(selectedText);
      secondLineDiv.appendChild(speakBtn);
      
      if (!isHover) {
        setTimeout(() => playWordAudio(selectedText), 300);
      }
    }

    wordHeader.appendChild(secondLineDiv);
    translationContent.appendChild(wordHeader);
    
    // 添加翻译文本
    const meaningDiv = document.createElement('div');
    meaningDiv.className = 'meaning';
    meaningDiv.textContent = response.translation;
    
    // 根据设置添加模糊效果
    if (isHover && settings.autoBlur) {
      meaningDiv.classList.add('blur');
    }
    translationContent.appendChild(meaningDiv);

    // 添加例句
    if (response.example && settings.showExample) {
      const exampleDiv = document.createElement('div');
      exampleDiv.className = 'example show';
      exampleDiv.innerHTML = `
        <div class="en">${response.example.en}</div>
        <div class="cn">${response.example.cn}</div>
      `;
      translationContent.appendChild(exampleDiv);
    }

    // 添加关闭按钮
    const closeBtn = document.createElement('div');
    closeBtn.className = 'close-btn';
    closeBtn.textContent = '×';
    closeBtn.onclick = removeExistingPopup;
    // 悬停显示时只显示翻译内容
          popup.innerHTML = '';
          popup.appendChild(translationContent);
          popup.appendChild(closeBtn);

    // 保存到生词本
    if (!isHover && response.translation !== '翻译失败') {
      const saved = await saveToVocabulary(selectedText, response.translation);
      if (saved) {
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

    // 传递 isHover=true，让翻译弹窗知道这是悬停显示
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

  // 点击事件闭弹窗（点击弹窗外部或关闭按钮时关闭）
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.translate-popup')) {
      removeExistingPopup();
    }
  });

  // 移除鼠标移出事件监听器
  // document.addEventListener('mouseout', (e) => {...});
};

// 初始化扩展
const initializeExtension = async (retryCount = 0) => {
  try {
    console.log('初始化扩展');
    
    // 检查 chrome.storage 是否可用
    if (!chrome || !chrome.storage || !chrome.storage.sync) {
      throw new Error('chrome.storage 不可用');
    }

    // 确保词汇本数据已加载
    const vocabulary = await getVocabulary();
    if (!vocabulary || (!vocabulary.known && !vocabulary.unknown)) {
      throw new Error('词汇本数据未正确加载');
    }
    
    await highlightKnownWords();
    initEventListeners();
  } catch (error) {
    console.error('初始化扩展失败:', error);
    
    // 如果失败且未超过最大重试次数，则等待后重试
    if (retryCount < 3) {
      console.log(`重试初始化 (${retryCount + 1}/3)`);
      setTimeout(() => initializeExtension(retryCount + 1), 1000);
    }
  }
};

// 添加设置变更监听
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && changes.settings) {
    console.log('设置已更新:', changes.settings.newValue);
    // 移除现有弹窗，确保新弹窗使用最新设置
    removeExistingPopup();
    
    // 重新应用设置
    const newSettings = changes.settings.newValue;
    console.log('新的自动模糊设置:', newSettings.autoBlur);
  }
});

// 监听置变更消息
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'settingsUpdated') {
    console.log('收到设置更新:', message.settings);
    removeExistingPopup(); // 移除现有弹窗，确保使用新设置
  }
});

// 确保在正确的时机初始化
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    // 确保 chrome.storage 已经准备好
    if (chrome && chrome.storage) {
      initializeExtension();
    } else {
      console.error('chrome.storage 未准备好');
    }
  });
} else {
  // 确保 chrome.storage 已经准备好
  if (chrome && chrome.storage) {
    initializeExtension();
  } else {
    console.error('chrome.storage 未准备好');
  }
}

// 播放单词发音
async function playWordAudio(word) {
  try {
    const settings = await getSettings();
    const type = settings.pronunciationType || '0';
    const audioUrl = `https://dict.youdao.com/dictvoice?type=${type}&audio=${encodeURIComponent(word)}`;
    
    // 使用单例模式管理音频实例
    if (!window.wordAudio) {
      window.wordAudio = new Audio();
    }
    
    window.wordAudio.src = audioUrl;
    window.wordAudio.play().catch(error => {
      console.error('播放发音失败:', error);
    });
  } catch (error) {
    console.error('获取发音设置失败:', error);
  }
}

// 获取复习进度
async function getReviewProgress() {
  try {
    const settings = await getSettings();
    const dailyGoal = settings.dailyGoal || 20;
    const vocabulary = await getVocabulary();
    const unknownCount = Object.keys(vocabulary.unknown).length;
    const todayReviewed = await getTodayReviewed();
    const progress = Math.min((todayReviewed.length / dailyGoal) * 100, 100);

    return {
      totalToReview: unknownCount,
      reviewedToday: todayReviewed.length,
      progress: progress
    };
  } catch (error) {
    console.error('获取复习进度失败:', error);
    return {
      totalToReview: 0,
      reviewedToday: 0,
      progress: 0
    };
  }
} 