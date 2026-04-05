"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  ResponsiveContainer,
} from "recharts";
import { formatTimestamp } from "@/lib/formatters";

interface TradeEvent {
  type: "trade" | "auction";
  timestamp: number;
  amount: string;
  price: string;
  gasUsed?: number;
  txHash?: string;
}

const PAGE_SIZE = 20;

export function HistoryPage() {
  const t = useTranslations("history");
  const [events, setEvents] = useState<TradeEvent[]>([]);
  const [page, setPage] = useState(0);

  useEffect(() => {
    fetch("/api/events")
      .then((r) => r.json())
      .then((data) => setEvents(data))
      .catch(() => setEvents([]));
  }, []);

  const paginated = events.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(events.length / PAGE_SIZE);

  // Build chart data: group by hour
  const chartData = events.slice(-50).map((e, i) => ({
    t: i,
    volume: Number(e.amount),
    gas: e.gasUsed ?? 0,
    size: Number(e.amount),
  }));

  const handleExportCSV = () => {
    const header = "type,timestamp,amount,price,gasUsed,txHash";
    const rows = events.map((e) =>
      [e.type, e.timestamp, e.amount, e.price, e.gasUsed ?? "", e.txHash ?? ""].join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "eaon-history.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-3xl" style={{ color: "var(--text-primary)" }}>
          {t("title")}
        </h1>
        <div className="flex items-center gap-2">
          <Link
            href="/completed-trades"
            className="font-data text-xs px-3 py-1.5 rounded border transition-colors"
            style={{
              color: "var(--cyan)",
              borderColor: "var(--cyan)",
              background: "rgba(0,229,255,0.08)",
            }}
          >
            {t("completedTrades")}
          </Link>
          <button
            onClick={handleExportCSV}
            className="font-data text-xs px-3 py-1.5 rounded border transition-colors"
            style={{
              color: "var(--emerald)",
              borderColor: "var(--emerald)",
              background: "rgba(0,230,118,0.07)",
            }}
          >
            {t("exportCsv")}
          </button>
        </div>
      </div>

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="panel p-4">
            <p className="font-data text-xs mb-2" style={{ color: "var(--text-muted)" }}>{t("volume")}</p>
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={chartData}>
                <Area type="monotone" dataKey="volume" stroke="var(--amber)" fill="rgba(255,165,0,0.15)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="panel p-4">
            <p className="font-data text-xs mb-2" style={{ color: "var(--text-muted)" }}>{t("gasUsed")}</p>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={chartData}>
                <Bar dataKey="gas" fill="var(--cyan)" />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="panel p-4">
            <p className="font-data text-xs mb-2" style={{ color: "var(--text-muted)" }}>{t("avgSize")}</p>
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={chartData}>
                <Line type="monotone" dataKey="size" stroke="var(--emerald)" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="panel overflow-x-auto">
        <table className="w-full font-data text-xs">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--bg-border)", color: "var(--text-muted)" }}>
              <th className="text-left p-3">{t("colType")}</th>
              <th className="text-left p-3">{t("colTime")}</th>
              <th className="text-right p-3">{t("colAmount")}</th>
              <th className="text-right p-3">{t("colPrice")}</th>
              <th className="text-right p-3">{t("colGas")}</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={5} className="p-6 text-center" style={{ color: "var(--text-muted)" }}>
                  {t("noHistory")}
                </td>
              </tr>
            ) : (
              paginated.map((e, i) => (
                <tr
                  key={i}
                  style={{ borderBottom: "1px solid var(--bg-border)" }}
                >
                  <td className="p-3">
                    <span
                      style={{
                        color: e.type === "auction" ? "var(--cyan)" : "var(--amber)",
                        textTransform: "uppercase",
                      }}
                    >
                      {e.type}
                    </span>
                  </td>
                  <td className="p-3" style={{ color: "var(--text-secondary)" }}>
                    {formatTimestamp(e.timestamp)}
                  </td>
                  <td className="p-3 text-right">{e.amount} Wh</td>
                  <td className="p-3 text-right" style={{ color: "var(--cyan)" }}>{e.price}</td>
                  <td className="p-3 text-right" style={{ color: "var(--text-muted)" }}>
                    {e.gasUsed ?? "-"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 p-4 border-t" style={{ borderColor: "var(--bg-border)" }}>
            <button
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
              className="font-data text-xs px-2 py-1 rounded border disabled:opacity-30"
              style={{ borderColor: "var(--bg-border)", color: "var(--text-secondary)" }}
            >
              {t("prev")}
            </button>
            <span className="font-data text-xs" style={{ color: "var(--text-muted)" }}>
              {page + 1} / {totalPages}
            </span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage((p) => p + 1)}
              className="font-data text-xs px-2 py-1 rounded border disabled:opacity-30"
              style={{ borderColor: "var(--bg-border)", color: "var(--text-secondary)" }}
            >
              {t("next")}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
