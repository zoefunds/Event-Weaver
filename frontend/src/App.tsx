import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Analytics } from '@vercel/analytics/react';
import { WalletProvider } from './lib/wallet';
import { ToastProvider } from './components/Toast';
import { Nav } from './components/Nav';
import { Footer } from './components/Footer';
import { Walkthrough } from './components/Walkthrough';
import Landing from './pages/Landing';
import Markets from './pages/Markets';
import MarketDetail from './pages/MarketDetail';
import Create from './pages/Create';
import Portfolio from './pages/Portfolio';

export default function App() {
  return (
    <WalletProvider>
      <ToastProvider>
        <BrowserRouter>
          <Nav />
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/markets" element={<Markets />} />
            <Route path="/market/:id" element={<MarketDetail />} />
            <Route path="/create" element={<Create />} />
            <Route path="/portfolio" element={<Portfolio />} />
          </Routes>
          <Footer />
          <Walkthrough />
        </BrowserRouter>
        <Analytics />
      </ToastProvider>
    </WalletProvider>
  );
}
