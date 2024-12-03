let words = [];
let currentIndex = 0;
let currentMode = 'flashcard';
let correctCount = 0;
let spellingAttempts = 0;
const MAX_ATTEMPTS = 3;

// 初始化复习数据
async function initReview() {
  try {
    // 获取生词本数据
    const vocabulary = await getVocabulary();
    words = Object.entries(vocabulary.unknown);
    
    // 随机打乱单词顺序
    words.sort(() => Math.random() - 0.5);
    
    // 更新统计和显示第一个单词
    await updateStats();
    await showCurrentWord();
  } catch (error) {
    console.error('初始化复习失败:', error);
  }
}

// 显示当前单词
async function showCurrentWord() {
  if (currentIndex >= words.length) {
    showComplete();
    return;
  }

  const [word, translation] = words[currentIndex];
  const settings = await getSettings();

  switch (currentMode) {
    case 'flashcard':
      // 闪卡模式：显示单词，根据设置显示音标，点击显示释义
      document.getElementById('currentWord').textContent = word;
      document.getElementById('meaningText').textContent = translation;
      document.getElementById('meaningText').classList.add('hidden');
      document.getElementById('phoneticText').textContent = '';
      
      // 根据设置显示音标
      if (settings.showPhonetic) {
        const response = await translateWord(word);
        if (response.phonetic) {
          document.getElementById('phoneticText').textContent = `/${response.phonetic}/`;
          document.getElementById('phoneticText').style.display = 'block';
        }
      } else {
        document.getElementById('phoneticText').style.display = 'none';
      }

      // 根据设置自动朗读
      if (settings.autoSpeak) {
        setTimeout(() => playWordAudio(word), 500);
      }
      break;

    case 'spelling':
      // 拼写模式：只显示释义，用户输入单词
      document.getElementById('spellingMeaning').textContent = translation;
      const spellingInput = document.querySelector('#spellingMode input');
      spellingInput.value = '';
      spellingInput.placeholder = '请输入单词...';
      document.querySelector('.spelling-hint').textContent = '';
      spellingInput.focus();
      break;

    case 'listening':
      // 听写模式：自动播放音频，用户输入听到的单词
      const listeningInput = document.querySelector('#listeningMode input');
      listeningInput.value = '';
      listeningInput.placeholder = '请输入听到的单词...';
      listeningInput.focus();
      // 延迟播放音频，确保UI已更新
      setTimeout(() => playWordAudio(word), 800);
      break;
  }
}

// 播放单词音频
async function playWordAudio(word) {
  try {
    const settings = await getSettings();
    const type = settings.pronunciationType || '0'; // 根据设置选择美音或英音
    const audioUrl = `https://dict.youdao.com/dictvoice?type=${type}&audio=${encodeURIComponent(word)}`;
    
    if (!window.wordAudio) {
      window.wordAudio = new Audio();
    }
    
    window.wordAudio.src = audioUrl;
    await window.wordAudio.play();
  } catch (error) {
    console.error('播放发音失败:', error);
  }
}

// 检查拼写
function checkSpelling(input) {
  const currentWord = words[currentIndex][0].toLowerCase();
  const userInput = input.toLowerCase().trim();
  
  if (userInput === currentWord) {
    showFeedback(true, '正确！');
    correctCount++;
    return true;
  } else {
    showFeedback(false, '再试一次！');
    spellingAttempts++;
    if (spellingAttempts >= MAX_ATTEMPTS) {
      showSpellingHint(currentWord);
    }
    return false;
  }
}

// 显示反馈
function showFeedback(isCorrect, message) {
  const feedback = document.createElement('div');
  feedback.className = `feedback ${isCorrect ? 'correct' : 'incorrect'} show`;
  feedback.textContent = message;
  
  const currentMode = document.querySelector('.review-card[style*="block"]');
  currentMode.appendChild(feedback);
  
  setTimeout(() => feedback.remove(), 2000);
}

