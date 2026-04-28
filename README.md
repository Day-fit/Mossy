# Mossy
Mossy is self-hosted password manager that is built to counter self-hosted disadvantages.
## Architecture
Mossy is build in hybrid architecture, it uses backend (hosted by us) that makes transporting password to any location possible, it communicates with vault (hosted by you), via STOMP, thanks to that, you don't have to worry about firewall, or opening ports on your router

### Backend
Mossy's backend is build in microservice architecture thanks to that if something goes wrong with statistics related code, password access is still possible, in future we will use k8s instead of docker-compose, to achieve zero-down-time. [Precise break down](https://deepwiki.com/Day-fit/Mossy)
#### Optimization
Some of microservices use redis as cache layer to speed up database queries

### Browser extension
Provides suggestions for filling password, and captures passwords

### Vault
Vault is place where your passwords are stored. It has it's own database, but even vault cannot see your keys, as E2EE ensures that they are only accessible from your browser.

## Instalation
- Download [compose.yaml](https://raw.githubusercontent.com/Day-fit/Mossy/refs/heads/main/self-hosted/compose.yml), and [.env.example](https://raw.githubusercontent.com/Day-fit/Mossy/refs/heads/main/self-hosted/.env.example) file.
- Go to [mossy vaults tab](https://mossy.dayfit.pl/vaults) and add your vault
- Copy vault ID and API Key (**you won't be able to see it again!**)
- Paste it into `.env`
- Set up docker with docker compose
- Place `compose.yaml` file in same directory as `.env` file
- Run this command
```bash
docker compose --profile prod up -d
```
- Refresh website

## Browser extension installation
- Go to [releases](https://github.com/Day-fit/Mossy/releases)
- Download latest version (`.crx` file)
- Add it to your browser, you might need to allow installation of untrusted extensions (from other source than web store)
- Login into extension (with regular credentials)
- Synchronize vault key
- That's it, from now on web extension should suggest you to use saved password