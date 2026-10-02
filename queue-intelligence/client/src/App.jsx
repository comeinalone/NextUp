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