"use client";

import {
    Bar,
    BarChart,
    CartesianGrid,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts";

interface OverviewChartProps {
    data: {
        name: string;
        gross: number;
        tax: number;
        expense: number;
    }[];
}

export function OverviewChart({ data }: OverviewChartProps) {
    return (
        <ResponsiveContainer width="100%" height={350}>
            <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis
                    dataKey="name"
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                />
                <YAxis
                    stroke="#888888"
                    fontSize={12}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(value) => `$${value}`}
                />
                <Tooltip
                    formatter={(value: number) => [`$${value.toFixed(2)}`, undefined]}
                    cursor={{ fill: "transparent" }}
                    contentStyle={{ backgroundColor: "white", borderRadius: "8px", border: "1px solid #E2E8F0" }}
                />
                <Bar
                    dataKey="gross"
                    name="Gross Pay"
                    fill="#10b981" // emerald-500
                    radius={[4, 4, 0, 0]}
                />
                <Bar
                    dataKey="tax"
                    name="Taxes"
                    fill="#f59e0b" // amber-500
                    radius={[4, 4, 0, 0]}
                    stackId="a" // Optional: if they want stacked. User said "comparison", usually side-by-side is better. Let's keep side-by-side for now unless they want stacks. "Graph showing gross pay and tax burdens". Side by side is clearer for magnitude.
                />
                <Bar
                    dataKey="expense"
                    name="Expenses"
                    fill="#ef4444" // red-500
                    radius={[4, 4, 0, 0]}
                />
            </BarChart>
        </ResponsiveContainer>
    );
}
