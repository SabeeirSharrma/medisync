# Tunneling & Port Forwarding

Three options for exposing MediSync remotely, from production to quick dev sharing.

## Quick Tunnels (No Setup Required)

One command, temporary URL, zero config.

### Cloudflare Quick Tunnel

```bash
# Expose web UI
cloudflared tunnel --url http://localhost:3000

# Expose API
cloudflared tunnel --url http://localhost:3001

# Expose both (run in separate terminals)
cloudflared tunnel --url http://localhost:3000
cloudflared tunnel --url http://localhost:3001
```

Prints a `https://xxx.trycloudflare.com` URL. Temporary, dies when you Ctrl+C.

### ngrok Quick Tunnel

```bash
# Expose web UI
ngrok http 3000

# Expose API
ngrok http 3001

# Both on one dashboard
ngrok http 3000 --host-header localhost:3000
```

Opens dashboard at http://localhost:4040 with tunnel URL.

### SSH Quick Tunnel

```bash
# Local — access remote MediSync locally
ssh -L 3000:localhost:3000 user@server

# Remote — expose local MediSync on remote server
ssh -R 8080:localhost:3000 user@server
```

---

## Production Tunnels (Persistent)

### Cloudflare Tunnel

Free, secure, no open ports. Best for self-hosted production instances.

### Setup

1. **Install cloudflared** on your server:
   ```bash
   # Debian/Ubuntu
   curl -fsSL https://pkg.cloudflare.com/cloudflare-main.gpg | sudo tee /usr/share/keyrings/cloudflare-main.gpg
   echo "deb [signed-by=/usr/share/keyrings/cloudflare-main.gpg] https://pkg.cloudflare.com/cloudflared $(lsb_release -cs) main" | sudo tee /etc/apt/sources.list.d/cloudflared.list
   sudo apt update && sudo apt install cloudflared
   ```

2. **Authenticate** with your Cloudflare account:
   ```bash
   cloudflared tunnel login
   ```

3. **Create a tunnel**:
   ```bash
   cloudflared tunnel create medisync
   ```

4. **Copy the tunnel token** from the Cloudflare dashboard or use:
   ```bash
   cloudflared tunnel token medisync
   ```

5. **Add to `.env`**:
   ```bash
   CLOUDFLARE_TUNNEL_TOKEN=<your-tunnel-token>
   ```

6. **Configure DNS** in Cloudflare dashboard:
   - `medisync.your-domain.com` → Web (port 3000)
   - `api.medisync.your-domain.com` → API (port 3001)

7. **Start with tunnel profile**:
   ```bash
   docker compose --profile tunnel up -d cloudflared
   ```

### Custom Domain Mapping

Edit `config/cloudflared.yml` to map your domains:

```yaml
tunnel: <TUNNEL_ID>
credentials-file: /etc/cloudflared/credentials.json
ingress:
  - hostname: medisync.your-domain.com
    service: http://web:3000
  - hostname: api.medisync.your-domain.com
    service: http://api:3001
  - service: http_status:404
```

### Updating CORS

When using Cloudflare Tunnel, update `CORS_ORIGIN` in `.env`:

```bash
CORS_ORIGIN=https://medisync.your-domain.com
```

---

### ngrok

Quick tunnels for testing webhooks, sharing with others, or mobile app development.

### Setup

1. **Get an auth token** from [ngrok.com](https://dashboard.ngrok.com/get-started/your-authtoken)

2. **Add to `.env`**:
   ```bash
   NGROK_AUTHTOKEN=<your-auth-token>
   ```

3. **Start with tunnel profile**:
   ```bash
   docker compose --profile tunnel up -d ngrok
   ```

4. **Access ngrok dashboard** at http://localhost:4040 to see tunnel URLs

### Default Tunnels

The default config (`config/ngrok.yml`) exposes:
- Web: `http://localhost:4040` → `http://web:3000`
- API: `http://localhost:4040` → `http://api:3001`

### Custom Tunnel

To expose only the web interface on a specific port:

```bash
ngrok http 3000
```

Or with auth:

```bash
ngrok http 3000 --basic-auth="user:password"
```

### Updating CORS

When using ngrok, update `CORS_ORIGIN` in `.env`:

```bash
CORS_ORIGIN=https://<your-ngrok-subdomain>.ngrok-free.app
```

---

## SSH Port Forwarding

No extra services needed. Works with any SSH server.

### Local Forwarding

Access MediSync on a remote server from your local machine:

```bash
# Forward remote port 3000 to local port 3000
ssh -L 3000:localhost:3000 user@your-server

# Forward both web and API
ssh -L 3000:localhost:3000 -L 3001:localhost:3001 user@your-server
```

Then access locally:
- Web: http://localhost:3000
- API: http://localhost:3001

### Remote Forwarding

Expose your local MediSync to a remote server:

```bash
# On your local machine
ssh -R 8080:localhost:3000 user@your-server
```

Then access via `http://your-server:8080`.

### Dynamic SOCKS Proxy

Route all traffic through your server:

```bash
ssh -D 1080 user@your-server
```

Configure your browser to use SOCKS5 proxy at `localhost:1080`.

### SSH Config

Add to `~/.ssh/config` for convenience:

```
Host medisync
    HostName your-server.com
    User your-user
    LocalForward 3000 localhost:3000
    LocalForward 3001 localhost:3001
    ServerAliveInterval 60
```

Then just run `ssh medisync`.

### Persistent Tunnels

Use `autossh` for automatic reconnection:

```bash
autossh -M 0 -f -N -L 3000:localhost:3000 user@your-server
```

---

## Comparison

| Feature | Cloudflare Tunnel | ngrok | SSH |
|---------|------------------|-------|-----|
| **Cost** | Free | Free tier | Free |
| **Setup** | Moderate | Easy | Easy |
| **HTTPS** | Automatic | Automatic | Manual |
| **Custom Domain** | Yes | No (paid) | Yes |
| **Production Ready** | Yes | No | Yes |
| **No Server Needed** | Yes | Yes | No |
| **Rate Limits** | None | Yes (free tier) | None |
| **Auth** | Cloudflare Access | Basic auth | SSH keys |

---

## Troubleshooting

### Cloudflare Tunnel not starting

```bash
docker compose logs cloudflared
# Check token is set correctly in .env
# Verify tunnel exists: cloudflared tunnel list
```

### ngrok connection refused

```bash
docker compose logs ngrok
# Verify NGROK_AUTHTOKEN is set in .env
# Check ngrok dashboard at http://localhost:4040
```

### SSH tunnel drops connection

```bash
# Use ServerAliveInterval
ssh -o ServerAliveInterval=60 -L 3000:localhost:3000 user@server

# Or use autossh for auto-reconnect
autossh -M 0 -f -N -L 3000:localhost:3000 user@server
```

### CORS errors after tunneling

Update `CORS_ORIGIN` in `.env` to match your tunnel URL:

```bash
# Cloudflare
CORS_ORIGIN=https://medisync.your-domain.com

# ngrok
CORS_ORIGIN=https://<subdomain>.ngrok-free.app

# SSH (no change needed for localhost)
CORS_ORIGIN=http://localhost:3000
```
