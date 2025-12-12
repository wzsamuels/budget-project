
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
