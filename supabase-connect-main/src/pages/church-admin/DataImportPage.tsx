import { useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, FileDown, CheckCircle2, XCircle, Loader2, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { validateFile, UPLOAD_CONFIGS } from "@/lib/file-upload";

type ImportTab = "members" | "contributions";
type ImportRow = Record<string, string>;
type ParsedData = { headers: string[]; rows: ImportRow[] };
type FailedRow = { rowNumber: number; reason: string };
type ImportResult = { total: number; success: number; failed: number; failedRows: FailedRow[] };

const REQUIRED_HEADERS: Record<ImportTab, string[]> = {
  members: ["full_name", "phone", "email", "gender"],
  contributions: ["member", "amount", "category", "date"],
};

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      values.push(current.trim());
      current = "";
      continue;
    }

    current += char;
  }

  values.push(current.trim());
  return values;
}

function parseCSV(text: string): ParsedData {
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/^\uFEFF/, "");
  const rawLines = normalized.split("\n").filter((line) => line.trim().length > 0);

  if (rawLines.length === 0) {
    return { headers: [], rows: [] };
  }

  const headers = parseCsvLine(rawLines[0]).map((header) => header.replace(/^"(.*)"$/, "$1").trim());
  const rows = rawLines.slice(1).map((line) => {
    const values = parseCsvLine(line).map((value) => value.replace(/^"(.*)"$/, "$1").trim());
    const row: ImportRow = {};

    headers.forEach((header, index) => {
      row[header] = values[index] || "";
    });

    return row;
  });

  return { headers, rows };
}

function normalizeValue(value: string | null | undefined) {
  return (value ?? "").toLowerCase().trim();
}

function validateHeaders(tab: ImportTab, headers: string[]) {
  const requiredHeaders = REQUIRED_HEADERS[tab];
  const missing = requiredHeaders.filter((header) => !headers.includes(header));

  if (missing.length > 0) {
    return `Missing columns: ${missing.join(", ")}`;
  }

  return null;
}

function validateMemberRow(row: ImportRow): string | null {
  if (!row.full_name?.trim()) return "Missing full_name";
  if (!row.phone?.trim()) return "Missing phone";
  if (!row.email?.trim()) return "Missing email";
  if (!/\S+@\S+\.\S+/.test(row.email)) return "Invalid email";
  if (!row.gender?.trim()) return "Missing gender";

  const normalizedGender = row.gender.toLowerCase();
  if (!["male", "female"].includes(normalizedGender)) return "Invalid gender";

  return null;
}

function validateContributionRow(
  row: ImportRow,
  memberPhoneMap: Record<string, string>,
  memberEmailMap: Record<string, string>,
  memberNameMap: Record<string, string>,
): string | null {
  if (!row.member?.trim()) return "Missing member";
  if (!row.amount?.trim()) return "Missing amount";
  if (Number.isNaN(Number(row.amount))) return "Invalid amount";
  if (!row.category?.trim()) return "Missing category";
  if (!row.date?.trim()) return "Missing date";

  const normalizedMember = normalizeValue(row.member);
  const memberId =
    memberPhoneMap[normalizedMember] ||
    memberEmailMap[normalizedMember] ||
    memberNameMap[normalizedMember];

  if (!memberId) return "Member not found";

  if (Number.isNaN(new Date(row.date).getTime())) return "Invalid date";

  return null;
}

