"""
Lead extraction automation for small creative/development companies hiring sales staff.

Sources:
  1. 求人ボックス  - job listing aggregator
  2. Indeed Japan  - large job board
  3. Wantedly      - startup-focused job board
  4. DuckDuckGo    - direct company site search

Extracts per company:
  - 会社名 (company_name)
  - 代表者名 (rep_name)
  - 住所 (address)
  - 電話番号 (phone)
  - ホームページURL (url)
"""

import sys
import os
import json
import time
import pandas as pd
from datetime import datetime

sys.path.insert(0, os.path.dirname(__file__))

from scrapers import (
    scrape_kyujinbox, scrape_indeed, scrape_wantedly,
    scrape_via_search, scrape_hellowork, scrape_green, scrape_stanby,
)
from enricher import enrich_company, enrich_from_job_url
from scrapers.base import polite_sleep

TARGET_COUNT = 300
CACHE_FILE = os.path.join(os.path.dirname(__file__), "output", "cache.json")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "output")

# Keywords that confirm a company is in creative/dev industry
TARGET_KEYWORDS = [
    "制作", "デザイン", "Web", "ウェブ", "ホームページ", "HP制作",
    "チラシ", "ポスター", "グラフィック", "システム開発", "開発会社",
    "IT", "ソフトウェア", "アプリ", "DX", "コーディング",
]

# Reject these (large companies, staffing agencies, etc.)
REJECT_KEYWORDS = [
    "派遣", "人材", "転職", "求人サイト", "エージェント",
]


def is_target_company(info):
    """Check if the company is in our target industry."""
    text = " ".join([
        info.get("company_name", ""),
        info.get("job_title", ""),
        info.get("snippet", ""),
    ])
    has_target = any(kw in text for kw in TARGET_KEYWORDS)
    has_reject = any(kw in text for kw in REJECT_KEYWORDS)
    return has_target and not has_reject


def is_small_company(info):
    """Check if employee count suggests ≤10 people."""
    emp = info.get("employee_count")
    if emp is not None:
        return emp <= 10
    # If unknown, accept for now (will filter at enrichment stage)
    snippet = info.get("snippet", "") + info.get("job_title", "")
    small_hints = ["少人数", "小規模", "スタートアップ", "ベンチャー", "10名以下", "10人以下"]
    return any(kw in snippet for kw in small_hints) or emp is None


def load_cache():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    if os.path.exists(CACHE_FILE):
        with open(CACHE_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"raw_leads": [], "enriched": []}


def save_cache(cache):
    with open(CACHE_FILE, "w", encoding="utf-8") as f:
        json.dump(cache, f, ensure_ascii=False, indent=2)


def collect_raw_leads(cache):
    """Phase 1: Collect raw job listings from multiple sources."""
    print("\n=== Phase 1: Collecting job listings ===")

    raw = cache.get("raw_leads", [])
    seen_companies = {r.get("company_name", "") for r in raw}

    # Source 1: 求人ボックス
    print("\n[Source 1] 求人ボックス...")
    try:
        results = scrape_kyujinbox(max_per_query=3)
        for r in results:
            if r.get("company_name") and r["company_name"] not in seen_companies:
                seen_companies.add(r["company_name"])
                raw.append(r)
        print(f"  -> {len(results)} found, total raw: {len(raw)}")
    except Exception as e:
        print(f"  [ERROR] 求人ボックス: {e}")

    # Source 2: スタンバイ (Indeed系だがブロックされにくい)
    print("\n[Source 2] スタンバイ...")
    try:
        results = scrape_stanby(max_pages=3)
        for r in results:
            if r.get("company_name") and r["company_name"] not in seen_companies:
                seen_companies.add(r["company_name"])
                raw.append(r)
        print(f"  -> {len(results)} found, total raw: {len(raw)}")
    except Exception as e:
        print(f"  [ERROR] スタンバイ: {e}")

    # Source 3: Wantedly
    print("\n[Source 3] Wantedly...")
    try:
        results = scrape_wantedly(max_pages=2)
        for r in results:
            if r.get("company_name") and r["company_name"] not in seen_companies:
                seen_companies.add(r["company_name"])
                raw.append(r)
        print(f"  -> {len(results)} found, total raw: {len(raw)}")
    except Exception as e:
        print(f"  [ERROR] Wantedly: {e}")

    # Source 4: ハローワーク
    print("\n[Source 4] ハローワーク...")
    try:
        results = scrape_hellowork(max_pages=3)
        for r in results:
            if r.get("company_name") and r["company_name"] not in seen_companies:
                seen_companies.add(r["company_name"])
                raw.append(r)
        print(f"  -> {len(results)} found, total raw: {len(raw)}")
    except Exception as e:
        print(f"  [ERROR] ハローワーク: {e}")

    # Source 5: Green (IT転職)
    print("\n[Source 5] Green (IT転職)...")
    try:
        results = scrape_green(max_pages=3)
        for r in results:
            if r.get("company_name") and r["company_name"] not in seen_companies:
                seen_companies.add(r["company_name"])
                raw.append(r)
        print(f"  -> {len(results)} found, total raw: {len(raw)}")
    except Exception as e:
        print(f"  [ERROR] Green: {e}")

    # Source 6: Search engine (DuckDuckGo)
    print("\n[Source 6] Search engine (DuckDuckGo)...")
    try:
        results = scrape_via_search()
        for r in results:
            url = r.get("url", "")
            title = r.get("title", "")
            if title and title not in seen_companies:
                seen_companies.add(title)
                raw.append({
                    "company_name": title,
                    "job_url": url,
                    "snippet": r.get("snippet", ""),
                    "source": "search",
                })
        print(f"  -> {len(results)} found, total raw: {len(raw)}")
    except Exception as e:
        print(f"  [ERROR] Search: {e}")

    cache["raw_leads"] = raw
    save_cache(cache)
    print(f"\nTotal raw leads collected: {len(raw)}")
    return raw


