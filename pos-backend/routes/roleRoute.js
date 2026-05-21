const express = require("express");
const {
    createRole,
    getRoles,
    getRoleById,
    updateRole,
    toggleRoleStatus,
    deleteRole,
    duplicateRole
} = require("../controllers/roleController");
const { isVerifiedUser } = require("../middlewares/tokenVerification");
const { storeIsolation } = require("../middlewares/storeIsolation");
const { checkPermission } = require("../middlewares/checkPermission");
const router = express.Router();

// Todas as rotas requerem autenticação
router.use(isVerifiedUser);
router.use(storeIsolation);

// Rotas de Roles
router.post("/", checkPermission('users', 'manageRoles'), createRole);
router.get("/", getRoles);
router.get("/:id", getRoleById);
router.put("/:id", checkPermission('users', 'manageRoles'), updateRole);
router.put("/:id/toggle-status", checkPermission('users', 'manageRoles'), toggleRoleStatus);
router.post("/:id/duplicate", checkPermission('users', 'manageRoles'), duplicateRole);
router.delete("/:id", checkPermission('users', 'manageRoles'), deleteRole);

module.exports = router;
