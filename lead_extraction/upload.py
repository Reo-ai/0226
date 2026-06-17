"""
Google Sheetsへのアップロード専用スクリプト
使い方: python3 upload.py
"""
import json
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))

CACHE_FILE = os.path.join(os.path.dirname(__file__), "output", "cache.json")

if not os.path.exists(CACHE_FILE):
    print("ERROR: output/cache.json が見つかりません。先に python3 main.py を実行してください。")
    sys.exit(1)

with open(CACHE_FILE, encoding="utf-8") as f:
    data = json.load(f)

enriched = data.get("enriched", [])
if not enriched:
    print("ERROR: データがありません。先に python3 main.py を実行してください。")
    sys.exit(1)

print(f"{len(enriched)} 件のデータをGoogle Sheetsにアップロードします...")

from sheets_export import export_to_sheets
url = export_to_sheets(enriched)

if url:
    print(f"\n完了！スプレッドシートのURL:")
    print(f"  {url}")
