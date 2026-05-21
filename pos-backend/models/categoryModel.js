const mongoose = require("mongoose");
const { v4: uuidv4 } = require("uuid");

const categorySchema = new mongoose.Schema({
    categoryId: {
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
    image: {
        type: String,
        trim: true
    },
    order: {
        type: Number,
        default: 0,
        index: true
    },
    isActive: {
        type: Boolean,
        default: true,
        index: true
    }
}, { timestamps: true });

// Índice composto para unicidade de nome por loja
categorySchema.index({ store: 1, name: 1 }, { unique: true });
categorySchema.index({ store: 1, isActive: 1, order: 1 });

// Auto-increment do campo order antes de salvar
categorySchema.pre('save', async function(next) {
    if (this.isNew) {
        try {
            // Buscar a categoria com maior order na mesma loja
            const maxCategory = await this.constructor.findOne({ store: this.store })
                .sort({ order: -1 })
                .select('order');

            if (maxCategory && maxCategory.order !== undefined) {
                this.order = maxCategory.order + 1;
            } else {
                this.order = 0;
            }
        } catch (error) {
            return next(error);
        }
    }
    next();
});

// Método para mover categoria na ordem
categorySchema.methods.moveOrder = async function(newOrder) {
    const oldOrder = this.order;

    if (newOrder === oldOrder) return this;

    const categories = await this.constructor.find({ store: this.store }).sort({ order: 1 });

    // Remover categoria atual da lista
    const currentIndex = categories.findIndex(c => c._id.toString() === this._id.toString());
    if (currentIndex !== -1) {
        categories.splice(currentIndex, 1);
    }

    // Inserir na nova posição
    categories.splice(newOrder, 0, this);

    // Atualizar ordem de todas as categorias
    for (let i = 0; i < categories.length; i++) {
        categories[i].order = i;
        await categories[i].save();
    }

    this.order = newOrder;
    return this;
};

module.exports = mongoose.model("Category", categorySchema);
