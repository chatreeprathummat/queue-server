"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const router = (0, express_1.Router)();
const { placeCreateRequest, placeGetRequest, placeDocumentCheckboxList } = require('../controllers/PlaceRequestController');
router.get('/place-request-list', placeGetRequest);
router.get('/place-document-checkbox-list', placeDocumentCheckboxList);
router.post('/place-create-request', placeCreateRequest);
exports.default = router;
