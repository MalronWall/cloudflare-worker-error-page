import requests
import time
import os
from datetime import datetime

CF_ACCOUNT_ID = os.environ["CF_ACCOUNT_ID"]
CF_NAMESPACE_ID = os.environ["CF_NAMESPACE_ID"]
CF_API_TOKEN = os.environ["CF_API_TOKEN"]
KV_IP_KEY = os.environ.get("KV_IP_KEY", "wan-ip")
KV_4G_KEY = os.environ.get("KV_4G_KEY", "wan-is-4g")
SLEEP_SECONDS = int(os.environ.get("SLEEP_SECONDS", 60))

def get_wan_ip():
    return requests.get("https://api.ipify.org").text.strip()

def get_kv_url(key):
    return f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/storage/kv/namespaces/{CF_NAMESPACE_ID}/values/{key}"

def update_cloudflare_kv(key, value):
    url = get_kv_url(key)
    headers = {
        "Authorization": f"Bearer {CF_API_TOKEN}",
        "Content-Type": "text/plain"
    }
    resp = requests.put(url, data=value, headers=headers)
    resp.raise_for_status()

def is_mobile_ip(ip):
    # Query ip-api.com for network details
    resp = requests.get(f"http://ip-api.com/json/{ip}?fields=mobile,org,as,isp")
    data = resp.json()
    # ip-api.com returns 'mobile': True if the connection is mobile (4G/5G)
    return bool(data.get("mobile", False))

def log(msg, level="INFO"):
    now = datetime.now().isoformat(timespec="seconds")
    print(f"[{now}] [{level}] {msg}")

def main():
    last_ip = None
    last_is_4g = None
    while True:
        try:
            log(f"Last IP: {last_ip}")
            ip = get_wan_ip()
            log(f"Retrieved IP: {ip}")
            is_4g = is_mobile_ip(ip)
            log(f"Is mobile (4G/5G): {is_4g}")

            # Update if IP or connection type changed
            if ip != last_ip:
                log("IP change detected, updating Cloudflare KV.")
                update_cloudflare_kv(KV_IP_KEY, ip)
                last_ip = ip

            if is_4g != last_is_4g:
                log("Connection type change detected, updating Cloudflare KV.")
                update_cloudflare_kv(KV_4G_KEY, str(is_4g).lower())
                last_is_4g = is_4g
        except Exception as e:
            log(str(e), level="ERROR")
        time.sleep(SLEEP_SECONDS)

if __name__ == "__main__":
    main()