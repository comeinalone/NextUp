<<<<<<< HEAD
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ToastProvider } from "./components/Toast";
import Home from "./pages/customer/Home";
import TokenPage from "./pages/customer/TokenPage";
import CounterConsole from "./pages/counter/CounterConsole";
import Display from "./pages/display/Display";

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/t/:code" element={<TokenPage />} />
          <Route path="/counter/:id" element={<CounterConsole />} />
          <Route path="/display" element={<Display />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
=======
import { lazy, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'
import StarterApp from './StarterApp'
import ManagerLayout from './pages/manager/ManagerLayout'
import ManagerOverview from './pages/manager/ManagerOverview'
import ManagerStaff from './pages/manager/ManagerStaff'

const ManagerAnalytics = lazy(() => import('./pages/manager/ManagerAnalytics'))

export default function App() {
  return <BrowserRouter><Routes>
    <Route path="/manager" element={<ManagerLayout />}>
      <Route index element={<ManagerOverview />} />
      <Route path="staff" element={<ManagerStaff />} />
      <Route path="analytics" element={<Suspense fallback={<div className="route-loading">Loading analytics…</div>}><ManagerAnalytics /></Suspense>} />
    </Route>
    <Route path="*" element={<StarterApp />} />
  </Routes></BrowserRouter>
}
>>>>>>> origin/control
