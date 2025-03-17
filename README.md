# OpenAnswer - 智能解题助手

<div align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="License: MIT">
  <img src="https://img.shields.io/badge/node-%3E%3D%2014.0.0-brightgreen.svg" alt="Node: >=14.0.0">
  <img src="https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg" alt="Platform: Windows | macOS | Linux">
</div>

<p align="center">
  <img src="docs/images/logo.png" alt="OpenAnswer Logo" width="200">
</p>

OpenAnswer 是一个基于大语言模型的智能解题助手，可以通过屏幕捕获实时识别题目并给出解答。它使用OCR技术识别屏幕上的文字，然后利用大语言模型生成高质量的答案。

## ✨ 功能特点

- 🖥️ **实时屏幕捕获**：捕获屏幕上的题目，无需手动输入
- 🔍 **智能OCR识别**：支持本地OCR和百度云OCR，准确识别中英文文本
- 🧠 **强大的LLM支持**：支持多种大语言模型，包括SiliconFlow和DeepSeek
- 🌐 **多语言支持**：支持中文和英文题目的识别和解答
- 🚀 **高效响应**：快速处理和生成答案，提升学习效率
- 🎨 **现代化UI**：简洁直观的用户界面，提供良好的用户体验

## 🚀 快速开始

### 小白用户一键启动（推荐）

我们为没有编程经验的用户提供了简单的一键启动脚本：

- **Windows 用户**：双击 `start.bat` 文件
- **macOS/Linux 用户**：双击 `start.sh` 文件或在终端中运行

详细说明请参考 [小白用户快速入门指南](docs/QUICKSTART.md)。

### 手动安装与启动

1. 克隆仓库
```bash
git clone https://github.com/yourusername/openanswer.git
cd openanswer
```

2. 安装依赖
```bash
npm install
```

3. 配置环境变量
```bash
cp .env.example .env
```
编辑 `.env` 文件，填入你的API密钥和其他配置。

4. 启动服务
```bash
npm start
```

## 📝 使用方法

1. 启动应用后，在浏览器中访问 `http://localhost:3000`
2. 点击屏幕捕获区域，选择要共享的窗口（通常是显示题目的窗口）
3. 系统会自动识别屏幕上的文字，并在右侧显示识别结果
4. 识别到新题目后，系统会自动调用LLM生成答案
5. 答案会显示在右侧的"智能回答"区域

## 📋 系统要求

- Node.js >= 14.0.0
- 现代浏览器 (Chrome, Firefox, Edge, Safari)
- 网络连接 (用于API调用)

## ⚙️ 配置选项

详细配置选项请参考 [.env.example](.env.example) 文件，主要配置项包括：

- **LLM配置**：选择使用的大语言模型及相关API密钥
- **OCR配置**：选择文字识别方式及相关配置
- **系统配置**：调整OCR识别间隔、图像质量等参数
- **调试配置**：启用/禁用调试日志和调试信息

## 🛠️ 技术栈

- 前端：原生JavaScript、HTML5、CSS3
- 后端：Node.js、Express
- OCR：Tesseract.js (本地)、百度OCR API (云端)
- LLM：SiliconFlow API、DeepSeek API

## 📚 文档

- [使用指南](docs/USAGE.md)
- [系统架构](docs/ARCHITECTURE.md)
- [API文档](docs/API.md)
- [部署指南](docs/DEPLOYMENT.md)
- [故障排除](docs/TROUBLESHOOTING.md)
- [贡献指南](docs/CONTRIBUTING.md)
- [变更日志](docs/CHANGELOG.md)

## 🤝 贡献指南

欢迎贡献代码、报告问题或提出新功能建议！请遵循以下步骤：

1. Fork 本仓库
2. 创建你的特性分支 (`git checkout -b feature/amazing-feature`)
3. 提交你的更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启一个 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详情请参阅 [LICENSE](LICENSE) 文件。

## 📞 联系方式

如有任何问题或建议，请通过以下方式联系我们：

- 项目主页：[GitHub](https://github.com/yourusername/openanswer)
- 电子邮件：your.email@example.com

---

<div align="center">
  <sub>Built with ❤️ by Your Name</sub>
</div> 