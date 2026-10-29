# CCC NOC web app

CCC NOC is a browser based network operations console for the CCC Hospital Packet Tracer simulation. It includes a dashboard, topology view, device and VLAN management, routing and WAN views, security controls, traffic telemetry, event log, backups, and settings.

The app is a static frontend built with HTML, CSS, and vanilla JavaScript. It has no build step, package manager, backend, or runtime dependencies. Its sample network and telemetry data are defined in `assets/data.js`; interface behavior is in `assets/app.js`; styling is in `assets/styles.css`.

## Requirements

- A modern browser (for example, Firefox, Chrome, Edge, or Safari).
- Python 3, or another static file server. No Node.js installation is needed.
- Internet access is optional. The app loads IBM Plex fonts from Google Fonts; without a connection, the browser uses its fallback fonts.

## Run locally

From the repository root, start Python's built-in HTTP server:

```bash
python3 -m http.server 8000 --directory web
```

Then open <http://localhost:8000> in your browser. Stop the server with `Ctrl+C`.

Alternatively, run the server from inside the `web` directory:

```bash
cd web
python3 -m http.server 8000
```

You can also open `web/index.html` directly, but using a local HTTP server is recommended for consistent browser behavior.

## App data

The console is a frontend simulation and does not connect to Packet Tracer devices or a backend service. Changes and preferences are kept in the browser's `localStorage` for this site. To clear them, use the reset option in Settings or clear this site's browser storage.
