import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./state/AuthContext";
import { ActiveBookingProvider } from "./state/ActiveBookingContext";
import "./styles/global.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <ActiveBookingProvider>
          <App />
        </ActiveBookingProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
