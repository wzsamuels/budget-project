"use server";

import { addMonths, addYears } from "date-fns";

import { auth } from "@/auth";
import { db } from "@/db";
import { transactions, recurringExpenses, budgetCategories } from "@/db/schema";
import { addExpenseSchema, addRecurringExpenseSchema, AddExpenseFormValues, AddRecurringExpenseFormValues } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

export async function addExpense(data: AddExpenseFormValues) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
    }

    const validated = addExpenseSchema.safeParse(data);
    if (!validated.success) {
        return { success: false, error: "Invalid data" };
    }

    const { description, amount, date, categoryId } = validated.data;

    try {
        await db.insert(transactions).values({
            userId: session.user.id,
            description,
            amount: Math.round(amount * 100), // Convert to cents
            date,
            categoryId,
            type: "EXPENSE",
            isRecurring: false,
        });

        revalidatePath("/dashboard/expenses");
        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        console.error("Failed to add expense:", error);
        return { success: false, error: "Failed to add expense" };
    }
}

export async function addRecurringExpense(data: AddRecurringExpenseFormValues) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
    }

    const validated = addRecurringExpenseSchema.safeParse(data);
    if (!validated.success) {
        return { success: false, error: "Invalid data" };
    }

    const { description, amount, frequency, startDate, endDate, categoryId } = validated.data;

    try {
        await db.insert(recurringExpenses).values({
            userId: session.user.id,
            description,
            amount: Math.round(amount * 100), // Convert to cents
            frequency,
            nextDueDate: startDate,
            startDate,
            endDate: endDate || null,
            categoryId,
            isActive: true,
        });

        revalidatePath("/dashboard/expenses");
        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        console.error("Failed to add recurring expense:", error);
        return { success: false, error: "Failed to add recurring expense" };
    }
}

export async function updateTransaction(id: string, data: AddExpenseFormValues) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
    }

    const validated = addExpenseSchema.safeParse(data);
    if (!validated.success) {
        return { success: false, error: "Invalid data" };
    }

    const { description, amount, date, categoryId } = validated.data;

    try {
        await db.update(transactions)
            .set({
                description,
                amount: Math.round(amount * 100),
                date,
                categoryId,
                updatedAt: new Date()
            })
            .where(and(eq(transactions.id, id), eq(transactions.userId, session.user.id)));

        revalidatePath("/dashboard/expenses");
        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        console.error("Failed to update transaction:", error);
        return { success: false, error: "Failed to update transaction" };
    }
}

export async function updateRecurringExpense(id: string, data: AddRecurringExpenseFormValues) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
    }

    const validated = addRecurringExpenseSchema.safeParse(data);
    if (!validated.success) {
        return { success: false, error: "Invalid data" };
    }


    const { description, amount, frequency, startDate, endDate, categoryId } = validated.data;

    try {
        await db.update(recurringExpenses)
            .set({
                description,
                amount: Math.round(amount * 100),
                frequency,
                startDate,
                nextDueDate: startDate,
                endDate: endDate || null,
                categoryId,
                updatedAt: new Date()
            })
            .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.userId, session.user.id)));

        revalidatePath("/dashboard/expenses");
        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        console.error("Failed to update recurring expense:", error);
        return { success: false, error: "Failed to update recurring expense" };
    }
}

export async function deleteTransaction(id: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        await db.delete(transactions)
            .where(and(eq(transactions.id, id), eq(transactions.userId, session.user.id)));

        revalidatePath("/dashboard/expenses");
        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete transaction:", error);
        return { success: false, error: "Failed to delete transaction" };
    }
}

export async function deleteRecurringExpense(id: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        await db.delete(recurringExpenses)
            .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.userId, session.user.id)));

        revalidatePath("/dashboard/expenses");
        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        console.error("Failed to delete recurring expense:", error);
        return { success: false, error: "Failed to delete recurring expense" };
    }
}

export async function stopRecurringExpense(id: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        // Set endDate to yesterday (effectively stopping it) or today?
        // Let's set isActive to false AND endDate to now.
        // Schema has boolean isActive.

        await db.update(recurringExpenses)
            .set({
                isActive: false,
                endDate: new Date().toISOString().split("T")[0],
                updatedAt: new Date()
            })
            .where(and(eq(recurringExpenses.id, id), eq(recurringExpenses.userId, session.user.id)));

        revalidatePath("/dashboard/expenses");
        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        console.error("Failed to stop recurring expense:", error);
        return { success: false, error: "Failed to stop recurring expense" };
    }
}



