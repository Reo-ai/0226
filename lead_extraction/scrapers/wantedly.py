"""
Wantedly scraper (HTML-accessible endpoints)
Target: https://www.wantedly.com/projects
Focuses on startups and small companies.
"""
import re
from urllib.parse import urljoin, quote
from .base import fetch, parse, polite_sleep

BASE_URL = "https://www.wantedly.com"

# Wantedly occupation codes for sales
# occupation_types[]=sales
SEARCH_PARAMS = [
    "occupation_types[]=sales&hiring_types[]=mid_career&company_size=1_10",
    "occupation_types[]=sales&hiring_types[]=mid_career&company_size=11_30",
]

INDUSTRY_KEYWORDS = [
    "Web・インターネット", "IT・通信", "ゲーム・エンターテイメント",
    "広告・マーケティング", "デザイン", "クリエイティブ",
]


def _parse_wantedly_card(card):
    """Extract company info from Wantedly project card."""
    info = {}
    try:
        title_el = card.select_one("h2, h3, .title, [class*='ProjectCard__title']")
        if title_el:
            info["job_title"] = title_el.get_text(strip=True)

        company_el = card.select_one(".company-name, [class*='company'], [class*='Company']")
        if company_el:
            info["company_name"] = company_el.get_text(strip=True)

        link_el = card.select_one("a[href*='/projects/']")
        if link_el:
            info["job_url"] = urljoin(BASE_URL, link_el.get("href", ""))

        # Employee count badge
        count_el = card.select_one("[class*='member'], [class*='size']")
        if count_el:
            txt = count_el.get_text(strip=True)
            m = re.search(r'(\d+)', txt)
            if m:
                info["employee_count"] = int(m.group(1))
                info["is_small"] = int(m.group(1)) <= 10

    except Exception:
        pass
    return info


def scrape_wantedly(max_pages=3):
    """Scrape Wantedly for small company sales jobs."""
    results = []
    seen = set()

    # Wantedly search (HTML version - may need JS for some features)
    search_queries = [
        "営業 制作会社",
        "営業 Web制作",
        "営業 システム開発",
        "営業 デザイン",
    ]

    for query in search_queries:
        q_enc = quote(query)
        for page in range(1, max_pages + 1):
            url = f"{BASE_URL}/projects?page={page}&occupation_types[]=sales&query={q_enc}"
            print(f"  [Wantedly] '{query}' page={page} ...")

            html = fetch(url)
            if not html:
                break

            soup = parse(html)
            cards = soup.select(
                "[class*='ProjectCard'], [class*='project-card'], "
                ".projects-list li, [data-component*='project']"
            )

            if not cards:
                break

            found_new = False
            for card in cards:
                info = _parse_wantedly_card(card)
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
