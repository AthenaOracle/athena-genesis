// src/config/pages.js
import React from "react";
import { Home, Zap, DollarSign, Trophy, History, BarChart3 } from "lucide-react";

// Lazy load all Athena UI pages for performance
const EpochDashboard = React.lazy(() => import("../components/EpochDashboard"));
const PredictionForm = React.lazy(() => import("../components/PredictionForm"));
const ClaimRewards = React.lazy(() => import("../components/ClaimRewards"));
const Leaderboard = React.lazy(() => import("../components/Leaderboard"));
const EpochHistory = React.lazy(() => import("../components/EpochHistory"));
const Stats = React.lazy(() => import("../components/Stats"));

export const pages = [
  { name: "Dashboard", icon: Home, component: EpochDashboard, path: "/" },
  { name: "Predict", icon: Zap, component: PredictionForm, path: "/predict" },
  { name: "Claim", icon: DollarSign, component: ClaimRewards, path: "/claim", requiresWallet: true },
  { name: "Leaderboard", icon: Trophy, component: Leaderboard, path: "/leaderboard" },
  { name: "Stats", icon: BarChart3, component: Stats, path: "/stats" },
  { name: "History", icon: History, component: EpochHistory, path: "/history" },
];

export default pages;
