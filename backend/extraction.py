import threading

"""Bounded public-web fetching with IP-pinned connections and redirect checks."""
import http.client
import ipaddress
import socket
import ssl
from urllib.parse import urlsplit, urljoin

import certifi
import trafilatura

MAX_BYTES = 2_000_000


def resolve_public(url):
    parsed = urlsplit(url)
    if parsed.scheme not in {"http", "https"} or not parsed.hostname or parsed.username or parsed.password:
        raise ValueError("Use a public http or https article URL without credentials.")
    port = parsed.port or (443 if parsed.scheme == "https" else 80)
    if port not in {80, 443}:
        raise ValueError("Only standard web ports are supported.")
    hostname = parsed.hostname.encode("idna").decode()
    addresses = {info[4][0] for info in socket.getaddrinfo(hostname, port, type=socket.SOCK_STREAM)}
    if not addresses or any(not ipaddress.ip_address(ip).is_global for ip in addresses):
        raise ValueError("Private, local, and reserved network addresses cannot be fetched.")
    return parsed, hostname, port, sorted(addresses)[0]


class PinnedHTTPSConnection(http.client.HTTPSConnection):
    def __init__(self, hostname, port, address):
        super().__init__(hostname, port, timeout=7, context=ssl.create_default_context(cafile=certifi.where()))
        self.address = address

    def connect(self):
        raw = socket.create_connection((self.address, self.port), self.timeout)
        try:
            self.sock = self._context.wrap_socket(raw, server_hostname=self.host)
        except Exception:
            raw.close()
            raise


def _fetch_article(url):
    requested_url = url
    for _ in range(4):
        parsed, host, port, address = resolve_public(url)
        if parsed.scheme == "https":
            connection = PinnedHTTPSConnection(host, port, address)
        else:
            connection = http.client.HTTPConnection(address, port, timeout=7)
        try:
            path = parsed.path or "/"
            if parsed.query:
                path += "?" + parsed.query
            connection.request("GET", path, headers={"Host": host, "User-Agent": "VerityNews/1.0 (article reader)", "Accept": "text/html", "Accept-Encoding": "identity"})
            response = connection.getresponse()
            if response.status in {301, 302, 303, 307, 308}:
                location = response.getheader("Location")
                if not location:
                    raise ValueError("The publisher returned an invalid redirect.")
                url = urljoin(url, location)
                continue
            if response.status != 200:
                raise ValueError("The publisher blocked access or the article was not found. Paste the text instead.")
            if not any(kind in response.getheader("Content-Type", "") for kind in ("text/html", "application/xhtml+xml")):
                raise ValueError("This URL does not return an HTML article.")
            body = response.read(MAX_BYTES + 1)
            if len(body) > MAX_BYTES:
                raise ValueError("The page is too large. Paste the article text instead.")
        finally:
            connection.close()
        document = trafilatura.bare_extraction(body, url=url, include_comments=False, include_tables=False, with_metadata=True)
        text = document.text if document else ""
        if not text or len(text.strip()) < 80:
            raise ValueError("We could not extract enough article text. Paste it manually; paywalls are not bypassed.")
        return {"requested_url": requested_url, "extraction_status": "fetched", "title": document.title or "Untitled article", "text": text[:20000], "url": url, "publisher": host, "published_date": document.date or None, "truncated": len(text) > 20000}
    raise ValueError("The page redirected too many times. Paste the article text instead.")


_source_slots = threading.BoundedSemaphore(4)


class SourceBusyError(RuntimeError):
    pass


def fetch_article(url):
    if not _source_slots.acquire(blocking=False):
        raise SourceBusyError("Source reading is busy. Try again shortly.")
    try:
        return _fetch_article(url)
    finally:
        _source_slots.release()
