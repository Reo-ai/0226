"""
Google Custom Search scraper using SerpAPI-compatible free endpoints.
Uses DuckDuckGo as fallback (no API key needed).
"""
import re
from urllib.parse import urljoin, quote, urlencode
from .base import fetch, parse, polite_sleep

# DuckDuckGo HTML search (no JS required)
DDG_URL = "https://html.duckduckgo.com/html/"

QUERIES = [
    "制作会社 営業募集 従業員10名以下 site:wantedly.com OR site:jp.indeed.com",
    "ホームページ制作会社 営業 求人 少人数",
    "デザイン会社 システム開発 営業 採用 小規模",
    "チラシ ポスター 制作会社 営業 求人",
    "Web制作会社 営業担当 募集 少人数",
    "システム開発 営業 求人 10名以下",
    "グラフィックデザイン 制作 営業 採用",
    "ウェブ制作 営業 正社員 求人",
]


def _extract_links_ddg(html):
    """Extract search result links from DuckDuckGo HTML results."""
    soup = parse(html)
    links = []

    for result in soup.select(".result, .web-result, .results_links"):
        title_el = result.select_one("a.result__a, h2 a, .result__title a")
        snippet_el = result.select_one(".result__snippet, .result__body")

        if title_el:
            href = title_el.get("href", "")
            title = title_el.get_text(strip=True)
            snippet = snippet_el.get_text(strip=True) if snippet_el else ""

            # Filter DDG redirect URLs
            if "duckduckgo.com" in href or not href.startswith("http"):
                # Try to extract actual URL from redirect
                m = re.search(r'uddg=([^&]+)', href)
                if m:
                    from urllib.parse import unquote
                    href = unquote(m.group(1))

            if href.startswith("http"):
                links.append({
                    "title": title,
                    "url": href,
                    "snippet": snippet,
                })

    return links


def search_duckduckgo(query, max_results=10):
    """Search DuckDuckGo and return result links."""
    data = urlencode({"q": query, "kl": "jp-jp"})
    url = f"{DDG_URL}?{data}"

    html = fetch(url)
    if not html:
        return []

    results = _extract_links_ddg(html)
    return results[:max_results]


def scrape_via_search():
    """
    Use search engines to find company websites directly.
    Returns list of dicts: {company_name, url, snippet}
    """
    all_links = []
    seen_urls = set()

    for query in QUERIES:
        print(f"  [Search] '{query[:50]}...' ")
        links = search_duckduckgo(query, max_results=10)

        for link in links:
            url = link.get("url", "")
            if url and url not in seen_urls:
                seen_urls.add(url)
                all_links.append(link)

        polite_sleep(3.0, 6.0)

    return all_links
