import { useEffect } from 'react'
import { Activity, ArrowUpRight, BarChart3, LayoutDashboard, Users, PanelTop, FlaskConical } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import './manager.css'

export default function ManagerLayout() {
  useEffect(() => {
    const previousTitle = document.title
    document.title = 'NextUp | Control room'
    return () => { document.title = previousTitle }
  }, [])
  return (
    <div className="control-room">
      <a className="skip-link" href="#manager-content">Skip to content</a>
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><ArrowUpRight size={23} /></span>NextUp<span className="brand-dot">.</span></div>
        <div className="workspace-label">OPERATIONS WORKSPACE</div>
        <nav aria-label="Manager navigation">
          <NavLink to="/manager" end><LayoutDashboard size={18} />Overview</NavLink>
          <NavLink to="/manager/staff"><Users size={18} />Staff directory</NavLink>
          <NavLink to="/manager/analytics"><BarChart3 size={18} />Analytics</NavLink>
        </nav>
        <div className="sidebar-bottom"><PanelTop size={19} /><div><strong>Control room</strong><span>Manager workspace</span></div><span className="small-dot" /></div>
      </aside>
      <div className="workspace">
        <header className="topbar"><span><Activity size={16} />Service operations <span className="breadcrumb">/ Control room</span></span><span className="mock-label"><FlaskConical size={14} />Live operations · Mock analytics</span></header>
        <main id="manager-content" tabIndex={-1}><Outlet /></main>
        <footer>NextUp <span>Queue intelligence, at a glance.</span><span>Phase 3 · Live operations</span></footer>
      </div>
    </div>
  )
}