export default function DataImportPage() {
  const [tab, setTab] = useState<ImportTab>("members");
  const [parsedData, setParsedData] = useState<ParsedData | null>(null);
  const [rowErrors, setRowErrors] = useState<(string | null)[]>([]);
  const [fileError, setFileError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { churchId } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: members = [] } = useQuery({
    queryKey: ["import-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("members")
        .select("id, full_name, email, phone");

      if (error) {
        console.error("IMPORT MEMBERS ERROR:", error);
        return [];
      }

      return data ?? [];
    },
    enabled: tab === "contributions",
  });

  const { data: categories = [] } = useQuery({
    queryKey: ["import-categories"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contribution_categories")
        .select("id, name");

      if (error) {
        console.error("IMPORT CATEGORIES ERROR:", error);
        return [];
      }

      return data ?? [];
    },
    enabled: tab === "contributions",
  });

  const memberPhoneMap = useMemo(
    () => Object.fromEntries(
      members
        .filter((member: any) => member.phone)
        .map((member: any) => [normalizeValue(member.phone), member.id]),
    ),
    [members],
  );

  const memberEmailMap = useMemo(
    () => Object.fromEntries(
      members
        .filter((member: any) => member.email)
        .map((member: any) => [normalizeValue(member.email), member.id]),
    ),
    [members],
  );

  const memberNameMap = useMemo(
    () => Object.fromEntries(
      members.map((member: any) => [normalizeValue(member.full_name), member.id]),
    ),
    [members],
  );

  const categoryMap = useMemo(
    () => Object.fromEntries(
      categories.map((category: any) => [normalizeValue(category.name), category.id]),
    ),
    [categories],
  );

  const resetState = () => {
    setParsedData(null);
    setRowErrors([]);
    setFileError(null);
    setImportResult(null);
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    resetState();

    const extension = file.name.split(".").pop()?.toLowerCase();
    if (extension !== "csv") {
      setFileError("Please upload a CSV file");
      toast({ title: "Invalid file", description: "Please upload a CSV file", variant: "destructive" });
      return;
    }

    const validation = validateFile(file, "import-file");
    if (!validation.valid) {
      setFileError(validation.error || "Invalid file");
      toast({ title: "Invalid file", description: validation.error, variant: "destructive" });
      return;
    }

    const text = await file.text();
    const parsed = parseCSV(text);

    if (parsed.headers.length === 0) {
      setFileError("Invalid format");
      toast({ title: "Invalid CSV", description: "Invalid format", variant: "destructive" });
      return;
    }

    const headerError = validateHeaders(tab, parsed.headers);
    if (headerError) {
      setParsedData(parsed);
      setFileError(headerError);
      toast({ title: "Missing columns", description: headerError, variant: "destructive" });
      return;
    }

    const nextErrors = parsed.rows.map((row) => (
      tab === "members"
        ? validateMemberRow(row)
        : validateContributionRow(row, memberPhoneMap, memberEmailMap, memberNameMap)
    ));

    setParsedData(parsed);
    setRowErrors(nextErrors);
  };

  const downloadTemplate = () => {
    const headers = tab === "members"
      ? "full_name,phone,email,gender"
      : "member,amount,category,date";
    const sample = tab === "members"
      ? '\nJohn Doe,+255123456789,john@example.com,male'
      : "\nJohn Doe,50000,Tithe,2026-03-23T09:00:00Z";
    const blob = new Blob([headers + sample], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${tab}_template.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importData = useMutation({
    mutationFn: async () => {
      if (!parsedData || !churchId) throw new Error("No data");
      if (fileError) throw new Error(fileError);

      let success = 0;
      let failed = 0;
      const nextErrors = [...rowErrors];
      const failedRows: FailedRow[] = [];

      if (tab === "members") {
        for (let index = 0; index < parsedData.rows.length; index += 1) {
          if (nextErrors[index]) {
            failed += 1;
            failedRows.push({ rowNumber: index + 2, reason: nextErrors[index] || "Invalid row" });
            continue;
          }

          const row = parsedData.rows[index];
          const { error } = await supabase.from("members").insert({
            church_id: churchId,
            full_name: row.full_name.trim(),
            phone: row.phone.trim(),
            email: row.email.trim().toLowerCase(),
            gender: row.gender.trim().toLowerCase() as "male" | "female",
            status: "active",
          });

          if (error) {
            failed += 1;
            nextErrors[index] = error.message;
            failedRows.push({ rowNumber: index + 2, reason: error.message });
          } else {
            success += 1;
          }
        }
      } else {
        const categoryLookup = new Map<string, string>(
          categories.map((category: any) => [normalizeValue(category.name), category.id]),
        );
        const validRows: Array<{ payload: any; rowIndex: number }> = [];

        for (let index = 0; index < parsedData.rows.length; index += 1) {
          if (nextErrors[index]) {
            failed += 1;
            failedRows.push({ rowNumber: index + 2, reason: nextErrors[index] || "Invalid row" });
            continue;
          }

          const row = parsedData.rows[index];
          const normalizedMember = normalizeValue(row.member);
          const normalizedCategory = normalizeValue(row.category);
          const memberId =
            memberPhoneMap[normalizedMember] ||
            memberEmailMap[normalizedMember] ||
            memberNameMap[normalizedMember];

          if (!memberId) {
            failed += 1;
            nextErrors[index] = "Member not found";
            failedRows.push({ rowNumber: index + 2, reason: "Member not found" });
            continue;
          }

          let categoryId = categoryLookup.get(normalizedCategory);
          if (!categoryId) {
            const { data: createdCategory, error: categoryError } = await supabase
              .from("contribution_categories")
              .insert({
                name: row.category.trim(),
                church_id: churchId,
              } as any)
              .select("id, name")
              .single();

            if (categoryError || !createdCategory) {
              failed += 1;
              nextErrors[index] = categoryError?.message || "Category not found";
              failedRows.push({ rowNumber: index + 2, reason: nextErrors[index] || "Category not found" });
              continue;
            }

            categoryId = createdCategory.id;
            categoryLookup.set(normalizeValue(createdCategory.name), createdCategory.id);
          }

          const createdAt = new Date(row.date);
          if (Number.isNaN(createdAt.getTime())) {
            failed += 1;
            nextErrors[index] = "Invalid date";
            failedRows.push({ rowNumber: index + 2, reason: "Invalid date" });
            continue;
          }

          validRows.push({
            rowIndex: index,
            payload: {
              church_id: churchId,
              member_id: memberId,
              amount: Number(row.amount),
              category_id: categoryId,
              created_at: createdAt.toISOString(),
              date: createdAt.toISOString().split("T")[0],
              donor_name: row.member.trim(),
            },
          });
        }

        if (validRows.length > 0) {
          const payloads = validRows.map((row) => row.payload);
          const { error: bulkError } = await supabase.from("contributions").insert(payloads);

          if (!bulkError) {
            success += validRows.length;
          } else {
            for (const row of validRows) {
              const { error } = await supabase.from("contributions").insert(row.payload);
              if (error) {
                failed += 1;
                nextErrors[row.rowIndex] = error.message;
                failedRows.push({ rowNumber: row.rowIndex + 2, reason: error.message });
              } else {
                success += 1;
              }
            }
          }
        }
      }

      setRowErrors(nextErrors);
      return {
        total: parsedData.rows.length,
        success,
        failed,
        failedRows,
      };
    },
    onSuccess: (result) => {
      setImportResult(result);
      queryClient.invalidateQueries({ queryKey: [tab] });
      queryClient.invalidateQueries({ queryKey: ["contributions"] });
      queryClient.invalidateQueries({ queryKey: ["import-categories"] });
      toast({ title: "Import complete", description: `${result.success} imported, ${result.failed} failed.` });
    },
    onError: (error: any) => {
      toast({ title: "Import failed", description: error.message, variant: "destructive" });
    },
  });

  const validCount = rowErrors.filter((error) => !error).length;
  const errorCount = rowErrors.filter(Boolean).length;

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-serif">Data Import</h1>
        <p className="text-sm text-muted-foreground mt-1">Import members and contributions from CSV files</p>
      </div>

      <Tabs
        value={tab}
        onValueChange={(value) => {
          setTab(value as ImportTab);
          resetState();
        }}
      >
        <TabsList className="bg-secondary">
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="contributions">Contributions</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-4">
          <Card className="glass-card">
            <CardHeader><CardTitle className="text-base font-sans">Upload CSV File</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Button variant="outline" onClick={downloadTemplate}><FileDown className="mr-2 h-4 w-4" /> Download Template</Button>
                <div>
                  <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={handleFileUpload} />
                  <Button onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> Upload CSV</Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                CSV only. Max {UPLOAD_CONFIGS["import-file"].maxSizeLabel}. First row must be column headers.
              </p>
              {tab === "contributions" && (
                <p className="text-xs text-muted-foreground">
                  Use member full names and category names. The importer will map them to IDs automatically.
                </p>
              )}
              {fileError && (
                <p className="text-sm text-destructive">{fileError}</p>
              )}
            </CardContent>
          </Card>

          {parsedData && (
            <Card className="glass-card">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-sans">Preview ({parsedData.rows.length} rows)</CardTitle>
                  <div className="flex gap-2">
                    <Badge variant="outline" className="text-success border-success/30"><CheckCircle2 className="mr-1 h-3 w-3" /> {validCount} valid</Badge>
                    {errorCount > 0 && <Badge variant="outline" className="text-destructive border-destructive/30"><XCircle className="mr-1 h-3 w-3" /> {errorCount} errors</Badge>}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="max-h-[400px] overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-10">#</TableHead>
                        {parsedData.headers.map((header) => <TableHead key={header}>{header}</TableHead>)}
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {parsedData.rows.map((row, index) => (
                        <TableRow key={index} className={rowErrors[index] ? "bg-destructive/5" : ""}>
                          <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                          {parsedData.headers.map((header) => <TableCell key={header} className="text-sm">{row[header] || "—"}</TableCell>)}
                          <TableCell>
                            {rowErrors[index] ? (
                              <span className="flex items-center gap-1 text-xs text-destructive"><AlertTriangle className="h-3 w-3" /> {rowErrors[index]}</span>
                            ) : <CheckCircle2 className="h-4 w-4 text-success" />}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
                <div className="p-4 border-t border-border flex items-center justify-between">
                  <div className="text-sm text-muted-foreground">{validCount} rows will be imported</div>
                  <Button onClick={() => importData.mutate()} disabled={validCount === 0 || !!fileError || importData.isPending}>
                    {importData.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Import {validCount} Rows
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {importResult && (
            <Card className="glass-card border-success/30">
              <CardContent className="py-6 text-center">
                <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-success" />
                <p className="text-lg font-semibold">{importResult.success} successfully imported</p>
                <p className="text-sm text-muted-foreground">Total rows: {importResult.total}</p>
                <p className="text-sm text-muted-foreground">Failed rows: {importResult.failed}</p>
                {importResult.failedRows.length > 0 && (
                  <div className="mt-4 space-y-2 text-left">
                    {importResult.failedRows.map((failedRow) => (
                      <p key={`${failedRow.rowNumber}-${failedRow.reason}`} className="text-sm text-destructive">
                        Row {failedRow.rowNumber}: {failedRow.reason}
                      </p>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
