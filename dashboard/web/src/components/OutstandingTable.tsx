import type { CustomerBalance } from "../../../src/shared/types";
import { fmtMoney } from "../format";

export function OutstandingTable({ rows }: { rows: CustomerBalance[] }) {
  return (
    <div className="card wide" data-testid="table-outstanding">
      <h2>Largest outstanding balances</h2>
      <div className="subtle">Zoho Books · top customers by unpaid amount</div>
      {rows.length === 0 ? (
        <p className="subtle">No unpaid invoices.</p>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Customer</th>
                <th className="num">Open invoices</th>
                <th className="num">Outstanding</th>
                <th className="num">Overdue</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.customerName}>
                  <td>{r.customerName}</td>
                  <td className="num">{r.invoiceCount}</td>
                  <td className="num">{fmtMoney(r.outstanding)}</td>
                  <td className="num">{r.overdue > 0 ? fmtMoney(r.overdue) : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