def enrich_leads(cache, raw_leads):
    """Phase 2: Visit company websites to extract full details."""
    print("\n=== Phase 2: Enriching company details ===")

    enriched = cache.get("enriched", [])
    enriched_names = {e.get("company_name", "") for e in enriched}

    # Filter raw leads to target companies first
    candidates = [r for r in raw_leads if is_target_company(r)]
    print(f"Target-company candidates: {len(candidates)} (from {len(raw_leads)} raw)")

    for i, lead in enumerate(candidates):
        if len(enriched) >= TARGET_COUNT:
            print(f"  Reached target of {TARGET_COUNT} companies.")
            break

        company_name = lead.get("company_name", "")
        if not company_name or company_name in enriched_names:
            continue

        print(f"  [{i+1}/{len(candidates)}] Enriching: {company_name}")

        # Try to get company URL from job listing
        company_url = lead.get("company_url") or lead.get("url")
        job_url = lead.get("job_url")

        if not company_url and job_url:
            try:
                company_url = enrich_from_job_url(job_url)
                polite_sleep(1.0, 2.0)
            except Exception as e:
                print(f"    [WARN] Could not get company URL from job listing: {e}")

        # Enrich from company website
        try:
            details = enrich_company(company_name, company_url)
            details["source"] = lead.get("source", "job_board")
            details["job_title"] = lead.get("job_title", "")

            # Check employee count after enrichment
            emp = details.get("employee_count")
            if emp is not None and emp > 10:
                print(f"    -> Skipping: {emp} employees (> 10)")
                continue

            enriched.append(details)
            enriched_names.add(company_name)
            print(f"    -> OK: rep={details['rep_name'][:15] or 'N/A'}, "
                  f"addr={details['address'][:20] or 'N/A'}")

        except Exception as e:
            print(f"    [ERROR] Enrichment failed: {e}")

        polite_sleep(2.0, 4.0)

        # Save progress every 10 companies
        if len(enriched) % 10 == 0:
            cache["enriched"] = enriched
            save_cache(cache)
            print(f"  Progress saved: {len(enriched)} enriched")

    cache["enriched"] = enriched
    save_cache(cache)
    return enriched


def export_excel(enriched, output_path):
    """Phase 3: Export to Excel."""
    print(f"\n=== Phase 3: Exporting to Excel ({len(enriched)} companies) ===")

    rows = []
    for i, e in enumerate(enriched, 1):
        rows.append({
            "No.": i,
            "会社名": e.get("company_name", ""),
            "代表者名": e.get("rep_name", ""),
            "住所": e.get("address", ""),
            "電話番号": e.get("phone", ""),
            "ホームページURL": e.get("url", ""),
            "従業員数": e.get("employee_count", ""),
            "募集職種": e.get("job_title", ""),
            "情報源": e.get("source", ""),
        })

    df = pd.DataFrame(rows)

    with pd.ExcelWriter(output_path, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="リード一覧")

        ws = writer.sheets["リード一覧"]

        # Column widths
        col_widths = {
            "A": 6,   # No.
            "B": 30,  # 会社名
            "C": 20,  # 代表者名
            "D": 45,  # 住所
            "E": 18,  # 電話番号
            "F": 40,  # URL
            "G": 12,  # 従業員数
            "H": 30,  # 募集職種
            "I": 15,  # 情報源
        }
        for col, width in col_widths.items():
            ws.column_dimensions[col].width = width

    print(f"  Exported: {output_path}")
    return output_path


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    cache = load_cache()

    # Phase 1: Collect raw job listings
    raw_leads = collect_raw_leads(cache)

    if not raw_leads:
        print("\n[ERROR] No raw leads collected. Please check network access.")
        return

    # Phase 2: Enrich with company details
    enriched = enrich_leads(cache, raw_leads)

    if not enriched:
        print("\n[ERROR] No enriched leads. Check scraper output.")
        return

    # Phase 3: Export to Excel
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    output_path = os.path.join(OUTPUT_DIR, f"leads_{ts}.xlsx")
    export_excel(enriched, output_path)

    # Summary
    print(f"\n{'='*50}")
    print(f"Complete! {len(enriched)} companies extracted.")
    print(f"Output: {output_path}")
    has_rep = sum(1 for e in enriched if e.get("rep_name"))
    has_addr = sum(1 for e in enriched if e.get("address"))
    has_phone = sum(1 for e in enriched if e.get("phone"))
    has_url = sum(1 for e in enriched if e.get("url"))
    print(f"\nFill rate:")
    print(f"  代表者名:    {has_rep}/{len(enriched)} ({100*has_rep//len(enriched)}%)")
    print(f"  住所:        {has_addr}/{len(enriched)} ({100*has_addr//len(enriched)}%)")
    print(f"  電話番号:    {has_phone}/{len(enriched)} ({100*has_phone//len(enriched)}%)")
    print(f"  URL:         {has_url}/{len(enriched)} ({100*has_url//len(enriched)}%)")


if __name__ == "__main__":
    main()
