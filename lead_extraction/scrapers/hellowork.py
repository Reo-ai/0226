"""
ハローワーク インターネットサービス scraper
Government job listings - reliable HTML source with no heavy anti-scraping.
URL: https://www.hellowork.mhlw.go.jp/
"""
import re
from urllib.parse import urljoin, urlencode
from .base import fetch, parse, polite_sleep

BASE_URL = "https://www.hellowork.mhlw.go.jp"
SEARCH_URL = f"{BASE_URL}/kensaku/GECA110010.do"

# Business type codes for ハローワーク
# We use free-text search combined with industry filtering
SEARCH_PARAMS_LIST = [
    {
        "kywdStr": "営業 制作会社",
        "searchBtn": "検索",
        "kjKbnCode": "1",  # 正社員
    },
    {
        "kywdStr": "営業 ホームページ制作",
        "searchBtn": "検索",
        "kjKbnCode": "1",
    },
    {
        "kywdStr": "営業 システム開発",
        "searchBtn": "検索",
        "kjKbnCode": "1",
    },
    {
        "kywdStr": "営業 デザイン会社",
        "searchBtn": "検索",
        "kjKbnCode": "1",
    },
    {
        "kywdStr": "営業 Web制作",
        "searchBtn": "検索",
        "kjKbnCode": "1",
    },
]


def _parse_job_card_hw(card):
    """Parse a ハローワーク job listing card."""
    info = {}
    try:
        text = card.get_text("\n", strip=True)

        # Company name
        company_el = card.select_one(".company, .jigyosha, [class*='company']")
        if company_el:
            info["company_name"] = company_el.get_text(strip=True)
        else:
            # Try to find from text pattern
            m = re.search(r'事業所名[：:]\s*([^\n\r]{2,30})', text)
            if m:
                info["company_name"] = m.group(1).strip()

        # Job title
        title_el = card.select_one("h2, h3, .shokugyomei, [class*='title']")
        if title_el:
            info["job_title"] = title_el.get_text(strip=True)

        # Location
        m = re.search(r'就業場所[：:]\s*([^\n\r]{3,30})', text)
        if m:
            info["location"] = m.group(1).strip()

        # Employee count
        m = re.search(r'従業員[数]?[：:]\s*(\d+)\s*人?名?', text)
        if m:
            count = int(m.group(1))
            info["employee_count"] = count
            info["is_small"] = count <= 10

        # Job URL
        link_el = card.select_one("a[href]")
        if link_el:
            href = link_el.get("href", "")
            info["job_url"] = urljoin(BASE_URL, href)

        info["snippet"] = text[:300]

    except Exception:
        pass
    return info


def scrape_hellowork(max_pages=5):
    """Scrape ハローワーク for relevant job listings."""
    results = []
    seen = set()

    for params in SEARCH_PARAMS_LIST:
        query_str = params.get("kywdStr", "")
        print(f"  [HW] '{query_str}' ...")

        # POST request to ハローワーク search
        for page in range(1, max_pages + 1):
            page_params = dict(params)
            page_params["pg"] = str(page)

            try:
                import requests
                from .base import get_headers
                r = requests.post(SEARCH_URL, data=page_params,
                                  headers=get_headers(), timeout=15)
                r.encoding = "UTF-8"
                html = r.text
            except Exception as e:
                print(f"    [WARN] HW request failed: {e}")
                break

            if not html:
                break

            soup = parse(html)

            # ハローワーク result items
            cards = soup.select(".kyujin-item, .result-item, tr.kyujin, "
                                "[class*='kyujin'], .job-list li, table.list tr")

            if not cards:
                break

            found_new = False
            for card in cards:
                info = _parse_job_card_hw(card)
                company = info.get("company_name", "")
                if not company or company in seen:
                    continue
                seen.add(company)
                info["source"] = "hellowork"
                results.append(info)
                found_new = True

            if not found_new:
                break

            polite_sleep(2.0, 4.0)

        polite_sleep(3.0, 5.0)

    return results
