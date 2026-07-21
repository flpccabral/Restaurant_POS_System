---
name: fix_order_validation_500
description: Fixed 500 error on order finalization — empty customer name/phone causing Mongoose ValidationError
metadata:
  type: feedback
---

Order finalization returned 500 when customer name/phone were empty strings. Root cause: Mongoose `ValidationError` (required fields `customerDetails.name` and `customerDetails.phone` as empty strings) has no `statusCode`, so `globalErrorHandler` defaulted to 500.

Fixes applied:
- Frontend `Bill.jsx`: validate `customerData.customerName && customerData.customerPhone` before calling `handlePlaceOrder`, show warning snackbar
- Backend `globalErrorHandler.js`: added explicit handlers for `ValidationError` -> 400, `CastError` -> 400, duplicate key (E11000) -> 409
- Frontend `Bill.jsx` `onError`: now displays actual server error message in snackbar

**Why:** Empty customer fields were submitted because the customer info modal was never filled (not validated on frontend).

**How to apply:** If similar 500 errors appear without explicit statusCode mapping in globalErrorHandler, add a named-error handler block for that error type.
