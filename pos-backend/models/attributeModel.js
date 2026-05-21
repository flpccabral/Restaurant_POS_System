const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

// Subdocumento de Opção do Atributo
const optionSchema = new mongoose.Schema({
    optionId: {
        type: String,
        default: uuidv4
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    price: {
        type: Number,
        default: 0,
        min: 0
    }
}, { _id: false });

const attributeSchema = new mongoose.Schema({
    attributeId: {
        type: String,
        default: uuidv4,
        unique: true,
        index: true,
        immutable: true
    },
    store: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
        required: true,
        index: true
    },
    name: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true,
        maxlength: 500
    },
    isRequired: {
        type: Boolean,
        default: false,
        index: true
    },
    minSelected: {
        type: Number,
        default: 0,
        min: 0
    },
    maxSelected: {
        type: Number,
        default: null,
        min: 0
    },
    options: {
        type: [optionSchema],
        default: [],
        validate: {
            validator: function(options) {
                // Se for obrigatório, deve ter pelo menos 1 opção e minSelected >= 1
                if (this.isRequired && (options.length === 0 || this.minSelected < 1)) {
                    return false;
                }
                return true;
            },
            message: 'Required attributes must have at least 1 option and minSelected >= 1'
        }
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    }
}, { timestamps: true });

// Índices compostos
attributeSchema.index({ store: 1, name: 1 }, { unique: true });
attributeSchema.index({ store: 1, isActive: 1 });

// Validar minSelected quando isRequired for true
attributeSchema.path('minSelected').validate(function(value) {
    if (this.isRequired && value < 1) {
        return false;
    }
    return true;
}, 'minSelected must be at least 1 for required attributes');

// Validar maxSelected >= minSelected
attributeSchema.path('maxSelected').validate(function(value) {
    if (value !== null && value < this.minSelected) {
        return false;
    }
    return true;
}, 'maxSelected must be greater than or equal to minSelected');

// Método para adicionar opção
attributeSchema.methods.addOption = async function(name, price = 0) {
    const option = {
        name,
        price
    };

    this.options.push(option);
    await this.save();
    return this.options[this.options.length - 1];
};

// Método para validar seleção de opções
attributeSchema.methods.validateSelection = function(selectedOptions) {
    const count = selectedOptions.length;

    if (this.isRequired && count < this.minSelected) {
        return {
            valid: false,
            message: `Minimum ${this.minSelected} option(s) required`
        };
    }

    if (this.maxSelected !== null && count > this.maxSelected) {
        return {
            valid: false,
            message: `Maximum ${this.maxSelected} option(s) allowed`
        };
    }

    return { valid: true };
};

module.exports = mongoose.model("Attribute", attributeSchema);
