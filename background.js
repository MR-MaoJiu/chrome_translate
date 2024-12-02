// 有道词典API配置
const YOUDAO_API_URL = 'https://dict.youdao.com/jsonapi';

// 获取当前设置
async function getSettings() {
  const result = await chrome.storage.sync.get('settings');
  return result.settings || {
    apiType: 'youdao',
    customApiUrl: '',
    apiKey: '',
    autoSpeak: true,
    showPhonetic: true,
    showExample: true
  };
}

// 翻译功能
async function translateWord(word) {
  const settings = await getSettings();
  
  switch (settings.apiType) {
    case 'youdao':
      return translateWithYoudao(word);
    case 'google':
      return translateWithGoogle(word);
    case 'custom':
      return translateWithCustomApi(word, settings);
    default:
      return translateWithYoudao(word);
  }
}

// 有道词典API
async function translateWithYoudao(word) {
  try {
    const params = new URLSearchParams({
      q: word,
      jsonversion: '2',
      client: 'mobile',
      xmlVersion: '5.1',
      network: 'wifi'
    });

    const response = await fetch(`${YOUDAO_API_URL}?${params.toString()}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();

    // 解析翻译结果
    if (data.ec?.word?.[0]?.trs) {
      const translations = data.ec.word[0].trs.map(tr => 
        tr.tr[0].l.i[0].replace(/\s*\([^)]*\)/g, '')
      );
      return translations.join('；');
    }

    // 尝试使用网络释义
    if (data.web_trans?.['web-translation']?.[0]?.trans) {
      const webTrans = data.web_trans['web-translation'][0].trans;
      return webTrans.map(t => t.value).join('；');
    }

    return '未找到翻译';
  } catch (error) {
    console.error('翻译请求失败：', error);
    throw error;
  }
}

// Google翻译API
async function translateWithGoogle(word) {
  // 实现Google翻译API
}

// 自定义API
async function translateWithCustomApi(word, settings) {
  try {
    const response = await fetch(settings.customApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`
      },
      body: JSON.stringify({ word })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const data = await response.json();
    return data.translation;
  } catch (error) {
    console.error('自定义API请求失败：', error);
    throw error;
  }
}

// 监听消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    translateWord(request.word)
      .then(translation => {
        sendResponse({ translation });
      })
      .catch(error => {
        sendResponse({ error: error.message });
      });
    return true; // 保持消息通道打开
  }
}); 