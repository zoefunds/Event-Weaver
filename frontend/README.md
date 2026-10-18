# EventWeaver Frontend

React, TypeScript, Vite and Tailwind client for EventWeaver. The production deployment is
https://eventweaver-orpin.vercel.app.

## Development

```bash
npm install
npm run dev
```

Copy `.env.example` and provide the backend URL plus the matched GenLayer, Base escrow and
Base Sepolia USDC addresses. All `VITE_` values are public build-time configuration; private
relayer and settlement-authority keys belong only in Fly secrets.

## Quality gates

```bash
npm run lint
npm run build
```

The wallet writes market-management actions to GenLayer and performs USDC approval, escrow
staking and claims on Base Sepolia. Confirmed stake events are applied by the backend relay;
the browser never fabricates or directly records a GenLayer position.
