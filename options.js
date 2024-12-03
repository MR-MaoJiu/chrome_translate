// 默认设置
const defaultSettings = {
  apiType: 'youdao',
  customApiUrl: '',
  apiKey: '',
  autoSpeak: true,
  showPhonetic: true,
  showExample: true,
  autoBlur: true
};

// 加载设置
async function loadSettings() {
  const result = await chrome.storage.sync.get('settings');
  const settings = result.settings || defaultSettings;
  
  document.getElementById('apiType').value = settings.apiType;
  document.getElementById('customApiUrl').value = settings.customApiUrl;
  document.getElementById('apiKey').value = settings.apiKey;
  document.getElementById('autoSpeak').checked = settings.autoSpeak;
  document.getElementById('showPhonetic').checked = settings.showPhonetic;
  document.getElementById('showExample').checked = settings.showExample;
  document.getElementById('autoBlur').checked = settings.autoBlur;
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
      autoBlur: document.getElementById('autoBlur').checked
    };
    
    await chrome.storage.sync.set({ settings });
    
    // 通知保存成功
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
document.addEventListener('DOMContentLoaded', () => {
  loadSettings();
  
  // API类型切换
  document.getElementById('apiType').addEventListener('change', (e) => {
    document.getElementById('customApiSettings').style.display = 
      e.target.value === 'custom' ? 'block' : 'none';
  });
  
  // 保存按钮
  document.getElementById('saveBtn').addEventListener('click', saveSettings);
});