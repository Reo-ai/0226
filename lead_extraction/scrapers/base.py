import requests
import time
import random
from bs4 import BeautifulSoup

HEADERS_LIST = [
    {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
        "Accept-Language": "ja-JP,ja;q=0.9,en-US;q=0.8",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
    {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
        "Accept-Language": "ja,en-US;q=0.9",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    },
]


def get_headers():
    return random.choice(HEADERS_LIST)


def fetch(url, timeout=15, retries=3):
    for i in range(retries):
        try:
            r = requests.get(url, headers=get_headers(), timeout=timeout)
            r.raise_for_status()
            r.encoding = r.apparent_encoding
            return r.text
        except Exception as e:
            if i < retries - 1:
                time.sleep(2 ** i)
            else:
                print(f"  [WARN] fetch failed: {url} -> {e}")
                return None


def parse(html):
    return BeautifulSoup(html, "lxml")


def polite_sleep(min_sec=1.5, max_sec=3.5):
    time.sleep(random.uniform(min_sec, max_sec))
