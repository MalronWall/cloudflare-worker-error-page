import requests
import time
import os

CF_ACCOUNT_ID = os.environ["CF_ACCOUNT_ID"]
CF_NAMESPACE_ID = os.environ["CF_NAMESPACE_ID"]
CF_API_TOKEN = os.environ["CF_API_TOKEN"]
KV_IP_KEY = os.environ.get("KV_IP_KEY", "wan-ip")
KV_4G_KEY = os.environ.get("KV_4G_KEY", "wan-is-4g")

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

def main():
    last_ip = None
    last_is_4g = None
    while True:
        try:
            ip = get_wan_ip()
            print(f"[INFO] Retrieved IP: {ip}")
            is_4g = is_mobile_ip(ip)
            print(f"[INFO] Is mobile (4G/5G): {is_4g}")

            # Update if IP or connection type changed
            if ip != last_ip:
                print(f"[INFO] IP change detected, updating Cloudflare KV.")
                update_cloudflare_kv(KV_IP_KEY, ip)
                last_ip = ip

            if is_4g != last_is_4g:
                print(f"[INFO] Connection type change detected, updating Cloudflare KV.")
                update_cloudflare_kv(KV_4G_KEY, str(is_4g).lower())
                last_is_4g = is_4g
        except Exception as e:
            print(f"[ERROR] {e}")
        time.sleep(60)

if __name__ == "__main__":
    main()