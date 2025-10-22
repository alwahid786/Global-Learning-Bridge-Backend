import multer from "multer";
import csv from "csv-parser";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Fix __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const upload = multer({
  dest: path.join(__dirname, "../uploads/"),
  fileFilter: (req, file, cb) => {
    if (file.mimetype === "text/csv") {
      cb(null, true);
    } else {
      cb(new Error("Only CSV files are allowed"), false);
    }
  },
});

const parseCSV = (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ message: "CSV file is required" });
  }

  const results = [];
  const filePath = req.file.path; // multer already saves correct relative path

  fs.createReadStream(filePath)
    .pipe(csv())
    .on("data", (data) => results.push(data))
    .on("end", () => {
      req.csvData = results;

      // delete uploaded file after parsing
      fs.unlinkSync(filePath);

      next();
    })
    .on("error", (err) => {
      return res
        .status(500)
        .json({ message: "Error parsing CSV", error: err.message });
    });
};

export { upload, parseCSV };
