let currentTab = 'unknown';

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
      await moveWord(word, currentTab, targetType);
      displayVocabulary();
    });
  });
}

// 初始化显示和事件监听
document.addEventListener('DOMContentLoaded', () => {
  displayVocabulary();
  
  // Tab切换事件
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      e.target.classList.add('active');
      currentTab = e.target.dataset.tab;
      displayVocabulary();
    });
  });
});

// 监听存储变化
chrome.storage.onChanged.addListener((changes) => {
  if (changes.vocabulary) {
    displayVocabulary();
  }
}); 