"""
Indeed Japan scraper
Target: https://jp.indeed.com/
"""
import re
from urllib.parse import urljoin, quote
from .base import fetch, parse, polite_sleep

BASE_URL = "https://jp.indeed.com"

SEARCH_QUERIES = [
    ("営業 制作会社 ホームページ", ""),
    ("営業 Web制作", ""),
    ("営業 チラシ 制作会社", ""),
    ("営業 システム開発", ""),
    ("営業 デザイン会社", ""),
    ("営業 ホームページ作成", ""),
    ("営業 グラフィックデザイン", ""),
    ("法人営業 制作会社", ""),
    ("法人営業 開発会社", ""),
]

EMPLOYEE_PATTERN = re.compile(r'(\d+)\s*[〜~～]\s*(\d+)\s*名|(\d+)\s*名')


def _parse_employee_count(text):
    """Try to parse employee count from text."""
    m = EMPLOYEE_PATTERN.search(text)
    if m:
        if m.group(1):
            return int(m.group(2))  # upper bound of range
        if m.group(3):
            return int(m.group(3))
    return None


def _parse_indeed_card(card):
    """Extract info from an Indeed job card."""
    info = {}
    try:
        # Job title
        title_el = card.select_one("h2.jobTitle a, a[id^='job_'] span")
        if title_el:
            info["job_title"] = title_el.get_text(strip=True)

        # Company name
        company_el = card.select_one("[data-testid='company-name'], .companyName, span.company")
        if company_el:
            info["company_name"] = company_el.get_text(strip=True)

        # Location
        loc_el = card.select_one("[data-testid='text-location'], .companyLocation, .location")
        if loc_el:
            info["location"] = loc_el.get_text(strip=True)

        # Snippet
        snippet_el = card.select_one(".job-snippet, [class*='snippet'], ul.jobCardShelfContainer")
        if snippet_el:
            info["snippet"] = snippet_el.get_text(" ", strip=True)[:400]

        # Job URL
        link_el = card.select_one("a[id^='job_'], h2.jobTitle a, a[data-jk]")
        if link_el:
            href = link_el.get("href", "")
            info["job_url"] = urljoin(BASE_URL, href)

        card_text = card.get_text()
        emp = _parse_employee_count(card_text)
        info["employee_count"] = emp
        info["is_small"] = emp is not None and emp <= 10

    except Exception:
        pass
    return info


def scrape_indeed(max_pages=3):
    """Scrape Indeed Japan for relevant job listings."""
    results = []
    seen = set()

    for query, location in SEARCH_QUERIES:
        q_enc = quote(query)
        l_enc = quote(location)

        for page in range(0, max_pages * 10, 10):
            url = f"{BASE_URL}/jobs?q={q_enc}&l={l_enc}&start={page}&fromage=60"
            print(f"  [Indeed] '{query}' page_start={page} ...")

            html = fetch(url)
            if not html:
                break

            soup = parse(html)

            # Indeed uses various card selectors depending on A/B test
            cards = soup.select(
                ".job_seen_beacon, .jobsearch-SerpJobCard, "
                "[data-testid='slider_item'], .tapItem, .result"
            )

            if not cards:
                break

            found_new = False
            for card in cards:
                info = _parse_indeed_card(card)
                company = info.get("company_name", "")
                if not company or company in seen:
                    continue
                seen.add(company)
                results.append(info)
                found_new = True

            if not found_new:
                break

            polite_sleep(2.0, 4.0)

        polite_sleep(3.0, 5.0)

    return results
