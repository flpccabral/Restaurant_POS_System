const crypto = require('crypto');

/**
 * Gera um fingerprint único do dispositivo baseado em múltiplos fatores
 *
 * Fatores utilizados:
 * - User-Agent (navegador + versão)
 * - IP address
 * - Accept-Language (idioma do sistema)
 * - Accept-Encoding (codificação suportada)
 * - Platform (sec-ch-ua-platform)
 * - Timezone (se disponível)
 *
 * @param {Object} req - Request object do Express
 * @returns {String} Hash SHA-256 do fingerprint (64 caracteres hex)
 */
const generateDeviceFingerprint = (req) => {
    const headers = req.headers || {};

    // Coletar todos os fatores disponíveis
    const factors = [
        headers['user-agent'] || '',
        headers['accept-language'] || '',
        headers['accept-encoding'] || '',
        headers['sec-ch-ua-platform'] || '',
        headers['sec-ch-ua'] || '',
        headers['sec-ch-ua-mobile'] || '',
        req.ip || req.connection.remoteAddress || req.socket.remoteAddress || '',
        req.body?.timezone || headers['x-timezone'] || ''
    ];

    // Concatenar fatores com separador único
    const fingerprintString = factors.join('|||');

    // Gerar hash SHA-256
    return crypto
        .createHash('sha256')
        .update(fingerprintString)
        .digest('hex');
};

/**
 * Extrai informações detalhadas do dispositivo
 *
 * @param {Object} req - Request object do Express
 * @returns {Object} Informações estruturadas do dispositivo
 */
const parseDeviceInfo = (req) => {
    const headers = req.headers || {};
    const userAgent = headers['user-agent'] || '';

    let browser = 'Unknown';
    let browserVersion = 'Unknown';
    let os = 'Unknown';
    let osVersion = 'Unknown';
    let device = 'desktop';

    // Detectar navegador
    if (userAgent.includes('Edg/')) {
        browser = 'Edge';
        browserVersion = userAgent.match(/Edg\/([\d.]+)/)?.[1] || 'Unknown';
    } else if (userAgent.includes('Chrome/') && !userAgent.includes('Edg/')) {
        browser = 'Chrome';
        browserVersion = userAgent.match(/Chrome\/([\d.]+)/)?.[1] || 'Unknown';
    } else if (userAgent.includes('Firefox/')) {
        browser = 'Firefox';
        browserVersion = userAgent.match(/Firefox\/([\d.]+)/)?.[1] || 'Unknown';
    } else if (userAgent.includes('Safari/') && !userAgent.includes('Chrome')) {
        browser = 'Safari';
        browserVersion = userAgent.match(/Version\/([\d.]+)/)?.[1] || 'Unknown';
    } else if (userAgent.includes('MSIE') || userAgent.includes('Trident/')) {
        browser = 'Internet Explorer';
        browserVersion = userAgent.match(/(?:MSIE |rv:)([\d.]+)/)?.[1] || 'Unknown';
    }

    // Detectar sistema operacional
    if (userAgent.includes('Windows NT 10.0')) {
        os = 'Windows';
        osVersion = '10';
    } else if (userAgent.includes('Windows NT 6.3')) {
        os = 'Windows';
        osVersion = '8.1';
    } else if (userAgent.includes('Windows NT 6.2')) {
        os = 'Windows';
        osVersion = '8';
    } else if (userAgent.includes('Windows NT 6.1')) {
        os = 'Windows';
        osVersion = '7';
    } else if (userAgent.includes('Mac OS X')) {
        os = 'macOS';
        osVersion = userAgent.match(/Mac OS X ([\d._]+)/)?.[1]?.replace(/_/g, '.') || 'Unknown';
    } else if (userAgent.includes('Android')) {
        os = 'Android';
        osVersion = userAgent.match(/Android ([\d.]+)/)?.[1] || 'Unknown';
    } else if (userAgent.includes('iOS') || userAgent.includes('iPhone') || userAgent.includes('iPad')) {
        os = 'iOS';
        osVersion = userAgent.match(/OS ([\d_]+)/)?.[1]?.replace(/_/g, '.') || 'Unknown';
    } else if (userAgent.includes('Linux')) {
        os = 'Linux';
    } else if (userAgent.includes('Ubuntu')) {
        os = 'Ubuntu';
    }

    // Detectar tipo de dispositivo
    const lowerUA = userAgent.toLowerCase();
    if (/mobile|android|phone/i.test(lowerUA) && !/tablet/i.test(lowerUA)) {
        device = 'mobile';
    } else if (/tablet|ipad/i.test(lowerUA) || (os === 'Android' && !/mobile/i.test(lowerUA))) {
        device = 'tablet';
    }

    // Obter IP
    const ip = req.ip ||
               req.connection.remoteAddress ||
               req.socket.remoteAddress ||
               req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
               '';

    // Obter timezone
    const timezone = req.body?.timezone ||
                     headers['x-timezone'] ||
                     'Unknown';

    // Obter resolução da tela (se disponível via header customizado)
    const screenResolution = headers['x-screen-resolution'] || 'Unknown';

    return {
        userAgent,
        browser,
        browserVersion,
        os,
        osVersion,
        device,
        ip,
        timezone,
        screenResolution,
        language: headers['accept-language']?.split(',')[0] || 'Unknown',
        platform: headers['sec-ch-ua-platform'] || 'Unknown'
    };
};

/**
 * Compara dois fingerprints para verificar se são do mesmo dispositivo
 *
 * @param {String} fingerprint1 - Primeiro fingerprint
 * @param {String} fingerprint2 - Segundo fingerprint
 * @returns {Boolean} True se forem idênticos
 */
const compareFingerprints = (fingerprint1, fingerprint2) => {
    return fingerprint1 === fingerprint2;
};

/**
 * Gera um fingerprint simplificado (para fallback)
 * Usa apenas User-Agent e IP
 *
 * @param {Object} req - Request object do Express
 * @returns {String} Hash MD5 simplificado (32 caracteres hex)
 */
const generateSimpleFingerprint = (req) => {
    const userAgent = req.headers['user-agent'] || '';
    const ip = req.ip || req.connection.remoteAddress || '';

    return crypto
        .createHash('md5')
        .update(`${userAgent}|${ip}`)
        .digest('hex');
};

module.exports = {
    generateDeviceFingerprint,
    parseDeviceInfo,
    compareFingerprints,
    generateSimpleFingerprint
};
