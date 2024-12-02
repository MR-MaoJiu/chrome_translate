let words = [];
let currentIndex = 0;
let correctCount = 0;
let currentMode = 'flashcard';
let spellingAttempts = 0;
const MAX_ATTEMPTS = 3;

// 添加设置相关变量
let settings = {
  autoSpeak: true,
  showPhonetic: true,
  showExample: true
};

// 初始化设置
async function initSettings() {
  const result = await chrome.storage.sync.get('settings');
  settings = result.settings || {
    autoSpeak: true,
    showPhonetic: true,
    showExample: true
  };
}

// 初始化复习数据
async function initReview() {
  const vocabulary = await getVocabulary();
  words = [...Object.entries(vocabulary.unknown)];
  
  // 随机打乱单词顺序
  words.sort(() => Math.random() - 0.5);
  
  updateProgress();
  showCurrentWord();
}

// 更新进度
function updateProgress() {
  const total = words.length;
  const current = currentIndex;
  const progress = (current / total) * 100;
  
  document.getElementById('currentIndex').textContent = current;
  document.getElementById('totalWords').textContent = total;
  document.getElementById('progressFill').style.width = `${progress}%`;
}

// 获取单词音标和例句
async function getWordDetails(word) {
  try {
    const response = await fetch(`https://dict.youdao.com/jsonapi?q=${word}`);
    const data = await response.json();
    
    let phonetic = '';
    let example = '';
    
    // 获取音标
    if (data.ec?.word?.[0]?.ukphone) {
      phonetic = `/${data.ec.word[0].ukphone}/`;
    }
    
    // 获取例句
    if (data.blng_sents_part?.sentence?.[0]) {
      const sent = data.blng_sents_part.sentence[0];
      example = `${sent.sentence}\n${sent.sentence_translation}`;
    }
    
    return { phonetic, example };
  } catch (error) {
    console.error('获取单词详情失败:', error);
    return { phonetic: '', example: '' };
  }
}

// 显示当前单词
async function showCurrentWord() {
  if (currentIndex >= words.length) {
    showComplete();
    return;
  }
  
  const [word, translation] = words[currentIndex];
  
  // 在听写模式下不显示单词
  if (currentMode !== 'listening') {
    document.getElementById('wordText').textContent = word;
    document.getElementById('meaningText').textContent = translation;
    document.getElementById('meaningText').classList.add('hidden');
    
    // 获取并显示音标和例句
    if (settings.showPhonetic || settings.showExample) {
      const details = await getWordDetails(word);
      
      if (settings.showPhonetic && details.phonetic) {
        document.getElementById('phoneticText').textContent = details.phonetic;
      }
      
      if (settings.showExample && details.example) {
        const exampleDiv = document.createElement('div');
        exampleDiv.className = 'example hidden';
        exampleDiv.textContent = details.example;
        document.getElementById('meaningText').after(exampleDiv);
      }
    }
    
    // 自动朗读
    if (settings.autoSpeak && currentMode !== 'spelling') {
      speakWord();
    }
  }
  
  // 清空输入框和提示
  document.querySelectorAll('input').forEach(input => input.value = '');
  document.querySelectorAll('.spelling-hint').forEach(hint => hint.textContent = '');
  document.querySelectorAll('.result-feedback').forEach(feedback => {
    feedback.textContent = '';
    feedback.classList.remove('show', 'correct', 'incorrect');
  });
}

// 显示完成界面
function showComplete() {
  document.getElementById('reviewCard').style.display = 'none';
  document.getElementById('completeView').style.display = 'block';
  
  const accuracy = Math.round((correctCount / words.length) * 100);
  document.getElementById('reviewedCount').textContent = words.length;
  document.getElementById('accuracyRate').textContent = `${accuracy}%`;
}

// 朗读单词
function speakWord() {
  const word = words[currentIndex][0];
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-US';
  speechSynthesis.speak(utterance);
}

