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
  try {
    const settings = await getSettings();
    let result;
    
    switch (settings.apiType) {
      case 'youdao':
        result = await translateWithYoudao(word);
        break;
      case 'google':
        result = await translateWithGoogle(word);
        break;
      case 'custom':
        result = await translateWithCustomApi(word, settings);
        break;
      default:
        result = await translateWithYoudao(word);
    }

    // 确保返回的数据格式完整
    if (!result || typeof result !== 'object') {
      throw new Error('翻译结果格式错误');
    }

    return {
      translation: result.translation || '翻译失败',
      phonetic: result.phonetic || '',
      example: result.example || null
    };
  } catch (error) {
    console.error('翻译失败：', error);
    // 返回友好的错误信息
    return {
      translation: error.message || '翻译服务暂时不可用',
      phonetic: '',
      example: null
    };
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
    console.log('有道API返回数据:', data);

    let translation = '';
    let phonetic = '';
    let example = '';

    // 获取翻译
    if (data.ec?.word?.[0]?.trs) {
      const translations = data.ec.word[0].trs.map(tr => 
        tr.tr[0].l.i[0].replace(/\s*\([^)]*\)/g, '')
      );
      translation = translations.join('；');
    }

    // 获取音标 - 修正音标获取路径
    if (data.simple?.word?.[0]?.ukphone) {
      phonetic = data.simple.word[0].ukphone;
    }

    // 获取例句 - 修正例句获取路径
    if (data.blng_sents_part?.sentence_pair?.[0]) {
      const sent = data.blng_sents_part.sentence_pair[0];
      example = {
        en: sent.sentence,
        cn: sent.sentence_translation
      };
    }

    console.log('处理后的翻译数据:', { translation, phonetic, example });
    return { translation, phonetic, example };
  } catch (error) {
    console.error('翻译请求失败：', error);
    throw error;
  }
}

// Google翻译API
async function translateWithGoogle(word) {
  try {
    // 构建请求参数
    const params = new URLSearchParams({
      client: 'gtx',
      sl: 'en',
      tl: 'zh-CN',
      dt: 't',
      q: word
    });

    // 打印请求URL
    const url = `https://translate.googleapis.com/translate_a/single?${params.toString()}`;
    console.log('Google翻译请求URL:', url);

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Google API error: ${response.status}`);
    }

    const data = await response.json();
    // 打印完整返回数据
    console.log('Google翻译完整返回数据:', JSON.stringify(data, null, 2));

    // 解析翻译结果
    let translation = '';
    if (data && Array.isArray(data[0])) {
      translation = data[0]
        .filter(item => item && item[0])
        .map(item => item[0])
        .join('');
    }

    if (!translation) {
      throw new Error('翻译结果为空');
    }

    return {
      translation: translation,
      phonetic: '',
      example: null
    };
  } catch (error) {
    console.error('Google翻译请求失败：', error);
    return {
      translation: '谷歌翻译服务暂时不可用，请稍后再试',
      phonetic: '',
      example: null
    };
  }
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
    
    // 确保返回统一的数据格式
    return {
      translation: data.translation || '翻译失败',
      phonetic: data.phonetic || '',
      example: data.example || null
    };
  } catch (error) {
    console.error('自定义API请求失败：', error);
    return {
      translation: '自定义API请求失败',
      phonetic: '',
      example: null
    };
  }
}

// 监听消息
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'translate') {
    translateWord(request.word)
      .then(result => {
        if (!result.translation) {
          throw new Error('翻译结果为空');
        }
        sendResponse({
          translation: result.translation,
          phonetic: result.phonetic || '',
          example: result.example || null,
          error: null
        });
      })
      .catch(error => {
        console.error('翻译处理错误：', error);
        sendResponse({
          translation: '翻译服务暂时不可用',
          phonetic: '',
          example: null,
          error: error.message
        });
      });
    return true; // 保持消息通道打开
  }
}); 