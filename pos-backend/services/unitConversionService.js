/**
 * Unit Conversion Service
 *
 * Converte unidades de medida entre recipe ingredient units e ingredient baseUnit.
 * Suporta: kg <-> g, L <-> ml, unidade, pacote, caixa.
 *
 * Cada GlobalIngredient tem:
 * - baseUnit: unidade base de estoque (g, kg, ml, L, unidade, pacote, caixa)
 * - conversionToBase: Map<unit, factor> — quantas unidades-base cabem em 1 unidade
 *
 * Exemplo para ingrediente com baseUnit='g':
 *   conversionToBase = { "kg": 1000, "g": 1, "pacote": 500 }
 *   → 1kg = 1000g, 1pacote = 500g
 *
 * Exemplo para ingrediente com baseUnit='ml':
 *   conversionToBase = { "L": 1000, "ml": 1 }
 *   → 1L = 1000ml
 */

// Unidades de peso e seus fatores relativos a gramas
const WEIGHT_UNITS = {
    g: 1,
    kg: 1000
};

// Unidades de volume e seus fatores relativos a ml
const VOLUME_UNITS = {
    ml: 1,
    L: 1000
};

// Unidades countaveis (sem conversao automatica entre si)
const COUNTABLE_UNITS = new Set(['unidade', 'pacote', 'caixa']);

/**
 * Determina a categoria da unidade (weight, volume, countable)
 */
function getCategory(unit) {
    if (WEIGHT_UNITS[unit] !== undefined) return 'weight';
    if (VOLUME_UNITS[unit] !== undefined) return 'volume';
    if (COUNTABLE_UNITS.has(unit)) return 'countable';
    return null;
}

/**
 * Converte uma quantidade de uma unidade para a unidade base do ingrediente.
 *
 * @param {number} quantity - Quantidade na unidade de origem
 * @param {string} fromUnit - Unidade de origem (ex: "kg", "unidade")
 * @param {string} baseUnit - Unidade base do ingrediente (ex: "g", "ml")
 * @param {object} [conversionFactors] - Map de fatores customizados do ingrediente
 * @returns {{ quantityInBase: number, appliedFactor: number }}
 */
function toBaseUnit(quantity, fromUnit, baseUnit, conversionFactors = {}) {
    if (!quantity || quantity <= 0) {
        throw new Error('Quantity must be a positive number');
    }
    if (!fromUnit || !baseUnit) {
        throw new Error('fromUnit and baseUnit are required');
    }

    // Mesma unidade — sem conversao
    if (fromUnit === baseUnit) {
        return { quantityInBase: quantity, appliedFactor: 1 };
    }

    // Se tem fator customizado no ingrediente, usar primeiro (antes de verificar categoria)
    // Isso permite cross-category conversions como pacote -> g quando ha fator explicito
    if (conversionFactors && conversionFactors[fromUnit] !== undefined) {
        const factor = conversionFactors[fromUnit];
        return { quantityInBase: quantity * factor, appliedFactor: factor };
    }

    const fromCategory = getCategory(fromUnit);
    const baseCategory = getCategory(baseUnit);

    // Categorias incompativeis (ex: kg -> unidade) — apenas quando nao ha fator customizado
    if (fromCategory && baseCategory && fromCategory !== baseCategory) {
        throw new Error(
            `Incompatible units: cannot convert ${fromUnit} (${fromCategory}) to ${baseUnit} (${baseCategory})`
        );
    }

    // Peso: converter para base via fatores fixos
    if (fromCategory === 'weight' && baseCategory === 'weight') {
        const fromFactor = WEIGHT_UNITS[fromUnit];
        const baseFactor = WEIGHT_UNITS[baseUnit];
        if (fromFactor === undefined || baseFactor === undefined) {
            throw new Error(`Unknown weight unit: ${fromUnit} or ${baseUnit}`);
        }
        // Converter: fromUnit -> g -> baseUnit
        const quantityInGrams = quantity * fromFactor;
        const quantityInBase = quantityInGrams / baseFactor;
        return { quantityInBase, appliedFactor: fromFactor / baseFactor };
    }

    // Volume: converter para base via fatores fixos
    if (fromCategory === 'volume' && baseCategory === 'volume') {
        const fromFactor = VOLUME_UNITS[fromUnit];
        const baseFactor = VOLUME_UNITS[baseUnit];
        if (fromFactor === undefined || baseFactor === undefined) {
            throw new Error(`Unknown volume unit: ${fromUnit} or ${baseUnit}`);
        }
        const quantityInMl = quantity * fromFactor;
        const quantityInBase = quantityInMl / baseFactor;
        return { quantityInBase, appliedFactor: fromFactor / baseFactor };
    }

    // Countable: se unidades sao iguais, ja tratado acima.
    // Se sao diferentes (pacote -> caixa), precisa de fator customizado.
    if (fromCategory === 'countable' && baseCategory === 'countable') {
        throw new Error(
            `Conversion from ${fromUnit} to ${baseUnit} requires explicit factor on ingredient's conversionToBase`
        );
    }

    // Unidade desconhecida
    if (!fromCategory) {
        throw new Error(`Unknown unit: ${fromUnit}`);
    }
    if (!baseCategory) {
        throw new Error(`Unknown baseUnit: ${baseUnit}`);
    }

    throw new Error(`Cannot convert ${fromUnit} to ${baseUnit}`);
}

