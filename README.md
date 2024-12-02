# 智能单词翻译与学习助手

这是一个Chrome浏览器插件，帮助用户在浏览英文网页时实现以下功能：
- 划词即时翻译
- 自动保存生词到生词本
- 已学习单词自动高亮显示
- 鼠标悬停显示翻译

## 使用方法
1. 在Chrome浏览器中加载此插件
2. 在任意英文网页中选中单词即可看到翻译
3. 翻译过的单词会自动保存到生词本
4. 下次遇到相同单词时会自动高亮显示
5. 将鼠标移到高亮单词上可以看到之前的翻译

## 技术架构
- manifest.json: 插件配置文件
- content.js: 页面内容处理脚本
- background.js: 后台服务脚本
- storage.js: 数据存储管理
- popup.html: 插件弹窗界面
- styles.css: 样式文件

## 数据存储
使用Chrome.storage.sync进行数据同步存储：
- 生词本数据结构
- 用户设置 