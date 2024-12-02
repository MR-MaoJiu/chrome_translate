// 保存单词到生词本
const saveToVocabulary = async (word, translation) => {
  const vocabulary = await getVocabulary();
  vocabulary[word.toLowerCase()] = translation;
  
  await chrome.storage.sync.set({ vocabulary });
};

// 获取生词本
const getVocabulary = async () => {
  const result = await chrome.storage.sync.get('vocabulary');
  return result.vocabulary || {};
};

// 检查单词是否存在于生词本
const isWordKnown = async (word) => {
  const vocabulary = await getVocabulary();
  return !!vocabulary[word.toLowerCase()];
}; 