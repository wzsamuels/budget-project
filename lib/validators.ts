
import { z } from "zod";

export const deductionCategories = [
    "TAX",
    "BENEFIT",
    "RETIREMENT",
    "HSA",
    "GARNISHMENT",
] as const;

export const budgetCategoryTypes = [
    "FIXED",
    "VARIABLE",
    "SAVINGS_GOAL",
] as const;

export const transactionTypes = ["INCOME", "EXPENSE"] as const;

export const paycheckFormSchema = z.object({
    employerName: z.string().min(1, "Employer name is required"),
    payDate: z.date({ required_error: "Pay date is required" }),
    grossAmount: z.coerce.number().min(0.01, "Gross amount must be positive"),
    deductions: z.array(
        z.object({
            name: z.string().min(1, "Deduction name is required"),
            amount: z.coerce.number().min(0, "Amount must be positive"),
            category: z.enum(deductionCategories),
            isPreTax: z.boolean().default(false),
        })
    ).default([]),
});

export type PaycheckFormValues = z.infer<typeof paycheckFormSchema>;
