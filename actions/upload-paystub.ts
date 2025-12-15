"use server";

import { PDFParse } from "pdf-parse";
import { PaycheckFormValues, deductionCategories } from "@/lib/validators";

type ParsedPaycheck = Partial<PaycheckFormValues>;

export async function parsePaystub(formData: FormData): Promise<{ success: boolean; data?: ParsedPaycheck; error?: string }> {
    const file = formData.get("file") as File;

    if (!file) {
        return { success: false, error: "No file uploaded" };
    }

    if (file.type !== "application/pdf") {
        return { success: false, error: "Only PDF files are supported" };
    }

    try {
        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const parser = new PDFParse({ data: buffer });
        const data = await parser.getText();
        const text = data.text;

        // Parse logic
        const extracted = parsePaystubText(text);

        return { success: true, data: extracted };
    } catch (error) {
        console.error("PDF Parse Error:", error);
        return { success: false, error: "Failed to parse PDF: " + (error instanceof Error ? error.message : String(error)) };
    }
}

function parsePaystubText(text: string): ParsedPaycheck {
    // Normalize text: remove multiple spaces, converting to lines
    const lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);

    const result: ParsedPaycheck = {
        grossAmount: 0,
        deductions: [],
        employerName: "",
        payDate: new Date(),
    };

    // 1. Try to find Employer Name (usually at the top)
    // Simple heuristic: First non-date line that looks like a name
    // This is very rudimentary.
    const possibleEmployerParams = lines.slice(0, 5);
    for (const line of possibleEmployerParams) {
        if (line.length > 3 && !line.match(/\d/) && !line.includes("Statement") && !line.includes("Pay Stub")) {
            // result.employerName = line; // Too risky to guess, let user fill
            break;
        }
    }

    // 2. Find Pay Date
    // Look for date patterns like MM/DD/YYYY or similar
    const dateRegex = /(\d{1,2}\/\d{1,2}\/\d{2,4})|([A-Z][a-z]+ \d{1,2}, \d{4})/;
    const dateMatch = text.match(dateRegex);
    if (dateMatch) {
        const dateStr = dateMatch[0];
        const parsedDate = new Date(dateStr);
        if (!isNaN(parsedDate.getTime())) {
            result.payDate = parsedDate;
        }
    }

    // 3. Find Gross Pay
    // Look for "Gross Pay" or "Total Gross" or "Gross Earnings"
    const grossRegex = /(?:Gross Pay|Total Gross|Gross Earnings|Total Earnings)/i;

    // First pass: explicit gross earnings line
    lines.forEach(line => {
        if (grossRegex.test(line)) {
            // Priority: "Gross Earnings" line
            const amount = parseLineAmount(line);
            if (amount > (result.grossAmount || 0)) {
                result.grossAmount = amount;
            }
        }
    });

    // 4. Find Deductions
    // Common keywords
    const deductionKeywords: Record<string, { category: typeof deductionCategories[number], isPreTax: boolean }> = {
        "Federal Income Tax": { category: "TAX", isPreTax: false },
        "Fed Tax": { category: "TAX", isPreTax: false },
        "FITW": { category: "TAX", isPreTax: false }, // User specific
        "Social Security": { category: "TAX", isPreTax: false },
        "Soc Sec": { category: "TAX", isPreTax: false },
        "OASDI": { category: "TAX", isPreTax: false },
        "SS": { category: "TAX", isPreTax: false }, // User specific
        "Medicare": { category: "TAX", isPreTax: false },
        "Med Tax": { category: "TAX", isPreTax: false },
        "MED": { category: "TAX", isPreTax: false }, // User specific
        "State Income Tax": { category: "TAX", isPreTax: false },
        "State Tax": { category: "TAX", isPreTax: false },
        "NY Tax": { category: "TAX", isPreTax: false },
        "CA Tax": { category: "TAX", isPreTax: false },
        "NC": { category: "TAX", isPreTax: false }, // User specific
        "401k": { category: "RETIREMENT", isPreTax: true },
        "403b": { category: "RETIREMENT", isPreTax: true },
        "Dental": { category: "BENEFIT", isPreTax: true },
        "Medical": { category: "BENEFIT", isPreTax: true },
        "Health": { category: "BENEFIT", isPreTax: true },
        "Vision": { category: "BENEFIT", isPreTax: true },
        "HSA": { category: "HSA", isPreTax: true },
        "FSA": { category: "HSA", isPreTax: true },
    };

    // Iterate lines to find these keywords
    // Iterate lines to find these keywords
    // Iterate lines to find these keywords
    for (const line of lines) {
        // Skip YTD lines often found on same row in some formats, but usually parsing splits them badly or they are clear.
        // We want "Current" column usually. simpler parsers struggle with columns.
        // Strategy: Look for the keyword, then find the FIRST monetary value in that line (usually current),
        // if there are multiple, heuristics needed.

        const lowerLine = line.toLowerCase();

        // 1. Skip lines that definitely aren't deductions but look like them
        // "Total Taxes" or headings often contain keywords but aren't deductions per se.
        // Also avoid "Fed Taxable Income" being counted as a deduction (it's income).
        if (lowerLine.includes("taxable income") || lowerLine.includes("total taxes")) {
            continue;
        }

        for (const [key, config] of Object.entries(deductionKeywords)) {
            // Regex to match whole word/phrase only, to avoid "NC" matching "Income"
            // Escape special chars in key just in case (though we know our keys are safe)
            const escapedKey = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            const regex = new RegExp(`\\b${escapedKey}\\b`, 'i');

            if (regex.test(line)) {
                const amount = parseLineAmount(line);
                if (amount > 0) {
                    // Check if we already have this deduction
                    const exists = result.deductions?.find(d => d.name === key);
                    if (!exists) {
                        result.deductions?.push({
                            name: key,
                            amount: amount,
                            category: config.category,
                            isPreTax: config.isPreTax
                        });
                    }
                }
            }
        }
    }

    // fallback for gross amount
    if (!result.grossAmount) {
        lines.forEach(line => {
            // If we found "Fed Taxable Income", use it as fallback for income as per user request
            if (line.toLowerCase().includes("fed taxable income") || line.toLowerCase().includes("federal taxable income")) {
                const amount = parseLineAmount(line);
                if (amount > (result.grossAmount || 0)) {
                    // Use this as fallback
                    result.grossAmount = amount;
                }
            }
        });
    }

    return result;
}

function parseLineAmount(text: string): number {
    // Matches all currency-like numbers
    const matches = text.match(/(\d{1,3}(?:,\d{3})*\.\d{2})/g);

    if (!matches || matches.length === 0) return 0;

    const values = matches.map(m => parseFloat(m.replace(/,/g, '')));

    // Heuristic:
    // If there is more than 1 number, the last one is probably YTD.
    // We want the Current amount.
    // Exception: If the FIRST number looks like Hours (e.g. < 100 often, but risky),
    // and there are 3 numbers (Hours, Current, YTD), then taking "Matches excluding last" -> [Hours, Current].
    // Then picking Max(remaining) works (Current > Hours usually).
    // Example: "Gross Earnings 80.00 1,520.00 9,120.00"
    // matches = [80.00, 1520.00, 9120.00]
    // exclude last => [80.00, 1520.00]
    // max => 1520.00. Correct.

    // Example: "FITW 73.30 445.27"
    // matches = [73.30, 445.27]
    // exclude last => [73.30]
    // max => 73.30. Correct.

    if (values.length > 1) {
        const candidateValues = values.slice(0, values.length - 1);
        return Math.max(...candidateValues);
    }

    return values[0];
}
