import { BrowserRouter, Route, Routes } from 'react-router-dom'
import StarterApp from './StarterApp'
import ManagerLayout from './pages/manager/ManagerLayout'
import ManagerOverview from './pages/manager/ManagerOverview'
import ManagerStaff from './pages/manager/ManagerStaff'

export default function App() {
  return <BrowserRouter><Routes>
    <Route path="/manager" element={<ManagerLayout />}>
      <Route index element={<ManagerOverview />} />
      <Route path="staff" element={<ManagerStaff />} />
    </Route>
    <Route path="*" element={<StarterApp />} />
  </Routes></BrowserRouter>
}
