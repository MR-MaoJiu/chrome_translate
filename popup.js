// 获取生词本数据并显示
async function displayVocabulary() {
  const vocabularyList = document.getElementById('vocabularyList');
  const result = await chrome.storage.sync.get('vocabulary');
  const vocabulary = result.vocabulary || {};

  vocabularyList.innerHTML = '';
  
  Object.entries(vocabulary).forEach(([word, translation]) => {
    const wordItem = document.createElement('div');
    wordItem.className = 'word-item';
    wordItem.innerHTML = `
      <div class="word">${word}</div>
      <div class="translation">${translation}</div>
    `;
    vocabularyList.appendChild(wordItem);
  });
}

// 初始化显示
document.addEventListener('DOMContentLoaded', displayVocabulary);

// 监听存储变化
chrome.storage.onChanged.addListener((changes) => {
  if (changes.vocabulary) {
    displayVocabulary();
  }
}); 