# Git 同步推送指南

## 🚀 快速开始

### 1. 使用同步脚本

项目已配置 `git-sync.sh` 脚本，可以同时推送到 GitHub 和 Gitee。

```bash
# 给脚本执行权限（仅需执行一次）
chmod +x git-sync.sh

# 提交并推送到所有远程仓库
./git-sync.sh "你的提交消息"

# 仅推送已提交的更改
./git-sync.sh --push

# 从所有远程仓库拉取最新更改
./git-sync.sh --pull

# 先拉取再推送（推荐）
./git-sync.sh --sync

# 查看状态
./git-sync.sh --status

# 查看帮助
./git-sync.sh --help
```

### 2. 身份验证配置

#### GitHub 身份验证
```bash
# 方法1: 使用 Personal Access Token
git config --global credential.helper store
# 首次推送时输入 GitHub 用户名和 Personal Access Token

# 方法2: 使用 SSH（推荐）
ssh-keygen -t ed25519 -C "your_email@example.com"
# 将公钥添加到 GitHub 设置中
git remote set-url origin git@github.com:congwa/wdm.git
```

#### Gitee 身份验证
```bash
# 方法1: 使用 Personal Access Token
git config --global credential.helper store
# 首次推送时输入 Gitee 用户名和 Personal Access Token

# 方法2: 使用 SSH（推荐）
ssh-keygen -t ed25519 -C "your_email@example.com"
# 将公钥添加到 Gitee 设置中
git remote set-url gitee git@gitee.com:cong_wa/wdm.git
```

### 3. 全局 Git 配置

```bash
# 设置用户信息
git config --global user.name "cong_wa"
git config --global user.email "cong_wa@163.com"

# 设置默认分支名
git config --global init.defaultBranch main

# 设置推送策略
git config --global push.default simple
```

## 📋 脚本功能说明

### 命令选项
- `./git-sync.sh "消息"` - 提交更改并推送到所有远程仓库
- `./git-sync.sh --push` - 仅推送已提交的更改
- `./git-sync.sh --pull` - 从所有远程仓库拉取更改
- `./git-sync.sh --sync` - 先拉取再推送（推荐日常使用）
- `./git-sync.sh --status` - 显示当前状态
- `./git-sync.sh --help` - 显示帮助信息

### 自动化流程
1. ✅ 检查 Git 仓库状态
2. ✅ 验证远程仓库配置
3. ✅ 自动添加并提交更改
4. ✅ 从远程仓库拉取最新更改
5. ✅ 推送到所有配置的远程仓库
6. ✅ 彩色输出和详细日志

## 🔧 故障排除

### 身份验证失败
```bash
# 清除凭据缓存
git config --global --unset credential.helper

# 重新配置凭据
git config --global credential.helper store
```

### 远程仓库配置错误
```bash
# 查看当前远程仓库
git remote -v

# 重新添加远程仓库
git remote remove origin
git remote add origin https://github.com/congwa/wdm.git

git remote remove gitee
git remote add gitee https://gitee.com/cong_wa/wdm.git
```

### 分支冲突
```bash
# 强制推送（谨慎使用）
git push -f origin main
git push -f gitee main

# 或者解决冲突后重新推送
git pull origin main --rebase
git pull gitee main --rebase
git push origin main
git push gitee main
```

## 📝 使用示例

### 日常开发流程
```bash
# 1. 修改代码后
./git-sync.sh "feat: 添加新功能"

# 2. 或者分步操作
git add .
git commit -m "feat: 添加新功能"
./git-sync.sh --push

# 3. 或者先同步再推送
./git-sync.sh --sync
```

### 多人协作
```bash
# 开始工作前先同步
./git-sync.sh --pull

# 完成工作后推送
./git-sync.sh "完成功能开发"
```

## 🎯 最佳实践

1. **使用 SSH**: 比 HTTPS 更安全且无需重复输入密码
2. **定期同步**: 使用 `--sync` 选项避免冲突
3. **明确提交信息**: 遵循项目的提交消息规范
4. **查看状态**: 使用 `--status` 了解当前状态
5. **备份重要分支**: 在重大更改前创建备份分支

## 🔗 相关链接

- [GitHub 仓库](https://github.com/congwa/wdm)
- [Gitee 仓库](https://gitee.com/cong_wa/wdm)
- [Git 官方文档](https://git-scm.com/doc)
- [GitHub SSH 配置](https://docs.github.com/zh/authentication/connecting-to-github-with-ssh)
- [Gitee SSH 配置](https://gitee.com/help/articles/4191)
