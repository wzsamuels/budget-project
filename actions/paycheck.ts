
"use server";

import { auth } from "@/auth";
import { db } from "@/db";
import { paychecks, paycheckDeductions } from "@/db/schema";
import { paycheckFormSchema } from "@/lib/validators";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

export async function createPaycheck(data: z.infer<typeof paycheckFormSchema>) {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
        throw new Error("Unauthorized");
    }

    const validated = paycheckFormSchema.safeParse(data);
    if (!validated.success) {
        return { error: "Invalid data" };
    }

    const { grossAmount, deductions, employerName, payDate } = validated.data;

    // Convert dollars to cents
    const grossCents = Math.round(grossAmount * 100);

    const totalDeductionsCents = deductions.reduce(
        (acc, d) => acc + Math.round(d.amount * 100),
        0
    );

    const netCents = grossCents - totalDeductionsCents;

    await db.transaction(async (tx) => {
        const [paycheck] = await tx
            .insert(paychecks)
            .values({
                userId,
                payDate: payDate.toISOString().split("T")[0],
                grossAmount: grossCents,
                netAmount: netCents,
                employerName,
            })
            .returning();

        if (deductions.length > 0) {
            await tx.insert(paycheckDeductions).values(
                deductions.map((d) => ({
                    paycheckId: paycheck.id,
                    name: d.name,
                    amount: Math.round(d.amount * 100),
                    category: d.category,
                    isPreTax: d.isPreTax,
                }))
            );
        }
    });

    revalidatePath("/dashboard");
    redirect("/dashboard");
}

import { addWeeks, addMonths, endOfMonth, setDate, isAfter, startOfDay } from "date-fns";
import { eq } from "drizzle-orm";

export async function projectPaycheck(
    paycheckId: string,
    frequency: "WEEKLY" | "BIWEEKLY" | "SEMIMONTHLY" | "MONTHLY"
) {
    const session = await auth();
    const userId = session?.user?.id;
    if (!userId) throw new Error("Unauthorized");

    // 1. Fetch Source Paycheck
    const source = await db.query.paychecks.findFirst({
        where: eq(paychecks.id, paycheckId),
        with: {
            deductions: true,
        },
    });

    if (!source) throw new Error("Paycheck not found");
    if (source.userId !== userId) throw new Error("Unauthorized");

    // 2. Calculate Future Dates
    const futureDates: Date[] = [];
    let currentDate = new Date(source.payDate);
    const endOfYear = new Date(new Date().getFullYear(), 11, 31);

    // Initial increment to get first future date
    currentDate = getNextPayDate(currentDate, frequency);

    while (!isAfter(currentDate, endOfYear)) {
        futureDates.push(new Date(currentDate));
        currentDate = getNextPayDate(currentDate, frequency);
    }

    if (futureDates.length === 0) return { success: true, count: 0 };

    // 3. Insert Projected Paychecks
    // We use a transaction to ensure all or nothing
    await db.transaction(async (tx) => {
        for (const date of futureDates) {
            const [newPaycheck] = await tx
                .insert(paychecks)
                .values({
                    userId,
                    payDate: date.toISOString().split("T")[0],
                    grossAmount: source.grossAmount,
                    netAmount: source.netAmount,
                    employerName: source.employerName,
                    isProjected: true,
                })
                .returning();

            if (source.deductions.length > 0) {
                await tx.insert(paycheckDeductions).values(
                    source.deductions.map((d) => ({
                        paycheckId: newPaycheck.id,
                        name: d.name,
                        amount: d.amount,
                        category: d.category,
                        isPreTax: d.isPreTax,
                    }))
                );
            }
        }
    });

    revalidatePath("/dashboard");
    return { success: true, count: futureDates.length };
}

function getNextPayDate(date: Date, frequency: string): Date {
    const d = new Date(date);
    switch (frequency) {
        case "WEEKLY":
            return addWeeks(d, 1);
        case "BIWEEKLY":
            return addWeeks(d, 2);
        case "MONTHLY":
            return addMonths(d, 1);
        case "SEMIMONTHLY": {
            // Logic: 15th and Last Day of Month
            const day = d.getDate();
            if (day < 15) {
                return setDate(d, 15);
            } else {
                // Move to last day of current month? No, if we are on 15th, next is end of month.
                // If we are on 30th/31st, next is 15th of NEXT month.
                // Wait, if current is < 15 (e.g. 1st), next is 15th.
                // If current is 15 <= day < EndOfMonth, next is EndOfMonth.
                // If current is EndOfMonth, next is 15th of next month.

                // Let's refine:
                // If day < 15 -> Go to 15th of SAME month.
                // If day == 15 -> Go to EndOf SAME month.
                // If day > 15 -> Go to 15th of NEXT month.

                // Edge case: "End of month" varies (28, 30, 31).
                // If current is 28th (feb), is it end of month? Yes.
                const eom = endOfMonth(d).getDate();

                if (day < 15) return setDate(d, 15);
                if (day === 15) return endOfMonth(d);

                // Else (day > 15), go to next month 15th
                return setDate(addMonths(d, 1), 15);
            }
        }
        default:
            return addWeeks(d, 1);
    }
}
