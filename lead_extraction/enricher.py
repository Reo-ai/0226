"""
Company website enricher.
Given a company name + optional URL, scrapes the company's 会社概要 page
to extract: 代表者名, 住所, 電話番号, URL.
"""
import re
from urllib.parse import urljoin, urlparse
from scrapers.base import fetch, parse, polite_sleep

# Patterns to extract company details from 会社概要 pages
REP_PATTERNS = [
    re.compile(r'代表者?[名]?\s*[:：]\s*([^\n\r<]{2,20})'),
    re.compile(r'代表取締役[社長]?\s*[:：]?\s*([^\n\r<]{2,20})'),
    re.compile(r'代表\s*[:：]\s*([^\n\r<]{2,20})'),
    re.compile(r'社長\s*[:：]\s*([^\n\r<]{2,20})'),
    re.compile(r'CEO\s*[:：]?\s*([^\n\r<]{2,30})'),
]

PHONE_PATTERNS = [
    re.compile(r'(?:電話|TEL|tel|Tel)[\s\:：]*([0-9０-９\-－（）()\s]{10,18})'),
    re.compile(r'\b(0\d{1,4}[-\-]\d{1,4}[-\-]\d{4})\b'),
    re.compile(r'(0\d{9,10})\b'),
]

ADDRESS_PATTERNS = [
    re.compile(r'(?:住所|所在地|address)[^\n\r]*[:：]\s*([^\n\r<]{10,80})'),
    re.compile(r'(〒\d{3}-\d{4}[^\n\r<]{5,60})'),
    re.compile(r'(東京都[^\n\r<]{5,50}|大阪府[^\n\r<]{5,50}|神奈川県[^\n\r<]{5,50}|'
               r'愛知県[^\n\r<]{5,50}|福岡県[^\n\r<]{5,50}|北海道[^\n\r<]{5,50}|'
               r'埼玉県[^\n\r<]{5,50}|千葉県[^\n\r<]{5,50}|京都府[^\n\r<]{5,50}|'
               r'兵庫県[^\n\r<]{5,50}|広島県[^\n\r<]{5,50}|宮城県[^\n\r<]{5,50})'),
]

EMPLOYEE_PATTERNS = [
    re.compile(r'従業員[数]?\s*[:：]\s*(\d+)\s*名?'),
    re.compile(r'社員数\s*[:：]\s*(\d+)\s*名?'),
    re.compile(r'スタッフ\s*[:：]\s*(\d+)\s*名?'),
    re.compile(r'(\d+)\s*名\s*(?:の社員|のスタッフ|のメンバー)'),
]

# URL patterns for 会社概要 subpages
ABOUT_PATHS = [
    "/company", "/about", "/kaisha", "/gaiyou",
    "/company/", "/about/", "/corporate",
    "/aboutus", "/company-profile",
    "会社概要", "about",
]


def _normalize_phone(phone_str):
    """Normalize phone number to standard format."""
    phone = re.sub(r'[^\d]', '', phone_str)
    if len(phone) == 10:
        return f"{phone[:3]}-{phone[3:6]}-{phone[6:]}"
    if len(phone) == 11:
        return f"{phone[:3]}-{phone[3:7]}-{phone[7:]}"
    return phone_str.strip()


def _extract_from_text(text, patterns):
    """Try each pattern and return first match."""
    for pat in patterns:
        m = pat.search(text)
        if m:
            return m.group(1).strip()
    return ""


def _find_about_url(soup, base_url):
    """Find 会社概要 or about page link."""
    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        text = a.get_text(strip=True)
        full_url = urljoin(base_url, href)

        if any(kw in text for kw in ["会社概要", "会社案内", "企業情報", "About", "ABOUT"]):
            return full_url
        if any(path in href.lower() for path in ABOUT_PATHS):
            return full_url

    return None


