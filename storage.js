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