// 显示反馈
function showFeedback(element, isCorrect, message) {
  const feedback = element.querySelector('.result-feedback');
  feedback.textContent = message;
  feedback.className = `result-feedback ${isCorrect ? 'correct' : 'incorrect'} show`;
  
  setTimeout(() => {
    feedback.classList.remove('show');
  }, 2000);
}

// 切换复习模式
function switchMode(mode) {
  currentMode = mode;
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  
  // 隐藏所有模式相关元素
  document.getElementById('flashcardButtons').style.display = 'none';
  document.getElementById('spellingInput').style.display = 'none';
  document.getElementById('listeningMode').style.display = 'none';
  document.getElementById('wordSection').style.display = 'block';
  
  // 显示当前模式元素
  switch (mode) {
    case 'flashcard':
      document.getElementById('flashcardButtons').style.display = 'flex';
      break;
    case 'spelling':
      document.getElementById('spellingInput').style.display = 'block';
      document.getElementById('spellingInput').querySelector('input').focus();
      break;
    case 'listening':
      document.getElementById('listeningMode').style.display = 'block';
      document.getElementById('wordSection').style.display = 'none';
      document.getElementById('listeningMode').querySelector('input').focus();
      speakWord();
      break;
  }
  
  showCurrentWord();
}

// 检查拼写
function checkSpelling(input, element) {
  const currentWord = words[currentIndex][0].toLowerCase();
  const userInput = input.toLowerCase();
  
  if (userInput === currentWord) {
    showFeedback(element, true, '正确！');
    return true;
  } else {
    const input = element.querySelector('input');
    input.classList.add('shake');
    setTimeout(() => input.classList.remove('shake'), 300);
    
    spellingAttempts++;
    if (spellingAttempts >= MAX_ATTEMPTS) {
      showSpellingHint(currentWord);
    }
    showFeedback(element, false, '再试一次！');
    return false;
  }
}

// 显示拼写提示
function showSpellingHint(word) {
  const hint = word.split('').map(char => '_').join(' ');
  document.querySelector('.spelling-hint').textContent = hint;
}

// 下一个单词
async function nextWord() {
  const currentWord = words[currentIndex][0];
  correctCount++;
  await recordReviewedWord(currentWord);
  currentIndex++;
  spellingAttempts = 0;
  
  // 清空输入框和提示
  document.querySelectorAll('input').forEach(input => input.value = '');
  document.querySelectorAll('.spelling-hint').forEach(hint => hint.textContent = '');
  document.querySelectorAll('.result-feedback').forEach(feedback => feedback.classList.remove('show'));
  
  updateProgress();
  showCurrentWord();
}

// 初始化事件监听
document.addEventListener('DOMContentLoaded', async () => {
  await initSettings();
  await initReview();
  
  // 添加关闭按钮事件
  document.getElementById('closeBtn').addEventListener('click', () => {
    window.close();
  });
  
  // 模式切换
  document.querySelectorAll('.mode-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      if (!btn.classList.contains('active')) {
        switchMode(btn.dataset.mode);
      }
    });
  });
  
  // 闪卡模式按钮
  document.getElementById('showBtn').addEventListener('click', () => {
    document.getElementById('meaningText').classList.remove('hidden');
    document.querySelector('.example')?.classList.remove('hidden');
  });
  
  document.getElementById('nextBtn').addEventListener('click', nextWord);
  
  // 朗读按钮
  document.querySelectorAll('.btn-speak').forEach(btn => {
    btn.addEventListener('click', speakWord);
  });
  
  // 拼写模式输入
  const spellingInput = document.querySelector('#spellingInput input');
  spellingInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      if (checkSpelling(spellingInput.value, document.getElementById('spellingInput'))) {
        nextWord();
      }
    }
  });
  
  // 听写模式输入
  const listeningInput = document.querySelector('#listeningMode input');
  listeningInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      if (checkSpelling(listeningInput.value, document.getElementById('listeningMode'))) {
        nextWord();
      }
    }
  });
}); 