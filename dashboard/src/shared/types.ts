// Types shared by the API server and the web frontend.

export type DataMode = "mock" | "live";

/** A Zoho CRM deal, normalized from the CRM API's Deals module. */
export interface Deal {
  id: string;
  name: string;
  stage: string;
  amount: number;
  /** ISO date (YYYY-MM-DD) the deal is expected to close / did close. */
  closingDate: string | null;
  owner: string;
  accountName: string | null;
  /** ISO timestamp. */
  createdTime: string;
}

export type InvoiceStatus =
  | "draft"
  | "sent"
  | "viewed"
  | "unpaid"
  | "partially_paid"
  | "overdue"
  | "paid"
  | "void";

/** A Zoho Books invoice, normalized from the Books invoices API. */
export interface Invoice {
  id: string;
  number: string;
  customerName: string;
  /** ISO date (YYYY-MM-DD) the invoice was issued. */
  date: string;
  /** ISO date (YYYY-MM-DD) payment is due. */
  dueDate: string;
  status: InvoiceStatus;
  total: number;
  /** Amount still owed. */
  balance: number;
}

export interface DateRange {
  /** Inclusive ISO date (YYYY-MM-DD). */
  from: string;
  /** Inclusive ISO date (YYYY-MM-DD). */
  to: string;
}

export interface Summary {
  openPipelineValue: number;
  openDealCount: number;
  wonValue: number;
  wonCount: number;
  /** Won / (won + lost) among deals closed in range; null when none closed. */
  winRate: number | null;
  invoicedValue: number;
  collectedValue: number;
  outstandingValue: number;
  overdueValue: number;
}

export interface StageBucket {
  stage: string;
  count: number;
  amount: number;
}

export interface MonthPoint {
  /** YYYY-MM */
  month: string;
  wonValue: number;
  invoicedValue: number;
  collectedValue: number;
}

export interface AgingBucket {
  label: string;
  amount: number;
  count: number;
}

export interface CustomerBalance {
  customerName: string;
  outstanding: number;
  overdue: number;
  invoiceCount: number;
}

export interface DashboardData {
  mode: DataMode;
  generatedAt: string;
  range: DateRange;
  summary: Summary;
  pipeline: StageBucket[];
  monthly: MonthPoint[];
  arAging: AgingBucket[];
  topOutstanding: CustomerBalance[];
}

export interface ApiError {
  error: string;
  detail?: unknown;
}

/** Request body for the live API tester passthrough. */
export interface ZohoProbeRequest {
  service: "crm" | "books";
  /** Path below the service root, e.g. "/crm/v7/Deals" or "/books/v3/invoices". */
  path: string;
  query?: Record<string, string>;
}

export interface ZohoProbeResponse {
  url: string;
  status: number;
  durationMs: number;
  body: unknown;
}
