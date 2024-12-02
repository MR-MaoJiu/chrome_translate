// 复习提醒时间间隔（基于艾宾浩斯遗忘曲线）
const REVIEW_INTERVALS = [
  5 * 60 * 1000,        // 5分钟
  30 * 60 * 1000,       // 30分钟
  12 * 60 * 60 * 1000,  // 12小时
  24 * 60 * 60 * 1000,  // 1天
  2 * 24 * 60 * 60 * 1000,  // 2天
  4 * 24 * 60 * 60 * 1000,  // 4天
  7 * 24 * 60 * 60 * 1000   // 7天
];

// 检查是否需要复习
async function checkReviewNotification() {
  const settings = await getSettings();
  if (!settings.enableReview) return;

  const vocabulary = await getVocabulary();
  const now = Date.now();
  let needReview = false;
  let reviewCount = 0;

  // 检查每个单词的复习时间
  for (const word of Object.keys(vocabulary.unknown)) {
    const wordData = await chrome.storage.sync.get(`review_${word}`);
    const reviewTimes = wordData[`review_${word}`]?.times || 0;
    const lastReview = wordData[`review_${word}`]?.lastReview || 0;

    if (reviewTimes < REVIEW_INTERVALS.length) {
      const interval = REVIEW_INTERVALS[reviewTimes];
      if (now - lastReview >= interval) {
        needReview = true;
        reviewCount++;
      }
    }
  }

  if (needReview) {
    showReviewNotification(reviewCount);
  }
}

// 显示复习提醒
function showReviewNotification(count) {
  chrome.notifications.create({
    type: 'basic',
    iconUrl: 'images/icon128.png',
    title: '单词复习提醒',
    message: `你有 ${count} 个单词需要复习啦！`,
    buttons: [
      { title: '开始复习' },
      { title: '稍后提醒' }
    ],
    requireInteraction: true
  });
}

// 更新单词复习记录
async function updateWordReview(word) {
  const key = `review_${word}`;
  const data = await chrome.storage.sync.get(key);
  const reviewData = data[key] || { times: 0, lastReview: 0 };

  reviewData.times++;
  reviewData.lastReview = Date.now();

  await chrome.storage.sync.set({ [key]: reviewData });
}

// 初始化提醒检查
chrome.alarms.create('checkReview', {
  periodInMinutes: 5 // 每5分钟检查一次
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === 'checkReview') {
    checkReviewNotification();
  }
});

// 处理通知按钮点击
chrome.notifications.onButtonClicked.addListener((notificationId, buttonIndex) => {
  if (buttonIndex === 0) {
    // 开始复习
    chrome.tabs.create({
      url: chrome.runtime.getURL('review.html')
    });
  } else {
    // 稍后提醒（30分钟后）
    chrome.alarms.create('remindLater', {
      delayInMinutes: 30
    });
  }
}); 