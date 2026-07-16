import { Link, NavLink } from 'react-router-dom';
import { Logo } from './Logo';
import { useWallet, shortAddr } from '../lib/wallet';

const links = [
  { to: '/markets', label: 'Discovery' },
  { to: '/create', label: 'Create' },
  { to: '/portfolio', label: 'Portfolio' },
];

export function Nav() {
  const { address, connect, disconnect, connecting } = useWallet();

  return (
    <nav className="fixed top-0 z-50 flex h-16 w-full items-center justify-between border-b border-white/10 bg-background/80 px-5 backdrop-blur-md md:px-16">
      <div className="flex items-center gap-10">
        <Link to="/" aria-label="EventWeaver home">
          <Logo />
        </Link>
        <div className="hidden items-center gap-7 md:flex">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              className={({ isActive }) =>
                isActive
                  ? 'border-b-2 border-primary pb-1 font-bold text-primary'
                  : 'font-medium text-on-variant transition-colors hover:text-primary'
              }
            >
              {l.label}
            </NavLink>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-3">
        {address ? (
          <button
            onClick={disconnect}
            title="Disconnect"
            className="label-caps rounded-lg border border-primary/40 px-4 py-2 text-primary transition-all hover:bg-primary/10 active:scale-95"
          >
            {shortAddr(address)}
          </button>
        ) : (
          <button
            onClick={connect}
            disabled={connecting}
            className="rounded-lg bg-primary px-5 py-2 text-sm font-bold text-on-primary transition-transform active:scale-95 disabled:opacity-60"
          >
            {connecting ? 'Connecting…' : 'Connect Wallet'}
          </button>
        )}
      </div>
    </nav>
  );
}
