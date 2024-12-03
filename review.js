let words = [];
let currentIndex = 0;
let currentMode = 'flashcard';
let correctCount = 0;
let spellingAttempts = 0;
const MAX_ATTEMPTS = 3;

// 初始化复习数据
async function initReview() {
  try {
    console.log('开始初始化复习数据');
    // 获取生词本数据
    const vocabulary = await getVocabulary();
    console.log('获取到生词本数据:', vocabulary);
    
    if (!vocabulary || !vocabulary.unknown) {
      throw new Error('生词本数据无效');
    }

    words = Object.entries(vocabulary.unknown);
    console.log('待复习单词数量:', words.length);
    
    if (words.length === 0) {
      document.querySelector('.container').innerHTML = `
        <div class="complete-view">
          <div class="complete-icon"></div>
          <h2>太棒了！</h2>
          <p>当前没有需要复习的单词</p>
          <button class="control-btn primary" onclick="window.close()">关闭</button>
        </div>
      `;
      return;
    }
    
    // 随机打乱单词顺序
    words.sort(() => Math.random() - 0.5);
    
    // 更新统计
    await updateStats();
    // 显示第一个单词
    await showCurrentWord();
  } catch (error) {
    console.error('初始化复习失败:', error);
    document.querySelector('.container').innerHTML = `
      <div class="error-view">
        <div class="error-icon">❌</div>
        <h2>初始化失败</h2>
        <p>${error.message}</p>
        <button class="control-btn primary" onclick="window.close()">关闭</button>
      </div>
    `;
  }
}

// 更新统计数据
async function updateStats() {
  try {
    const settings = await getSettings();
    const dailyGoal = settings.dailyGoal || 20;
    const todayReviewed = await getTodayReviewed();
    const progress = Math.min((todayReviewed.length / dailyGoal) * 100, 100);

    document.getElementById('totalToReview').textContent = words.length;
    document.getElementById('reviewedToday').textContent = todayReviewed.length;
    document.getElementById('dailyProgress').textContent = `${Math.round(progress)}%`;
    document.getElementById('progressFill').style.width = `${progress}%`;
  } catch (error) {
    console.error('更新统计失败:', error);
  }
}

// 显示当前单词
async function showCurrentWord() {
  try {
    if (currentIndex >= words.length) {
      showComplete();
      return;
    }

    const [word, translation] = words[currentIndex];
    console.log('显示单词:', word, translation);

    switch (currentMode) {
      case 'flashcard':
        // 闪卡模式：显示单词，获取音标和发音
        document.getElementById('currentWord').textContent = word;
        document.getElementById('meaningText').textContent = translation;
        document.getElementById('meaningText').classList.add('hidden');

        try {
          // 获取翻译数据（包含音标）
          const response = await chrome.runtime.sendMessage({
            action: 'translate',
            word: word
          });

          console.log('翻译响应:', response);

          if (response && !response.error) {
            const settings = await getSettings();
            // 显示音标
            if (settings.showPhonetic && response.phonetic) {
              document.getElementById('phoneticText').textContent = `/${response.phonetic}/`;
              document.getElementById('phoneticText').style.display = 'block';
            } else {
              document.getElementById('phoneticText').style.display = 'none';
            }

            // 自动朗读
            if (settings.autoSpeak) {
              await playWordAudio(word);
            }
          }
        } catch (error) {
          console.error('获取翻译数据失败:', error);
        }
        break;

      case 'spelling':
        // 拼写模式：只显示释义
        document.getElementById('spellingMeaning').textContent = translation;
        document.querySelector('#spellingMode input').value = '';
        document.querySelector('.spelling-hint').textContent = '';
        break;

      case 'listening':
        // 听写模式：清空输入框并播放音频
        document.querySelector('#listeningMode input').value = '';
        await playWordAudio(word);
        break;
    }
  } catch (error) {
    console.error('显示单词失败:', error);
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

// 播放单词音频
async function playWordAudio(word) {
  try {
    const settings = await getSettings();
    const type = settings.pronunciationType || '0'; // 0美音，1英音
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
  await recordReviewedWord(words[currentIndex - 1][0]);
  await updateStats();
  showCurrentWord();
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