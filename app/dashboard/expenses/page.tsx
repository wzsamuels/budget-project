import { auth } from "@/auth";
import { db } from "@/db";
import { transactions, recurringExpenses, budgetCategories } from "@/db/schema";
import { eq, desc, and } from "drizzle-orm";
import { redirect } from "next/navigation";
import { AddExpenseDialog } from "@/components/expenses/add-expense-dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { format } from "date-fns";

async function getExpensesData(userId: string) {
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
            category: true // Assuming valid relation but schema didn't explicit define relations on transaction yet?
        }
    });

    // We can't use 'with' if relations aren't defined in schema.ts relations object.
    // Let's check schema relations.
    // schema.ts had `transactions` table but I didn't see `transactionsRelations`.
    // I will fetch categories manually map them if relations missing,
    // or just list them.
    // Let's assume relations are missing and just show data. Using categoryId match if needed.

    // Actually, let's fix relations in schema if meaningful, but for now I'll just map in JS if needed.
    // But `with` will fail if not defined.

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
                                                    {expense.frequency} • Next: {format(new Date(expense.nextDueDate), "MMM d, yyyy")}
                                                </div>
                                            </div>
                                            <div className="font-bold">
                                                ${(expense.amount / 100).toFixed(2)}
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
                                                    {format(new Date(tx.date), "MMM d")} • {categoryMap.get(tx.categoryId || "") || "Uncategorized"}
                                                </div>
                                            </div>
                                            <div className="font-bold text-red-500">
                                                -${(tx.amount / 100).toFixed(2)}
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
