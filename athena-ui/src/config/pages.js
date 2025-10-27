// src/config/pages.js
import React from "react";
import { Home, Zap, DollarSign, Trophy, History } from "lucide-react";

/**
 * ✅ Lazy load all major Athena UI views for better performance.
 * These are split automatically by Vite/React for on-demand loading.
 */
const EpochDashboard = React.lazy(() => import("../components/EpochDashboard"));
const PredictionForm = React.lazy(() => import("../components/PredictionForm"));
const ClaimRewards = React.lazy(() => import("../components/ClaimRewards"));
const Leaderboard = React.lazy(() => import("../components/Leaderboard"));
const EpochHistory = React.lazy(() => import("../components/EpochHistory"));

/**
 * ✅ Central route registry for Athena UI
 * Each page includes:
 * - name: Display name in nav
 * - icon: Lucide icon component
 * - component: Lazy-loaded React component
 * - path: Router path (for react-router-dom)
 * - requiresWallet: Optional flag for wallet-gated routes
 */
export const pages = [
  {
    name: "Dashboard",
    icon: Home,
    component: EpochDashboard,
    path: "/",
  },
  {
    name: "Predict",
    icon: Zap,
    component: PredictionForm,
    path: "/predict",
  },
  {
    name: "Claim",
    icon: DollarSign,
    component: ClaimRewards,
    path: "/claim",
    requiresWallet: true,
  },
  {
    name: "Leaderboard",
    icon: Trophy,
    component: Leaderboard,
    path: "/leaderboard",
  },
  {
    name: "History",
    icon: History,
    component: EpochHistory,
    path: "/history",
  },
];

/**
 * ✅ Default export for convenience
 * Enables simple imports:  import pages from "../config/pages";
 */
export default pages;
