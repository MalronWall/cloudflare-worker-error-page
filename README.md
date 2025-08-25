<!-- Choisissez votre langue / Choose votre language: -->
[en English](#english) | [🇫🇷 Français](#français)

---

## <a name="english"></a>en English

# Cloudflare Worker Error Page

This project allows you to deploy a custom error page using a Cloudflare Worker.

![Create worker](images/other/presentation.png)
![Create worker](images/other/maintenance.png)

## Installation Steps

### 1. Fork this repository

### 2. Create a Worker on Cloudflare

- Log in to your Cloudflare dashboard.
- Go to the **Workers Routes** section.
- Got to Manage Workers.
- Go to Create
- Select import a repository
- Link your Github account to Cloudflare and select the repository forked
- Add the project name : ``` cloudflare-worker-error-page ```
- Add the build command : ``` npx wrangler deploy --assets=./ ```
- Go to Create and deploy
- Wait for the build to finish and click on continue to project
- Go to Settings -> Domains & Routes -> Add
- Click on Route and selecto your domaine in Zone
- Add this on Route : ``` *domain.fr/* ``` Don't put the . after the first * otherwise it's going to work only for subdomain. And you can add multiple Route with multiple domain

![Create worker](images/create_worker/create_worker_1.png)
![Create worker](images/create_worker/create_worker_2.png)
![Create worker](images/create_worker/create_worker_3.png)
![Create worker](images/create_worker/create_worker_4.png)
![Create worker](images/create_worker/create_worker_5.png)
![Create worker](images/create_worker/create_worker_6.png)
![Create worker](images/create_worker/create_worker_7.png)
![Create worker](images/create_worker/create_worker_8.png)
![Create worker](images/create_worker/create_worker_9.png)

### 3. Create a KV namespace

- In Cloudflare, go to **Workers > KV**.
- Create a namespace named: ``` cloudflare-worker-error-page ```
- Copy the namespace ID and add it to the `id` field in the `kv_namespaces` section of the `wrangler.toml` file.
- Because you link the github repo with Cloudflare the projet the worker will be automatically updated.

![Create KV](images/create_kv/create_kv.png)
![Add names](images/create_kv/create_kv_add_name.png)
![Copy id](images/create_kv/create_kv_copy_id.png)

### 4. OPTIONAL Add a docker container on your server for send the info to Cloudflare when your 4G/5G backup is active

- On wrangler.toml set ``` ENABLE_4G_BANNER = true ```
- clone this repo on your server
- execute ``` docker build -t wan-ip-checker . ``` for build the docker image
- launch the docker container with this command :
```
docker run -e CF_ACCOUNT_ID=Your_cloudflare_account_id \
           -e CF_NAMESPACE_ID=Your_cloudflare_namespace_id \
           -e CF_API_TOKEN=Your_cloudflare_api_token \
           -e KV_KEY=wan-ip \
           -e KV_4G_KEY=wan-is-4g \
           wan-ip-checker
```
- You can get tour account id on the [dashboard](https://dash.cloudflare.com/login), click on the 3 dot right to your mail
- You can get your namespace id in your wrangler.toml
- For generate a new api token go to your profile -> API Tokens -> Create Token -> click on Use template for Edit Cloudflare Workers
- remove every permissions exept **Workers KV Storage** and set it to Edit
- On Account Resources select your cloudflare account
- On Zone Resources select Include and All zones
- Click on **Continue to summary** and **Create token**

### 5. Enable environment variables

- Open the `wrangler.toml` file.
- Remove the `#` in front of the variables you want to enable, or add them as **secrets** in Cloudflare (Worker Variables/Secrets section).

## Notes

- Canva URLs for error pages are configurable in `wrangler.toml`.

---























## <a name="français"></a>🇫🇷 Français

