#!/bin/bash
# 桌面宠物启动脚本 — 双击即可运行
cd "$(dirname "$0")"
unset ELECTRON_RUN_AS_NODE
npm start
