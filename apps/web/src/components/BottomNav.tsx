import { NavLink } from "react-router-dom";

const TABS = [
  { to: "/venues", icon: "☕", label: "Venues" },
  { to: "/meetups", icon: "◎", label: "Meetups" },
  { to: "/community", icon: "✦", label: "Community" },
  { to: "/profile", icon: "☺", label: "Profile" },
];

export function BottomNav() {
  return (
    <nav className="bottom-nav">
      {TABS.map((tab) => (
        <NavLink key={tab.to} to={tab.to} className={({ isActive }) => (isActive ? "active" : "")}>
          <span className="icon" aria-hidden="true">
            {tab.icon}
          </span>
          {tab.label}
        </NavLink>
      ))}
    </nav>
  );
}
