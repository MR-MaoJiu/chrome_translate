// 获取设置
async function getSettings() {
  const result = await chrome.storage.sync.get('settings');
  return result.settings || {
    apiType: 'youdao',
    autoSpeak: true,
    showPhonetic: true,
    showExample: true,
    autoBlur: true,
    pronunciationType: '0',
    dailyGoal: 20
  };
}

// 获取生词本
async function getVocabulary() {
  const result = await chrome.storage.sync.get('vocabulary');
  return result.vocabulary || { known: {}, unknown: {} };
}

// 获取今日已复习单词
async function getTodayReviewed() {
  const today = new Date().toISOString().split('T')[0];
  const result = await chrome.storage.sync.get('reviewHistory');
  const history = result.reviewHistory || {};
  return history[today] || [];
}

// 记录已复习单词
async function recordReviewedWord(word) {
  const today = new Date().toISOString().split('T')[0];
  const result = await chrome.storage.sync.get('reviewHistory');
  const history = result.reviewHistory || {};
  
  if (!history[today]) {
    history[today] = [];
  }
  
  if (!history[today].includes(word)) {
    history[today].push(word);
  }
  
  await chrome.storage.sync.set({ reviewHistory: history });
} 