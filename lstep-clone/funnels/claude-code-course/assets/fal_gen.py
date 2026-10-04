# falで画像を1枚生成して保存する（リッチメニューのイラスト用）。鍵は ~/.fal_key から読み、表示しない。
#   python3 fal_gen.py <model> <出力パス> <プロンプトファイル> [参照画像...]
#   例: python3 fal_gen.py fal-ai/nano-banana-2/edit richmenu-art/x.png p.txt richmenu-art/map.png
import base64, json, mimetypes, os, ssl, sys, time, urllib.request
import certifi

CTX = ssl.create_default_context(cafile=certifi.where())
KEY = open(os.path.expanduser("~/.fal_key")).read().strip()

model, out, prompt_file, *refs = sys.argv[1:]
prompt = open(prompt_file, encoding="utf-8").read()
body = {"prompt": prompt, "num_images": 1, "aspect_ratio": "1:1", "output_format": "png"}
if refs:
    body["image_urls"] = [
        f"data:{mimetypes.guess_type(r)[0] or 'image/png'};base64,{base64.b64encode(open(r, 'rb').read()).decode()}"
        for r in refs
    ]

req = urllib.request.Request(
    f"https://fal.run/{model}",
    data=json.dumps(body).encode(),
    headers={"Authorization": f"Key {KEY}", "Content-Type": "application/json"},
)
t = time.time()
try:
    res = json.load(urllib.request.urlopen(req, timeout=300, context=CTX))
except urllib.error.HTTPError as e:
    print("HTTP", e.code, e.read().decode()[:500])
    sys.exit(1)
url = res["images"][0]["url"]
data = (
    urllib.request.urlopen(url, timeout=120, context=CTX).read()
    if url.startswith("http")
    else base64.b64decode(url.split(",", 1)[1])
)
open(out, "wb").write(data)
print(f"ok {out} {len(data)//1024}KB {time.time()-t:.1f}s")
