"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { History } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, Line, LineChart, ResponsiveContainer } from "recharts";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

const CHART_COLORS = {
  volume:  "hsl(38 92% 52%)",   /* amber */
  gas:     "hsl(192 90% 48%)",  /* cyan */
  size:    "hsl(158 64% 48%)",  /* emerald */
};

export function HistoryPage() {
  const t = useTranslations("history");
  const [events, setEvents] = useState<TradeEvent[]>([]);
  const [page, setPage] = useState(0);
  const [filter, setFilter] = useState<"all" | "trade" | "auction">("all");

  useEffect(() => {
    fetch("/api/events")
      .then((response) => response.json())
      .then((data) => setEvents(data))
      .catch(() => setEvents([]));
  }, []);

  const filteredEvents = useMemo(
    () => (filter === "all" ? events : events.filter((event) => event.type === filter)),
    [events, filter]
  );

  const paginated = filteredEvents.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.max(1, Math.ceil(filteredEvents.length / PAGE_SIZE));
  const chartData = filteredEvents.slice(-50).map((event, index) => ({
    time: index,
    volume: Number(event.amount),
    gas: event.gasUsed ?? 0,
    size: Number(event.amount),
  }));

  const handleExportCSV = () => {
    const header = "type,timestamp,amount,price,gasUsed,txHash";
    const rows = filteredEvents.map((event) =>
      [event.type, event.timestamp, event.amount, event.price, event.gasUsed ?? "", event.txHash ?? ""].join(",")
    );
    const blob = new Blob([[header, ...rows].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "eaon-history.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <History className="size-5 text-primary" />
            <h1 className="font-display text-2xl font-bold tracking-tight">{t("title")}</h1>
          </div>
          <p className="font-mono text-xs text-muted-foreground">
            Inspect historical market executions and export filtered datasets.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={filter}
            onValueChange={(value) => {
              if (value) setFilter(value as "all" | "trade" | "auction");
            }}
          >
            <SelectTrigger className="h-8 w-[140px] font-mono text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All events</SelectItem>
              <SelectItem value="trade">Trades</SelectItem>
              <SelectItem value="auction">Auctions</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" render={<Link href="/completed-trades" />}>
            {t("completedTrades")}
          </Button>
          <Button size="sm" onClick={handleExportCSV}>{t("exportCsv")}</Button>
        </div>
      </div>

      {/* Charts */}
      {chartData.length > 0 && (
        <div className="grid gap-4 md:grid-cols-3">
          {/* Volume */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ backgroundColor: CHART_COLORS.volume }} />
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("volume")}
              </p>
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <AreaChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Area
                  type="monotone"
                  dataKey="volume"
                  stroke={CHART_COLORS.volume}
                  fill={CHART_COLORS.volume}
                  fillOpacity={0.15}
                  strokeWidth={1.5}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Gas Used */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ backgroundColor: CHART_COLORS.gas }} />
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("gasUsed")}
              </p>
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <BarChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Bar dataKey="gas" fill={CHART_COLORS.gas} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Avg Size */}
          <div className="rounded-lg border border-border bg-card p-4">
            <div className="mb-3 flex items-center gap-2">
              <span className="size-2 rounded-full" style={{ backgroundColor: CHART_COLORS.size }} />
              <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                {t("avgSize")}
              </p>
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={chartData} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <Line
                  type="monotone"
                  dataKey="size"
                  stroke={CHART_COLORS.size}
                  strokeWidth={1.5}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Event table */}
      <div className="rounded-lg border border-border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/20 hover:bg-muted/20">
              <TableHead className="font-mono text-[10px] uppercase tracking-wider">{t("colType")}</TableHead>
              <TableHead className="font-mono text-[10px] uppercase tracking-wider">{t("colTime")}</TableHead>
              <TableHead className="text-right font-mono text-[10px] uppercase tracking-wider">{t("colAmount")}</TableHead>
              <TableHead className="text-right font-mono text-[10px] uppercase tracking-wider">{t("colPrice")}</TableHead>
              <TableHead className="text-right font-mono text-[10px] uppercase tracking-wider">{t("colGas")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody className="divide-y divide-border">
            {paginated.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-20 text-center font-mono text-xs text-muted-foreground">
                  {t("noHistory")}
                </TableCell>
              </TableRow>
            ) : (
              paginated.map((event, index) => (
                <TableRow key={`${event.timestamp}-${index}`} className="hover:bg-muted/10">
                  <TableCell>
                    <span
                      className={
                        event.type === "auction"
                          ? "rounded px-1.5 py-0.5 font-mono text-[10px] font-medium bg-primary/10 text-primary"
                          : "rounded px-1.5 py-0.5 font-mono text-[10px] font-medium bg-secondary/10 text-secondary"
                      }
                    >
                      {event.type}
                    </span>
                  </TableCell>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {formatTimestamp(event.timestamp)}
                  </TableCell>
                  <TableCell className="text-right font-mono text-xs">{event.amount} Wh</TableCell>
                  <TableCell className="text-right font-mono text-xs">{event.price}</TableCell>
                  <TableCell className="text-right font-mono text-xs text-muted-foreground">
                    {event.gasUsed ?? "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>

        {filteredEvents.length > PAGE_SIZE && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="font-mono text-xs text-muted-foreground">
              {page + 1} / {totalPages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                className="h-7 font-mono text-xs"
                disabled={page === 0}
                onClick={() => setPage((current) => current - 1)}
              >
                {t("prev")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 font-mono text-xs"
                disabled={page >= totalPages - 1}
                onClick={() => setPage((current) => current + 1)}
              >
                {t("next")}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
