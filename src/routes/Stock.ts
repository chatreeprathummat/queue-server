import { Router } from 'express';
const router: Router = Router();

// Import all Stock Controller functions
const { 
  stockCreateDraftPR,
  stockRejectItem,
  stockGetPendingItems,
  stockManagerApproveDraftPR,
  stockManagerRejectDraftPR,
  stockManagerRequestMoreInfo,
  stockManagerGetPendingDraftPRs,
  stockAddDraftPRSupplier,
  stockUpdateDraftPRSupplier,
  stockRemoveDraftPRSupplier,
  stockGetDraftPRSuppliers,
  stockCompareDraftPRPrices,
  stockRecommendBestSupplier,
  stockUpdateDraftPRSummary
} = require('../controllers/StockController') as any;

// ========================================
// Routes สำหรับพนักงานพัสดุ (STOCK_STAFF)
// ========================================

// สร้างร่าง PR สำหรับ item เดียว
router.post('/stock-create-draft-pr', stockCreateDraftPR);

// ปฏิเสธรายการโดยพนักงานพัสดุ
router.post('/stock-reject-item', stockRejectItem);

// ดึงรายการ items ที่รอพัสดุดำเนินการ
router.get('/stock-pending-items', stockGetPendingItems);

// ========================================
// Routes สำหรับหัวหน้าพัสดุ (STOCK_MANAGER)
// ========================================

// อนุมัติร่าง PR โดยหัวหน้าพัสดุ
router.post('/stock-manager-approve-draft-pr/:draftPRId', stockManagerApproveDraftPR);

// ปฏิเสธร่าง PR โดยหัวหน้าพัสดุ
router.post('/stock-manager-reject-draft-pr/:draftPRId', stockManagerRejectDraftPR);

// ขอข้อมูลเพิ่มเติมสำหรับร่าง PR โดยหัวหน้าพัสดุ
router.post('/stock-manager-request-more-info/:draftPRId', stockManagerRequestMoreInfo);

// ดึงรายการ draft-pr ที่รอหัวหน้าพัสดุอนุมัติ
router.get('/stock-manager-pending-draft-prs', stockManagerGetPendingDraftPRs);

// ========================================
// Routes จัดการผู้จำหน่ายใน Draft-PR
// ========================================

// เพิ่มผู้จำหน่ายใน draft-pr
router.post('/stock-draft-pr/:draftPrId/suppliers', stockAddDraftPRSupplier);

// อัพเดทข้อมูลผู้จำหน่ายใน draft-pr
router.put('/stock-draft-pr/:draftPrId/suppliers/:supplierEntryId', stockUpdateDraftPRSupplier);

// ลบผู้จำหน่ายออกจาก draft-pr
router.delete('/stock-draft-pr/:draftPrId/suppliers/:supplierEntryId', stockRemoveDraftPRSupplier);

// ดูรายการผู้จำหน่ายทั้งหมดใน draft-pr
router.get('/stock-draft-pr/:draftPrId/suppliers', stockGetDraftPRSuppliers);

// ========================================
// Routes ใช้ Stored Procedures
// ========================================

// เปรียบเทียบราคาผู้จำหน่าย
router.get('/stock-draft-pr/:draftPrId/compare-prices', stockCompareDraftPRPrices);

// แนะนำผู้จำหน่ายที่ดีที่สุด
router.post('/stock-draft-pr/:draftPrId/recommend-supplier', stockRecommendBestSupplier);

// อัพเดทข้อมูลสรุปผู้จำหน่ายแบบ Manual
router.post('/stock-draft-pr/:draftPrId/update-summary', stockUpdateDraftPRSummary);

export default router;


