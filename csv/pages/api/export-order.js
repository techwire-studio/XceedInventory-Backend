import { Pool } from "pg";
import fs from "fs";
import path from "path";
import { format } from "fast-csv";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { order_id } = req.query;
  if (!order_id) {
    return res.status(400).json({ error: "Missing order_id parameter" });
  }

  try {
    const client = await pool.connect();

    // Fetch specific order and its items
    const result = await client.query(
      `SELECT 
        o.id AS order_id, 
        o.user_id, 
        o.total_amount, 
        o.status, 
        o.created_at, 
        o.updated_at,
        oi.id AS order_item_id,
        oi.product_id, 
        oi.quantity, 
        oi.price
      FROM orders o
      LEFT JOIN order_items oi ON o.id = oi.order_id
      WHERE o.id = $1`,
      [order_id]
    );

    client.release();

    if (result.rows.length === 0) {
      return res.status(404).json({ error: "Order not found" });
    }

    const csvFilePath = path.join(process.cwd(), "exports", `order_${order_id}.csv`);

    // Ensure exports directory exists
    if (!fs.existsSync(path.dirname(csvFilePath))) {
      fs.mkdirSync(path.dirname(csvFilePath), { recursive: true });
    }

    // Write to CSV
    const csvStream = format({ headers: true });
    const writableStream = fs.createWriteStream(csvFilePath);

    csvStream.pipe(writableStream);
    result.rows.forEach((row) => csvStream.write(row));
    csvStream.end();

    writableStream.on("finish", () => {
      res.setHeader("Content-Disposition", `attachment; filename=order_${order_id}.csv`);
      res.setHeader("Content-Type", "text/csv");
      res.sendFile(csvFilePath);
    });

  } catch (error) {
    console.error("Error exporting CSV:", error);
    res.status(500).json({ error: "Failed to export CSV" });
  }
}
