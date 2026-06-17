"""
Google Sheets への直接出力モジュール
gspread ライブラリを使用してスプレッドシートを自動作成・書き込みします。
"""
import os
import shutil

CREDENTIALS_SEARCH_PATHS = [
    os.path.join(os.path.dirname(__file__), "credentials.json"),
    os.path.expanduser("~/.config/gspread/credentials.json"),
]
GSPREAD_CONFIG_DIR = os.path.expanduser("~/.config/gspread")

HEADERS = [
    "No.", "会社名", "代表者名", "住所",
    "電話番号", "ホームページURL", "従業員数", "募集職種", "情報源"
]


def _find_credentials():
    """Search for credentials.json in known locations."""
    for path in CREDENTIALS_SEARCH_PATHS:
        if os.path.exists(path):
            return path
    return None


def _ensure_gspread_credentials():
    """Copy credentials.json to gspread config dir if needed."""
    gspread_creds = os.path.join(GSPREAD_CONFIG_DIR, "credentials.json")
    if os.path.exists(gspread_creds):
        return  # Already set up

    creds_path = _find_credentials()
    if not creds_path:
        raise FileNotFoundError(
            "\n\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "  Google Sheetsへの出力には credentials.json が必要です。\n"
            "  以下の手順でファイルを取得してください:\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
            "\n"
            "  1. https://console.cloud.google.com/ を開く\n"
            "  2. 新しいプロジェクトを作成（または既存を選択）\n"
            "  3. 左メニュー → APIとサービス → ライブラリ\n"
            "     「Google Sheets API」を有効化\n"
            "     「Google Drive API」を有効化\n"
            "  4. 左メニュー → APIとサービス → 認証情報\n"
            "     「認証情報を作成」→「OAuthクライアントID」\n"
            "     アプリの種類:「デスクトップアプリ」を選択\n"
            "  5. 作成後「JSONをダウンロード」\n"
            "  6. ダウンロードしたファイルを以下に保存:\n"
            f"     {CREDENTIALS_SEARCH_PATHS[0]}\n"
            "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n"
        )

    os.makedirs(GSPREAD_CONFIG_DIR, exist_ok=True)
    shutil.copy(creds_path, gspread_creds)
    print(f"  credentials.json を {GSPREAD_CONFIG_DIR} にコピーしました。")


def export_to_sheets(enriched, sheet_title="営業リード一覧"):
    """
    Export enriched leads directly to a new Google Spreadsheet.
    Returns the URL of the created spreadsheet.
    """
    try:
        import gspread
    except ImportError:
        raise ImportError(
            "gspread がインストールされていません。\n"
            "pip3 install gspread google-auth-oauthlib を実行してください。"
        )

    print(f"\n=== Google Sheets へ出力中 ({len(enriched)} 件) ===")

    _ensure_gspread_credentials()

    print("  Googleアカウントの認証を行います...")
    print("  ブラウザが開いたらGoogleアカウントでログインして許可してください。")

    gc = gspread.oauth()

    # 新しいスプレッドシートを作成
    print(f"  スプレッドシート「{sheet_title}」を作成中...")
    sh = gc.create(sheet_title)

    ws = sh.sheet1
    ws.update_title("リード一覧")

    # データ行を構築
    rows = [HEADERS]
    for i, e in enumerate(enriched, 1):
        rows.append([
            i,
            e.get("company_name", ""),
            e.get("rep_name", ""),
            e.get("address", ""),
            e.get("phone", ""),
            e.get("url", ""),
            str(e.get("employee_count", "")),
            e.get("job_title", ""),
            e.get("source", ""),
        ])

    # 一括書き込み
    ws.update(rows)

    # ヘッダー行を太字・背景色に設定
    ws.format("A1:I1", {
        "textFormat": {"bold": True},
        "backgroundColor": {"red": 0.2, "green": 0.6, "blue": 1.0},
    })

    # 列幅を自動調整
    ws.columns_auto_resize(0, 8)

    url = f"https://docs.google.com/spreadsheets/d/{sh.id}"
    print(f"\n  ✓ Google Sheets に保存しました！")
    print(f"  URL: {url}")
    return url
