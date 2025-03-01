import multer from "multer";
import { parse } from "papaparse";
import { Pool } from "pg";
import fs from "fs";
import path from "path";
import util from "util";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const upload = multer({ dest: "uploads/" });
const uploadMiddleware = util.promisify(upload.single("file"));

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await uploadMiddleware(req, res);

    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    console.log("File received:", req.file);

    const filePath = path.join(process.cwd(), req.file.path);
    const fileContent = fs.readFileSync(filePath, "utf8");

    const { data } = parse(fileContent, { header: true });

    console.log("Parsed CSV data:", data);

    const client = await pool.connect();
    try {
      for (const row of data) {

        // Insert into orders table
        if (row.id && row.user_id && row.total_amount && row.status) {
          await client.query(
            `INSERT INTO orders (id, user_id, total_amount, status, created_at, updated_at) 
             VALUES ($1, $2, $3, $4, NOW(), NOW()) 
             ON CONFLICT (id) DO UPDATE 
             SET total_amount = EXCLUDED.total_amount, 
                 status = EXCLUDED.status, 
                 updated_at = NOW()`,
            [row.id, row.user_id, parseFloat(row.total_amount), row.status]
          );
        }

        // Insert into order_items table
        if (row.id && row.order_id && row.product_id && row.quantity && row.price) {
          await client.query(
            `INSERT INTO order_items (id, order_id, product_id, quantity, price) 
             VALUES ($1, $2, $3, $4, $5) 
             ON CONFLICT (id) DO UPDATE 
             SET quantity = EXCLUDED.quantity, 
                 price = EXCLUDED.price`,
            [row.id, row.order_id, parseInt(row.product_id), parseInt(row.quantity), parseFloat(row.price)]
          );
        }
      }

      console.log("Data inserted into database");
      res.status(200).json({ message: "Upload successful" });
    } catch (dbError) {
      console.error("Database error:", dbError);
      res.status(500).json({ error: "Database insertion failed: " + dbError.message });
    } finally {
      client.release();
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}
