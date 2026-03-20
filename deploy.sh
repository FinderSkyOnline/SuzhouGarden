#!/bin/bash

# 博客部署脚本 - 本地构建，服务器部署

# 配置信息（请根据您的服务器信息修改）
SERVER_USER="root"
SERVER_IP="101.43.124.15"
SERVER_PATH="/app/SuzhouGarden"
LOCAL_DIST_PATH="dist"

echo "=== 开始博客部署流程 ==="

# 1. 本地构建
echo "1. 开始本地构建..."
npm run build

if [ $? -ne 0 ]; then
    echo "❌ 构建失败，请检查错误信息"
    exit 1
fi

echo "✅ 构建完成"

# 2. 检查构建结果
if [ ! -d "$LOCAL_DIST_PATH" ]; then
    echo "❌ 构建目录不存在：$LOCAL_DIST_PATH"
    exit 1
fi

echo "2. 构建文件检查通过"

# 3. 上传到服务器
echo "3. 开始上传到服务器..."

# 使用 rsync 同步文件（推荐）
rsync -avz --delete --exclude='.user.ini' $LOCAL_DIST_PATH/ $SERVER_USER@$SERVER_IP:$SERVER_PATH/

if [ $? -eq 0 ]; then
    echo "✅ 部署成功！"
    echo "🌐 已更新"
else
    echo "❌ 部署失败，请检查服务器连接"
    exit 1
fi

echo "=== 部署完成 ==="
