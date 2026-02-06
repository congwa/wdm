#!/bin/bash

# Gitee Release 创建辅助脚本
# 由于 Gitee API 限制，此脚本主要提供准备工作和指导

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# 检查构建文件
check_build_files() {
    print_info "检查构建文件..."
    
    local dmg_file="src-tauri/target/release/bundle/dmg/Windsurf Data Manager_0.1.0_x64.dmg"
    
    if [ -f "$dmg_file" ]; then
        local file_size=$(ls -lh "$dmg_file" | awk '{print $5}')
        print_success "DMG 文件已找到: $dmg_file ($file_size)"
        return 0
    else
        print_error "DMG 文件未找到: $dmg_file"
        print_info "请先运行: npm run tauri:build"
        return 1
    fi
}

# 检查 Git 标签
check_git_tag() {
    print_info "检查 Git 标签..."
    
    if git rev-parse v0.1.0 >/dev/null 2>&1; then
        print_success "标签 v0.1.0 已存在"
        
        # 检查标签是否已推送到 Gitee
        if git ls-remote --tags gitee | grep -q "v0.1.0"; then
            print_success "标签 v0.1.0 已推送到 Gitee"
        else
            print_warning "标签 v0.1.0 未推送到 Gitee"
            print_info "推送标签到 Gitee..."
            git push gitee v0.1.0
            print_success "标签已推送到 Gitee"
        fi
    else
        print_warning "标签 v0.1.0 不存在"
        print_info "创建标签..."
        git tag v0.1.0 -m "v0.1.0: Windsurf Data Manager 首个版本

🎯 核心功能
- 💬 AI 对话暂停反馈：智能控制对话流程，Token 监控
- 🧹 智能存储清理：安全清理vs深度清理，预估释放空间
- 📊 数据分析管理：仪表盘概览，使用统计分析

🚀 技术特性
- Tauri + React + TypeScript 跨平台桌面应用
- 现代化 UI 设计，TailwindCSS 样式
- Rust 后端高性能处理
- 完整的项目文档和配置"
        
        print_info "推送标签到 Gitee..."
        git push gitee v0.1.0
        print_success "标签已创建并推送到 Gitee"
    fi
}

# 生成 Release 说明
generate_release_notes() {
    local notes_file="RELEASE_NOTES.md"
    
    print_info "生成 Release 说明..."
    
    cat > "$notes_file" << 'EOF'
# 🎯 Windsurf Data Manager v0.1.0

首个正式版本发布！专为 Windsurf AI 开发环境打造的智能数据管理工具。

## ✨ 核心功能

### 💬 AI 对话暂停反馈
- 智能暂停机制，精准控制 AI 对话流程
- 实时 Token 使用监控，避免超限
- 多对话管理，标签页快速切换
- 详细的上下文分析和使用统计

### 🧹 智能存储清理
- 安全清理 vs 深度清理分类管理
- 自动扫描项目冗余文件
- 预估释放空间计算
- 支持构建产物、缓存、日志等多种文件类型

### 📊 数据分析与管理
- 仪表盘概览，项目关键指标
- AI 使用统计和 Token 消耗趋势
- 项目结构和文件类型分析
- 历史数据追踪和模式分析

## 🚀 技术特性

- **跨平台**: 基于 Tauri 框架的原生桌面应用
- **现代化**: React + TypeScript + TailwindCSS
- **高性能**: Rust 后端处理，快速响应
- **美观**: 深色主题，现代化 UI 设计
- **完整**: 详细文档和配置说明

## 📦 下载安装

### macOS
- 下载 `Windsurf Data Manager_0.1.0_x64.dmg`
- 双击打开，拖拽到 Applications 文件夹
- 首次运行需要在系统设置中允许运行

## 🔧 系统要求

- **macOS**: 10.15+ (Catalina 或更高版本)
- **内存**: 最低 4GB RAM
- **存储**: 至少 100MB 可用空间

## 📄 更新日志

- 🎉 首次发布 Windsurf Data Manager
- 💬 实现 AI 对话暂停反馈完整功能
- 🧹 智能存储清理功能上线
- 📊 数据分析仪表盘完成
- 🚀 Tauri + React 技术栈稳定运行
- 📝 完整项目文档和使用指南

---

**⭐ 如果这个项目对您有帮助，请给个 Star 支持一下！**
EOF

    print_success "Release 说明已生成: $notes_file"
    print_info "您可以从以下文件复制 Release 说明内容"
}

# 显示手动操作指南
show_manual_guide() {
    echo ""
    print_info "=== Gitee Release 创建指南 ==="
    echo ""
    echo "📝 手动创建步骤："
    echo ""
    echo "1. 🌐 访问 Gitee 仓库:"
    echo "   https://gitee.com/cong_wa/wdm"
    echo ""
    echo "2. 🏷️ 创建 Release:"
    echo "   - 点击仓库页面的「发行版」标签"
    echo "   - 点击「新建发行版」按钮"
    echo ""
    echo "3. 📋 填写信息:"
    echo "   - 标签: 选择 v0.1.0"
    echo "   - 发行版标题: Windsurf Data Manager v0.1.0"
    echo "   - 发行版说明: 复制 RELEASE_NOTES.md 中的内容"
    echo ""
    echo "4. 📁 上传文件:"
    echo "   - 点击「附件」区域"
    echo "   - 上传文件: src-tauri/target/release/bundle/dmg/Windsurf Data Manager_0.1.0_x64.dmg"
    echo "   - 文件大小: 6.58MB"
    echo ""
    echo "5. ✅ 发布:"
    echo "   - 点击「创建发行版」按钮"
    echo ""
    echo "🔗 Release 创建后的访问地址:"
    echo "   https://gitee.com/cong_wa/wdm/releases/v0.1.0"
    echo ""
}

# 主函数
main() {
    echo "🚀 Gitee Release 创建辅助脚本"
    echo "============================"
    echo ""
    
    # 检查构建文件
    if ! check_build_files; then
        exit 1
    fi
    
    # 检查并推送标签
    check_git_tag
    
    # 生成 Release 说明
    generate_release_notes
    
    # 显示手动操作指南
    show_manual_guide
    
    print_success "准备工作完成！请按照上述指南手动创建 Gitee Release"
}

# 执行主函数
main "$@"
