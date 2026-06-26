import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Navbar } from './components/Navbar';
import { HomePage } from './components/HomePage';
import { ListingSearch } from './components/ListingSearch';
import { ListingDetail } from './components/ListingDetail';
import { TransactionStatus } from './components/TransactionStatus';
import { ErrorBoundary } from './components/ErrorBoundary';

const App: React.FC = () => {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-slate-950">
          <Navbar />
          <main>
            <ErrorBoundary>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/listings" element={<ListingSearch />} />
                <Route path="/listings/:id" element={<ListingDetail />} />
                <Route path="/transactions/:id" element={<TransactionStatus />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </ErrorBoundary>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
