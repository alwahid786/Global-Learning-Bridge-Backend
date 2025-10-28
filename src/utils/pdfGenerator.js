import PdfPrinter from "pdfmake";
import path from "path";
import { getEnv } from "../configs/config.js";
import axios from "axios";

const fonts = {
  Roboto: {
    normal: path.resolve(`${getEnv("FONTS_PATH")}/Roboto-Regular.ttf`),
    bold: path.resolve(`${getEnv("FONTS_PATH")}/Roboto-Medium.ttf`),
    italics: path.resolve(`${getEnv("FONTS_PATH")}/Roboto-Italic.ttf`),
    bolditalics: path.resolve(
      `${getEnv("FONTS_PATH")}/Roboto-MediumItalic.ttf`
    ),
  },
};

const printer = new PdfPrinter(fonts);

const fetchImageAsBase64 = async (url) => {
  const response = await axios.get(url, { responseType: "arraybuffer" });
  const base64 = Buffer.from(response.data, "binary").toString("base64");
  const mimeType = url.endsWith(".png") ? "image/png" : "image/jpeg";
  return `data:${mimeType};base64,${base64}`;
};

export const generateInvoicePDF = (invoiceData) => {
  return new Promise(async (resolve, reject) => {
    try {
      const {
        invoiceNumber,
        status,
        createdAt,
        updatedAt,
        sentCount,
        lastSent,
        statementType,
        statementNumber,
        statementTotal,
        adjustments = [],
        assignedPercentage,
        bypassPercentage,
        freeTextExplanation,
        finalTotal,
        attachedReports = [],
        clientId: client = {},
        warrantyCompany,
        owner = {},
      } = invoiceData;

      const brandColor = "rgb(10, 86, 124)";
      const highlightBoxColor = "#d9edf7"; // light blue background for invoice details
      const headerFillColor = "#08506E"; // darker version of brandColor for headers

      let companyLogoBase64 = null;
      let companyLogo = getEnv("LOGO_URL_WITH_BACKGROUND");
      if (companyLogo) {
        companyLogoBase64 = await fetchImageAsBase64(companyLogo);
      }

      // Totals
      const totalAdd = adjustments
        .filter((a) => a.type === "Charge" || a.type === "add")
        .reduce((sum, a) => sum + Number(a.amount || 0), 0);

      const totalDeduct = adjustments
        .filter((a) => a.type === "Deduction" || a.type === "deduction")
        .reduce((sum, a) => sum + Number(a.amount || 0), 0);

      const netAdjustments = totalAdd - totalDeduct;

      // PDF Definition
      const docDefinition = {
        content: [
          // HEADER - Company + Invoice
          {
            columns: [
              companyLogoBase64
                ? {
                    width: 300,
                    stack: [
                      {
                        image: companyLogoBase64,
                        width: 100,
                        height: 100,
                        margin: [0, 0, 0, 10],
                      },
                    ],
                  }
                : {
                    text: owner?.companyName || "Company Name",
                    style: "companyTitle",
                  },
              {
                table: {
                  widths: ["40%", "60%"], // Left column for labels, right column for values
                  body: [
                    [
                      {
                        text: "INVOICE",
                        style: "invoiceTitle",
                        colSpan: 2,
                        alignment: "center",
                        fillColor: highlightBoxColor,
                        border: [true, true, true, true],
                      },
                      {},
                    ],
                    [
                      {
                        text: "Invoice #",
                        alignment: "center",
                        bold: true,
                        border: [true, true, false, true],
                      },
                      {
                        text: invoiceNumber || "-",
                        alignment: "center",
                        border: [false, true, true, true],
                      },
                    ],
                    [
                      {
                        text: "Status",
                        alignment: "center",
                        bold: true,
                        border: [true, true, false, true],
                      },
                      {
                        text: status || "-",
                        alignment: "center",
                        border: [false, true, true, true],
                      },
                    ],
                    [
                      {
                        text: "Date",
                        alignment: "center",
                        bold: true,
                        border: [true, true, false, true],
                      },
                      {
                        text: new Date(createdAt).toLocaleDateString(),
                        alignment: "center",
                        border: [false, true, true, true],
                      },
                    ],
                    [
                      {
                        text: "Last Sent",
                        alignment: "center",
                        bold: true,
                        border: [true, true, false, true],
                      },
                      {
                        text: lastSent
                          ? new Date(lastSent).toLocaleDateString()
                          : "-",
                        alignment: "center",
                        border: [false, true, true, true],
                      },
                    ],
                    [
                      {
                        text: "Statement #",
                        alignment: "center",
                        bold: true,
                        border: [true, true, false, true],
                      },
                      {
                        text: statementNumber || "-",
                        alignment: "center",
                        border: [false, true, true, true],
                      },
                    ],
                    [
                      {
                        text: "Statement Type",
                        alignment: "center",
                        bold: true,
                        border: [true, true, false, true],
                      },
                      {
                        text: statementType || "-",
                        alignment: "center",
                        border: [false, true, true, true],
                      },
                    ],
                    [
                      {
                        text: "Sent Count",
                        alignment: "center",
                        bold: true,
                        border: [true, true, false, true],
                      },
                      {
                        text: sentCount || 0,
                        alignment: "center",
                        border: [false, true, true, true],
                      },
                    ],
                  ],
                },
                layout: {
                  hLineColor: "#555",
                  vLineColor: "#555",
                },
              },
            ],
          },

          { text: "\n" },

          // CLIENT INFO
          {
            table: {
              widths: ["35%", "65%"], // left: labels, right: values
              body: [
                [
                  {
                    text: "INVOICE TO",
                    style: "tableHeader",
                    fillColor: headerFillColor,
                    color: "white",
                    colSpan: 2,
                    alignment: "start",
                  },
                  {},
                ],
                [{ text: "Name", bold: true }, { text: client?.name || "-" }],
                [
                  { text: "Company", bold: true },
                  { text: client?.storeName || "-" },
                ],
                [
                  { text: "Dealer ID", bold: true },
                  { text: client?.dealerId || "-" },
                ],
                [{ text: "Phone", bold: true }, { text: client?.phone || "-" }],
                [
                  { text: "Client Email", bold: true },
                  { text: client?.email || "-" },
                ],
                [
                  { text: "Notification Emails", bold: true },
                  { text: client?.emails?.join(", ") || "-" },
                ],
                [
                  { text: "Address", bold: true },
                  {
                    text: client?.address
                      ? `${client.address.street}, ${client.address.area}, ${client.address.city}, ${client.address.state}, ${client.address.country} - ${client.address.zip}`
                      : "-",
                  },
                ],
              ],
            },
            layout: {
              hLineColor: "#ddd",
              vLineColor: "#ddd",
            },
          },

          { text: "\n" },

          // WARRANTY COMPANY
          {
            table: {
              widths: ["*"],
              body: [
                [
                  {
                    text: "Warranty Company",
                    style: "tableHeader",
                    fillColor: headerFillColor,
                    color: "white",
                  },
                ],
                [
                  {
                    text: warrantyCompany || "-",
                    margin: [0, 5],
                  },
                ],
              ],
            },
          },

          { text: "\n" },

          // ADJUSTMENTS TABLE
          { text: "Adjustments", style: "sectionHeader" },
          {
            table: {
              headerRows: 1,
              widths: ["*", "*", "*"],
              body: [
                [
                  {
                    text: "Type",
                    style: "tableHeader",
                    fillColor: headerFillColor,
                    color: "white",
                  },
                  {
                    text: "Amount",
                    style: "tableHeader",
                    fillColor: headerFillColor,
                    color: "white",
                  },
                  {
                    text: "Reason",
                    style: "tableHeader",
                    fillColor: headerFillColor,
                    color: "white",
                  },
                ],
                ...(adjustments.length > 0
                  ? adjustments.map((a) => [
                      a.type === "add"
                        ? "Charge"
                        : a.type === "deduction"
                        ? "Deduction"
                        : a.type,
                      `$${Number(a.amount).toFixed(2)}`,
                      a.reason || "-",
                    ])
                  : [["-", "-", "-"]]),
              ],
            },
            layout: "lightHorizontalLines",
          },
          {
            text: `Total Additions: $${totalAdd.toFixed(
              2
            )}   |   Total Deductions: $${totalDeduct.toFixed(2)}`,
            bold: true,
            margin: [0, 5, 0, 10],
          },

          // GRAND TOTAL
          {
            table: {
              widths: ["*", "*", "*", "*", "*"],
              body: [
                [
                  { text: "Statement Total", color: "white", bold: true },
                  { text: "Net Adjustments", color: "white", bold: true },
                  { text: "Assigned %", color: "white", bold: true },
                  { text: "Bypass?", color: "white", bold: true },
                  { text: "Final Total", color: "white", bold: true },
                ],
                [
                  `$${Number(statementTotal).toFixed(2)}`,
                  `$${netAdjustments.toFixed(2)}`,
                  `${assignedPercentage || 0}%`,
                  bypassPercentage ? "Yes" : "No",
                  {
                    text: `$${Number(finalTotal).toFixed(2)}`,
                    bold: true,
                    fontSize: 14,
                  },
                ],
              ],
            },
            layout: {
              fillColor: (rowIndex) =>
                rowIndex === 0 ? headerFillColor : "#f2f2f2",
              hLineColor: () => "#ccc",
              vLineColor: () => "#ccc",
            },
          },

          { text: "\n" },

          // COMMENTS / EXPLANATION
          {
            table: {
              widths: ["*"],
              body: [
                [
                  {
                    text: "Explanation / Comments",
                    style: "tableHeader",
                    fillColor: headerFillColor,
                    color: "white",
                  },
                ],
                [
                  {
                    text: freeTextExplanation || "-",
                    margin: [5, 10],
                  },
                ],
              ],
            },
            layout: "noBorders",
          },

          { text: "\n" },

          // ATTACHMENTS
          { text: "Attachments", style: "sectionHeader" },
          ...(attachedReports.length > 0
            ? attachedReports.map((a) => {
                const safeUrl = a.url ? encodeURI(a.url) : null;
                return {
                  text: `• ${a.filename || "File"}`,
                  link: safeUrl || undefined,
                  color: "blue",
                  decoration: "underline",
                  margin: [10, 2],
                };
              })
            : [{ text: "No attachments" }]),

          { text: "\n" },

          // FOOTER
          {
            text: `Thank you for your business!\n\nFor questions, contact: ${
              owner?.email || "-"
            } | ${owner?.phone || "-"}`,
            style: "footer",
          },
        ],

        styles: {
          companyTitle: {
            fontSize: 22,
            bold: true,
            color: brandColor,
            margin: [0, 0, 0, 10],
          },
          invoiceTitle: {
            fontSize: 16,
            bold: true,
            alignment: "center",
            margin: [0, 5],
          },
          tableHeader: { bold: true, fontSize: 11 },
          sectionHeader: { bold: true, margin: [0, 10, 0, 5], fontSize: 12 },
          footer: { italics: true, alignment: "center", margin: [0, 20, 0, 0] },
        },
        defaultStyle: {
          fontSize: 10,
        },
        pageBreakBefore: (currentNode) =>
          currentNode.table && currentNode.table.body.length > 20,
      };

      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      let chunks = [];
      pdfDoc.on("data", (chunk) => chunks.push(chunk));
      pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
      pdfDoc.on("error", (err) => reject(err));
      pdfDoc.end();
    } catch (error) {
      reject(error);
    }
  });
};

