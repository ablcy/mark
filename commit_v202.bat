@echo off
cd /d C:\Users\lcy\mark
git add app.js index.html server.js
git commit -m "V2.0.2: 搜索联想改用服务端代理百度 API（DuckDuckGo 不可用）"
git push origin main
echo Done!
pause
