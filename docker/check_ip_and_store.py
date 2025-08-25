import requests
import time
import os

CF_ACCOUNT_ID = os.environ["CF_ACCOUNT_ID"]
CF_NAMESPACE_ID = os.environ["CF_NAMESPACE_ID"]
CF_API_TOKEN = os.environ["CF_API_TOKEN"]
KV_KEY = os.environ.get("KV_KEY", "wan-ip")

def get_wan_ip():
    return requests.get("https://api.ipify.org").text.strip()

def get_kv_url(key):
    return f"https://api.cloudflare.com/client/v4/accounts/{CF_ACCOUNT_ID}/storage/kv/namespaces/{CF_NAMESPACE_ID}/values/{key}"

def update_cloudflare_kv(ip):
    url = get_kv_url(KV_KEY)
    headers = {
        "Authorization": f"Bearer {CF_API_TOKEN}",
        "Content-Type": "text/plain"
    }
    resp = requests.put(url, data=ip, headers=headers)
    resp.raise_for_status()

def main():
    last_ip = None
    while True:
        try:
            ip = get_wan_ip()
            print(f"[INFO] Retrieved IP: {ip}")
            if ip != last_ip:
                print(f"[INFO] Change detected, updating Cloudflare KV.")
                update_cloudflare_kv(ip)
                last_ip = ip
        except Exception as e:
            print(f"[ERROR] {e}")
        time.sleep(60)

if __name__ == "__main__":
    main()