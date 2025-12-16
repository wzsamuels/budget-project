
import { auth } from "@/auth";
import { db } from "@/db";
import { paychecks, paycheckDeductions, transactions, budgetCategories } from "@/db/schema";
import { eq, and, gte, lte, sum, sql, desc } from "drizzle-orm";
import { ProjectPaycheckDialog } from "@/components/dashboard/project-paycheck-dialog";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { format } from "date-fns";
import { DollarSign, Percent, TrendingUp, TrendingDown } from "lucide-react";
import { OverviewChart } from "@/components/dashboard/overview-chart";

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
        },
        orderBy: [desc(paychecks.payDate)]
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

    // Monthly Data Aggregation
    const monthlyData = new Array(12).fill(0).map((_, i) => ({
        name: new Date(0, i).toLocaleString('default', { month: 'short' }),
        gross: 0,
        tax: 0,
        expense: 0
    }));

    // Add Paychecks to Monthly Data AND calculate monthly cash flow
    let monthIncome = 0;

    paychecksYTD.forEach(p => {
        const month = new Date(p.payDate).getMonth();
        const gross = p.grossAmount / 100;
        const tax = p.deductions
            .filter(d => d.category === 'TAX')
            .reduce((sum, d) => sum + d.amount, 0) / 100;

        monthlyData[month].gross += gross;
        monthlyData[month].tax += tax;

        // Calculate specific month income for the card
        if (p.payDate >= startOfMonth.toISOString().split("T")[0]) {
            monthIncome += p.netAmount; // Keep in cents for consistency with existing vars
        }
    });

    // Fetch Transactions YTD
    const transactionsYTD = await db.query.transactions.findMany({
        where: and(
            eq(transactions.userId, userId),
            gte(transactions.date, startOfYear.toISOString().split("T")[0])
        )
    });

    let monthExpenses = 0;

    transactionsYTD.forEach(t => {
        const month = new Date(t.date).getMonth();
        const amount = t.amount / 100; // convert to dollars

        if (t.type === 'INCOME') {
            // Treat income transactions as gross adjustment for now, or ignore for chart?
            // User specifically asked for "gross pay" vs "tax". Income txs are likely net.
            // Let's add income transactions to gross for visualizing "Money In".
            monthlyData[month].gross += amount;
        } else if (t.type === 'EXPENSE') {
            monthlyData[month].expense += amount;
        }

        // Calculate specific month expenses for the card
        if (t.date >= startOfMonth.toISOString().split("T")[0]) {
            if (t.type === 'INCOME') {
                monthIncome += t.amount;
            } else if (t.type === 'EXPENSE') {
                monthExpenses += t.amount;
            }
        }
    });

    const cashFlow = monthIncome - monthExpenses;

    return {
        grossIncomeYTD,
        taxesYTD,
        savingsRate,
        monthIncome,
        monthExpenses,
        cashFlow,
        overviewData: monthlyData,
        recentPaychecks: paychecksYTD.slice(0, 10)
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
                        <TrendingUp className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-500">+${(data.cashFlow / 100).toFixed(2)}</div>
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
                        <DollarSign className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-500">
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
                        <OverviewChart data={data.overviewData} />
                    </CardContent>
                </Card>

                <Card className="col-span-3">
                    <CardHeader>
                        <CardTitle>Recent Paychecks</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            {/* We just use the fetched YTD paychecks, sorted desc by default query? No, we need to ensure sort. */}
                            {/* Assuming paychecksYTD is passed to the component or available in data object. It was used for calc but not returned explicitly. Let's return recentPaychecks. */}
                            {data.recentPaychecks.length === 0 ? (
                                <div className="text-sm text-muted-foreground">No recent activity.</div>
                            ) : (
                                data.recentPaychecks.map((paycheck) => (
                                    <div key={paycheck.id} className="flex justify-between items-center border-b pb-2 last:border-0">
                                        <div>
                                            <div className="font-medium flex items-center gap-2">
                                                {paycheck.employerName}
                                                {paycheck.isProjected && (
                                                    <span className="text-[10px] bg-blue-100 text-blue-800 px-1 rounded">Est</span>
                                                )}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {format(new Date(paycheck.payDate), "MMM d, yyyy")}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="font-bold">
                                                ${(paycheck.netAmount / 100).toFixed(2)}
                                            </div>
                                            {!paycheck.isProjected && (
                                                <ProjectPaycheckDialog
                                                    paycheckId={paycheck.id}
                                                    employerName={paycheck.employerName}
                                                    payDate={paycheck.payDate}
                                                />
                                            )}
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
