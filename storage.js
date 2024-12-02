// 保存单词到生词本
const saveToVocabulary = async (word, translation) => {
  const vocabulary = await getVocabulary();
  vocabulary.unknown[word.toLowerCase()] = translation;
  
  await chrome.storage.sync.set({ vocabulary });
};

// 获取生词本
const getVocabulary = async () => {
  const result = await chrome.storage.sync.get('vocabulary');
  return result.vocabulary || { known: {}, unknown: {} };
};

// 检查单词是否存在于生词本
const isWordKnown = async (word) => {
  const vocabulary = await getVocabulary();
  const lowercaseWord = word.toLowerCase();
  return !!(vocabulary.known[lowercaseWord] || vocabulary.unknown[lowercaseWord]);
};

// 将单词在已认识和未认识之间移动
const moveWord = async (word, fromType, toType) => {
  const vocabulary = await getVocabulary();
  const translation = vocabulary[fromType][word];
  
  delete vocabulary[fromType][word];
  vocabulary[toType][word] = translation;
  
  await chrome.storage.sync.set({ vocabulary });
};

// 获取今日学习的单词
async function getTodayWords() {
  const today = new Date().toDateString();
  const result = await chrome.storage.sync.get(['dailyProgress', 'lastActiveDate']);
  
  // 检查是否需要重置每日进度
  if (result.lastActiveDate !== today) {
    await chrome.storage.sync.set({
      lastActiveDate: today,
      dailyProgress: []
    });
    return [];
  }
  
  return result.dailyProgress || [];
}

// 记录今日新学单词
async function recordTodayWord(word) {
  const todayWords = await getTodayWords();
  if (!todayWords.includes(word)) {
    todayWords.push(word);
    await chrome.storage.sync.set({ dailyProgress: todayWords });
  }
}

// 更新连续学习天数
async function updateLearningStreak() {
  const today = new Date().toDateString();
  const result = await chrome.storage.sync.get(['lastActiveDate', 'learningStreak']);
  
  const lastDate = new Date(result.lastActiveDate);
  const currentDate = new Date(today);
  const dayDiff = Math.floor((currentDate - lastDate) / (1000 * 60 * 60 * 24));
  
  let streak = result.learningStreak || 0;
  
  if (dayDiff === 1) {
    streak++;
  } else if (dayDiff > 1) {
    streak = 1;
  }
  
  await chrome.storage.sync.set({
    lastActiveDate: today,
    learningStreak: streak
  });
  
  return streak;
}

// 获取今日复习记录
async function getTodayReviewed() {
  const today = new Date().toDateString();
  const result = await chrome.storage.sync.get(['reviewProgress', 'lastReviewDate']);
  
  // 检查是否需要重置每日进度
  if (result.lastReviewDate !== today) {
    await chrome.storage.sync.set({
      lastReviewDate: today,
      reviewProgress: []
    });
    return [];
  }
  
  return result.reviewProgress || [];
}

// 记录复习单词
async function recordReviewedWord(word) {
  const todayReviewed = await getTodayReviewed();
  if (!todayReviewed.includes(word)) {
    todayReviewed.push(word);
    await chrome.storage.sync.set({ reviewProgress: todayReviewed });
  }
} 