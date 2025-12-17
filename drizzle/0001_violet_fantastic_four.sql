ALTER TABLE "paychecks" ADD COLUMN "is_projected" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ADD COLUMN "start_date" date DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "recurring_expenses" ADD COLUMN "end_date" date;