# Mossy
Mossy is self-hosted password manager that is built to counter self-hosted disadvantages.

## Why Mossy? (vs Vaultwarden/Bitwarden)

| Problem with self-hosting | Mossy's solution |
|---|---|
| Requires open ports / port forwarding | Backend acts as relay via STOMP — vault connects *out*, not in |
| Firewall & uPnP headaches | Zero config — just run `docker compose up` |
| Trusting the server with your keys | Impossible — E2EE means vault never sees plaintext keys |
| Single point of failure | Microservice architecture isolates failures |

## Security Model
Mossy uses End-to-End Encryption with a Diffie-Hellman key exchange, meaning your passwords are encrypted in the browser before they ever leave your device.

- What the backend (our servers) can see: session tokens, metadata
- What the backend cannot see: your passwords, your keys - ever

## How NAT Traversal Works

Most self-hosted tools require you to open ports on your router so the server can reach you.
Mossy flips this — **your vault connects out to our backend, not the other way around.**
No uPnP, firewall config or security concerns

## End-to-End Encryption

Your passwords are encrypted in the browser before they ever leave your device.
The vault stores only ciphertext — even if someone compromises the server, they get nothing useful.

### Password encryption
Passwords are encrypted with **AES-256** symmetric encryption.
The key never leaves your device in plaintext.

### Cross-device key sync
When syncing your vault key to another device, Mossy uses **X25519 (XCurve)** — 
an ephemeral key pair generated **per message**, so even if one message is compromised, 
past and future messages remain safe (forward secrecy).

### MitM protection
Each device has a static **Ed25519** keypair. Every sync message is signed with the sender's 
`deviceKeyId` — the receiving device verifies the signature before accepting the key.
This ensures you're syncing with *your* device, not an attacker's.

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
- Download latest version (`.crx` file) OR use unpacked version (use dist as folder (NOT ASSETS), and skip next step)
- Add it to your browser, you might need to allow installation of untrusted extensions (from other source than web store)
- Login into extension (with regular credentials)
- Synchronize vault key
- That's it, from now on web extension should suggest you to use saved password
