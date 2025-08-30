import { Router } from 'express';
const router: Router = Router();
const { 
    getItemCategories,
    placeCreateRequest, 
    placeUpdateRequest, 
    placeCancelRequest, 
    placeGetRequest, 
    placeDocumentList, 
    headApproveRequest, 
    headRequestMoreInfo, 
    headRejectRequest} = require('../controllers/PlaceController') as any;

// ดึงข้อมูลหมวดหมู่สินค้า
router.get('/place-item-categories', getItemCategories);

//ดึงข้อมูลเอกสารแนบ
router.get('/place-document-type-list', placeDocumentList);

//สร้างคำขอเบิก
router.post('/place-create-request', placeCreateRequest);

//แก้ไขคำขอเบิก
router.put('/place-update-request/:reqId', placeUpdateRequest);

//ยกเลิกคำขอเบิก
router.delete('/place-cancel-request/:reqId', placeCancelRequest);

//ดึงข้อมูลคำขอเบิก
router.get('/place-request-list', placeGetRequest);



//========= หัวหน้าหน่วยงาน =========
//หัวหน้าหน่วยงานอนุมัติคำขอเบิก
router.put('/place-head-approve-request/:reqId', headApproveRequest);

//หัวหน้าหน่วยงานขอข้อมูลเพิ่มเติม
router.put('/place-head-request-more-info/:reqId', headRequestMoreInfo);

//หัวหน้าหน่วยงานปฏิเสธคำขอเบิก
router.put('/place-head-reject-request/:reqId', headRejectRequest);

export default router;

