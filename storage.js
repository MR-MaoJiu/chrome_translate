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

// 保存到生词本
async function saveToVocabulary(word, translation) {
  try {
    const result = await chrome.storage.sync.get('vocabulary');
    const vocabulary = result.vocabulary || { known: {}, unknown: {} };
    
    // 如果单词已经存在，不重复保存
    if (vocabulary.known[word] || vocabulary.unknown[word]) {
      return false;
    }
    
    // 保存到不认识的单词列表
    vocabulary.unknown[word] = translation;
    await chrome.storage.sync.set({ vocabulary });
    return true;
  } catch (error) {
    console.error('保存到生词本失败:', error);
    return false;
  }
}

// 记录今日学习的单词
async function recordTodayWord(word) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = await chrome.storage.sync.get('learningHistory');
    const history = result.learningHistory || {};
    
    if (!history[today]) {
      history[today] = [];
    }
    
    if (!history[today].includes(word)) {
      history[today].push(word);
      await chrome.storage.sync.set({ learningHistory: history });
    }
  } catch (error) {
    console.error('记录今日单词失败:', error);
  }
}

// 更新学习连续天数
async function updateLearningStreak() {
  try {
    const result = await chrome.storage.sync.get(['learningHistory', 'streak']);
    const history = result.learningHistory || {};
    const today = new Date().toISOString().split('T')[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    let streak = result.streak || { count: 0, lastDay: null };
    
    if (history[today]?.length > 0) {
      if (streak.lastDay === yesterday) {
        streak.count++;
      } else if (streak.lastDay !== today) {
        streak.count = 1;
      }
      streak.lastDay = today;
      await chrome.storage.sync.set({ streak });
    }
  } catch (error) {
    console.error('更新学习连续天数失败:', error);
  }
}

// 移动单词（在认识和不认识列表之间）
async function moveWord(word, fromType, toType) {
  try {
    const result = await chrome.storage.sync.get('vocabulary');
    const vocabulary = result.vocabulary || { known: {}, unknown: {} };
    
    if (vocabulary[fromType][word]) {
      vocabulary[toType][word] = vocabulary[fromType][word];
      delete vocabulary[fromType][word];
      await chrome.storage.sync.set({ vocabulary });
      return true;
    }
    return false;
  } catch (error) {
    console.error('移动单词失败:', error);
    return false;
  }
} 