export async function skipNextRecurringExpense(id: string) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const expense = await db.query.recurringExpenses.findFirst({
            where: and(eq(recurringExpenses.id, id), eq(recurringExpenses.userId, session.user.id))
        });

        if (!expense) return { success: false, error: "Expense not found" };

        // Construct UTC Date from string "YYYY-MM-DD"
        let nextDate = new Date(expense.nextDueDate + "T00:00:00Z");

        if (expense.frequency === "MONTHLY") {
            nextDate = addMonths(nextDate, 1);
        } else if (expense.frequency === "YEARLY") {
            nextDate = addYears(nextDate, 1);
        }

        await db.update(recurringExpenses)
            .set({
                nextDueDate: nextDate.toISOString().split("T")[0],
                updatedAt: new Date()
            })
            .where(eq(recurringExpenses.id, id));

        revalidatePath("/dashboard/expenses");
        revalidatePath("/dashboard");
        return { success: true };
    } catch (error) {
        console.error("Failed to skip recurring expense:", error);
        return { success: false, error: "Failed to skip recurring expense" };
    }
}

export async function getBudgetCategories() {
    const session = await auth();
    if (!session?.user?.id) return [];

    return await db.query.budgetCategories.findMany({
        where: eq(budgetCategories.userId, session.user.id),
    });
}

export async function seedBudgetCategories() {
    const session = await auth();
    if (!session?.user?.id) return { success: false };

    const defaults = [
        { name: "Housing/Rent", type: "FIXED" },
        { name: "Utilities", type: "FIXED" },
        { name: "Internet", type: "FIXED" },
        { name: "Groceries", type: "VARIABLE" },
        { name: "Dining Out", type: "VARIABLE" },
        { name: "Transportation/Gas", type: "VARIABLE" },
        { name: "Entertainment", type: "VARIABLE" },
        { name: "Health", type: "FIXED" },
        { name: "Insurance", type: "FIXED" },
        { name: "Savings", type: "SAVINGS_GOAL" },
    ] as const;

    const userId = session.user.id;

    try {
        await db.insert(budgetCategories).values(
            defaults.map(d => ({
                userId: userId,
                name: d.name,
                type: d.type
            }))
        );
        revalidatePath("/dashboard/expenses");
        return { success: true };
    } catch (error) {
        console.error("Failed to seed categories:", error);
        return { success: false };
    }
}
// ... existing code ...

export async function markRecurringExpenseAsPaid(
    recurringRuleId: string,
    values: z.infer<typeof addExpenseSchema>
) {
    const session = await auth();
    if (!session?.user?.id) {
        return { success: false, error: "Unauthorized" };
    }

    try {
        const expenseRule = await db.query.recurringExpenses.findFirst({
            where: and(
                eq(recurringExpenses.id, recurringRuleId),
                eq(recurringExpenses.userId, session.user.id)
            )
        });

        if (!expenseRule) {
            return { success: false, error: "Recurring expense rule not found" };
        }

        // 1. Create the Transaction
        await db.insert(transactions).values({
            userId: session.user.id,
            description: values.description,
            amount: Math.round(values.amount * 100), // dollars to cents
            categoryId: values.categoryId || null,
            date: values.date, // "YYYY-MM-DD" string
            type: "EXPENSE",
            isRecurring: true,
            recurringRuleId: recurringRuleId,
        });

        // 2. Advance the Next Due Date
        // Construct UTC Date from string "YYYY-MM-DD"
        let nextDate = new Date(expenseRule.nextDueDate + "T00:00:00Z");

        if (expenseRule.frequency === "MONTHLY") {
            nextDate = addMonths(nextDate, 1);
        } else if (expenseRule.frequency === "YEARLY") {
            nextDate = addYears(nextDate, 1);
        }

        await db.update(recurringExpenses)
            .set({
                nextDueDate: nextDate.toISOString().split("T")[0],
                updatedAt: new Date()
            })
            .where(eq(recurringExpenses.id, recurringRuleId));

        revalidatePath("/dashboard/expenses");
        revalidatePath("/dashboard");
        return { success: true };

    } catch (error) {
        console.error("Failed to mark recurring expense as paid:", error);
        return { success: false, error: "Failed to process payment" };
    }
}
