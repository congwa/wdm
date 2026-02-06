#!/bin/bash
# 图片处理脚本 - 根据平台自动切换图片引用
# 用法: ./scripts/image-processor.sh [github|gitee]

set -e

# 检查参数
if [ $# -ne 1 ]; then
    echo "用法: $0 [github|gitee|qiniu]"
    echo "  github - 将图片链接替换为 GitHub raw 文件链接"
    echo "  gitee  - 使用本地图片引用"
    echo "  qiniu  - 使用七牛云图床链接"
    exit 1
fi

PLATFORM=$1
README_FILE="README.md"
BACKUP_FILE="README.md.backup"

# 检查 README 文件是否存在
if [ ! -f "$README_FILE" ]; then
    echo "错误: 找不到 $README_FILE 文件"
    exit 1
fi

# 创建备份
cp "$README_FILE" "$BACKUP_FILE"
echo "已创建备份: $BACKUP_FILE"

# HTTP 图床配置 - 七牛云外链
QINIU_BASE_URL="http://qiniu.biomed168.com/pic"

# GitHub raw 文件链接配置
GITHUB_BASE_URL="https://raw.githubusercontent.com/congwa/wdm/main/images"

if [ "$PLATFORM" = "github" ]; then
    echo "切换到 GitHub 模式 - 使用 GitHub raw 文件链接..."
    
    # 替换七牛云链接为 GitHub raw 链接
    sed -i.tmp 's|http://qiniu\.biomed168\.com/pic/\([^)]*\)|'"$GITHUB_BASE_URL"'/\1|g' "$README_FILE"
    
    # 替换本地图片引用为 GitHub raw 链接
    sed -i.tmp 's|src="images/\([^"]*\)"|src="'"$GITHUB_BASE_URL"'/\1"|g' "$README_FILE"
    
    # 清理临时文件
    rm -f "$README_FILE.tmp"
    
    echo "✅ 已切换到 GitHub 模式"
    
elif [ "$PLATFORM" = "gitee" ]; then
    echo "切换到 Gitee 模式 - 使用本地图片引用..."
    
    # 将外部图床链接替换为本地图片引用
    sed -i.tmp 's|http://qiniu\.biomed168\.com/pic/\([^)]*\)|images/\1|g' "$README_FILE"
    sed -i.tmp 's|https://raw\.githubusercontent\.com/[^)]*/images/\([^)]*\)|images/\1|g' "$README_FILE"
    
    # 清理临时文件
    rm -f "$README_FILE.tmp"
    
    echo "✅ 已切换到 Gitee 模式"
    
elif [ "$PLATFORM" = "qiniu" ]; then
    echo "切换到七牛云模式 - 使用七牛云图床链接..."
    
    # 将本地图片引用替换为七牛云链接
    sed -i.tmp 's|src="images/\([^"]*\)"|src="'"$QINIU_BASE_URL"'/\1"|g' "$README_FILE"
    
    # 将 GitHub raw 链接替换为七牛云链接
    sed -i.tmp 's|src="https://raw\.githubusercontent\.com/[^"]*/images/\([^"]*\)"|src="'"$QINIU_BASE_URL"'/\1"|g' "$README_FILE"
    
    # 清理临时文件
    rm -f "$README_FILE.tmp"
    
    echo "✅ 已切换到七牛云模式"
    
else
    echo "错误: 不支持的平台 '$PLATFORM'"
    echo "支持的平台: github, gitee, qiniu"
    rm -f "$BACKUP_FILE"
    exit 1
fi

# 显示更改
echo ""
echo "更改预览:"
echo "----------"
diff "$BACKUP_FILE" "$README_FILE" || echo "无显示差异（可能是格式化问题）"
echo "----------"

# 验证更改
echo ""
echo "当前图片引用:"
grep -n "src=\"http" "$README_FILE" | head -3
grep -n "src=\"images" "$README_FILE" | head -3

echo ""
echo "✅ 处理完成！"
echo "💡 提示: 如需恢复，请运行: cp $BACKUP_FILE $README_FILE"
