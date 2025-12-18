import { auth } from "@/auth";
import { db } from "@/db";
import { paychecks, deductionCategoryEnum } from "@/db/schema";
import { eq, and } from "drizzle-orm";
import { redirect, notFound } from "next/navigation";
import { PaycheckForm } from "../../new/paycheck-form";

export default async function EditPaycheckPage({ params }: { params: Promise<{ id: string }> }) {
    const session = await auth();
    const userId = session?.user?.id;

    if (!userId) {
        redirect("/api/auth/signin");
    }

    const { id } = await params;

    const paycheck = await db.query.paychecks.findFirst({
        where: and(eq(paychecks.id, id), eq(paychecks.userId, userId)),
        with: {
            deductions: true
        }
    });

    if (!paycheck) {
        notFound();
    }

    // Map DB data to Form values
    const initialData = {
        employerName: paycheck.employerName,
        grossAmount: paycheck.grossAmount / 100,
        payDate: new Date(paycheck.payDate),
        deductions: paycheck.deductions.map(d => ({
            name: d.name,
            amount: d.amount / 100,
            category: d.category as typeof deductionCategoryEnum.enumValues[number],
            isPreTax: d.isPreTax
        }))
    };

    return (
        <div className="container mx-auto py-10 px-4 md:px-8 space-y-8">
            <h1 className="text-3xl font-bold tracking-tight">Edit Paycheck</h1>
            <PaycheckForm paycheckId={id} initialData={initialData} />
        </div>
    );
}
