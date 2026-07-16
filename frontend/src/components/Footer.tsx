import { Link } from 'react-router-dom';

export function Footer() {
  return (
    <footer className="mt-16 flex w-full flex-col items-center justify-between gap-6 border-t border-white/5 bg-[#0e0e0f] px-5 py-8 md:flex-row md:px-16">
      <span className="label-caps text-on-surface">
        © 2026 EventWeaver · Powered by GenLayer
      </span>
      <div className="flex flex-wrap gap-6">
        <a
          className="label-caps text-on-variant opacity-80 transition-colors hover:text-tertiary hover:opacity-100"
          href="https://docs.genlayer.com/"
          target="_blank"
          rel="noreferrer"
        >
          GenLayer Docs
        </a>
        <Link
          className="label-caps text-on-variant opacity-80 transition-colors hover:text-tertiary hover:opacity-100"
          to="/markets"
        >
          Markets
        </Link>
        <Link
          className="label-caps text-on-variant opacity-80 transition-colors hover:text-tertiary hover:opacity-100"
          to="/create"
        >
          Create
        </Link>
      </div>
    </footer>
  );
}