/**
 * Converte de unidade base para outra unidade (inverso de toBaseUnit).
 *
 * @param {number} quantityInBase - Quantidade na unidade base
 * @param {string} toUnit - Unidade de destino
 * @param {string} baseUnit - Unidade base do ingrediente
 * @param {object} [conversionFactors]
 * @returns {{ quantity: number, appliedFactor: number }}
 */
function fromBaseUnit(quantityInBase, toUnit, baseUnit, conversionFactors = {}) {
    if (!quantityInBase || quantityInBase < 0) {
        throw new Error('Quantity must be a non-negative number');
    }
    if (!toUnit || !baseUnit) {
        throw new Error('toUnit and baseUnit are required');
    }

    if (toUnit === baseUnit) {
        return { quantity: quantityInBase, appliedFactor: 1 };
    }

    // Fator customizado inverso
    if (conversionFactors && conversionFactors[toUnit] !== undefined) {
        const factor = conversionFactors[toUnit];
        return { quantity: quantityInBase / factor, appliedFactor: 1 / factor };
    }

    const toCategory = getCategory(toUnit);
    const baseCategory = getCategory(baseUnit);

    if (toCategory === 'weight' && baseCategory === 'weight') {
        const toFactor = WEIGHT_UNITS[toUnit];
        const baseFactor = WEIGHT_UNITS[baseUnit];
        const quantity = (quantityInBase * baseFactor) / toFactor;
        return { quantity, appliedFactor: baseFactor / toFactor };
    }

    if (toCategory === 'volume' && baseCategory === 'volume') {
        const toFactor = VOLUME_UNITS[toUnit];
        const baseFactor = VOLUME_UNITS[baseUnit];
        const quantity = (quantityInBase * baseFactor) / toFactor;
        return { quantity, appliedFactor: baseFactor / toFactor };
    }

    throw new Error(`Cannot convert from ${baseUnit} to ${toUnit}`);
}

/**
 * Valida se uma unidade e compativel com a unidade base do ingrediente.
 *
 * @param {string} unit - Unidade a validar
 * @param {string} baseUnit - Unidade base do ingrediente
 * @returns {{ valid: boolean, reason: string|null }}
 */
function validateUnit(unit, baseUnit) {
    if (!unit) {
        return { valid: false, reason: 'Unit is required' };
    }
    if (!baseUnit) {
        return { valid: false, reason: 'baseUnit is required' };
    }
    if (unit === baseUnit) {
        return { valid: true, reason: null };
    }

    const unitCategory = getCategory(unit);
    const baseCategory = getCategory(baseUnit);

    if (!unitCategory) {
        return { valid: false, reason: `Unknown unit: ${unit}` };
    }
    if (!baseCategory) {
        return { valid: false, reason: `Unknown baseUnit: ${baseUnit}` };
    }
    if (unitCategory !== baseCategory) {
        return { valid: false, reason: `Incompatible: ${unit} (${unitCategory}) cannot convert to ${baseUnit} (${baseCategory})` };
    }

    return { valid: true, reason: null };
}

/**
 * Calcula a quantidade real a ser baixada do estoque, convertendo
 * a unidade da receita para a unidade base do ingrediente.
 *
 * Formula completa:
 *   grossQuantity = netQuantity * (1 + lossFactor / 100) * recipeQuantity
 *   quantityInBaseUnit = convert(grossQuantity, recipeUnit, ingredient.baseUnit, ingredient.conversionToBase)
 *
 * @param {object} recipeIngredient - Ingrediente da receita
 * @param {number} recipeQuantity - Quantidade de receitas sendo produzidas
 * @param {object} globalIngredient - GlobalIngredient com baseUnit e conversionToBase
 * @returns {{ grossQuantity: number, quantityInBase: number, appliedUnit: string, appliedFactor: number }}
 */
function calculateConsumption(recipeIngredient, recipeQuantity, globalIngredient) {
    const { netQuantity, lossFactor = 0, unit } = recipeIngredient;
    const { baseUnit, conversionToBase } = globalIngredient;

    if (!netQuantity || netQuantity <= 0) {
        throw new Error('netQuantity must be positive');
    }

    // Quantidade bruta com perda e multiplicador de receita
    const grossQuantity = netQuantity * (1 + lossFactor / 100) * recipeQuantity;

    // Converter para unidade base do ingrediente
    const factors = conversionToBase ? Object.fromEntries(conversionToBase) : {};
    const { quantityInBase, appliedFactor } = toBaseUnit(grossQuantity, unit, baseUnit, factors);

    return {
        grossQuantity: Math.round(grossQuantity * 10000) / 10000,
        quantityInBase: Math.round(quantityInBase * 10000) / 10000,
        appliedUnit: baseUnit,
        appliedFactor
    };
}

module.exports = {
    toBaseUnit,
    fromBaseUnit,
    validateUnit,
    calculateConsumption,
    // Exportados para testes e uso externo
    WEIGHT_UNITS,
    VOLUME_UNITS,
    COUNTABLE_UNITS,
    getCategory
};
