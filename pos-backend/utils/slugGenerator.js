/**
 * Gerador de Slugs para SKUs de Produtos
 *
 * Cria slugs únicos baseados em nome do produto e variação
 * Ex: "Hambúrguer Artesanal" + "Grande" = "hamburguer-artesanal-grande"
 */

/**
 * Normaliza string para formato slug
 * @param {string} str - String a ser normalizada
 * @returns {string} - Slug formatado
 */
const normalize = (str) => {
    if (!str) return '';

    return str
        .toLowerCase()
        .normalize('NFD')
        .replace(/[̀-ͯ]/g, '') // Remove acentos
        .replace(/[^a-z0-9]/g, '-')      // Substitui não-alfanuméricos por -
        .replace(/-+/g, '-')             // Remove múltiplos hífens
        .replace(/^-|-$/g, '');          // Remove hífens nas extremidades
};

/**
 * Gera slug para produto
 * @param {string} productName - Nome do produto
 * @param {string} variationName - Nome da variação (opcional)
 * @returns {string} - Slug gerado
 */
const generateProductSlug = (productName, variationName = null) => {
    const baseSlug = normalize(productName);
    const variationSlug = variationName ? '-' + normalize(variationName) : '';

    return `${baseSlug}${variationSlug}`;
};

/**
 * Gera SKU único verificando existentes
 * @param {string} productName - Nome do produto
 * @param {string} variationName - Nome da variação
 * @param {Array} existingSkus - Lista de SKUs já existentes
 * @returns {string} - SKU único
 */
const generateUniqueSku = (productName, variationName, existingSkus = []) => {
    let baseSku = generateProductSlug(productName, variationName);

    if (!existingSkus.includes(baseSku)) {
        return baseSku;
    }

    // Adicionar contador se SKU já existir
    let counter = 1;
    let uniqueSku = `${baseSku}-${counter}`;

    while (existingSkus.includes(uniqueSku)) {
        counter++;
        uniqueSku = `${baseSku}-${counter}`;
    }

    return uniqueSku;
};

/**
 * Gera slug para categoria
 * @param {string} categoryName - Nome da categoria
 * @returns {string} - Slug da categoria
 */
const generateCategorySlug = (categoryName) => {
    return normalize(categoryName);
};

/**
 * Gera slug para atributo
 * @param {string} attributeName - Nome do atributo
 * @returns {string} - Slug do atributo
 */
const generateAttributeSlug = (attributeName) => {
    return normalize(attributeName);
};

module.exports = {
    normalize,
    generateProductSlug,
    generateUniqueSku,
    generateCategorySlug,
    generateAttributeSlug
};
