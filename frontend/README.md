# DS-Net frontend

Next.js (App Router) + TypeScript + Tailwind CSS UI for the DS-Net API. See the [root README](../README.md).

```bash
cp .env.example .env.local   # NEXT_PUBLIC_API_URL=http://localhost:8000
npm install
npm run dev                  # http://localhost:3000
```

Pages: `/` overview · `/analyze` upload + Grad-CAM viewer · `/model` model card and metrics · `/history` stored predictions.
