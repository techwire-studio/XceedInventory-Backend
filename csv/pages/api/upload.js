import multer from "multer";
import { parse } from "papaparse";
import { Pool } from "pg";
import fs from "fs";
import path from "path";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

const upload = multer({ dest: "uploads/" });

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
    upload.single("file")(req, res, async (err) => {
      if (err) {
        console.error("Multer error:", err);
        return res.status(500).json({ error: "File upload failed" });
      }
      
      // Check if file exists
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }
      
      console.log("File received:", req.file); // Debugging

      const filePath = path.join(process.cwd(), req.file.path);
      const fileContent = fs.readFileSync(filePath, "utf8");

      const { data } = parse(fileContent, { header: true });

      console.log("Parsed CSV data:", data); // Debugging

      const client = await pool.connect();
      try {
        for (const row of data) {
          // Using correct column names and ON CONFLICT on id instead of email
          await client.query(
            "INSERT INTO usernames (username) VALUES ($1)",
            [row.username]
          );
        }
        console.log("Data inserted into database");
        res.status(200).json({ message: "Upload successful" });
      } catch (dbError) {
        console.error("Database error:", dbError);
        res.status(500).json({ error: "Database insertion failed: " + dbError.message });
      } finally {
        client.release();
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath); // Cleanup
        }
      }
    });
  } catch (error) {
    console.error("Unexpected error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
}