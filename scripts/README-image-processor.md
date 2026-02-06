# 图片处理脚本使用说明

## 概述

这个脚本用于根据不同平台自动切换 README.md 中的图片引用方式：
- **GitHub**: 使用 GitHub raw 文件链接
- **Gitee**: 使用本地图片引用
- **七牛云**: 使用七牛云图床链接

## 脚本位置

`scripts/image-processor.sh`

## 使用方法

### 手动使用

```bash
# 切换到 GitHub 模式（使用 GitHub raw 链接）
./scripts/image-processor.sh github

# 切换到 Gitee 模式（使用本地图片）
./scripts/image-processor.sh gitee

# 切换到七牛云模式（使用七牛云图床）
./scripts/image-processor.sh qiniu
```

### 快速切换

```bash
# 智能检测当前模式并切换
./quick-switch.sh
```

## 工作原理

### GitHub 模式
- 将七牛云链接 `http://qiniu.biomed168.com/pic/xxx.png` 替换为 GitHub raw 链接 `https://raw.githubusercontent.com/congwa/wdm/main/images/xxx.png`

### Gitee 模式
- 将所有外部图床链接替换为本地图片引用 `images/xxx.png`

### 七牛云模式（原始）
- 使用七牛云外链 `http://qiniu.biomed168.com/pic/xxx.png`

## 图片文件映射

| 功能图片 | 本地路径 | GitHub raw | 七牛云 |
|---------|---------|-----------|--------|
| AI 对话统计 | `images/chat.png` | GitHub raw | 七牛云 |
| 对话上下文 | `images/chat_context.png` | GitHub raw | 七牛云 |
| 存储清理 | `images/clean.png` | GitHub raw | 七牛云 |
| 数据分析 | `images/an.png` | GitHub raw | 七牛云 |
| QQ 联系 | `images/qq.jpg` | GitHub raw | 七牛云 |

## 安全特性

1. **自动备份**: 每次执行前都会创建 `README.md.backup` 备份
2. **变更预览**: 显示具体的更改内容
3. **验证检查**: 显示当前图片引用状态
4. **恢复机制**: 可通过备份文件快速恢复

## 配置说明

如需修改图床 URL，请编辑脚本中的以下变量：

```bash
QINIU_BASE_URL="http://qiniu.biomed168.com/pic"
GITHUB_BASE_URL="https://raw.githubusercontent.com/congwa/wdm/main/images"
```

## 故障排除

### 恢复备份
```bash
cp README.md.backup README.md
```

### 检查当前状态
```bash
grep -n "src=" README.md | grep -E "(http://|images/)"
```

### 清理临时文件
```bash
rm -f README.md.backup README.md.tmp
```

## 使用场景

### 1. GitHub 发布
```bash
./scripts/image-processor.sh github
git add README.md
git commit -m "切换到 GitHub 模式"
git push github main
```

### 2. Gitee 发布
```bash
./scripts/image-processor.sh gitee
git add README.md
git commit -m "切换到 Gitee 模式"
git push gitee main
```

### 3. 日常开发
```bash
./quick-switch.sh  # 智能切换
```

## 注意事项

1. 确保图片文件在 `images/` 目录中存在
2. 确保在 GitHub 仓库中存在对应的图片文件
3. 脚本会自动处理文件权限问题
4. 在 Windows 环境下需要使用 Git Bash 或 WSL
5. 建议在执行前提交当前更改，以便回滚