// 显示拼写提示
function showSpellingHint(word) {
  const hint = word.split('').map(char => '_').join(' ');
  document.querySelector('.spelling-hint').textContent = hint;
}

// 切换复习模式
function switchMode(mode) {
  currentMode = mode;
  
  // 隐藏所有模式
  document.getElementById('flashcardMode').style.display = 'none';
  document.getElementById('spellingMode').style.display = 'none';
  document.getElementById('listeningMode').style.display = 'none';
  
  // 显示选中的模式
  document.getElementById(`${mode}Mode`).style.display = 'block';
  
  // 更新按钮状态
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  
  // 重新显示当前单词
  showCurrentWord();
}

// 下一个单词
async function nextWord() {
  currentIndex++;
  spellingAttempts = 0;
  await onWordReviewed(words[currentIndex - 1][0]);
  showCurrentWord();
}

// 更新统计数据
async function updateStats() {
  try {
    // 获取设置中的每日目标
    const settings = await getSettings();
    const dailyGoal = settings.dailyGoal || 20;

    // 获取生词本数据
    const vocabulary = await getVocabulary();
    const unknownCount = Object.keys(vocabulary.unknown).length;

    // 获取今日复习记录
    const todayReviewed = await getTodayReviewed();
    
    // 计算进度
    const progress = Math.min((todayReviewed.length / dailyGoal) * 100, 100);

    // 更新UI
    document.getElementById('totalToReview').textContent = unknownCount;
    document.getElementById('reviewedToday').textContent = todayReviewed.length;
    document.getElementById('dailyProgress').textContent = `${Math.round(progress)}%`;
    document.getElementById('progressFill').style.width = `${progress}%`;
  } catch (error) {
    console.error('更新统计数据失败:', error);
  }
}

// 显示完成界面
function showComplete() {
  const accuracy = Math.round((correctCount / words.length) * 100);
  
  const completeHtml = `
    <div class="complete-view">
      <div class="complete-icon">🎉</div>
      <h2>恭喜完成复习！</h2>
      <div class="complete-stats">
        <div class="stat-item">
          <div class="stat-value">${words.length}</div>
          <div class="stat-label">总复习单词</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${correctCount}</div>
          <div class="stat-label">正确数量</div>
        </div>
        <div class="stat-item">
          <div class="stat-value">${accuracy}%</div>
          <div class="stat-label">正确率</div>
        </div>
      </div>
      <button class="control-btn primary" onclick="window.close()">完成</button>
    </div>
  `;

  document.querySelector('.container').innerHTML = completeHtml;
}

// 初始化事件监听
document.addEventListener('DOMContentLoaded', async () => {
  await initReview();
  
  // 模式切换按钮
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => switchMode(btn.dataset.mode));
  });
  
  // 闪卡模式按钮
  document.getElementById('speakBtn').addEventListener('click', () => {
    playWordAudio(words[currentIndex][0]);
  });
  
  document.getElementById('showBtn').addEventListener('click', () => {
    document.getElementById('meaningText').classList.remove('hidden');
  });
  
  document.getElementById('nextBtn').addEventListener('click', nextWord);
  
  // 拼写模式按钮
  document.getElementById('spellingCheckBtn').addEventListener('click', () => {
    const input = document.querySelector('#spellingMode input');
    if (checkSpelling(input.value)) {
      nextWord();
    }
  });
  
  // 听写模式按钮
  document.getElementById('listeningRepeatBtn').addEventListener('click', () => {
    playWordAudio(words[currentIndex][0]);
  });
  
  document.getElementById('listeningCheckBtn').addEventListener('click', () => {
    const input = document.querySelector('#listeningMode input');
    if (checkSpelling(input.value)) {
      nextWord();
    }
  });
  
  // 输入框回车事件
  document.querySelectorAll('input').forEach(input => {
    input.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const checkBtn = input.closest('.review-card').querySelector('.primary');
        checkBtn.click();
      }
    });
  });
}); 