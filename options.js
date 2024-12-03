// 默认设置
const defaultSettings = {
  apiType: 'youdao',
  customApiUrl: '',
  apiKey: '',
  autoSpeak: true,
  showPhonetic: true,
  showExample: true,
  autoBlur: true,
  pronunciationType: '0'
};

// 加载设置
async function loadSettings() {
  try {
    const result = await chrome.storage.sync.get('settings');
    const settings = { ...defaultSettings, ...result.settings };
    
    // 更新UI
    document.getElementById('apiType').value = settings.apiType;
    document.getElementById('customApiUrl').value = settings.customApiUrl;
    document.getElementById('apiKey').value = settings.apiKey;
    document.getElementById('autoSpeak').checked = settings.autoSpeak;
    document.getElementById('showPhonetic').checked = settings.showPhonetic;
    document.getElementById('showExample').checked = settings.showExample;
    document.getElementById('autoBlur').checked = settings.autoBlur;
    document.getElementById('dailyGoal').value = settings.dailyGoal;
    document.getElementById('enableReview').checked = settings.enableReview;
    document.getElementById('pronunciationType').value = settings.pronunciationType;
    
    // 显示/隐藏自定义API设置
    document.getElementById('customApiSettings').style.display = 
      settings.apiType === 'custom' ? 'block' : 'none';
      
    return settings;
  } catch (error) {
    console.error('加载设置失败:', error);
    return defaultSettings;
  }
}

// 保存设置
async function saveSettings() {
  try {
    const settings = {
      apiType: document.getElementById('apiType').value,
      customApiUrl: document.getElementById('customApiUrl').value,
      apiKey: document.getElementById('apiKey').value,
      autoSpeak: document.getElementById('autoSpeak').checked,
      showPhonetic: document.getElementById('showPhonetic').checked,
      showExample: document.getElementById('showExample').checked,
      autoBlur: document.getElementById('autoBlur').checked,
      dailyGoal: parseInt(document.getElementById('dailyGoal').value) || 20,
      enableReview: document.getElementById('enableReview').checked,
      pronunciationType: document.getElementById('pronunciationType').value
    };
    
    // 保存到 chrome.storage.sync
    await chrome.storage.sync.set({ settings });
    
    // 通知所有标签页设置已更新
    const tabs = await chrome.tabs.query({});
    tabs.forEach(tab => {
      chrome.tabs.sendMessage(tab.id, { type: 'settingsUpdated', settings })
        .catch(error => console.log('Tab not ready:', tab.id));
    });
    
    showNotification();
  } catch (error) {
    console.error('保存设置失败:', error);
  }
}

// 显示保存成功提示
function showNotification() {
  const notification = document.getElementById('notification');
  notification.classList.add('show');
  setTimeout(() => {
    notification.classList.remove('show');
  }, 2000);
}

// 初始化事件监听
document.addEventListener('DOMContentLoaded', async () => {
  // 加载设置
  await loadSettings();
  
  // API类型切换
  document.getElementById('apiType').addEventListener('change', (e) => {
    document.getElementById('customApiSettings').style.display = 
      e.target.value === 'custom' ? 'block' : 'none';
  });
  
  // 所有设置项的变更监听
  const settingInputs = document.querySelectorAll('input, select');
  settingInputs.forEach(input => {
    input.addEventListener('change', saveSettings);
  });
  
  // 保存按钮
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
});