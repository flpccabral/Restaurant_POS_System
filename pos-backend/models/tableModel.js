const mongoose = require("mongoose");

const tableSchema = new mongoose.Schema({
	// MULTI-TENANCY FIX: Every table is now scoped to a specific store
	store: { type: mongoose.Schema.Types.ObjectId, ref: "Store", required: true, index: true },
	tableNo: { type: Number, required: true },
	status: {
		type: String,
		default: "Available"
	},
	seats: {
		type: Number,
		required: true
	},
	currentOrder: { type: mongoose.Schema.Types.ObjectId, ref: "Order" }
}, { timestamps: true });

// Compound unique index: tableNo is unique PER STORE, not globally
tableSchema.index({ store: 1, tableNo: 1 }, { unique: true });
// Query optimization for table listings filtered by store + status
tableSchema.index({ store: 1, status: 1 });

module.exports = mongoose.model("Table", tableSchema);
