const config = require("../config/config");

/**
 * Trata erros de validação do Mongoose (ex: campos required ausentes).
 * ValidationError não tem statusCode próprio, então cai como 500.
 * Aqui mapeamos para 400 Bad Request com mensagem limpa.
 */
const handleValidationError = (err) => {
    const messages = Object.values(err.errors || {}).map(e => e.message).join(', ');
    return {
        statusCode: 400,
        message: `Validation failed: ${messages}`,
        details: Object.keys(err.errors || {}).reduce((acc, key) => {
            acc[key] = err.errors[key].message;
            return acc;
        }, {})
    };
};

const globalErrorHandler = (err, req, res, next) => {
    // Mongoose ValidationError -> 400
    if (err.name === 'ValidationError') {
        const { statusCode, message, details } = handleValidationError(err);
        return res.status(statusCode).json({
            success: false,
            status: statusCode,
            message,
            details,
            errorStack: config.nodeEnv === "development" ? err.stack : ""
        });
    }

    // Duplicate key error (MongoDB E11000) -> 409
    if (err.code === 11000) {
        return res.status(409).json({
            success: false,
            status: 409,
            message: "Duplicate key error. This record already exists.",
            errorStack: config.nodeEnv === "development" ? err.stack : ""
        });
    }

    // CastError (invalid ObjectId, etc.) -> 400
    if (err.name === 'CastError') {
        return res.status(400).json({
            success: false,
            status: 400,
            message: `Invalid value for ${err.path}: ${err.value}`,
            errorStack: config.nodeEnv === "development" ? err.stack : ""
        });
    }

    const statusCode = err.statusCode || 500;

    return res.status(statusCode).json({
        success: false,
        status: statusCode,
        message: err.message,
        errorStack: config.nodeEnv === "development" ? err.stack : ""
    });
}

module.exports = globalErrorHandler;