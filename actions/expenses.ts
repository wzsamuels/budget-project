"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { transactions, recurringExpenses, budgetCategories } from "@/db/schema";
import { addExpenseSchema, addRecurringExpenseSchema, AddExpenseFormValues, AddRecurringExpenseFormValues } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";

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
            date: date.toISOString().split("T")[0],
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

    const { description, amount, frequency, startDate, categoryId } = validated.data;

    try {
        await db.insert(recurringExpenses).values({
            userId: session.user.id,
            description,
            amount: Math.round(amount * 100), // Convert to cents
            frequency,
            nextDueDate: startDate.toISOString().split("T")[0],
            categoryId,
            isActive: true,
        });

        revalidatePath("/dashboard/expenses");
        return { success: true };
    } catch (error) {
        console.error("Failed to add recurring expense:", error);
        return { success: false, error: "Failed to add recurring expense" };
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
