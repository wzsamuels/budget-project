
import { auth } from "@/auth";
import { db } from "@/db";
import { paychecks, paycheckDeductions, transactions, budgetCategories, recurringExpenses } from "@/db/schema";
import { eq, and, gte, lte, sum, sql, desc } from "drizzle-orm";
import { ProjectPaycheckDialog } from "@/components/dashboard/project-paycheck-dialog";
import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { format, addMonths, addYears } from "date-fns";
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

    // Fetch Recurring Expenses
    const activeRecurring = await db.query.recurringExpenses.findMany({
        where: and(
            eq(recurringExpenses.userId, userId),
            eq(recurringExpenses.isActive, true)
        )
    });

    // Project Recurring Expenses
    const today = new Date();

    activeRecurring.forEach(expense => {
        let currentDate = new Date(expense.nextDueDate);
        // If start date is before this year, move it to first occurrence of this year?
        // Logic: If recurrence started in 2023, we need to find the first occurrence in 2024.
        // Simple approx: while current < startOfYear, add frequency.

        while (currentDate < startOfYear) {
            if (expense.frequency === 'MONTHLY') {
                currentDate = addMonths(currentDate, 1);
            } else if (expense.frequency === 'YEARLY') {
                currentDate = addYears(currentDate, 1);
            }
        }

        while (currentDate <= endOfMonth) { // Wait, endOfMonth is just THIS month's end. We want end of YEAR.
            // But monthlyData is 12 months. Let's project for whole year.
            const endOfYear = new Date(new Date().getFullYear(), 11, 31);

            if (currentDate > endOfYear) break;

            const month = currentDate.getMonth();
            const amount = expense.amount / 100; // cents to dollars

            // Add to Graph Data (Whole Year Projection)
            monthlyData[month].expense += amount;

            // Add to YTD Totals (Only if <= Today)
            if (currentDate <= today) {
                // expensesYTD is calculated by reduce later. We need to add to a running total or intermediate.
                // But wait, "expensesYTD" variable below sums `monthlyData`. 
                // If I add to monthlyData here, expensesYTD will include FUTURE recurring expenses if I sum all months.
                // Correct logic: expensesYTD should only sum monthlyData cols that are past? 
                // OR: I track YTD explicitly.

                // Let's rely on specific addition.
                // We should add to monthlyData for the graph.

                // For the "Expenses (YTD)" CARD, we need a separate accumulator if monthlyData contains future.
                // Previously: const expensesYTD = monthlyData.reduce((acc, m) => acc + m.expense, 0);
                // This sums EVERYTHING in monthlyData. 
                // If I put future recurring expenses in monthlyData, expensesYTD will be wrong (it will be "Expenses Projected for Year").

                // Fix: Calculate expensesYTD separately or allow it to be "Projected Annual Spend"?
                // The card says "Expenses (YTD)".

                // Let's modify expensesYTD calculation to only sum up to current month?
                // Or better, accumulate `recurringYTD` separately here.
            }

            if (expense.frequency === 'MONTHLY') {
                currentDate = addMonths(currentDate, 1);
            } else if (expense.frequency === 'YEARLY') {
                currentDate = addYears(currentDate, 1);
            }
        }
    });

    // Recalculate expensesYTD correctly:
    // Transactions YTD + Recurring YTD.
    // monthlyData now mixes Transactions (YTD) + Recurring (Year).
    // This makes `monthlyData.reduce` invalid for YTD.

    // Let's refine. monthlyData should reflect "What happened or will happen".

    // Let's use loop to calc YTD components.
    let recurringYTD = 0;

    // Resetting projection loop for clean logic
    activeRecurring.forEach(expense => {
        let currentDate = new Date(expense.nextDueDate);
        while (currentDate < startOfYear) {
            if (expense.frequency === 'MONTHLY') currentDate = addMonths(currentDate, 1);
            else if (expense.frequency === 'YEARLY') currentDate = addYears(currentDate, 1);
        }

        const endOfYear = new Date(new Date().getFullYear(), 11, 31);

        while (currentDate <= endOfYear) {
            const month = currentDate.getMonth();
            const amount = expense.amount / 100;

            // Add to Monthly Data (Graph)
            monthlyData[month].expense += amount;

            // Add to YTD (Card)
            if (currentDate <= today) {
                recurringYTD += amount;

                // Add to Month specific (Card)
                if (currentDate >= startOfMonth && currentDate <= endOfMonth) {
                    monthExpenses += expense.amount; // Keep in cents for consistency
                }
            }

            if (expense.frequency === 'MONTHLY') currentDate = addMonths(currentDate, 1);
            else if (expense.frequency === 'YEARLY') currentDate = addYears(currentDate, 1);
        }
    });

    // Transactions YTD (already fetched)
    const transactionsTotalYTD = transactionsYTD.reduce((acc, t) => t.type === 'EXPENSE' ? acc + (t.amount / 100) : acc, 0);

    const expensesYTD = transactionsTotalYTD + recurringYTD;

    const cashFlow = monthIncome - monthExpenses;


    return {
        grossIncomeYTD,
        taxesYTD,
        savingsRate,
        expensesYTD,
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
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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

                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Expenses (YTD)</CardTitle>
                        <TrendingDown className="h-4 w-4 text-red-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-red-500">
                            ${(data.expensesYTD).toFixed(2)}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                            Total spending this year
                        </p>
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
