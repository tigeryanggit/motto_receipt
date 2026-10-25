import { getDb, nowInHongKong } from "@/lib/db";

export type ReceiptRow = {
  createDate: string;
  referenceNo: string;
  userName: string;
  receiptDate: string;
  category: string;
  amount: string;
  remarks: string;
};

export function storedReferenceFileNames(monthKey: string): string[] {
  const rows = getDb()
    .prepare(
      `SELECT reference_no FROM receipts WHERE reference_no LIKE ?`
    )
    .all(`${monthKey}-%`) as Array<{ reference_no: string }>;
  return rows.map((row) => `${row.reference_no}.jpg`);
}

export function insertReceipt(input: Omit<ReceiptRow, "createDate">): ReceiptRow {
  const row: ReceiptRow = {
    createDate: nowInHongKong(),
    referenceNo: input.referenceNo,
    userName: input.userName,
    receiptDate: input.receiptDate,
    category: input.category,
    amount: input.amount,
    remarks: input.remarks,
  };
  getDb()
    .prepare(
      `INSERT INTO receipts (
        create_date, reference_no, user_name, receipt_date, category, amount, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      row.createDate,
      row.referenceNo,
      row.userName,
      row.receiptDate,
      row.category,
      row.amount,
      row.remarks
    );
  return row;
}

export function deleteReceipt(referenceNo: string): void {
  getDb().prepare(`DELETE FROM receipts WHERE reference_no = ?`).run(referenceNo);
}

const RECEIPT_COLUMNS = `create_date, reference_no, user_name, receipt_date, category, amount, remarks`;

export function listReceiptsBetween(
  dateFrom: string,
  dateTo: string,
  userName?: string
): ReceiptRow[] {
  const rows = getDb()
    .prepare(
      `SELECT ${RECEIPT_COLUMNS}
       FROM receipts
       WHERE receipt_date >= ? AND receipt_date <= ?
         AND (? IS NULL OR user_name = ?)
       ORDER BY reference_no`
    )
    .all(dateFrom, dateTo, userName ?? null, userName ?? null) as Array<{
    create_date: string;
    reference_no: string;
    user_name: string;
    receipt_date: string;
    category: string;
    amount: string;
    remarks: string;
  }>;
  return rows.map(mapReceiptRow);
}

function mapReceiptRow(row: {
  create_date: string;
  reference_no: string;
  user_name: string;
  receipt_date: string;
  category: string;
  amount: string;
  remarks: string;
}): ReceiptRow {
  return {
    createDate: row.create_date,
    referenceNo: row.reference_no,
    userName: row.user_name,
    receiptDate: row.receipt_date,
    category: row.category,
    amount: row.amount,
    remarks: row.remarks,
  };
}

export function getReceipt(referenceNo: string): ReceiptRow | null {
  const row = getDb()
    .prepare(
      `SELECT ${RECEIPT_COLUMNS}
       FROM receipts
       WHERE reference_no = ?`
    )
    .get(referenceNo) as
    | {
        create_date: string;
        reference_no: string;
        user_name: string;
        receipt_date: string;
        category: string;
        amount: string;
        remarks: string;
      }
    | undefined;
  return row ? mapReceiptRow(row) : null;
}

export function receiptBelongsTo(
  receipt: ReceiptRow,
  user: { role: string; displayName: string }
): boolean {
  return user.role === "admin" || receipt.userName === user.displayName;
}

export function listReceipts(userName?: string): ReceiptRow[] {
  const rows = getDb()
    .prepare(
      `SELECT ${RECEIPT_COLUMNS}
       FROM receipts
       WHERE (? IS NULL OR user_name = ?)
       ORDER BY create_date DESC, reference_no DESC`
    )
    .all(userName ?? null, userName ?? null) as Array<{
    create_date: string;
    reference_no: string;
    user_name: string;
    receipt_date: string;
    category: string;
    amount: string;
    remarks: string;
  }>;
  return rows.map(mapReceiptRow);
}
