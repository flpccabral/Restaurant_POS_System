const mongoose = require("mongoose");

const kdsConfigSchema = new mongoose.Schema({
    store: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Store',
        required: true,
        unique: true,
        index: true
    },
    isEnabled: {
        type: Boolean,
        default: true
    },
    stations: [{
        _id: false,
        id: {
            type: String,
            required: true
        },
        name: {
            type: String,
            required: true
        },
        type: {
            type: String,
            enum: ['kitchen', 'bar', 'dessert', 'expo'],
            default: 'kitchen'
        },
        displayOrder: {
            type: Number,
            default: 0
        },
        autoRouteItems: {
            type: Boolean,
            default: true,
            comment: 'Se true, itens são rotados automaticamente para esta estação'
        },
        itemCategories: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Category'
        }],
        isActive: {
            type: Boolean,
            default: true
        },
        displaySettings: {
            theme: {
                type: String,
                enum: ['light', 'dark'],
                default: 'dark'
            },
            showItemImages: {
                type: Boolean,
                default: true
            },
            showModifiers: {
                type: Boolean,
                default: true
            },
            highlightAllergens: {
                type: Boolean,
                default: true
            },
            soundEnabled: {
                type: Boolean,
                default: true
            }
        }
    }],
    defaultStation: {
        type: String,
        default: 'kitchen',
        comment: 'Estação padrão para itens sem categoria específica'
    },
    slaSettings: {
        defaultPrepTime: {
            type: Number,
            default: 15,
            comment: 'Tempo padrão de preparo em minutos'
        },
        urgentThreshold: {
            type: Number,
            default: 5,
            comment: 'Minutos para considerar pedido como urgente'
        },
        lateThreshold: {
            type: Number,
            default: 10,
            comment: 'Minutos de atraso para alertas'
        }
    },
    displaySettings: {
        refreshInterval: {
            type: Number,
            default: 30,
            comment: 'Intervalo de refresh em segundos'
        },
        showOrderNumber: {
            type: Boolean,
            default: true
        },
        showTableNumber: {
            type: Boolean,
            default: true
        },
        showTimer: {
            type: Boolean,
            default: true
        },
        groupByTable: {
            type: Boolean,
            default: false
        },
        sortOrdersBy: {
            type: String,
            enum: ['time', 'table', 'priority'],
            default: 'time'
        }
    }
}, { timestamps: true });

// Índices
kdsConfigSchema.index({ store: 1, isEnabled: 1 });

// Método para obter estações ativas
kdsConfigSchema.methods.getActiveStations = function() {
    return this.stations.filter(s => s.isActive);
};

// Método para obter estação por ID
kdsConfigSchema.methods.getStationById = function(stationId) {
    return this.stations.find(s => s.id === stationId);
};

// Método para verificar se item deve ir para estação
kdsConfigSchema.methods.shouldRouteToStation = function(stationId, itemCategory) {
    const station = this.getStationById(stationId);
    if (!station || !station.autoRouteItems) return false;

    if (!station.itemCategories || station.itemCategories.length === 0) {
        return true; // Estação recebe todos os itens se não houver categorias
    }

    return station.itemCategories.some(cat => cat.toString() === itemCategory.toString());
};

// Método estático para obter config da loja
kdsConfigSchema.statics.getStoreConfig = async function(storeId) {
    let config = await this.findOne({ store: storeId });

    if (!config) {
        // Criar config padrão
        config = await this.create({
            store: storeId,
            isEnabled: true,
            stations: [
                {
                    id: 'kitchen',
                    name: 'Cozinha',
                    type: 'kitchen',
                    displayOrder: 1,
                    autoRouteItems: true,
                    isActive: true
                },
                {
                    id: 'bar',
                    name: 'Bar',
                    type: 'bar',
                    displayOrder: 2,
                    autoRouteItems: true,
                    isActive: true
                },
                {
                    id: 'expo',
                    name: 'Expedição',
                    type: 'expo',
                    displayOrder: 3,
                    autoRouteItems: false,
                    isActive: true
                }
            ],
            defaultStation: 'kitchen'
        });
    }

    return config;
};

module.exports = mongoose.model("KDSConfig", kdsConfigSchema);
