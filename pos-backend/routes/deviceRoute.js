const express = require("express");
const {
    getAllDevices,
    getPendingDevices,
    getMyDevices,
    approveDevice,
    revokeDevice,
    getDeviceById,
    setCurrentDevice,
    updateDeviceNickname,
    getDeviceStats
} = require("../controllers/deviceController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const { registerDevice, submitNickname } = require("../middlewares/deviceApproval");
const { checkPermission } = require("../middlewares/checkPermission");
const router = express.Router();

// Rotas públicas (não requerem device approval)
router.post("/register", isVerifiedUser, registerDevice);
router.post("/submit-nickname", isVerifiedUser, submitNickname);

// Todas as outras rotas requerem autenticação E device approval
router.use(isVerifiedUser);

// Rotas de listagem
router.get("/", checkPermission('devices', 'read'), getAllDevices);
router.get("/pending", checkPermission('devices', 'read'), getPendingDevices);
router.get("/my", getMyDevices);
router.get("/stats", checkPermission('devices', 'read'), getDeviceStats);

// Rotas de ação
router.get("/:id", checkPermission('devices', 'read'), getDeviceById);
router.post("/:id/approve", checkPermission('devices', 'approve'), approveDevice);
router.delete("/:id", checkPermission('devices', 'revoke'), revokeDevice);
router.post("/:id/set-current", setCurrentDevice);
router.put("/:id/nickname", updateDeviceNickname);

module.exports = router;
