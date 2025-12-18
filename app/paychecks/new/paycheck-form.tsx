
"use client";

import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { paycheckFormSchema, deductionCategories, PaycheckFormValues } from "@/lib/validators";
import { createPaycheck } from "@/actions/paycheck";
import { useState, useMemo } from "react";
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
    FormDescription,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { CalendarIcon, Plus, Trash2, DollarSign, Wallet } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Cell,
    ReferenceLine
} from "recharts";
import { toast } from "sonner";
import { parsePaystub } from "@/actions/upload-paystub";
import { Loader2, UploadCloud } from "lucide-react";

interface PaycheckFormProps {

    paycheckId?: string;
    initialData?: PaycheckFormValues;
}

import { updatePaycheck } from "@/actions/paycheck";

export function PaycheckForm({ paycheckId, initialData }: PaycheckFormProps) {
    const [isPending, setIsPending] = useState(false);
    const [isParsing, setIsParsing] = useState(false);

    const form = useForm<PaycheckFormValues>({
        resolver: zodResolver(paycheckFormSchema) as any,
        defaultValues: initialData || {
            employerName: "",
            grossAmount: 0,
            deductions: [],
        },
    });

    const { fields, append, remove, replace } = useFieldArray({
        control: form.control,
        name: "deductions",
    });

    const { watch } = form;
    const grossAmount = Number(watch("grossAmount") || 0);
    const deductions = watch("deductions") || [];

    const metrics = useMemo(() => {
        const totalDeductions = deductions.reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
        const netPay = grossAmount - totalDeductions;

        // Group deductions for chart
        const taxes = deductions.filter(d => d.category === 'TAX').reduce((acc, d) => acc + (Number(d.amount) || 0), 0);
        const benefits = deductions.filter(d => d.category !== 'TAX').reduce((acc, d) => acc + (Number(d.amount) || 0), 0);

        return { totalDeductions, netPay, taxes, benefits };
    }, [grossAmount, deductions]);

    const chartData = [
        { name: "Gross", amount: grossAmount, fill: "var(--primary)" },
        { name: "Taxes", amount: -metrics.taxes, fill: "var(--expense)" },
        { name: "Benefits/Other", amount: -metrics.benefits, fill: "var(--chart-2)" },
        { name: "Net Pay", amount: metrics.netPay, fill: "var(--income)" },
    ];

    async function onSubmit(data: PaycheckFormValues) {
        setIsPending(true);
        try {
            if (paycheckId) {
                await updatePaycheck(paycheckId, data);
                toast.success("Paycheck updated successfully");
            } else {
                await createPaycheck(data);
                toast.success("Paycheck saved successfully");
            }
        } catch (error) {
            toast.error("Failed to save paycheck");
        } finally {
            setIsPending(false);
        }
    }

    async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsParsing(true);
        const formData = new FormData();
        formData.append("file", file);

        try {
            const result = await parsePaystub(formData);
            if (result.success && result.data) {
                const { data } = result;

                if (data.grossAmount) form.setValue("grossAmount", data.grossAmount);
                if (data.payDate) form.setValue("payDate", new Date(data.payDate)); // Ensure date object
                if (data.employerName) form.setValue("employerName", data.employerName);

                if (data.deductions && data.deductions.length > 0) {
                    // Replace existing deductions or append? Let's replace to be clean if it's a fresh import
                    // But mapping types correctly is key.
                    replace(data.deductions as any);
                    toast.success("Paystub parsed successfully!");
                } else {
                    toast.info("Parsed basic info, but found no deductions. Please add manually.");
                }
            } else {
                toast.error(result.error || "Failed to parse paystub");
            }
        } catch (err) {
            toast.error("Something went wrong parsing the file");
        } finally {
            setIsParsing(false);
            // Reset input
            e.target.value = "";
        }
    }

    return (
        <div className="grid lg:grid-cols-2 gap-8">
            {/* Left Column: Form */}
            <div className="space-y-6">
                {/* Upload Card */}
                <Card className="border-dashed border-2 bg-muted/20">
                    <CardContent className="pt-6 flex flex-col items-center justify-center text-center">
                        <div className="p-3 bg-background rounded-full mb-3 shadow-sm">
                            {isParsing ? <Loader2 className="h-6 w-6 animate-spin text-primary" /> : <UploadCloud className="h-6 w-6 text-primary" />}
                        </div>
                        <h3 className="font-semibold mb-1">Auto-fill from Paystub</h3>
                        <p className="text-sm text-muted-foreground mb-4 max-w-xs">
                            Upload a PDF paystub to automatically extract gross pay, taxes, and deductions.
                        </p>
                        <div className="relative">
                            <Button variant="outline" disabled={isParsing}>
                                {isParsing ? "Analyzing..." : "Select PDF"}
                            </Button>
                            <Input
                                type="file"
                                accept="application/pdf"
                                className="absolute inset-0 opacity-0 cursor-pointer"
                                onChange={onFileChange}
                                disabled={isParsing}
                            />
                        </div>
                    </CardContent>
                </Card>

                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
                        <Card>
                            <CardHeader>
                                <CardTitle>Income Details</CardTitle>
                                <CardDescription>Start with your top-line gross pay.</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <FormField
                                    control={form.control}
                                    name="employerName"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Employer</FormLabel>
                                            <FormControl>
                                                <Input placeholder="Acme Corp" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />

                                <div className="grid grid-cols-2 gap-4">
                                    <FormField
                                        control={form.control}
                                        name="grossAmount"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>Gross Pay ($)</FormLabel>
                                                <FormControl>
                                                    <Input type="number" step="0.01" {...field} />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />

                                    <FormField
                                        control={form.control}
                                        name="payDate"
                                        render={({ field }) => (
                                            <FormItem className="flex flex-col">
                                                <FormLabel className="mb-1.5">Pay Date</FormLabel>
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
                                                                    format(field.value, "PPP")
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
                                                            selected={field.value}
                                                            onSelect={field.onChange}
                                                            disabled={(date) =>
                                                                date > new Date() || date < new Date("1900-01-01")
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
                            </CardContent>
                        </Card>

                        <Card>
                            <CardHeader className="flex flex-row items-center justify-between">
                                <div>
                                    <CardTitle>Deductions</CardTitle>
                                    <CardDescription>Taxes, Benefits, Retirement</CardDescription>
                                </div>
                                <Button type="button" variant="outline" size="sm" onClick={() => append({ name: "", amount: 0, category: "TAX", isPreTax: false })} >
                                    <Plus className="w-4 h-4 mr-2" /> Add
                                </Button>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                {fields.map((field, index) => (
                                    <div key={field.id} className="grid grid-cols-12 gap-3 items-end border-b pb-4 last:border-0 last:pb-0 animate-in fade-in slide-in-from-top-2">
                                        <div className="col-span-4">
                                            <FormField
                                                control={form.control}
                                                name={`deductions.${index}.name`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className={index !== 0 ? "sr-only" : ""}>Name</FormLabel>
                                                        <FormControl>
                                                            <Input placeholder="Fed Tax" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <div className="col-span-3">
                                            <FormField
                                                control={form.control}
                                                name={`deductions.${index}.amount`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className={index !== 0 ? "sr-only" : ""}>Amount</FormLabel>
                                                        <FormControl>
                                                            <Input type="number" step="0.01" {...field} />
                                                        </FormControl>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <div className="col-span-3">
                                            <FormField
                                                control={form.control}
                                                name={`deductions.${index}.category`}
                                                render={({ field }) => (
                                                    <FormItem>
                                                        <FormLabel className={index !== 0 ? "sr-only" : ""}>Category</FormLabel>
                                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                                            <FormControl>
                                                                <SelectTrigger>
                                                                    <SelectValue placeholder="Cat" />
                                                                </SelectTrigger>
                                                            </FormControl>
                                                            <SelectContent>
                                                                {deductionCategories.map((type) => (
                                                                    <SelectItem key={type} value={type}>
                                                                        {type}
                                                                    </SelectItem>
                                                                ))}
                                                            </SelectContent>
                                                        </Select>
                                                        <FormMessage />
                                                    </FormItem>
                                                )}
                                            />
                                        </div>

                                        <div className="col-span-2 flex justify-end">
                                            <Button type="button" variant="ghost" size="icon" onClick={() => remove(index)}>
                                                <Trash2 className="w-4 h-4 text-destructive" />
                                            </Button>
                                        </div>
                                    </div>
                                ))}
                                {fields.length === 0 && (
                                    <div className="text-center p-8 text-muted-foreground border border-dashed rounded-lg">
                                        No deductions added yet.
                                    </div>
                                )}
                            </CardContent>
                        </Card>

                        <Button type="submit" size="lg" className="w-full" disabled={isPending}>
                            {isPending ? "Saving..." : "Save Paycheck"}
                        </Button>
                    </form>
                </Form>
            </div>

            {/* Right Column: Visualization */}
            <div className="space-y-6">
                <Card className="bg-muted/50 border-0 h-full max-h-[600px] flex flex-col sticky top-6">
                    <CardHeader>
                        <CardTitle>Paycheck Anatomy</CardTitle>
                        <CardDescription>Real-time breakdown of your income</CardDescription>
                    </CardHeader>
                    <CardContent className="flex-1 min-h-[300px]">
                        <ResponsiveContainer width="100%" height={350}>
                            <BarChart data={chartData} layout="vertical" margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                                <XAxis type="number" hide />
                                <YAxis dataKey="name" type="category" width={100} tick={{ fontSize: 12 }} />
                                <Tooltip
                                    formatter={(value: number) => `$${Math.abs(value).toFixed(2)}`}
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                                />
                                <Bar dataKey="amount" radius={[0, 4, 4, 0]} barSize={40}>
                                    {chartData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.fill} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </CardContent>
                    <div className="p-6 pt-0 mt-auto border-t bg-card/50 rounded-b-xl">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-muted-foreground">Gross Pay</span>
                            <span className="font-medium">${grossAmount.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center mb-4 text-destructive">
                            <span>Total Deductions</span>
                            <span>-${metrics.totalDeductions.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between items-center pt-4 border-t border-dashed">
                            <span className="text-lg font-bold">Net Pay</span>
                            <span className="text-2xl font-bold text-income">${metrics.netPay.toFixed(2)}</span>
                        </div>
                    </div>
                </Card>
            </div>
        </div>
    );
}
