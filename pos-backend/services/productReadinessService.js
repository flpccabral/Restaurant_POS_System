/**
 * Product Readiness Service — Fase 9.1A
 *
 * Analisa o status operacional de um produto vendável com base na regra
 * de impacto em estoque (stockImpactRule).
 *
 * Retorna um status consolidado que indica se o produto está pronto para
 * ser vendido sem causar problemas de rastreabilidade de estoque e CMV.
 */

const mongoose = require('mongoose');

/**
 * Tipos de retorno:
 *   ready_for_sale         → recipe_composition com Recipe ativa
 *   ready_direct_ok        → stock_item_direct com configuração válida
 *   ready_no_stock_impact  → no_stock_impact (sem baixa intencional)
 *   ready_missing_recipe   → recipe_composition sem Recipe ativa
 *   ready_missing_direct   → stock_item_direct com configuração inválida
 *   incomplete_config      → combo_components ou configuração desconhecida
 */

/**
 * Computa o status de readiness de um produto.
 *
 * @param {object} product - Documento do produto (populated ou não)
 * @returns {Promise<object>}
 */
const computeProductReadinessStatus = async (product) => {
    const Recipe = mongoose.model('Recipe');

    const result = {
        status: 'incomplete_config',
        label: 'Configuracao incompleta',
        severity: 'critical',
        reason: null,
        hasActiveRecipe: false
    };

    if (!product) {
        result.reason = 'Produto nao encontrado';
        return result;
    }

    const rule = product.stockImpactRule || 'recipe_composition';

    switch (rule) {
        case 'recipe_composition': {
            // Verificar se existe Recipe ativa
            const activeRecipe = await Recipe.findOne({
                store: product.store,
                product: product._id,
                isActive: true
            }).lean();

            result.hasActiveRecipe = !!activeRecipe;

            if (activeRecipe) {
                result.status = 'ready_for_sale';
                result.label = 'Pronto para venda (com receita)';
                result.severity = 'ok';
                result.reason = null;
            } else {
                result.status = 'ready_missing_recipe';
                result.label = 'Falta ficha tecnica';
                result.severity = 'warning';
                result.reason = 'Produto recipe_composition sem ficha tecnica ativa';
            }
            break;
        }

        case 'stock_item_direct': {
            const hasValidConfig = product.directStockItem &&
                product.directStockQuantity > 0 &&
                product.directStockUnit;

            if (hasValidConfig) {
                result.status = 'ready_direct_ok';
                result.label = 'Pronto para venda (baixa direta)';
                result.severity = 'ok';
                result.reason = null;
            } else {
                result.status = 'ready_missing_direct';
                result.label = 'Falta configuracao de baixa direta';
                result.severity = 'warning';
                result.reason = 'stock_item_direct sem directStockItem, quantidade ou unidade';
            }
            break;
        }

        case 'no_stock_impact': {
            result.status = 'ready_no_stock_impact';
            result.label = 'Sem impacto em estoque';
            result.severity = 'ok';
            result.reason = null;
            break;
        }

        case 'combo_components': {
            result.status = 'incomplete_config';
            result.label = 'Combo nao implementado';
            result.severity = 'critical';
            result.reason = 'combo_components nao implementado — usar composicao manual';
            break;
        }

        default: {
            result.status = 'incomplete_config';
            result.label = 'Regra de impacto desconhecida';
            result.severity = 'critical';
            result.reason = `stockImpactRule '${rule}' nao reconhecida`;
            break;
        }
    }

    return result;
};

module.exports = {
    computeProductReadinessStatus
};
