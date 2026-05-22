const Table = require("../models/tableModel");
const createHttpError = require("http-errors");
const mongoose = require("mongoose")

/**
 * MULTI-TENANCY FIX: Helper to build store-scoped filter
 */
const storeFilter = (req) => {
  const storeRef = req.storeId || req.user?.store;
  return storeRef ? { store: storeRef } : {};
};

const addTable = async (req, res, next) => {
  try {
    const { tableNo, seats } = req.body;
    if (!tableNo) {
      const error = createHttpError(400, "Please provide table No!");
      return next(error);
    }

    // MULTI-TENANCY LOCK: Check uniqueness within the user's store only
    const isTablePresent = await Table.findOne({ tableNo, ...storeFilter(req) });

    if (isTablePresent) {
      const error = createHttpError(400, "Table already exist!");
      return next(error);
    }

    // MULTI-TENANCY LOCK: Inject store into new table
    const newTable = new Table({
      tableNo,
      seats,
      store: req.storeId || req.user.store,
    });
    await newTable.save();
    res
      .status(201)
      .json({ success: true, message: "Table added!", data: newTable });
  } catch (error) {
    next(error);
  }
};

const getTables = async (req, res, next) => {
  try {
    // MULTI-TENANCY LOCK: Only return tables belonging to user's store
    const tables = await Table.find(storeFilter(req)).populate({
      path: "currentOrder",
      select: "customerDetails"
    });
    res.status(200).json({ success: true, data: tables });
  } catch (error) {
    next(error);
  }
};

const updateTable = async (req, res, next) => {
  try {
    const { status, orderId } = req.body;
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      const error = createHttpError(404, "Invalid id!");
      return next(error);
    }

    // MULTI-TENANCY LOCK: Scoped to user's store — prevents updating tables from other stores
    const table = await Table.findOneAndUpdate(
      { _id: id, ...storeFilter(req) },
      { status, currentOrder: orderId },
      { new: true }
    );

    if (!table) {
      const error = createHttpError(404, "Table not found!");
      return next(error);
    }

    res.status(200).json({ success: true, message: "Table updated!", data: table });

  } catch (error) {
    next(error);
  }
};

module.exports = { addTable, getTables, updateTable };
