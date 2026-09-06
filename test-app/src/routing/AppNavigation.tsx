import { NavLink } from "react-router-dom";
import { appRoutes } from "./routes.core";

export function AppNavigation() {
  return (
    <nav className="app-navigation" aria-label="기능 화면">
      {appRoutes.map((route) => (
        <NavLink
          key={route.id}
          to={route.path}
          className={({ isActive }) => isActive ? "is-active" : undefined}
        >
          {route.label}
        </NavLink>
      ))}
    </nav>
  );
}
