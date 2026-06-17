"""
Green (IT転職) scraper - https://www.green-japan.com/
Specializes in IT/Web companies, many small startups.
"""
import re
from urllib.parse import urljoin, quote
from .base import fetch, parse, polite_sleep

BASE_URL = "https://www.green-japan.com"

SEARCH_QUERIES = [
    "営業 Web制作",
    "営業 制作会社",
    "営業 システム開発",
    "営業 デザイン",
    "セールス Web",
]


def _parse_green_card(card):
    """Parse a Green job listing card."""
    info = {}
    try:
        title_el = card.select_one("h2, h3, .job-title, [class*='title']")
        if title_el:
            info["job_title"] = title_el.get_text(strip=True)

        company_el = card.select_one(".company-name, [class*='company'], a[href*='/company/']")
        if company_el:
            info["company_name"] = company_el.get_text(strip=True)
            href = company_el.get("href", "")
            if href:
                info["company_url"] = urljoin(BASE_URL, href)

        link_el = card.select_one("a[href*='/job/']")
        if link_el:
            info["job_url"] = urljoin(BASE_URL, link_el.get("href", ""))

        # Employee count hint
        text = card.get_text()
        m = re.search(r'(\d+)\s*名', text)
        if m:
            count = int(m.group(1))
            if count <= 50:  # reasonable threshold for employee count
                info["employee_count"] = count
                info["is_small"] = count <= 10

        info["snippet"] = card.get_text(" ", strip=True)[:300]

    except Exception:
        pass
    return info


def scrape_green(max_pages=3):
    """Scrape Green for IT/Web company sales job listings."""
    results = []
    seen = set()

    for query in SEARCH_QUERIES:
        q_enc = quote(query)
        for page in range(1, max_pages + 1):
            url = f"{BASE_URL}/job?query={q_enc}&page={page}"
            print(f"  [Green] '{query}' page={page} ...")

            html = fetch(url)
            if not html:
                break

            soup = parse(html)
            cards = soup.select(
                ".job-list-item, [class*='JobCard'], [class*='job_card'], "
                ".search-result-item, article"
            )

            if not cards:
                break

            found_new = False
            for card in cards:
                info = _parse_green_card(card)
                company = info.get("company_name", "")
                if not company or company in seen:
                    continue
                seen.add(company)
                info["source"] = "green"
                results.append(info)
                found_new = True

            if not found_new:
                break

            polite_sleep(2.0, 4.0)

        polite_sleep(2.0, 4.0)

    return results
