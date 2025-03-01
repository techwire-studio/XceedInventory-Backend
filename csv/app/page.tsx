"use client";
import { useState } from "react";

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");

  const uploadCSV = async () => {
    if (!file) {
      alert("Please select a file");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("./api/upload", {
        method: "POST",
        body: formData,
      });

      const text = await res.text();
      console.log("Raw Response:", text);

      const data = JSON.parse(text);
      setMessage(data.message || data.error);
    } catch (error) {
      console.error("Error:", error);
      setMessage("Failed to upload");
    }
  };

  return (
    <div style={{ padding: "20px" }}>
      <h2>Upload CSV</h2>
      <input
  type="file"
  accept=".csv"
  onChange={(e) => {
    console.log("Selected file:", e.target.files?.[0]);
    setFile(e.target.files?.[0] || null);
  }}
/>
      <button onClick={uploadCSV}>Upload</button>
      {message && <p>{message}</p>}
    </div>
  );
}
