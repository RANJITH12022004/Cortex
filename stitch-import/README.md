# Stitch Design Import

Designs imported from **Cortex Industrial Management System** (Google Stitch project `16391226028490069095`).

## Re-import designs

```bash
# Set your API key (from stitch.withgoogle.com account settings)
$env:STITCH_API_KEY="your-key"   # PowerShell
npm run import:stitch
```

This downloads:

- `DESIGN.md` — design system spec (also at repo root)
- `stitch-import/screens/*.html` — reference HTML for each screen
- `stitch-import/manifest.json` — screen ID → route mapping

## Imported screens

| Route | Screen |
|---|---|
| `/login` | Login - Cortex |
| `/dashboard` | Manager Dashboard - Cortex |
| `/command-center` | Command Center - Cortex OS |
| `/products/setup` | Product Setup |
| `/procurement/stock-out` | Stock-Out |
| `/orders` | Order PR-2904 |
| `/orders/detail` | Order Detail |
| `/tasks` | Task: SN-8812 |
| `/tasks/production` | Production Task |
| `/qc/inspection` | QC Inspection |
| `/qc/form` | QC Form |

## MCP integration

Cursor MCP config is in [`.cursor/mcp.json`](../.cursor/mcp.json). Set `STITCH_API_KEY` in your environment (or Cursor MCP settings) — never commit the real key.

## Using designs in code

Read `DESIGN.md` at the repo root before building or modifying UI. Reference HTML in `stitch-import/screens/` for layout and component patterns.
