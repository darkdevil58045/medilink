const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const fs = require('fs');

async function generatePatientReport(patientData, aiAssessment, outputPath) {
  return new Promise(async (resolve, reject) => {
    try {
      const doc = new PDFDocument();
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);

      // Title
      doc.fontSize(20).text('MediLink Patient Report', { align: 'center' });
      doc.moveDown();

      // Patient Info
      doc.fontSize(14).text(`Patient Name: ${patientData.fullName || 'N/A'}`);
      doc.text(`Patient ID: ${patientData._id}`);
      doc.text(`Date: ${new Date().toLocaleDateString()}`);
      doc.moveDown();

      // AI Assessment
      doc.fontSize(16).text('AI Assessment:', { underline: true });
      doc.fontSize(12).text(aiAssessment);
      doc.moveDown();

      // Add QR Code for verification
      const qrData = `PatientID:${patientData._id};Date:${new Date().toISOString()}`;
      const qrImageDataUrl = await QRCode.toDataURL(qrData);
      const qrImageBuffer = Buffer.from(qrImageDataUrl.split(',')[1], 'base64');
      doc.image(qrImageBuffer, { fit: [100, 100], align: 'center' });

      // Digital signature placeholder
      doc.moveDown();
      doc.fontSize(12).text('Digital Signature: ______________________', { align: 'right' });

      doc.end();

      stream.on('finish', () => {
        resolve(outputPath);
      });
    } catch (err) {
      reject(err);
    }
  });
}

module.exports = {
  generatePatientReport,
};
