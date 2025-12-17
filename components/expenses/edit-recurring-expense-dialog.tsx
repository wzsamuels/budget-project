"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { format } from "date-fns";
import { CalendarIcon, Pencil } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from "@/components/ui/popover";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { updateRecurringExpense, deleteRecurringExpense, stopRecurringExpense, skipNextRecurringExpense } from "@/actions/expenses";
import { editRecurringExpenseSchema, recurringFrequencies } from "@/lib/validators";

interface Category {
    id: string;
    name: string;
}

interface EditRecurringExpenseDialogProps {
    expense: {
        id: string;
        description: string;
        amount: number; // in cents
        frequency: "MONTHLY" | "YEARLY";
        startDate: string;
        endDate: string | null;
        categoryId: string | null;
    };
    categories: Category[];
}

export function EditRecurringExpenseDialog({ expense, categories }: EditRecurringExpenseDialogProps) {
    const [open, setOpen] = useState(false);

    const form = useForm<z.infer<typeof editRecurringExpenseSchema>>({
        resolver: zodResolver(editRecurringExpenseSchema) as any,
        defaultValues: {
            description: expense.description,
            amount: expense.amount / 100,
            frequency: expense.frequency,
            startDate: expense.startDate || "",
            endDate: expense.endDate || undefined,
            categoryId: expense.categoryId || "",
        },
    });

    async function onSubmit(values: z.infer<typeof editRecurringExpenseSchema>) {
        const result = await updateRecurringExpense(expense.id, values);
        if (result.success) {
            toast.success("Recurring expense updated successfully");
            setOpen(false);
        } else {
            toast.error(result.error || "Failed to update recurring expense");
        }
    }

    async function handleSkip() {
        if (!confirm("Skip the next scheduled occurrence?")) return;
        const result = await skipNextRecurringExpense(expense.id);
        if (result.success) {
            toast.success("Next occurrence skipped");
            setOpen(false);
        } else {
            toast.error(result.error || "Failed to skip amount");
        }
    }

    async function handleStop() {
        if (!confirm("End this recurring expense? This will set the end date to today and stop future projections.")) return;
        const result = await stopRecurringExpense(expense.id);
        if (result.success) {
            toast.success("Recurring expense stopped");
            setOpen(false);
        } else {
            toast.error(result.error || "Failed to stop expense");
        }
    }

    async function handleDelete() {
        if (!confirm("Delete this recurring expense rule entirely? This will remove it from all projections.")) return;
        const result = await deleteRecurringExpense(expense.id);
        if (result.success) {
            toast.success("Recurring expense deleted");
            setOpen(false);
        } else {
            toast.error(result.error || "Failed to delete expense");
        }
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                    <Pencil className="h-4 w-4" />
                    <span className="sr-only">Edit</span>
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Edit Recurring Expense</DialogTitle>
                    <DialogDescription>
                        Update the rule for this recurring expense.
                    </DialogDescription>
                </DialogHeader>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                        <FormField
                            control={form.control}
                            name="description"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Description</FormLabel>
                                    <FormControl>
                                        <Input placeholder="Netflix, Rent, etc." {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="amount"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Default Amount ($)</FormLabel>
                                    <FormControl>
                                        <Input type="number" step="0.01" placeholder="0.00" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="categoryId"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Category</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select a category" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {categories.map((cat) => (
                                                <SelectItem key={cat.id} value={cat.id}>
                                                    {cat.name}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="frequency"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>Frequency</FormLabel>
                                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="Select frequency" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            {recurringFrequencies.map((freq) => (
                                                <SelectItem key={freq} value={freq}>
                                                    {freq.charAt(0) + freq.slice(1).toLowerCase()}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <FormField
                                control={form.control}
                                name="startDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>Start Date</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full pl-3 text-left font-normal",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                    >
                                                        {field.value ? (
                                                            format(new Date(field.value + "T12:00:00"), "PPP")
                                                        ) : (
                                                            <span>Pick a date</span>
                                                        )}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value ? new Date(field.value + "T12:00:00") : undefined}
                                                    onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                                                    disabled={(date) =>
                                                        date < new Date("1900-01-01")
                                                    }
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                            <FormField
                                control={form.control}
                                name="endDate"
                                render={({ field }) => (
                                    <FormItem className="flex flex-col">
                                        <FormLabel>End Date (Opt)</FormLabel>
                                        <Popover>
                                            <PopoverTrigger asChild>
                                                <FormControl>
                                                    <Button
                                                        variant={"outline"}
                                                        className={cn(
                                                            "w-full pl-3 text-left font-normal",
                                                            !field.value && "text-muted-foreground"
                                                        )}
                                                    >
                                                        {field.value ? (
                                                            format(new Date(field.value + "T12:00:00"), "PPP")
                                                        ) : (
                                                            <span>No end date</span>
                                                        )}
                                                        <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                                    </Button>
                                                </FormControl>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-auto p-0" align="start">
                                                <Calendar
                                                    mode="single"
                                                    selected={field.value ? new Date(field.value + "T12:00:00") : undefined}
                                                    onSelect={(date) => field.onChange(date ? format(date, "yyyy-MM-dd") : "")}
                                                    disabled={(date) =>
                                                        date < new Date("1900-01-01")
                                                    }
                                                    initialFocus
                                                />
                                            </PopoverContent>
                                        </Popover>
                                        <FormMessage />
                                    </FormItem>
                                )}
                            />
                        </div>
                        <div className="flex flex-col gap-3 pt-4 border-t mt-4">
                            <Button type="button" variant="outline" onClick={handleSkip}>
                                Skip Next Occurrence
                            </Button>
                            <div className="flex gap-2">
                                <Button type="button" variant="secondary" className="flex-1" onClick={handleStop}>
                                    Stop Series
                                </Button>
                                <Button type="button" variant="destructive" className="flex-1" onClick={handleDelete}>
                                    Delete Series
                                </Button>
                            </div>
                            <Button type="submit" className="w-full">Save Changes</Button>
                        </div>
                    </form>
                </Form>
            </DialogContent>
        </Dialog>
    );
}
