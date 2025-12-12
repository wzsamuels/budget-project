
import { auth } from "@/auth";
import { db } from "@/db";
import { paychecks, paycheckDeductions, transactions, budgetCategories } from "@/db/schema";
import { eq, and, gte, lte, sum, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { DollarSign, Percent, TrendingUp, TrendingDown } from "lucide-react";

async function getDashboardData(userId: string) {
    const now = new Date();
    const startOfYear = new Date(now.getFullYear(), 0, 1);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // YTD Metrics
    const paychecksYTD = await db.query.paychecks.findMany({
        where: and(
            eq(paychecks.userId, userId),
            gte(paychecks.payDate, startOfYear.toISOString().split("T")[0])
        ),
        with: {
            deductions: true
        }
    });

    const grossIncomeYTD = paychecksYTD.reduce((acc, p) => acc + p.grossAmount, 0);

    // Tax Burden YTD
    const taxesYTD = paychecksYTD.reduce((acc, p) => {
        return acc + p.deductions
            .filter(d => d.category === 'TAX')
            .reduce((sum, d) => sum + d.amount, 0);
    }, 0);

    // Savings YTD (401k + HSA)
    const preTaxSavingsYTD = paychecksYTD.reduce((acc, p) => {
        return acc + p.deductions
            .filter(d => ['RETIREMENT', 'HSA'].includes(d.category))
            .reduce((sum, d) => sum + d.amount, 0);
    }, 0);

    // ToDo: Add post-tax savings from transactions when implemented

    const savingsRate = grossIncomeYTD > 0
        ? (preTaxSavingsYTD / grossIncomeYTD) * 100
        : 0;

    // Monthly Cash Flow
    // Income: Net Pay from Paychecks this month + Income Transactions
    // Expenses: Expense Transactions this month

    const paychecksMonth = paychecksYTD.filter(p => p.payDate >= startOfMonth.toISOString().split("T")[0]);
    const monthNetPay = paychecksMonth.reduce((acc, p) => acc + p.netAmount, 0);

    // Fetch transactions (assuming transactions model exists and is populated, though we haven't built the UI for it yet)
    // For now, using 0 for transactions context if table empty
    // Actually I need to fetch transactions.

    /* 
    const txMonth = await db.query.transactions.findMany({
        where: and(
            eq(transactions.userId, userId),
            gte(transactions.date, startOfMonth.toISOString().split("T")[0])
        )
    });
    */
    // Since we haven't set up the query helper for transactions fully or seed data, I'll stick to paychecks data for now.

    const monthIncome = monthNetPay; // + txMonth.filter(t => t.type === 'INCOME').sum
    const monthExpenses = 0; // txMonth.filter(t => t.type === 'EXPENSE').sum

    const cashFlow = monthIncome - monthExpenses;

    return {
        grossIncomeYTD,
        taxesYTD,
        savingsRate,
        monthIncome,
        monthExpenses,
        cashFlow
    };
}

export default async function DashboardPage() {
    const session = await auth();
    if (!session?.user?.id) return redirect("/api/auth/signin");

    const data = await getDashboardData(session.user.id);

    return (
        <div className="container mx-auto py-10 px-4 md:px-8 space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
                <div className="text-sm text-muted-foreground">
                    {format(new Date(), "MMMM yyyy")}
                </div>
            </div>

            {/* Header Cards */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Cash Flow (Month)</CardTitle>
                        <TrendingUp className="h-4 w-4 text-income" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-income">+${(data.cashFlow / 100).toFixed(2)}</div>
                        <p className="text-xs text-muted-foreground">
                            In: ${(data.monthIncome / 100).toFixed(2)} | Out: ${(data.monthExpenses / 100).toFixed(2)}
                        </p>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Savings Rate (YTD)</CardTitle>
                        <Percent className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{data.savingsRate.toFixed(1)}%</div>
                        <p className="text-xs text-muted-foreground">
                            Target: 20%
                        </p>
                        <Progress value={data.savingsRate} className="mt-2 h-2" />
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Tax Burden (YTD)</CardTitle>
                        <DollarSign className="h-4 w-4 text-expense" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-expense">
                            ${(data.taxesYTD / 100).toFixed(2)}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1">
                            Effective Rate: {data.grossIncomeYTD ? ((data.taxesYTD / data.grossIncomeYTD) * 100).toFixed(1) : 0}%
                        </div>
                    </CardContent>
                </Card>
            </div>

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4">
                    <CardHeader>
                        <CardTitle>Overview</CardTitle>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[200px] flex items-center justify-center text-muted-foreground">
                            Chart Placeholder (Need Recharts Implementation)
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Recent Paychecks</CardTitle>
                    </CardHeader>
                    <CardContent>
                        {/* List recent paychecks */}
                        <div className="space-y-4">
                            {/* This would map over recent paychecks */}
                            <div className="text-sm text-muted-foreground">No recent activity.</div>
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
