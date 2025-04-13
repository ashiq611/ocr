const express = require("express");
const multer = require("multer");
const axios = require("axios");
const FormData = require("form-data");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 7000;

// Multer setup for file upload with file type restriction
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname);
  },
});

const fileFilter = (req, file, cb) => {
  const fileTypes = /jpeg|jpg/;
  const mimeType = fileTypes.test(file.mimetype);
  const extname = fileTypes.test(path.extname(file.originalname).toLowerCase());

  if (mimeType && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Only .jpg and .jpeg files are allowed"));
  }
};

const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
});

app.post("/api/ocr", upload.single("image"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: "No file uploaded" });
    }

    const imagePath = req.file.path;
    const imageStream = fs.createReadStream(imagePath);

    // Build form-data for OCR request
    const form = new FormData();
    form.append("i2ocr_languages", "bd,ben");
    form.append("engine_options", "engine_3");
    form.append("layout_options", "single_column");
    form.append("i2ocr_uploadedfile", imageStream, {
      filename: req.file.originalname,
      contentType: "image/jpeg",
    });
    form.append("ocr_type", "1");
    form.append("ly", "single_column");
    form.append("en", "3");
    form.append("g-recaptcha-response", "");

    const response = await axios.post(
      "https://www.i2ocr.com/process_form",
      form,
      {
        headers: {
          ...form.getHeaders(),
          "x-requested-with": "XMLHttpRequest",
          Referer: "https://www.i2ocr.com/",
        },
      }
    );

    const responseText = response.data;

    // Regex to extract OCR result
    const match = responseText.match(/\$\(\"\#ocrTextBox\"\)\.val\(\"([\s\S]*?)\"\)\.show\(\)/);
    const ocrText = match ? match[1].replace(/\\n/g, "\n").replace(/\\"/g, '"') : null;

    // Clean up uploaded file
    fs.unlinkSync(imagePath);

    if (ocrText) {
      // Return OCR text with readable formatting
      res.json({ success: true, text: ocrText });
    } else {
      res.status(500).json({ success: false, message: "OCR result not found" });
    }
  } catch (error) {
    console.error("OCR Error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