def _parse_table_details(soup):
    """Parse company details from a definition list or table."""
    details = {}

    # Try dl/dt/dd structure (common for 会社概要)
    for dl in soup.find_all("dl"):
        dts = dl.find_all("dt")
        dds = dl.find_all("dd")
        for dt, dd in zip(dts, dds):
            key = dt.get_text(strip=True)
            val = dd.get_text(" ", strip=True)
            if "代表" in key:
                details["rep_name"] = val
            elif "住所" in key or "所在地" in key:
                details["address"] = val
            elif "電話" in key or "TEL" in key.upper():
                details["phone"] = _normalize_phone(val)
            elif "従業員" in key or "社員" in key:
                m = re.search(r'(\d+)', val)
                if m:
                    details["employee_count"] = int(m.group(1))

    # Try table structure
    if not details:
        for table in soup.find_all("table"):
            for row in table.find_all("tr"):
                cells = row.find_all(["th", "td"])
                if len(cells) >= 2:
                    key = cells[0].get_text(strip=True)
                    val = cells[1].get_text(" ", strip=True)
                    if "代表" in key:
                        details["rep_name"] = val
                    elif "住所" in key or "所在地" in key:
                        details["address"] = val
                    elif "電話" in key or "TEL" in key.upper():
                        details["phone"] = _normalize_phone(val)
                    elif "従業員" in key or "社員" in key:
                        m = re.search(r'(\d+)', val)
                        if m:
                            details["employee_count"] = int(m.group(1))

    return details


def enrich_company(company_name, company_url=None):
    """
    Fetch company website and extract details.
    Returns dict: {company_name, rep_name, address, phone, url, employee_count}
    """
    result = {
        "company_name": company_name,
        "rep_name": "",
        "address": "",
        "phone": "",
        "url": company_url or "",
        "employee_count": None,
    }

    if not company_url:
        return result

    # Normalize URL
    if not company_url.startswith("http"):
        company_url = "https://" + company_url

    # Fetch homepage
    html = fetch(company_url)
    if not html:
        return result

    soup = parse(html)
    result["url"] = company_url

    # Try to find 会社概要 page
    about_url = _find_about_url(soup, company_url)

    if about_url and about_url != company_url:
        polite_sleep(1.0, 2.0)
        about_html = fetch(about_url)
        if about_html:
            about_soup = parse(about_html)
            table_details = _parse_table_details(about_soup)
            if table_details:
                result.update(table_details)
                if result["rep_name"] and result["address"]:
                    return result

            # Fallback: regex on full text
            text = about_soup.get_text("\n")
            if not result.get("rep_name"):
                result["rep_name"] = _extract_from_text(text, REP_PATTERNS)
            if not result.get("address"):
                result["address"] = _extract_from_text(text, ADDRESS_PATTERNS)
            if not result.get("phone"):
                raw_phone = _extract_from_text(text, PHONE_PATTERNS)
                if raw_phone:
                    result["phone"] = _normalize_phone(raw_phone)
            if not result.get("employee_count"):
                raw_emp = _extract_from_text(text, EMPLOYEE_PATTERNS)
                if raw_emp:
                    m = re.search(r'(\d+)', raw_emp)
                    if m:
                        result["employee_count"] = int(m.group(1))

    # Also try homepage itself
    if not result["rep_name"] or not result["address"]:
        table_details = _parse_table_details(soup)
        for k, v in table_details.items():
            if not result.get(k):
                result[k] = v

        text = soup.get_text("\n")
        if not result["rep_name"]:
            result["rep_name"] = _extract_from_text(text, REP_PATTERNS)
        if not result["address"]:
            result["address"] = _extract_from_text(text, ADDRESS_PATTERNS)
        if not result["phone"]:
            raw_phone = _extract_from_text(text, PHONE_PATTERNS)
            if raw_phone:
                result["phone"] = _normalize_phone(raw_phone)

    # Clean up rep_name (remove common noise)
    rep = result.get("rep_name", "")
    rep = re.sub(r'(株式会社|合同会社|有限会社|代表取締役|社長|CEO)', '', rep).strip()
    result["rep_name"] = rep

    return result


def enrich_from_job_url(job_url):
    """Visit a job listing page to find the company website URL."""
    html = fetch(job_url)
    if not html:
        return None

    soup = parse(html)

    # Look for company website link
    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        text = a.get_text(strip=True)
        if any(kw in text for kw in ["会社HP", "公式サイト", "ホームページ", "企業サイト", "会社サイト"]):
            return href

    # Look for external link patterns
    for a in soup.find_all("a", href=True):
        href = a.get("href", "")
        if (href.startswith("http") and
                "indeed.com" not in href and
                "wantedly.com" not in href and
                "kyujinbox.com" not in href and
                "duckduckgo.com" not in href):
            # Likely a company website
            return href

    return None
