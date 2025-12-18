import { auth } from "@/auth";
import { db } from "@/db";
import { transactions, recurringExpenses, budgetCategories } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
import { EditTransactionDialog } from "@/components/expenses/edit-transaction-dialog";
import { EditRecurringExpenseDialog } from "@/components/expenses/edit-recurring-expense-dialog";
import { MarkAsPaidDialog } from "@/components/expenses/mark-paid-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

async function getExpensesData(userId: string) {
    try {
        const categories = await db.query.budgetCategories.findMany({
            where: eq(budgetCategories.userId, userId),
        });

        const recentExpenses = await db.query.transactions.findMany({
            where: and(
                eq(transactions.userId, userId),
                eq(transactions.type, "EXPENSE")
            ),
            orderBy: [desc(transactions.date)],
            limit: 10,
            with: {
                category: true
            }
        });

        const activeRecurring = await db.query.recurringExpenses.findMany({
            where: and(
                eq(recurringExpenses.userId, userId),
                eq(recurringExpenses.isActive, true)
            )
        });

        return {
            categories: categories.map(c => ({ id: c.id, name: c.name })),
            recentExpenses,
            activeRecurring
        };
    } catch (error) {
        console.error("Error in getExpensesData:", error);
        throw error;
    }
}

import { SeedCategoriesButton } from "@/components/expenses/seed-categories-button";

export default async function ExpensesPage() {
    const session = await auth();
    if (!session?.user?.id) return redirect("/api/auth/signin");

    const data = await getExpensesData(session.user.id);

    // Manual category mapping for display
    const categoryMap = new Map(data.categories.map(c => [c.id, c.name]));

    return (
        <div className="container mx-auto py-10 px-4 md:px-8 space-y-8">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
                    <p className="text-muted-foreground">Manage your spending and recurring bills.</p>
                </div>
                {data.categories.length > 0 && <AddExpenseDialog categories={data.categories} />}
            </div>

            {data.categories.length === 0 ? (
                <SeedCategoriesButton />
            ) : (
                <div className="grid gap-6 md:grid-cols-2">
                    {/* Recurring Expenses */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Recurring Expenses</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {data.activeRecurring.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No recurring expenses set up.</p>
                            ) : (
                                <div className="space-y-4">
                                    {data.activeRecurring.map((expense) => (
                                        <div key={expense.id} className="flex justify-between items-center border-b pb-2 last:border-0">
                                            <div>
                                                <div className="font-medium">{expense.description}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {expense.frequency} • Next: {(() => {
                                                        const [y, m, d] = expense.nextDueDate.split('-').map(Number);
                                                        return format(new Date(y, m - 1, d), "MMM d, yyyy");
                                                    })()}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="font-bold">
                                                    ${(expense.amount / 100).toFixed(2)}
                                                </div>
                                                <MarkAsPaidDialog expense={expense} categories={data.categories} />
                                                <EditRecurringExpenseDialog expense={expense} categories={data.categories} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>

                    {/* Recent Transactions */}
                    <Card>
                        <CardHeader>
                            <CardTitle>Recent Transactions</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {data.recentExpenses.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No recent transactions.</p>
                            ) : (
                                <div className="space-y-4">
                                    {data.recentExpenses.map((tx) => (
                                        <div key={tx.id} className="flex justify-between items-center border-b pb-2 last:border-0">
                                            <div>
                                                <div className="font-medium">{tx.description}</div>
                                                <div className="text-xs text-muted-foreground">
                                                    {(() => {
                                                        const [y, m, d] = tx.date.split('-').map(Number);
                                                        return format(new Date(y, m - 1, d), "MMM d");
                                                    })()} • {categoryMap.get(tx.categoryId || "") || "Uncategorized"}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3">
                                                <div className="font-bold text-red-500">
                                                    -${(tx.amount / 100).toFixed(2)}
                                                </div>
                                                <EditTransactionDialog transaction={tx} categories={data.categories} />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}
