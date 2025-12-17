
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
    payDate: z.date({ message: "Pay date is required" }),
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

export const recurringFrequencies = ["MONTHLY", "YEARLY"] as const;

export const addExpenseSchema = z.object({
    description: z.string().min(1, "Description is required"),
    amount: z.coerce.number().min(0.01, "Amount must be positive"),
    date: z.string().min(1, "Date is required"),
    categoryId: z.string().min(1, "Category is required"),
    isRecurring: z.boolean().default(false),
});

export type AddExpenseFormValues = z.infer<typeof addExpenseSchema>;

export const addRecurringExpenseSchema = z.object({
    description: z.string().min(1, "Description is required"),
    amount: z.coerce.number().min(0.01, "Amount must be positive"),
    frequency: z.enum(recurringFrequencies),
    startDate: z.string().min(1, "Start Date is required"),
    endDate: z.string().optional(),
    categoryId: z.string().min(1, "Category is required"),
});

export type AddRecurringExpenseFormValues = z.infer<typeof addRecurringExpenseSchema>;

export const editTransactionSchema = addExpenseSchema;
export type EditTransactionFormValues = z.infer<typeof editTransactionSchema>;

export const editRecurringExpenseSchema = addRecurringExpenseSchema;
export type EditRecurringExpenseFormValues = z.infer<typeof editRecurringExpenseSchema>;
