"""
スタンバイ (stanby.com) scraper - Indeed傘下の日本求人サイト
ブロックされにくい別エンドポイントを使用
"""
import re
from urllib.parse import urljoin, quote
from .base import fetch, parse, polite_sleep

BASE_URL = "https://jp.stanby.com"

SEARCH_QUERIES = [
    "営業 制作会社",
    "営業 Web制作",
    "営業 ホームページ制作",
    "営業 システム開発",
    "営業 デザイン会社",
    "営業 チラシ 制作",
    "法人営業 IT 小規模",
]


def _parse_stanby_card(card):
    info = {}
    try:
        title_el = card.select_one("h2, h3, [class*='title'], a[href*='/job/']")
        if title_el:
            info["job_title"] = title_el.get_text(strip=True)

        company_el = card.select_one("[class*='company'], [class*='corp']")
        if company_el:
            info["company_name"] = company_el.get_text(strip=True)

        loc_el = card.select_one("[class*='location'], [class*='area'], [class*='address']")
        if loc_el:
            info["location"] = loc_el.get_text(strip=True)

        link_el = card.select_one("a[href]")
        if link_el:
            href = link_el.get("href", "")
            info["job_url"] = urljoin(BASE_URL, href)

        card_text = card.get_text()
        m = re.search(r'従業員[数]?[：:]\s*(\d+)', card_text)
        if m:
            count = int(m.group(1))
            info["employee_count"] = count
            info["is_small"] = count <= 10

        info["snippet"] = card_text[:300]
        info["source"] = "stanby"

    except Exception:
        pass
    return info


def scrape_stanby(max_pages=3):
    results = []
    seen = set()

    for query in SEARCH_QUERIES:
        q_enc = quote(query)
        for page in range(1, max_pages + 1):
            url = f"{BASE_URL}/search?q={q_enc}&page={page}"
            print(f"  [スタンバイ] '{query}' page={page} ...")

            html = fetch(url)
            if not html:
                break

            soup = parse(html)
            cards = soup.select(
                "[class*='JobCard'], [class*='job-card'], "
                "article, li.job, .result-item"
            )

            if not cards:
                break

            found_new = False
            for card in cards:
                info = _parse_stanby_card(card)
                company = info.get("company_name", "")
                if not company or company in seen:
                    continue
                seen.add(company)
                results.append(info)
                found_new = True

            if not found_new:
                break

            polite_sleep(2.0, 4.0)

        polite_sleep(2.0, 4.0)

    return results