export const generateReceiptPDF = (receiptData) => {
  return new Promise(async (resolve, reject) => {
    try {
      const {
        donorName,
        email,
        amount,
        currency,
        status,
        transactionId,
        date,
      } = receiptData;

      const brandColor = "rgba(6, 26, 37, 1)";
      const highlightBoxColor = "#d9edf7";
      const headerFillColor = "#08506E";

      let companyLogoBase64 = null;
      let companyLogo = getEnv("CHARITY_LOGO");
      if (companyLogo) {
        const response = await axios.get(companyLogo, {
          responseType: "arraybuffer",
        });
        const base64 = Buffer.from(response.data, "binary").toString("base64");
        const mimeType = companyLogo.endsWith(".png")
          ? "image/png"
          : "image/jpeg";
        companyLogoBase64 = `data:${mimeType};base64,${base64}`;
      }

      const formattedDate = new Date(date).toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });

      // --- PDF Definition ---
      const docDefinition = {
        pageSize: "A5",
        pageMargins: [40, 40, 40, 40],
        content: [
          // HEADER
          {
            stack: [
              companyLogoBase64
                ? {
                    image: companyLogoBase64,
                    width: 220,
                    alignment: "center",
                    margin: [0, 0, 0, 15],
                  }
                : {
                    text: "GLOBAL LEARNING BRIDGE",
                    alignment: "center",
                    color: brandColor,
                    bold: true,
                    fontSize: 18,
                    margin: [0, 0, 0, 8],
                  },
              {
                text: "Donation Receipt",
                alignment: "center",
                color: "#000000",
                bold: true,
                fontSize: 16,
                margin: [0, 0, 0, 5],
              },
              {
                text: "Thank you for your generous contribution!",
                alignment: "center",
                italics: true,
                color: "#555",
                fontSize: 10,
                margin: [0, 0, 0, 10],
              },
              {
                canvas: [
                  { type: "line", x1: 0, y1: 0, x2: 350, y2: 0, lineWidth: 1 },
                ],
                margin: [0, 5, 0, 10],
              },
            ],
          },

          // RECEIPT DETAILS TABLE
          {
            table: {
              widths: ["35%", "65%"],
              body: [
                [
                  {
                    text: "Donor Name",
                    bold: true,
                    color: brandColor,
                    border: [false, false, false, false],
                  },
                  {
                    text: donorName || "-",
                    border: [false, false, false, false],
                  },
                ],
                [
                  {
                    text: "Email",
                    bold: true,
                    color: brandColor,
                    border: [false, false, false, false],
                  },
                  {
                    text: email || "-",
                    border: [false, false, false, false],
                  },
                ],
                [
                  {
                    text: "Amount",
                    bold: true,
                    color: brandColor,
                    border: [false, false, false, false],
                  },
                  {
                    text: `${amount || 0} ${currency || ""}`,
                    border: [false, false, false, false],
                  },
                ],
                [
                  {
                    text: "Transaction ID",
                    bold: true,
                    color: brandColor,
                    border: [false, false, false, false],
                  },
                  {
                    text: transactionId || "-",
                    border: [false, false, false, false],
                  },
                ],
                [
                  {
                    text: "Status",
                    bold: true,
                    color: brandColor,
                    border: [false, false, false, false],
                  },
                  {
                    text: status || "-",
                    color:
                      status?.toLowerCase() === "succeeded"
                        ? "green"
                        : status?.toLowerCase() === "pending"
                        ? "orange"
                        : "red",
                    bold: true,
                    border: [false, false, false, false],
                  },
                ],
                [
                  {
                    text: "Date",
                    bold: true,
                    color: brandColor,
                    border: [false, false, false, false],
                  },
                  {
                    text: formattedDate,
                    border: [false, false, false, false],
                  },
                ],
              ],
            },
            layout: {
              fillColor: (rowIndex) => (rowIndex % 2 === 0 ? "#f9f9f9" : null),
              paddingLeft: () => 6,
              paddingRight: () => 6,
              paddingTop: () => 4,
              paddingBottom: () => 4,
            },
          },

          { text: "\n" },

          // FOOTER / THANK YOU
          {
            stack: [
              {
                text: "We appreciate your continued support.",
                alignment: "center",
                italics: true,
                fontSize: 10,
                color: "#666",
              },
              {
                text: "This receipt serves as confirmation of your donation.",
                alignment: "center",
                italics: true,
                fontSize: 9,
                color: "#999",
                margin: [0, 2, 0, 10],
              },
              {
                text: "Global Learning Bridge",
                alignment: "center",
                bold: true,
                color: brandColor,
              },
              {
                text: "support@globallearningbridge.com",
                alignment: "center",
                fontSize: 9,
                color: "#555",
              },
            ],
          },
        ],

        styles: {
          title: {
            fontSize: 16,
            bold: true,
            alignment: "center",
            color: brandColor,
          },
          label: {
            fontSize: 10,
            bold: true,
            color: brandColor,
          },
          value: {
            fontSize: 10,
            color: "#333",
          },
          footer: {
            fontSize: 8,
            italics: true,
            alignment: "center",
            color: "#777",
          },
        },

        defaultStyle: {
          font: "Roboto",
        },
      };

      // --- Generate PDF ---
      const pdfDoc = printer.createPdfKitDocument(docDefinition);
      let chunks = [];
      pdfDoc.on("data", (chunk) => chunks.push(chunk));
      pdfDoc.on("end", () => resolve(Buffer.concat(chunks)));
      pdfDoc.on("error", (err) => reject(err));
      pdfDoc.end();
    } catch (error) {
      reject(error);
    }
  });
};
