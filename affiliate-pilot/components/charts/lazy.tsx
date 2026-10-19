"use client";
import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

// グラフ用ライブラリ（recharts）は大きいので、画面を表示してから読み込む
export const RevenueChart = dynamic(() => import("./revenue-chart").then((m) => m.RevenueChart), { ssr: false, loading: () => <Skeleton className="h-60" /> });
export const ClicksChart = dynamic(() => import("./clicks-chart").then((m) => m.ClicksChart), { ssr: false, loading: () => <Skeleton className="h-48" /> });
export const ScoreRadar = dynamic(() => import("./score-radar").then((m) => m.ScoreRadar), { ssr: false, loading: () => <Skeleton className="h-64" /> });
