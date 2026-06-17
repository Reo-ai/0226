"""
求人ボックス scraper
Target: https://kyujinbox.com/
Search for 営業 at 制作会社 / 開発会社 with small employee count
"""
import re
from urllib.parse import urljoin, urlencode, quote
from .base import fetch, parse, polite_sleep

BASE_URL = "https://kyujinbox.com"

SEARCH_QUERIES = [
    "営業 制作会社 ホームページ",
    "営業 Web制作 小規模",
    "営業 チラシ ポスター 制作",
    "営業 システム開発会社",
    "営業 デザイン会社 少人数",
    "営業 IT開発 ベンチャー",
    "営業 グラフィックデザイン制作",
    "営業 ウェブ制作会社",
]

SMALL_COMPANY_KEYWORDS = [
    "10名以下", "10人以下", "10名未満", "10人未満",
    "少人数", "小規模", "数名", "スタートアップ",
    "2名", "3名", "4名", "5名", "6名", "7名", "8名", "9名", "10名",
    "2人", "3人", "4人", "5人", "6人", "7人", "8人", "9人", "10人",
]

COMPANY_TYPE_KEYWORDS = [
    "制作会社", "制作所", "デザイン会社", "デザイン事務所",
    "システム開発", "開発会社", "ソフトウェア", "Web制作",
    "ウェブ制作", "ホームページ制作", "IT企業",
]


def _is_small_company(text):
    """Check if text suggests a small company (≤10 employees)."""
    text_lower = text
    for kw in SMALL_COMPANY_KEYWORDS:
        if kw in text_lower:
            return True
    # Also check for numeric patterns like "従業員数：5名"
    m = re.search(r'従業員[数]?[：:]\s*(\d+)', text_lower)
    if m and int(m.group(1)) <= 10:
        return True
    return False


def _is_target_company(text):
    """Check if company is a creative/development company."""
    for kw in COMPANY_TYPE_KEYWORDS:
        if kw in text:
            return True
    return False


def _parse_job_card(card, base_url):
    """Extract job info from a listing card."""
    result = {}
    try:
        # Title / job link
        title_el = card.select_one("h2 a, h3 a, .job-title a, a.job-link")
        if title_el:
            result["job_title"] = title_el.get_text(strip=True)
            href = title_el.get("href", "")
            result["job_url"] = urljoin(base_url, href)

        # Company name
        company_el = card.select_one(".company-name, .corp-name, [class*='company']")
        if company_el:
            result["company_name"] = company_el.get_text(strip=True)

        # Location
        loc_el = card.select_one(".location, [class*='location'], [class*='area']")
        if loc_el:
            result["location"] = loc_el.get_text(strip=True)

        # Employee count / description snippet
        desc_el = card.select_one(".description, .summary, p")
        if desc_el:
            result["snippet"] = desc_el.get_text(strip=True)[:300]

        card_text = card.get_text()
        result["is_small"] = _is_small_company(card_text)
        result["is_target"] = _is_target_company(card_text)

    except Exception as e:
        pass
    return result


def scrape_kyujinbox(max_per_query=5):
    """
    Scrape 求人ボックス for relevant job listings.
    Returns list of dicts with job/company info.
    """
    results = []
    seen_companies = set()

    for query in SEARCH_QUERIES:
        encoded = quote(query)
        for page in range(1, max_per_query + 1):
            url = f"{BASE_URL}/仕事?q={encoded}&p={page}"
            print(f"  [求人BOX] {query} page={page} ...")

            html = fetch(url)
            if not html:
                break

            soup = parse(html)
            cards = soup.select(".job-item, .job-card, article, [class*='job_item'], [class*='jobItem']")

            if not cards:
                # fallback: try to find any structured job listings
                cards = soup.select("li.result, div.result, .search-result")

            if not cards:
                break

            found_new = False
            for card in cards:
                info = _parse_job_card(card, BASE_URL)
                company = info.get("company_name", "")
                if not company or company in seen_companies:
                    continue

                seen_companies.add(company)
                results.append(info)
                found_new = True

            if not found_new:
                break

            polite_sleep(1.5, 3.0)

        polite_sleep(2.0, 4.0)

    return results
