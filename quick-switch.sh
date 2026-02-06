#!/bin/bash
# 快速切换脚本 - 用于日常开发中的平台切换

set -e

echo "Windsurf Data Manager - 图片引用快速切换"
echo "=========================================="
echo ""

# 检查当前状态
echo "当前图片引用状态:"
grep -n "src=" README.md | grep -E "(http://|images/)" | head -3
echo ""

# 检测当前模式
if grep -q "http://qiniu.biomed168.com" README.md; then
    CURRENT_MODE="七牛云图床"
    NEXT_MODE="github"
    NEXT_ACTION="切换到 GitHub 模式（GitHub raw 链接）"
elif grep -q "https://raw.githubusercontent.com" README.md; then
    CURRENT_MODE="GitHub"
    NEXT_MODE="gitee"
    NEXT_ACTION="切换到 Gitee 模式（本地图片）"
elif grep -q "src=\"images/" README.md; then
    CURRENT_MODE="Gitee"
    NEXT_MODE="github"
    NEXT_ACTION="切换到 GitHub 模式（GitHub raw 链接）"
else
    echo "⚠️  无法检测当前模式"
    exit 1
fi

echo "当前模式: $CURRENT_MODE"
echo "建议操作: $NEXT_ACTION"
echo ""

read -p "是否执行切换？(y/N): " -n 1 -r
echo
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "正在切换..."
    ./scripts/image-processor.sh $NEXT_MODE
    echo ""
    echo "✅ 切换完成！"
    echo ""
    echo "新状态:"
    grep -n "src=" README.md | grep -E "(http://|images/)" | head -3
else
    echo "❌ 取消切换"
fi
