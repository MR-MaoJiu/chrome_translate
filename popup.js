let currentTab = 'unknown';
let dailyGoal = 20; // 每日目标单词数
let learningStreak = 0; // 连续学习天数

// 更新统计数据
async function updateStats() {
  try {
    // 获取设置中的每日目标
    const settings = await getSettings();
    const dailyGoal = settings.dailyGoal || 20;

    // 获取生词本数据
    const vocabulary = await getVocabulary();
    const unknownCount = Object.keys(vocabulary.unknown || {}).length;

    // 获取今日已复习单词
    const todayReviewed = await getTodayReviewed();
    const reviewedCount = todayReviewed.length;

    // 计算进度
    const progress = Math.min((reviewedCount / dailyGoal) * 100, 100);

    // 更新UI
    document.getElementById('totalToReview').textContent = unknownCount;
    document.getElementById('reviewedToday').textContent = reviewedCount;
    document.getElementById('dailyProgress').textContent = `${Math.round(progress)}%`;
    document.getElementById('progressFill').style.width = `${progress}%`;

    // 更新标签数量
    document.getElementById('knownCount').textContent = Object.keys(vocabulary.known || {}).length;
    document.getElementById('unknownCount').textContent = unknownCount;
  } catch (error) {
    console.error('更新统计失败:', error);
  }
}

// 获取设置
async function getSettings() {
  const result = await chrome.storage.sync.get('settings');
  return result.settings || { dailyGoal: 20 };
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

// 打开复习模式
function startReview() {
  chrome.tabs.create({
    url: chrome.runtime.getURL('review.html')
  });
}

// 打开设置页面
function openSettings() {
  chrome.runtime.openOptionsPage();
}

// 获取生词本数据并显示
async function displayVocabulary() {
  const vocabularyList = document.getElementById('vocabularyList');
  const result = await chrome.storage.sync.get('vocabulary');
  const vocabulary = result.vocabulary || { known: {}, unknown: {} };

  // 更新计数器
  document.getElementById('knownCount').textContent = Object.keys(vocabulary.known).length;
  document.getElementById('unknownCount').textContent = Object.keys(vocabulary.unknown).length;

  vocabularyList.innerHTML = '';
  
  const currentWords = vocabulary[currentTab];
  const targetType = currentTab === 'known' ? 'unknown' : 'known';
  const buttonText = currentTab === 'known' ? '标记为不认识' : '标记为已认识';
  
  // 检查是否有单词
  if (Object.keys(currentWords).length === 0) {
    vocabularyList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">
          ${currentTab === 'known' ? '🎯' : '📚'}
        </div>
        <div class="empty-state-text">
          ${currentTab === 'known' ? 
            '还没有已掌握的单词<br>继续加油学习吧！' : 
            '还没有收录新的单词<br>遇到不认识的单词就选中它'}
        </div>
      </div>
    `;
    return;
  }
  
  Object.entries(currentWords).forEach(([word, translation]) => {
    const wordItem = document.createElement('div');
    wordItem.className = `word-item ${currentTab}`;
    wordItem.innerHTML = `
      <div class="word-content">
        <div class="word">${word}</div>
        <div class="translation">${translation}</div>
      </div>
      <button class="move-btn" data-word="${word}">${buttonText}</button>
    `;
    vocabularyList.appendChild(wordItem);
  });

  // 添加移动按钮事件监听
  document.querySelectorAll('.move-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const word = e.target.dataset.word;
      const wordItem = e.target.closest('.word-item');
      
      // 添加过渡动画
      wordItem.style.transform = 'translateX(100%)';
      wordItem.style.opacity = '0';
      
      // 等待动画完成后移动单词
      setTimeout(async () => {
        await moveWord(word, currentTab, targetType);
        displayVocabulary();
      }, 300);
    });
  });

  // 添加每日目标标记
  if (currentTab === 'unknown' && todayCount >= dailyGoal) {
    const dailyGoalBadge = document.createElement('div');
    dailyGoalBadge.className = 'daily-goal';
    dailyGoalBadge.textContent = '今日目标已达成 🎉';
    vocabularyList.appendChild(dailyGoalBadge);
  }

  // 更新统计
  await updateStats();
}

// 初始化显示和事件监听
document.addEventListener('DOMContentLoaded', () => {
  displayVocabulary();
  
  // 绑定按钮事件
  document.getElementById('reviewBtn').addEventListener('click', startReview);
  document.getElementById('settingsBtn').addEventListener('click', openSettings);
  
  // Tab切换事件
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      if (e.target.classList.contains('active')) return;
      
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      currentTab = e.target.dataset.tab;
      
      // 添加过渡动画
      const list = document.getElementById('vocabularyList');
      list.style.opacity = '0';
      
      setTimeout(() => {
        displayVocabulary();
        list.style.opacity = '1';
      }, 200);
    });
  });
});

// 监听存储变化
chrome.storage.onChanged.addListener((changes) => {
  if (changes.vocabulary) {
    displayVocabulary();
    updateProgress();
  }
});

// 更新进度条和成就
async function updateProgress() {
  const vocabulary = await getVocabulary();
  const knownCount = Object.keys(vocabulary.known).length;
  const unknownCount = Object.keys(vocabulary.unknown).length;
  const totalCount = knownCount + unknownCount;
  
  // 获取今日新学单词数
  const today = new Date().toDateString();
  const todayWords = await getTodayWords();
  const todayCount = todayWords.length;
  
  // 更新进度条
  const progress = Math.min((todayCount / dailyGoal) * 100, 100);
  document.getElementById('progressFill').style.width = `${progress}%`;
  document.getElementById('todayCount').textContent = todayCount;
  document.getElementById('dailyGoal').textContent = dailyGoal;
  
  // 更新成就
  document.getElementById('streak').querySelector('.achievement-value').textContent = `${learningStreak}天`;
  document.getElementById('total').querySelector('.achievement-value').textContent = totalCount;
  
  const masteryRate = totalCount > 0 ? Math.round((knownCount / totalCount) * 100) : 0;
  document.getElementById('mastery').querySelector('.achievement-value').textContent = `${masteryRate}%`;
  
  // 根据达成情况添加高亮
  if (learningStreak >= 7) document.getElementById('streak').classList.add('active');
  if (totalCount >= 100) document.getElementById('total').classList.add('active');
  if (masteryRate >= 80) document.getElementById('mastery').classList.add('active');
}

// 初始化
document.addEventListener('DOMContentLoaded', async () => {
  await updateStats();
});

// 监听存储变化
chrome.storage.onChanged.addListener((changes, namespace) => {
  if (namespace === 'sync' && (changes.vocabulary || changes.reviewHistory)) {
    updateStats();
  }
}); 