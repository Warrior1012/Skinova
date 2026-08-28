# Skinova Frontend MVP — White / Green

React + Vite + TypeScript + Tailwind frontend for the Skinova AI-assisted skin-lesion screening hackathon MVP.

## Run

```bash
npm install
npm run dev
```

## Backend connection

Copy `.env.example` to `.env` and set:

```env
VITE_API_BASE_URL=http://localhost:8000
VITE_DEMO_MODE=false
```

Expected backend endpoints:

- `POST /assessment/start`
- `POST /assessment/{id}/image`
- `GET /assessment/{id}/questions`
- `POST /assessment/{id}/answer`
- `GET /assessment/{id}/result`
- `GET /assessment/{id}/report`
- `GET /hospitals`

## Important demo behavior

The browser demo intentionally does **not** assign a skin disease to arbitrary uploaded files. It validates file type/size only. Real disease prediction and confidence must come from the backend ML endpoint.

The home hero uses a public-domain clinical nevus reference image from Wikimedia Commons:
https://commons.wikimedia.org/wiki/File:Nevus.jpg

## Included UX

- Light/white medical-tech visual system
- Green accent color and high-contrast readable text
- Home hero with real clinical reference image
- About section
- Technology section with project stack
- FAQ section with working expand/collapse answers
- Upload + drag/drop + validation
- Image preview and replace
- Analysis/loading states
- Dynamic question renderer
- Result screen with clearly visible PDF action
- Nearby dermatology care section
- Google Maps fallback
- New assessment / reset flow
- Session-aware navigation so basic refreshes do not leave the user on a broken loading screen

## Local Backend Integration

The frontend is configured for the Skinova FastAPI backend at `http://localhost:8000`.

The included `.env` uses:

- `VITE_API_BASE_URL=http://localhost:8000`
- `VITE_DEMO_MODE=false`

Start the backend first, then run `npm run dev`.
