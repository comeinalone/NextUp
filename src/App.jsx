import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ToastProvider } from "./components/Toast";
import Home from "./pages/customer/Home";
import CounterConsole from "./pages/counter/CounterConsole";

const Soon = ({ name }) => <p className="p-6 text-mute">{name}: coming next.</p>;

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/t/:code" element={<Soon name="Token page" />} />
          <Route path="/counter/:id" element={<CounterConsole />} />
          <Route path="/display" element={<Soon name="Display" />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
