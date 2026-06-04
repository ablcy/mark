#!/usr/bin/env python3
"""mark 推送脚本 v2 - 用 --input JSON 避免命令行参数过长"""
import base64, json, os, subprocess, sys, tempfile

REPO = "ablcy/mark"
BRANCH = "main"
MSG = "v3.0.6 去掉综合搜索+添加搜狗360+修复引擎图标/弹窗/空态"
FILES = ["index.html", "styles.css", "app.js", "server.js"]

def gh_api_put(path, b64_content, sha=None):
    """用 --input 传递 JSON，避免命令行参数过长"""
    data = {
        "message": MSG,
        "branch": BRANCH,
        "content": b64_content,
    }
    if sha:
        data["sha"] = sha

    # 写入临时 JSON 文件
    with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False, encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)
        tmp_path = f.name

    try:
        cmd = ["gh", "api", "-X", "PUT",
               f"/repos/{REPO}/contents/{path}",
               "--input", tmp_path]
        r = subprocess.run(cmd, capture_output=True, text=True)
        return r.returncode, r.stdout[:200], r.stderr[:200]
    finally:
        os.unlink(tmp_path)

def get_sha(path):
    cmd = ["gh", "api", f"/repos/{REPO}/contents/{path}?ref={BRANCH}"]
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode == 0:
        return json.loads(r.stdout)["sha"]
    return None

def push_file(path):
    print(f"  推送 {path}...", end=" ", flush=True)
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode()

    sha = get_sha(path)
    code, out, err = gh_api_put(path, b64, sha)
    if code == 0:
        print("✅")
        return True
    else:
        print(f"❌ {out or err}")
        return False

print(f"推送 {REPO} ({BRANCH})...")
ok = all(push_file(f) for f in FILES)
if ok:
    print("✅ 全部推送成功 → https://marki.up.railway.app/")
else:
    print("❌ 推送失败")
    sys.exit(1)
