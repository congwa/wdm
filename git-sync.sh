#!/bin/bash

# Git 同步推送脚本 - 同时推送到 GitHub 和 Gitee
# 使用方法: ./git-sync.sh [commit-message]

set -e  # 遇到错误立即退出

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 打印带颜色的消息
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

# 检查是否在 Git 仓库中
check_git_repo() {
    if ! git rev-parse --git-dir > /dev/null 2>&1; then
        print_error "当前目录不是 Git 仓库"
        exit 1
    fi
}

# 检查远程仓库配置
check_remotes() {
    print_info "检查远程仓库配置..."
    
    local has_github=false
    local has_gitee=false
    
    # 检查 GitHub
    if git remote get-url origin 2>/dev/null | grep -q "github.com"; then
        has_github=true
        print_success "GitHub 远程仓库已配置: $(git remote get-url origin)"
    fi
    
    # 检查 Gitee
    if git remote get-url gitee 2>/dev/null | grep -q "gitee.com"; then
        has_gitee=true
        print_success "Gitee 远程仓库已配置: $(git remote get-url gitee)"
    fi
    
    if [ "$has_github" = false ] && [ "$has_gitee" = false ]; then
        print_error "没有找到配置的远程仓库"
        print_info "请确保已配置 GitHub (origin) 和/或 Gitee (gitee) 远程仓库"
        exit 1
    fi
}

# 检查是否有未提交的更改
check_changes() {
    if [ -n "$(git status --porcelain)" ]; then
        print_warning "发现未提交的更改"
        return 0
    else
        print_info "没有未提交的更改"
        return 1
    fi
}

# 添加并提交更改
commit_changes() {
    local commit_msg="$1"
    
    if [ -z "$commit_msg" ]; then
        print_error "请提供提交消息"
        echo "使用方法: $0 \"提交消息\""
        exit 1
    fi
    
    print_info "添加所有更改..."
    git add .
    
    print_info "提交更改..."
    git commit -m "$commit_msg"
    print_success "更改已提交"
}

# 推送到远程仓库
push_to_remotes() {
    local branch=$(git branch --show-current)
    print_info "当前分支: $branch"
    
    # 推送到 GitHub
    if git remote get-url origin 2>/dev/null | grep -q "github.com"; then
        print_info "推送到 GitHub..."
        if git push origin "$branch"; then
            print_success "GitHub 推送成功"
        else
            print_error "GitHub 推送失败"
        fi
    fi
    
    # 推送到 Gitee
    if git remote get-url gitee 2>/dev/null | grep -q "gitee.com"; then
        print_info "推送到 Gitee..."
        if git push gitee "$branch"; then
            print_success "Gitee 推送成功"
        else
            print_error "Gitee 推送失败"
        fi
    fi
}

# 拉取远程更改
pull_changes() {
    local branch=$(git branch --show-current)
    
    print_info "从远程仓库拉取最新更改..."
    
    # 从 GitHub 拉取
    if git remote get-url origin 2>/dev/null | grep -q "github.com"; then
        git pull origin "$branch" || print_warning "从 GitHub 拉取失败或无新更改"
    fi
    
    # 从 Gitee 拉取
    if git remote get-url gitee 2>/dev/null | grep -q "gitee.com"; then
        git pull gitee "$branch" || print_warning "从 Gitee 拉取失败或无新更改"
    fi
}

# 创建 Release 辅助
create_release() {
    local version="$1"
    
    if [ -z "$version" ]; then
        version="v0.1.0"
    fi
    
    print_info "准备创建 Release: $version"
    
    # 检查构建文件
    local dmg_file="src-tauri/target/release/bundle/dmg/Windsurf Data Manager_0.1.0_x64.dmg"
    if [ ! -f "$dmg_file" ]; then
        print_error "DMG 文件未找到: $dmg_file"
        print_info "请先运行: npm run tauri:build"
        return 1
    fi
    
    # 检查标签
    if ! git rev-parse "$version" >/dev/null 2>&1; then
        print_warning "标签 $version 不存在，正在创建..."
        git tag "$version" -m "$version: Windsurf Data Manager Release"
        print_success "标签 $version 已创建"
    fi
    
    # 推送标签到所有远程仓库
    print_info "推送标签到远程仓库..."
    git push origin "$version" || print_warning "GitHub 标签推送失败"
    git push gitee "$version" || print_warning "Gitee 标签推送失败"
    
    print_success "Release 准备工作完成！"
    print_info "请访问以下链接手动创建 Release："
    print_info "GitHub: https://github.com/congwa/wdm/releases/new?tag=$version"
    print_info "Gitee: https://gitee.com/cong_wa/wdm/releases/new"
    print_info ""
    print_info "上传文件: $dmg_file"
}

# 显示帮助信息
show_help() {
    echo "Git 同步推送脚本 - 同时推送到 GitHub 和 Gitee"
    echo ""
    echo "使用方法:"
    echo "  $0 \"提交消息\"     - 提交更改并推送到所有远程仓库"
    echo "  $0 --push          - 仅推送已提交的更改到所有远程仓库"
    echo "  $0 --pull          - 从所有远程仓库拉取最新更改"
    echo "  $0 --sync          - 先拉取再推送所有更改"
    echo "  $0 --release [版本] - 准备 Release 创建（默认 v0.1.0）"
    echo "  $0 --status        - 显示当前状态"
    echo "  $0 --help          - 显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 \"修复了一个bug\""
    echo "  $0 --push"
    echo "  $0 --sync"
    echo "  $0 --release v0.1.0"
}

# 显示状态
show_status() {
    print_info "=== Git 状态 ==="
    git status
    
    print_info "=== 远程仓库 ==="
    git remote -v
    
    print_info "=== 最近提交 ==="
    git log --oneline -5
}

# 主函数
main() {
    echo "🚀 Git 同步推送脚本"
    echo "===================="
    
    check_git_repo
    check_remotes
    
    case "$1" in
        --help|-h)
            show_help
            exit 0
            ;;
        --push)
            push_to_remotes
            ;;
        --pull)
            pull_changes
            ;;
        --sync)
            pull_changes
            if check_changes; then
                print_warning "有未提交的更改，请先提交后再同步"
                exit 1
            fi
            push_to_remotes
            ;;
        --release)
            create_release "$2"
            ;;
        --status)
            show_status
            ;;
        "")
            print_error "请提供提交消息或使用 --help 查看帮助"
            echo "使用方法: $0 \"提交消息\""
            exit 1
            ;;
        *)
            commit_changes "$1"
            pull_changes
            push_to_remotes
            print_success "所有操作完成！✨"
            ;;
    esac
}

# 执行主函数
main "$@"
