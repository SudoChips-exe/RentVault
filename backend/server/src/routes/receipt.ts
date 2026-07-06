import { Router } from 'express';
import * as admin from 'firebase-admin';
import { createClient } from '@supabase/supabase-js';
import PDFDocument from 'pdfkit';
import { formatAmountNaira } from '../models';
import { ApiError } from '../api-error';
import { config } from '../config';
import { requireAuth, asyncRoute, AuthedRequest, sensitiveActionRateLimit } from '../middleware';

const db = admin.firestore();
const supabase = createClient(config.supabase.url, config.supabase.anonKey);
const DOCUMENTS_BUCKET = 'documents';

const RECEIPT_ELIGIBLE_STATUSES = new Set([
  'funds_held',
  'verification_submitted',
  'verified',
  'disbursement_pending',
  'completed',
  'disbursement_partial_failure',
]);

export const receiptRouter = Router();

receiptRouter.post('/generateReceipt', requireAuth, sensitiveActionRateLimit, asyncRoute(async (req: AuthedRequest, res) => {
  const uid = req.uid!;
  const { transactionId } = req.body;
  if (!transactionId || typeof transactionId !== 'string') {
    throw new ApiError('invalid-argument', 'transactionId is required');
  }

  const txDoc = await db.collection('transactions').doc(transactionId).get();
  if (!txDoc.exists) throw new ApiError('not-found', 'Transaction not found');

  const tx = txDoc.data()!;
  const userDoc = await db.collection('users').doc(uid).get();
  const requesterRole = userDoc.exists ? userDoc.data()!.role : null;

  const isAssociated =
    tx.tenantUid === uid || tx.landlordUid === uid || tx.agentUid === uid || requesterRole === 'admin';
  if (!isAssociated) {
    throw new ApiError('permission-denied', 'You are not associated with this transaction');
  }

  if (!RECEIPT_ELIGIBLE_STATUSES.has(tx.status)) {
    throw new ApiError('failed-precondition', 'A receipt is only available once a payment has been made');
  }

  const fileName = `${transactionId}.pdf`;
  const filePath = `receipts/${fileName}`;
  const { data: existingFiles } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .list('receipts', { search: fileName });
  const alreadyExists = (existingFiles || []).some((f) => f.name === fileName);

  if (!alreadyExists) {
    const [listingDoc, tenantDoc, landlordDoc] = await Promise.all([
      db.collection('listings').doc(tx.listingId).get(),
      db.collection('users').doc(tx.tenantUid).get(),
      db.collection('users').doc(tx.landlordUid).get(),
    ]);
    const listing = listingDoc.exists ? listingDoc.data()! : null;
    const tenant = tenantDoc.exists ? tenantDoc.data()! : null;
    const landlord = landlordDoc.exists ? landlordDoc.data()! : null;

    const pdfBuffer = await buildReceiptPdf({
      transactionId,
      transactionReference: tx.transactionReference,
      amount: tx.amount,
      status: tx.status,
      createdAt: tx.createdAt?.toDate?.() || new Date(),
      propertyName: listing?.propertyName || 'Unknown property',
      propertyAddress: listing?.address || 'Unknown address',
      tenantName: tenant?.displayName || 'Unknown tenant',
      landlordName: landlord?.displayName || 'Unknown landlord',
    });

    const { error: uploadError } = await supabase.storage
      .from(DOCUMENTS_BUCKET)
      .upload(filePath, pdfBuffer, { contentType: 'application/pdf', upsert: true });
    if (uploadError) {
      throw new ApiError('internal', 'Failed to store generated receipt');
    }
  }

  const { data: signedData, error: signError } = await supabase.storage
    .from(DOCUMENTS_BUCKET)
    .createSignedUrl(filePath, 15 * 60);
  if (signError || !signedData) {
    throw new ApiError('internal', 'Failed to generate receipt URL');
  }

  console.log(`[RECEIPT] Generated/served receipt for transaction ${transactionId}`);

  res.json({ url: signedData.signedUrl });
}));

function buildReceiptPdf(params: {
  transactionId: string;
  transactionReference: string;
  amount: number;
  status: string;
  createdAt: Date;
  propertyName: string;
  propertyAddress: string;
  tenantName: string;
  landlordName: string;
}): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    doc.fontSize(20).font('Helvetica-Bold').text('RentVault', { continued: false });
    doc.fontSize(10).font('Helvetica').fillColor('#16a34a').text('Secure Escrow Payment Receipt');
    doc.moveDown(1.5);

    doc.fillColor('#000000').fontSize(14).font('Helvetica-Bold').text('Payment Receipt');
    doc.moveDown(0.5);
    doc.fontSize(9).font('Helvetica').fillColor('#666666')
      .text(`Transaction Reference: ${params.transactionReference}`)
      .text(`Transaction ID: ${params.transactionId}`)
      .text(`Date: ${params.createdAt.toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}`);
    doc.moveDown(1.5);

    const row = (label: string, value: string) => {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#000000').text(label, { continued: true, width: 200 });
      doc.font('Helvetica').fillColor('#333333').text(`  ${value}`);
      doc.moveDown(0.4);
    };

    row('Property:', params.propertyName);
    row('Address:', params.propertyAddress);
    row('Tenant:', params.tenantName);
    row('Landlord:', params.landlordName);
    row('Status:', params.status.replace(/_/g, ' ').toUpperCase());
    doc.moveDown(0.6);

    doc.fontSize(12).font('Helvetica-Bold').fillColor('#000000')
      .text(`Amount Paid: ${formatAmountNaira(params.amount)}`);
    doc.moveDown(1.5);

    doc.fontSize(8).font('Helvetica').fillColor('#999999')
      .text('Funds for this transaction are held in escrow via RentVault and released to the landlord only upon verified occupancy.', {
        width: 495,
      });

    doc.end();
  });
}
