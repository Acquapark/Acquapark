"use client";

import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardHeader } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils";

export function DashboardCharts({
  entradasSemana,
  faturamentoMensal,
}: {
  entradasSemana: { dia: string; entradas: number }[];
  faturamentoMensal: { mes: string; valor: number }[];
}) {
  return (
    <>
      <Card>
        <CardHeader title="Entradas na semana" subtitle="Ingressos utilizados por dia" />
        <div className="h-64 px-4 py-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={entradasSemana}>
              <CartesianGrid vertical={false} stroke="#eef0f3" />
              <XAxis dataKey="dia" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#6b7385" }} />
              <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#6b7385" }} width={32} />
              <Tooltip
                cursor={{ fill: "#f7f8fa" }}
                contentStyle={{ borderRadius: 4, borderColor: "#e2e5ea", fontSize: 12 }}
              />
              <Bar dataKey="entradas" fill="#2563eb" radius={[3, 3, 0, 0]} maxBarSize={36} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card>
        <CardHeader title="Faturamento" subtitle="Últimos 6 meses" />
        <div className="h-64 px-4 py-4">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={faturamentoMensal}>
              <CartesianGrid vertical={false} stroke="#eef0f3" />
              <XAxis dataKey="mes" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: "#6b7385" }} />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: "#6b7385" }}
                width={48}
                tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                formatter={(value) => formatCurrency(Number(value))}
                contentStyle={{ borderRadius: 4, borderColor: "#e2e5ea", fontSize: 12 }}
              />
              <Line type="monotone" dataKey="valor" stroke="#2563eb" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Card>
    </>
  );
}
