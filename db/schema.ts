
import {
    pgTable,
    text,
    integer,
    boolean,
    timestamp,
    pgEnum,
    uuid,
    date,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Enums
export const deductionCategoryEnum = pgEnum("deduction_category", [
    "TAX",
    "BENEFIT",
    "RETIREMENT",
    "HSA",
    "GARNISHMENT",
]);

export const budgetCategoryTypeEnum = pgEnum("budget_category_type", [
    "FIXED",
    "VARIABLE",
    "SAVINGS_GOAL",
]);

export const transactionTypeEnum = pgEnum("transaction_type", [
    "INCOME",
    "EXPENSE",
]);

// Auth.js Tables
export const users = pgTable("user", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    name: text("name"),
    email: text("email").notNull().unique(),
    emailVerified: timestamp("emailVerified", { mode: "date" }),
    image: text("image"),
});

export const accounts = pgTable(
    "account",
    {
        userId: text("userId")
            .notNull()
            .references(() => users.id, { onDelete: "cascade" }),
        type: text("type").notNull(),
        provider: text("provider").notNull(),
        providerAccountId: text("providerAccountId").notNull(),
        refresh_token: text("refresh_token"),
        access_token: text("access_token"),
        expires_at: integer("expires_at"),
        token_type: text("token_type"),
        scope: text("scope"),
        id_token: text("id_token"),
        session_state: text("session_state"),
    },
    (account) => [
        {
            compoundKey: [account.provider, account.providerAccountId]
        }
    ]
);

export const sessions = pgTable("session", {
    sessionToken: text("sessionToken").primaryKey(),
    userId: text("userId")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    expires: timestamp("expires", { mode: "date" }).notNull(),
});

export const verificationTokens = pgTable(
    "verificationToken",
    {
        identifier: text("identifier").notNull(),
        token: text("token").notNull(),
        expires: timestamp("expires", { mode: "date" }).notNull(),
    },
    (verificationToken) => [
        {
            compoundKey: [verificationToken.identifier, verificationToken.token]
        }
    ]
);

// App Domain Tables

export const paychecks = pgTable("paychecks", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    payDate: date("pay_date").notNull(),
    grossAmount: integer("gross_amount").notNull(), // stored in cents
    netAmount: integer("net_amount").notNull(), // stored in cents
    employerName: text("employer_name").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
    isProjected: boolean("is_projected").default(false).notNull(),
});

export const paychecksRelations = relations(paychecks, ({ many }) => ({
    deductions: many(paycheckDeductions),
}));

export const paycheckDeductions = pgTable("paycheck_deductions", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    paycheckId: text("paycheck_id")
        .notNull()
        .references(() => paychecks.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g., "Federal Tax", "Aetna Health"
    amount: integer("amount").notNull(), // stored in cents
    category: deductionCategoryEnum("category").notNull(),
    isPreTax: boolean("is_pre_tax").notNull().default(false),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const paycheckDeductionsRelations = relations(paycheckDeductions, ({ one }) => ({
    paycheck: one(paychecks, {
        fields: [paycheckDeductions.paycheckId],
        references: [paychecks.id],
    }),
}));

export const budgetCategories = pgTable("budget_categories", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g., "Groceries"
    type: budgetCategoryTypeEnum("type").notNull(),
    targetAmount: integer("target_amount").notNull().default(0), // stored in cents
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const transactions = pgTable("transactions", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => budgetCategories.id, {
        onDelete: "set null",
    }),
    recurringRuleId: text("recurring_rule_id").references(() => recurringExpenses.id, {
        onDelete: "set null",
    }),
    amount: integer("amount").notNull(), // stored in cents
    date: date("date").notNull(),
    description: text("description").notNull(),
    type: transactionTypeEnum("type").notNull(),
    isRecurring: boolean("is_recurring").default(false).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const savingsPots = pgTable("savings_pots", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(), // e.g., "Emergency Fund"
    currentBalance: integer("current_balance").notNull().default(0), // stored in cents
    goalAmount: integer("goal_amount"), // stored in cents
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const recurringFrequencyEnum = pgEnum("recurring_frequency", [
    "MONTHLY",
    "YEARLY",
]);

export const recurringExpenses = pgTable("recurring_expenses", {
    id: text("id")
        .primaryKey()
        .$defaultFn(() => crypto.randomUUID()),
    userId: text("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    categoryId: text("category_id").references(() => budgetCategories.id, {
        onDelete: "set null",
    }),
    amount: integer("amount").notNull(), // stored in cents
    description: text("description").notNull(),
    frequency: recurringFrequencyEnum("frequency").notNull(),
    nextDueDate: date("next_due_date").notNull(),
    startDate: date("start_date").notNull().defaultNow(),
    endDate: date("end_date"),
    isActive: boolean("is_active").default(true).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Relations defined after all tables to allow circular references
export const transactionsRelations = relations(transactions, ({ one }) => ({
    category: one(budgetCategories, {
        fields: [transactions.categoryId],
        references: [budgetCategories.id],
    }),
    recurringRule: one(recurringExpenses, {
        fields: [transactions.recurringRuleId],
        references: [recurringExpenses.id],
    }),
}));

export const recurringExpensesRelations = relations(recurringExpenses, ({ many }) => ({
    transactions: many(transactions),
}));
